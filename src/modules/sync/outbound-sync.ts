/**
 * Outbound sync: Paperclip → Zoho.
 * When a Paperclip Issue status changes, update the corresponding Zoho entity.
 */

import type { PluginContext, PluginEvent } from "@paperclipai/plugin-sdk";
import { PAPERCLIP_TO_PROJECTS_STATUS } from "../../constants.js";
import { projectsFetch } from "../../lib/zoho-client.js";
import { consumeOutboundSuppression, suppressNextInbound } from "./sync-guard.js";
import { getTaskMapping } from "./task-mapping.js";

/**
 * Handle issue.updated events and sync status back to Zoho.
 */
export async function handleIssueUpdated(
  ctx: PluginContext,
  event: PluginEvent,
): Promise<void> {
  // The Paperclip server puts issueId in event.entityId and companyId at
  // event.companyId (top level). The payload contains the flat updateFields
  // spread (e.g. { status: "done", _previous: { status: "todo" } }).
  const issueId = event.entityId;
  const companyId = event.companyId;
  const payload = event.payload as {
    status?: string;
    _previous?: { status?: string };
  };

  const newStatus = payload.status;
  const prevStatus = payload._previous?.status;

  if (!issueId || !companyId || !newStatus || newStatus === prevStatus) {
    return;
  }

  const issue = await ctx.issues.get(issueId, companyId);
  if (!issue) return;

  // Check if this is a Zoho Projects-synced issue via the origin convention.
  // originKind: "plugin:project-bridge:projects-task", originId: <zohoTaskId>.
  if (issue.originKind !== "plugin:project-bridge:projects-task") {
    return;
  }

  const zohoTaskId = issue.originId;
  if (!zohoTaskId) return;

  // Loop guard: if this `issue.updated` is the echo of an inbound write we just
  // applied from a Zoho webhook, don't push it straight back to Zoho. The marker
  // is single-use and status-matched, so a genuine Paperclip-side change (LWW,
  // D5) still syncs outbound.
  if (await consumeOutboundSuppression(ctx, issue.id, newStatus)) {
    ctx.logger.info(
      `issue.updated for ${issue.id} originates from inbound Zoho sync — skipping outbound (loop guard)`,
    );
    return;
  }

  // Resolve project + portal ids from the persisted origin-identity record.
  // (originFingerprint is never set by the inbound handler, so we never read it.)
  const mapping = await getTaskMapping(ctx, zohoTaskId);
  if (!mapping) {
    ctx.logger.warn(
      `No Zoho task mapping for issue ${issue.id} (task ${zohoTaskId}); cannot sync status outbound`,
    );
    return;
  }

  await syncTaskStatusToProjects(
    ctx,
    { taskId: zohoTaskId, projectId: mapping.zohoProjectId, portalId: mapping.portalId },
    newStatus,
  );
  // Future: desk, crm handlers
}

async function syncTaskStatusToProjects(
  ctx: PluginContext,
  zoho: { taskId: string; projectId: string; portalId?: string },
  paperclipStatus: string,
): Promise<void> {
  const zohoStatus = PAPERCLIP_TO_PROJECTS_STATUS[paperclipStatus];
  if (!zohoStatus) {
    ctx.logger.warn(`No Zoho status mapping for Paperclip status "${paperclipStatus}"`);
    return;
  }

  // Prefer the portal captured at sync time; fall back to current config.
  const config = (await ctx.config.get()) as { portalId?: string };
  const portalId = zoho.portalId ?? config.portalId;
  if (!portalId || !zoho.projectId) {
    ctx.logger.warn("Missing portalId or projectId for outbound sync");
    return;
  }

  const path = `/portal/${portalId}/projects/${zoho.projectId}/tasks/${zoho.taskId}/`;
  const result = await projectsFetch(ctx, "PUT", path, {
    status: { name: zohoStatus },
  });

  if (result.ok) {
    // Loop guard: Zoho fires a webhook for this API-driven update. Arm a marker
    // so that inbound echo is recognized and dropped instead of round-tripping.
    await suppressNextInbound(ctx, zoho.taskId, zohoStatus);
    ctx.logger.info(
      `Synced task ${zoho.taskId} to Zoho status "${zohoStatus}"`,
    );
  } else {
    ctx.logger.error(
      `Failed to sync task ${zoho.taskId} to Zoho (${result.status}): ${JSON.stringify(result.data)}`,
    );
  }
}
