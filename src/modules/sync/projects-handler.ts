/**
 * Zoho Projects webhook handler.
 * Normalizes incoming task payloads and creates/updates Paperclip Issues.
 * Auto-links Paperclip Projects when a new Zoho project is seen.
 * Routes to the correct Company via Zoho Project Group name (primary)
 * or agent tag org prefix (fallback).
 *
 * Ported from task-webhook.py normalize_projects_payload.
 */

import type { PluginContext } from "@paperclipai/plugin-sdk";
import { PRIORITY_MAP, PROJECTS_STATUS_MAP } from "../../constants.js";
import type { GroupMappingEntry, NormalizedProjectsTask, ProjectMappingEntry } from "../../lib/types.js";
import { projectsFetch } from "../../lib/zoho-client.js";
import { resolveAgent } from "./agent-mapping.js";
import {
  claimInboundEvent,
  consumeInboundSuppression,
  eventFingerprint,
  suppressNextOutbound,
} from "./sync-guard.js";
import { PROJECTS_TASK_ORIGIN_KIND, saveTaskMapping } from "./task-mapping.js";

/**
 * Parse the raw webhook body — handles both JSON and form-encoded (data=<JSON>).
 */
export function parseWebhookBody(rawBody: string, parsedBody: unknown): unknown {
  if (parsedBody && typeof parsedBody === "object") return parsedBody;
  try {
    return JSON.parse(rawBody);
  } catch {
    // Fall through to form-encoded
  }
  try {
    const params = new URLSearchParams(rawBody);
    const dataField = params.get("data") ?? params.get("json");
    if (dataField) return JSON.parse(decodeURIComponent(dataField));
  } catch {
    // Fall through
  }
  throw new Error("Could not parse webhook body");
}

/**
 * Extract agent tags from the raw payload and task tags.
 * Returns parsed tags like ["nr:kelly", "hb:diana"] and the first org prefix found.
 */
function extractAgentTags(raw: Record<string, unknown>, taskTags?: string[]): { agentTags: string[]; orgPrefix?: string } {
  const agentTags: string[] = [];

  // From raw.agentTags field (set by Deluge)
  const agentTagsStr = (raw.agentTags as string) ?? "";
  if (agentTagsStr) {
    const parsed = agentTagsStr
      .replace(/[\[\]]/g, "")
      .split(",")
      .map((t) => t.trim().replace(/['"]/g, ""))
      .filter(Boolean);
    agentTags.push(...parsed);
  }

  // From task tags (e.g. {name: "nr:kelly"})
  if (taskTags) {
    for (const tag of taskTags) {
      if (tag.includes(":") && !agentTags.includes(tag)) {
        agentTags.push(tag);
      }
    }
  }

  // Extract org prefix from first agent tag
  let orgPrefix: string | undefined;
  for (const tag of agentTags) {
    if (tag.includes(":")) {
      orgPrefix = tag.split(":")[0].toLowerCase();
      break;
    }
  }

  return { agentTags, orgPrefix };
}

/**
 * Extract the task owner's display name across known Zoho task shapes:
 * v3 `owners_and_work.owners[]`, classic `details.owners[]`, or top-level
 * `owner_name`. Returns "" when unassigned, and treats Zoho's "Unassigned User"
 * placeholder as unassigned so it never masquerades as a real assignee.
 */
function extractOwnerName(task: Record<string, unknown>): string {
  const firstOwnerName = (owners: unknown): string => {
    if (Array.isArray(owners) && owners.length > 0) {
      const name = (owners[0] as Record<string, unknown>)?.name;
      return typeof name === "string" ? name.trim() : "";
    }
    return "";
  };
  const ow = task.owners_and_work as { owners?: unknown } | undefined;
  let name = firstOwnerName(ow?.owners);
  if (!name) {
    const details = task.details as { owners?: unknown } | undefined;
    name = firstOwnerName(details?.owners);
  }
  if (!name && typeof task.owner_name === "string") name = (task.owner_name as string).trim();
  return name === "Unassigned User" ? "" : name;
}

/**
 * Normalize a Zoho Projects webhook payload into a standard task structure.
 */
export function normalizeProjectsPayload(raw: Record<string, unknown>): NormalizedProjectsTask {
  const taskWrapper = (raw.Task ?? raw.task ?? {}) as Record<string, unknown>;

  let task: Record<string, unknown>;
  if (Array.isArray(taskWrapper.tasks) && taskWrapper.tasks.length > 0) {
    task = taskWrapper.tasks[0] as Record<string, unknown>;
  } else {
    task = taskWrapper;
  }

  // Custom fields
  const customFieldsArr = (task.custom_fields ?? []) as Array<{ label_name?: string; value?: string }>;
  const customFields: Record<string, string> = {};
  let assignedAgent = "";

  for (const cf of customFieldsArr) {
    const label = cf.label_name ?? "";
    const value = cf.value ?? "";
    customFields[label] = value;
    if (label === "Assigned Agent") assignedAgent = value;
  }

  // Fallback chain for assigned agent
  if (!assignedAgent) {
    const oldCf = (task.CF ?? task.cf ?? {}) as Record<string, string>;
    assignedAgent = oldCf["Assigned Agent"] ?? oldCf.assigned_agent ?? "";
  }
  if (!assignedAgent) {
    assignedAgent = (raw.assignedAgent as string) ?? "";
  }
  // Owner (client user) — the current Zoho model assigns work to client users
  // rather than the legacy "Assigned Agent" dropdown. Read the task owner's
  // display name across the known v3 (`owners_and_work.owners`) and classic
  // (`details.owners` / `owner_name`) shapes so a fetched task self-resolves.
  if (!assignedAgent) {
    assignedAgent = extractOwnerName(task);
  }

  // Tags
  const tagsRaw = task.tags as Array<{ name?: string }> | string[] | undefined;
  const tags = Array.isArray(tagsRaw)
    ? tagsRaw.map((t) => (typeof t === "string" ? t : t.name ?? ""))
    : undefined;

  // Extract agent tags and org prefix
  const { agentTags, orgPrefix } = extractAgentTags(raw, tags);

  // If still no assigned agent, derive from agent tags
  if (!assignedAgent && agentTags.length > 0) {
    const firstTag = agentTags[0];
    if (firstTag.includes(":")) {
      const name = firstTag.split(":")[1].trim();
      assignedAgent = name.charAt(0).toUpperCase() + name.slice(1);
    }
  }

  // Status
  const statusObj = task.status as Record<string, string> | string | undefined;
  const statusName =
    typeof statusObj === "object" && statusObj !== null ? statusObj.name ?? "" : String(statusObj ?? "");
  const statusType =
    typeof statusObj === "object" && statusObj !== null ? statusObj.type ?? "" : "";

  const completed =
    task.completed === true ||
    statusType.toLowerCase() === "closed" ||
    statusType.toLowerCase() === "completed" ||
    ["closed", "completed", "done"].includes(statusName.toLowerCase());

  // Project info
  const project = (raw.Project ?? raw.project ?? raw.Projects ?? {}) as Record<string, string>;

  // Last-updated marker (varies by Zoho payload shape) — feeds event de-dup so a
  // genuine later change isn't collapsed with an earlier identical-looking one.
  const updatedTime =
    (task.last_updated_time as string) ??
    (task.last_updated_time_long as string | number)?.toString() ??
    (task.last_updated_date as string) ??
    (task.updated_time as string) ??
    undefined;

  return {
    taskId: String(task.id ?? task.id_string ?? ""),
    taskName: (task.name ?? task.title ?? "") as string,
    description: (task.description as string) ?? undefined,
    projectId: project.id ?? project.PROJECTID ?? "",
    projectName: project.name ?? project.PROJECTNAME ?? undefined,
    status: statusName,
    statusType,
    priority: (task.priority as string) ?? undefined,
    assignee: assignedAgent.trim() || undefined,
    assignedAgent: assignedAgent.trim() || undefined,
    parentTaskId: (task.parent_task_id as string) ?? undefined,
    updatedTime,
    completed,
    customFields,
    tags,
    agentTags,
    orgPrefix,
    raw,
  };
}

/**
 * Parse the configured project allowlist (comma/space/newline-separated ids).
 * Empty / unset → empty set, which the caller treats as "allow all".
 */
export function parseAllowedProjectIds(raw: string | undefined | null): Set<string> {
  if (!raw) return new Set();
  return new Set(
    raw
      .split(/[\s,]+/)
      .map((id) => id.trim())
      .filter(Boolean),
  );
}

/**
 * Whether a Zoho project is allowed to sync given the configured allowlist.
 * An empty allowlist allows every (mapped) project — backward-compatible default.
 */
export function isProjectAllowed(projectId: string, allowed: Set<string>): boolean {
  return allowed.size === 0 || allowed.has(projectId);
}

function mapPriority(zohoPriority: string | undefined): "low" | "medium" | "high" | "critical" {
  if (!zohoPriority) return "low";
  return (PRIORITY_MAP[zohoPriority.toLowerCase()] ?? "low") as "low" | "medium" | "high" | "critical";
}

function mapStatus(zohoStatus: string): string {
  if (!zohoStatus) return "todo";
  return PROJECTS_STATUS_MAP[zohoStatus.toLowerCase()] ?? "in_progress";
}

type IssueStatus = "todo" | "in_progress" | "blocked" | "in_review" | "done" | "cancelled" | "backlog";

// ─── State helpers ──────────────────────────────────────────────────────────

async function getProjectMapping(ctx: PluginContext): Promise<ProjectMappingEntry[]> {
  return ((await ctx.state.get({ scopeKind: "instance", stateKey: "zoho.projectMapping" })) as ProjectMappingEntry[] | null) ?? [];
}

async function saveProjectMapping(ctx: PluginContext, mapping: ProjectMappingEntry[]): Promise<void> {
  await ctx.state.set({ scopeKind: "instance", stateKey: "zoho.projectMapping" }, mapping);
}

// ─── State helpers (groups) ──────────────────────────────────────────────────

async function getGroupMappings(ctx: PluginContext): Promise<GroupMappingEntry[]> {
  return ((await ctx.state.get({ scopeKind: "instance", stateKey: "zoho.groupMapping" })) as GroupMappingEntry[] | null) ?? [];
}

// ─── Company resolution ─────────────────────────────────────────────────────

/**
 * Resolve the Paperclip company ID for a Zoho project.
 *
 * Strategy (in order):
 * 1. Fetch the project's group name from Zoho API → match to group mapping
 * 2. If no group mapping configured, try matching group name to Paperclip company name
 * 3. Fall back to single company if only one exists
 */
export async function resolveCompanyId(
  ctx: PluginContext,
  zohoProjectId: string,
): Promise<string | null> {
  // Step 1: Try to get the project group from Zoho API
  const groupName = await fetchProjectGroupName(ctx, zohoProjectId);

  if (groupName) {
    // Check configured group mappings
    const groupMappings = await getGroupMappings(ctx);
    if (groupMappings.length > 0) {
      const match = groupMappings.find(
        (g) => g.groupName.toLowerCase() === groupName.toLowerCase(),
      );
      if (match) {
        ctx.logger.info(`Resolved company from project group "${groupName}" → ${match.companyName ?? match.companyId}`);
        return match.companyId;
      }
    }

    // No explicit group mapping — try matching group name to Paperclip company name
    const companies = await ctx.companies.list({ limit: 50, offset: 0 });
    const companyMatch = companies.find(
      (c) => c.name?.toLowerCase() === groupName.toLowerCase(),
    );
    if (companyMatch) {
      ctx.logger.info(`Resolved company from project group "${groupName}" → company "${companyMatch.name}" (name match)`);
      return companyMatch.id;
    }
  }

  // Step 2: Single company fallback
  const companies = await ctx.companies.list({ limit: 10, offset: 0 });
  if (companies.length === 1) return companies[0].id;

  return null;
}

/**
 * Fetch the project group name from the Zoho Projects API.
 * Returns null if the API call fails or the project has no group.
 */
async function fetchProjectGroupName(ctx: PluginContext, zohoProjectId: string): Promise<string | null> {
  const config = (await ctx.config.get()) as { portalId?: string };
  if (!config.portalId) {
    ctx.logger.debug("No portalId configured, skipping project group lookup");
    return null;
  }

  try {
    const result = await projectsFetch(
      ctx,
      "GET",
      `/portal/${config.portalId}/projects/${zohoProjectId}/`,
    );

    if (!result.ok) {
      ctx.logger.debug(`Failed to fetch project ${zohoProjectId}: ${result.status}`);
      return null;
    }

    const data = result.data as Record<string, unknown>;
    // Zoho Projects API returns group info in the project response
    // The field name varies — check common patterns
    const projects = (data.projects ?? [data]) as Array<Record<string, unknown>>;
    const project = projects[0];
    if (!project) return null;

    // Try known field names for project group. The classic `restapi` response
    // historically exposes `group_name`/`GROUP_NAME`/`group.name`, but Zoho has
    // been converging the classic and v3 APIs — v3 nests the group under
    // `project_group.name` (verified live for PR-90 on 2026-06-12, NEO-104). Read
    // every known shape so group→company resolution survives either response.
    const projectGroup = project.project_group as Record<string, string> | undefined;
    const groupName =
      (project.group_name as string) ??
      (project.GROUP_NAME as string) ??
      ((project.group as Record<string, string>)?.name) ??
      projectGroup?.name ??
      projectGroup?.GROUP_NAME ??
      null;

    return groupName || null;
  } catch (error) {
    ctx.logger.debug(`Error fetching project group for ${zohoProjectId}: ${error instanceof Error ? error.message : String(error)}`);
    return null;
  }
}

// ─── Auto-create project ────────────────────────────────────────────────────

/**
 * Auto-link a Zoho project to an existing Paperclip Project by name match.
 * If no match is found, logs a warning — projects must be created manually in Paperclip.
 */
async function autoLinkProject(
  ctx: PluginContext,
  zohoProjectId: string,
  zohoProjectName: string | undefined,
  companyId: string,
): Promise<ProjectMappingEntry | null> {
  const projectName = zohoProjectName || "";

  try {
    const existing = await ctx.projects.list({ companyId, limit: 200, offset: 0 });

    // Try exact name match
    let match = existing.find((p) => p.name === projectName);

    // Try case-insensitive match
    if (!match && projectName) {
      const lower = projectName.toLowerCase();
      match = existing.find((p) => p.name?.toLowerCase() === lower);
    }

    if (!match) {
      ctx.logger.warn(
        `No Paperclip project matches Zoho project "${projectName}" (${zohoProjectId}) in company ${companyId}. Create the project in Paperclip, or add a manual mapping in plugin settings.`,
      );
      return null;
    }

    ctx.logger.info(`Auto-linked Zoho project "${projectName}" → Paperclip project "${match.name}" (${match.id})`);

    const entry: ProjectMappingEntry = {
      zohoProjectId,
      zohoProjectName: projectName,
      paperclipProjectId: match.id,
      paperclipCompanyId: companyId,
    };

    const mappings = await getProjectMapping(ctx);
    mappings.push(entry);
    await saveProjectMapping(ctx, mappings);

    return entry;
  } catch (error) {
    ctx.logger.error(`Failed to auto-link project for Zoho project ${zohoProjectId}: ${error instanceof Error ? error.message : String(error)}`);
    return null;
  }
}

// ─── Thin-ping hydration ─────────────────────────────────────────────────────
// The Zoho workflow function can send either the full task payload OR a thin
// "notification" — just the record type + id. The thin shape keeps the Deluge
// trivial: it tells us *what changed* and we pull the authoritative record from
// the Zoho API ourselves (we already hold an OAuth token for it). Backward
// compatible: a payload that already carries an inline Task body is used as-is.

function firstString(obj: Record<string, unknown>, keys: string[]): string | undefined {
  for (const k of keys) {
    const v = obj[k];
    if (typeof v === "string" && v.trim() !== "") return v.trim();
    if (typeof v === "number") return String(v);
  }
  return undefined;
}

/** True when the payload already carries task content (full payload, not a ping). */
function hasInlineTaskBody(raw: Record<string, unknown>): boolean {
  const tw = (raw.Task ?? raw.task) as Record<string, unknown> | undefined;
  if (!tw || typeof tw !== "object") return false;
  const arr = (tw as { tasks?: unknown }).tasks;
  const t = (Array.isArray(arr) && arr.length > 0 ? arr[0] : tw) as Record<string, unknown>;
  return Boolean(t && (t.name ?? t.title ?? t.status ?? t.priority ?? t.description));
}

/** Pull {taskId, projectId} out of a thin notification payload, if present. */
export function findThinTaskRef(raw: Record<string, unknown>): { taskId: string; projectId: string } | null {
  const taskId = firstString(raw, ["taskId", "task_id", "taskid", "recordId", "id"]);
  if (!taskId) return null;
  const projectId =
    firstString(raw, ["projectId", "project_id", "projectid"]) ??
    firstString((raw.Project ?? raw.project ?? {}) as Record<string, unknown>, ["id", "PROJECTID"]);
  if (!projectId) return null;
  return { taskId, projectId };
}

async function fetchTaskById(
  ctx: PluginContext,
  portalId: string,
  projectId: string,
  taskId: string,
): Promise<Record<string, unknown> | null> {
  try {
    const res = await projectsFetch(ctx, "GET", `/portal/${portalId}/projects/${projectId}/tasks/${taskId}/`);
    if (!res.ok) {
      ctx.logger.warn(`Thin ping: failed to fetch task ${taskId} in project ${projectId}: ${res.status}`);
      return null;
    }
    const data = res.data as Record<string, unknown>;
    const tasks = (data.tasks ?? (data.task ? [data.task] : [data])) as Array<Record<string, unknown>>;
    return tasks[0] ?? null;
  } catch (error) {
    ctx.logger.warn(`Thin ping: error fetching task ${taskId}: ${error instanceof Error ? error.message : String(error)}`);
    return null;
  }
}

/**
 * Normalize an inbound payload to the full shape `normalizeProjectsPayload`
 * expects. If the payload is already a full task body it is returned unchanged;
 * if it is a thin `{type:"task", taskId, projectId}` ping, the task is fetched
 * from the Zoho API and wrapped. Non-task pings (e.g. project/users) are left
 * untouched and fall through to the existing "no task id" no-op.
 */
export async function hydrateInboundPayload(
  ctx: PluginContext,
  raw: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  if (hasInlineTaskBody(raw)) return raw;
  const ref = findThinTaskRef(raw);
  if (!ref) return raw;

  const config = (await ctx.config.get()) as { portalId?: string };
  const portalId = firstString(raw, ["portalId", "portal_id"]) ?? config.portalId;
  if (!portalId) {
    ctx.logger.warn(`Thin task ping for ${ref.taskId} but no portalId configured/provided — cannot hydrate`);
    return raw;
  }

  const task = await fetchTaskById(ctx, portalId, ref.projectId, ref.taskId);
  if (!task) return raw;

  ctx.logger.info(`Hydrated thin task ping ${ref.taskId} (project ${ref.projectId}) from the Zoho API`);
  const hydrated: Record<string, unknown> = {
    Task: task,
    Project: { id: ref.projectId },
    source: "projects",
  };
  if (raw.assignedAgent) hydrated.assignedAgent = raw.assignedAgent;
  if (raw.agentTags) hydrated.agentTags = raw.agentTags;
  return hydrated;
}

async function fetchProjectName(
  ctx: PluginContext,
  portalId: string,
  projectId: string,
): Promise<string | undefined> {
  try {
    const res = await projectsFetch(ctx, "GET", `/portal/${portalId}/projects/${projectId}/`);
    if (!res.ok) return undefined;
    const data = res.data as Record<string, unknown>;
    const project = ((data.projects ?? [data]) as Array<Record<string, unknown>>)[0];
    const name = (project?.name ?? project?.PROJECTNAME) as unknown;
    return typeof name === "string" ? name : undefined;
  } catch {
    return undefined;
  }
}

/**
 * Handle a thin `type:"project"` notification. We never create issues from a
 * project event — instead we ensure the Zoho project is linked to a Paperclip
 * project so its tasks route immediately. Safe no-op when the project is already
 * mapped, not allowlisted, has no resolvable company, or has no matching
 * Paperclip project (autoLinkProject logs guidance in that case).
 */
export async function handleProjectNotification(
  ctx: PluginContext,
  raw: Record<string, unknown>,
): Promise<void> {
  const projectId =
    firstString(raw, ["projectId", "project_id", "projectid"]) ??
    firstString((raw.Project ?? raw.project ?? {}) as Record<string, unknown>, ["id", "PROJECTID"]);
  if (!projectId) {
    ctx.logger.debug("Project notification without a project id — ignoring");
    return;
  }

  const config = (await ctx.config.get()) as { allowedProjectIds?: string; portalId?: string };
  if (!isProjectAllowed(projectId, parseAllowedProjectIds(config.allowedProjectIds))) {
    ctx.logger.info(`Project notification ${projectId} not in the configured allowlist — ignoring`);
    return;
  }

  const mappings = await getProjectMapping(ctx);
  if (mappings.some((m) => m.zohoProjectId === projectId)) {
    ctx.logger.info(`Project notification ${projectId}: already linked — nothing to do`);
    return;
  }

  const companyId = await resolveCompanyId(ctx, projectId);
  if (!companyId) {
    ctx.logger.info(`Project notification ${projectId}: no company resolved — add a group mapping in settings`);
    return;
  }

  const portalId = firstString(raw, ["portalId", "portal_id"]) ?? config.portalId;
  const name = portalId ? await fetchProjectName(ctx, portalId, projectId) : undefined;
  await autoLinkProject(ctx, projectId, name, companyId);
}

// ─── Main handler ───────────────────────────────────────────────────────────

/**
 * Handle an inbound Zoho Projects webhook event.
 * Creates or updates a Paperclip Issue. Auto-creates projects as needed.
 */
export async function handleProjectsWebhook(
  ctx: PluginContext,
  rawBody: string,
  parsedBody: unknown,
): Promise<void> {
  const parsed = parseWebhookBody(rawBody, parsedBody) as Record<string, unknown>;

  // Route project-type notifications (no task) to the project linker.
  if (typeof parsed.type === "string" && parsed.type.toLowerCase() === "project") {
    await handleProjectNotification(ctx, parsed);
    return;
  }

  const raw = await hydrateInboundPayload(ctx, parsed);
  const normalized = normalizeProjectsPayload(raw);

  if (!normalized.taskId) {
    ctx.logger.debug("Zoho Projects webhook has no task id — ignoring");
    return;
  }

  // ─── Project allowlist: bound writes to explicitly-permitted projects ───────
  // When pointed at a live/production portal (no sandbox available) the operator
  // can list a dedicated test project's id here; the plugin then refuses to act
  // on any other project so real production tasks are never mirrored or mutated.
  // An empty allowlist preserves the prior "all mapped projects" behavior.
  const allowConfig = (await ctx.config.get()) as { allowedProjectIds?: string };
  const allowed = parseAllowedProjectIds(allowConfig.allowedProjectIds);
  if (!isProjectAllowed(normalized.projectId, allowed)) {
    ctx.logger.info(
      `Zoho project ${normalized.projectId} is not in the configured allowlist (${[...allowed].join(", ")}) — ignoring task ${normalized.taskId}`,
    );
    return;
  }

  // ─── Idempotency: drop duplicate / out-of-order webhook deliveries ──────────
  // Fingerprint the semantic end-state (+ Zoho's update marker when present), so
  // an at-least-once redelivery of the same event is a no-op while a genuine new
  // change produces a distinct fingerprint and is processed.
  const fingerprint = eventFingerprint([
    "projects-task",
    normalized.taskId,
    normalized.updatedTime,
    normalized.status,
    normalized.completed,
    normalized.priority,
    normalized.assignedAgent,
    normalized.taskName,
    normalized.description,
  ]);
  if (!(await claimInboundEvent(ctx, fingerprint))) {
    ctx.logger.info(`Duplicate Zoho task webhook for ${normalized.taskId} — ignoring (idempotency)`);
    return;
  }

  // ─── Loop guard: ignore the inbound echo of our own outbound status write ────
  // When outbound sync PUTs a status to Zoho, Zoho fires a webhook straight back.
  // A matching armed marker means this delivery is that echo — skip it so the
  // round-trip inbound → issue → outbound does not loop.
  if (await consumeInboundSuppression(ctx, normalized.taskId, normalized.status)) {
    ctx.logger.info(
      `Inbound webhook for task ${normalized.taskId} echoes our own outbound write (status "${normalized.status}") — skipping (loop guard)`,
    );
    return;
  }

  // Resolve project mapping — auto-create if needed
  const projectMappings = await getProjectMapping(ctx);
  let projectMap: ProjectMappingEntry | null = projectMappings.find((m) => m.zohoProjectId === normalized.projectId) ?? null;

  if (!projectMap) {
    // Resolve company from project group
    const companyId = await resolveCompanyId(ctx, normalized.projectId);
    if (!companyId) {
      ctx.logger.warn(
        `Cannot route Zoho project ${normalized.projectId}: no company resolved from org prefix "${normalized.orgPrefix}". Configure org prefix mappings in settings.`,
      );
      return;
    }

    // Auto-link to an existing Paperclip project by name
    projectMap = await autoLinkProject(ctx, normalized.projectId, normalized.projectName, companyId);
    if (!projectMap) return;
  }

  const { paperclipProjectId, paperclipCompanyId } = projectMap;

  // Resolve agent — try auto-match by name within the company
  let agentId: string | null = null;
  if (normalized.assignedAgent) {
    agentId = await resolveAgent(ctx, normalized.assignedAgent);

    // If manual mapping didn't find it, try name-based auto-match
    if (!agentId) {
      agentId = await autoResolveAgentByName(ctx, normalized.assignedAgent, paperclipCompanyId);
    }
  }

  // Check for existing issue
  const originKind = PROJECTS_TASK_ORIGIN_KIND;
  const originId = normalized.taskId;

  const existingIssues = await ctx.issues.list({
    companyId: paperclipCompanyId,
    projectId: paperclipProjectId,
    originKind,
    originId,
    limit: 1,
    offset: 0,
  });

  const existing = existingIssues.length > 0 ? existingIssues[0] : null;
  let issueStatus = mapStatus(normalized.status) as IssueStatus;
  const issuePriority = mapPriority(normalized.priority);

  // Paperclip requires an assignee for in_progress issues — fall back to todo if unassigned
  if (issueStatus === "in_progress" && !agentId) {
    issueStatus = "todo";
  }

  // Capture the portal id so outbound sync never has to guess it later.
  const config = (await ctx.config.get()) as { portalId?: string };

  if (existing) {
    // Loop guard: arm the marker BEFORE the write so the resulting `issue.updated`
    // event is recognized as inbound-driven and not echoed back out to Zoho.
    await suppressNextOutbound(ctx, existing.id, issueStatus);

    await ctx.issues.update(
      existing.id,
      {
        status: issueStatus,
        priority: issuePriority,
        assigneeAgentId: agentId ?? undefined,
      },
      paperclipCompanyId,
    );

    // Refresh the origin-identity record in case project/portal linkage changed.
    await saveTaskMapping(ctx, {
      zohoTaskId: normalized.taskId,
      zohoProjectId: normalized.projectId,
      portalId: config.portalId,
      paperclipIssueId: existing.id,
      paperclipCompanyId,
      paperclipProjectId,
    });

    ctx.logger.info(`Updated issue ${existing.id} from Zoho task ${normalized.taskId} (status: ${issueStatus})`);
  } else {
    const issue = await ctx.issues.create({
      companyId: paperclipCompanyId,
      projectId: paperclipProjectId,
      title: normalized.taskName,
      description: normalized.description,
      status: issueStatus,
      priority: issuePriority,
      assigneeAgentId: agentId ?? undefined,
      originKind,
      originId,
    });

    // Loop guard: arm in case the host emits an `issue.updated` alongside create
    // (e.g. status normalization) so that first event isn't echoed out to Zoho.
    await suppressNextOutbound(ctx, issue.id, issueStatus);

    // Persist the origin-identity convention so Paperclip → Zoho status sync can
    // resolve project + task ids without relying on the unset originFingerprint.
    await saveTaskMapping(ctx, {
      zohoTaskId: normalized.taskId,
      zohoProjectId: normalized.projectId,
      portalId: config.portalId,
      paperclipIssueId: issue.id,
      paperclipCompanyId,
      paperclipProjectId,
    });

    ctx.logger.info(`Created issue ${issue.id} from Zoho task ${normalized.taskId}: "${normalized.taskName}"`);

    await ctx.activity.log({
      companyId: paperclipCompanyId,
      entityType: "issue",
      entityId: issue.id,
      message: `Synced from Zoho Projects task "${normalized.taskName}" (${normalized.taskId})`,
      metadata: { plugin: "project-bridge" },
    });
  }
}

/**
 * Auto-resolve agent by matching name to Paperclip agents in a company.
 * Case-insensitive partial match on agent name.
 */
async function autoResolveAgentByName(
  ctx: PluginContext,
  agentName: string,
  companyId: string,
): Promise<string | null> {
  const agents = await ctx.agents.list({ companyId, limit: 200, offset: 0 });
  const lowerName = agentName.toLowerCase();

  // Exact name match
  const exact = agents.find((a) => a.name?.toLowerCase() === lowerName);
  if (exact) return exact.id;

  // Name contains match (e.g. "Kelly" matches "Kelly - PM")
  const partial = agents.find((a) => a.name?.toLowerCase().includes(lowerName));
  if (partial) return partial.id;

  return null;
}
