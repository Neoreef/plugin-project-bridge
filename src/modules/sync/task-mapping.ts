/**
 * Origin-identity convention for Zoho Projects ⇄ Paperclip issue sync.
 *
 * A Zoho-synced issue is stamped with:
 *   - `originKind: "plugin:project-bridge:projects-task"`
 *   - `originId: <zohoTaskId>`
 *
 * The issue create/update API cannot persist arbitrary metadata (and
 * `originFingerprint` is host-owned / read-only), so the remaining ids needed
 * for outbound sync — `{ zohoProjectId, portalId, ... }` — are stored in a
 * dedicated plugin-state mapping record keyed by the Zoho task id.
 *
 * This is the single source of truth that lets outbound sync
 * (Paperclip → Zoho) resolve project + task ids without relying on the unset
 * `originFingerprint`.
 */

import type { PluginContext } from "@paperclipai/plugin-sdk";

/** Origin kind stamped on every Paperclip issue synced from a Zoho Projects task. */
export const PROJECTS_TASK_ORIGIN_KIND = "plugin:project-bridge:projects-task";

/**
 * Persisted identity linking a Paperclip issue to its Zoho Projects task.
 * Keyed in plugin state by `zohoTaskId` (== issue `originId`).
 */
export type ProjectsTaskMapping = {
  zohoTaskId: string;
  zohoProjectId: string;
  /** Portal the task lives in. Captured at sync time so outbound never guesses. */
  portalId?: string;
  paperclipIssueId: string;
  paperclipCompanyId: string;
  paperclipProjectId: string;
};

function taskMappingKey(zohoTaskId: string) {
  return { scopeKind: "instance" as const, stateKey: `zoho.taskMapping.${zohoTaskId}` };
}

/** Persist (upsert) the origin-identity record for a Zoho task. */
export async function saveTaskMapping(ctx: PluginContext, mapping: ProjectsTaskMapping): Promise<void> {
  await ctx.state.set(taskMappingKey(mapping.zohoTaskId), mapping);
}

/** Resolve the origin-identity record for a Zoho task id, or null if unmapped. */
export async function getTaskMapping(ctx: PluginContext, zohoTaskId: string): Promise<ProjectsTaskMapping | null> {
  return ((await ctx.state.get(taskMappingKey(zohoTaskId))) as ProjectsTaskMapping | null) ?? null;
}
