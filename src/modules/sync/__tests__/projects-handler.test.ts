import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  normalizeProjectsPayload,
  resolveCompanyId,
  parseAllowedProjectIds,
  isProjectAllowed,
  findThinTaskRef,
  hydrateInboundPayload,
  handleProjectNotification,
} from "../projects-handler.js";
import { projectsFetch } from "../../../lib/zoho-client.js";

vi.mock("../../../lib/zoho-client.js", () => ({
  projectsFetch: vi.fn(),
}));

describe("projects-handler", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("normalizeProjectsPayload", () => {
    it("extracts custom fields, assignedAgent, status, project info", () => {
      const raw = {
        Task: {
          id: 123,
          name: "Test Task",
          description: "Test Desc",
          custom_fields: [
            { label_name: "Assigned Agent", value: "Ada" }
          ],
          status: { name: "open", type: "open" },
          priority: "high",
          last_updated_time: "2026-06-10T00:00:00Z"
        },
        Project: {
          id: "p1",
          name: "Test Project"
        }
      };

      const result = normalizeProjectsPayload(raw);
      expect(result.taskId).toBe("123");
      expect(result.taskName).toBe("Test Task");
      expect(result.description).toBe("Test Desc");
      expect(result.status).toBe("open");
      expect(result.priority).toBe("high");
      expect(result.projectId).toBe("p1");
      expect(result.projectName).toBe("Test Project");
      expect(result.assignedAgent).toBe("Ada");
      expect(result.assignee).toBe("Ada");
      expect(result.completed).toBe(false);
      expect(result.updatedTime).toBe("2026-06-10T00:00:00Z");
    });

    it("handles fallback chain for assignedAgent", () => {
      const raw = {
        task: {
          id: 124,
          name: "Task 2",
          CF: { "Assigned Agent": "Bob" },
          status: "in progress"
        }
      };
      const result = normalizeProjectsPayload(raw);
      expect(result.assignedAgent).toBe("Bob");
    });

    it("derives assignee from the task owner (client user) when no dropdown/tag", () => {
      const v3 = normalizeProjectsPayload({
        Task: { id: 1, name: "T", owners_and_work: { owners: [{ name: "Kelly", email: "kelly@x.com" }] } },
        Project: { id: "p1" },
      });
      expect(v3.assignedAgent).toBe("Kelly");

      const classic = normalizeProjectsPayload({ Task: { id: 2, name: "T", details: { owners: [{ name: "Ada" }] } } });
      expect(classic.assignedAgent).toBe("Ada");
    });

    it("treats Zoho 'Unassigned User' owner as no assignee", () => {
      const result = normalizeProjectsPayload({
        Task: { id: 3, name: "T", owners_and_work: { owners: [{ name: "Unassigned User" }] } },
      });
      expect(result.assignedAgent).toBeUndefined();
    });

    it("prefers an explicit Assigned Agent over the owner", () => {
      const result = normalizeProjectsPayload({
        Task: {
          id: 4,
          name: "T",
          custom_fields: [{ label_name: "Assigned Agent", value: "Werner" }],
          owners_and_work: { owners: [{ name: "Brian Ernesto" }] },
        },
      });
      expect(result.assignedAgent).toBe("Werner");
    });
  });

  describe("resolveCompanyId", () => {
    const createMockCtx = (opts: { groupMappings?: any[], companies?: any[], portalId?: string } = {}) => ({
      config: { get: async () => ({ portalId: opts.portalId ?? "portal-1" }) },
      state: { get: async () => opts.groupMappings ?? [] },
      companies: { list: async () => opts.companies ?? [] },
      logger: { info: vi.fn(), debug: vi.fn() },
    }) as any;

    it("resolves via group mapping", async () => {
      (projectsFetch as any).mockResolvedValueOnce({ ok: true, data: { projects: [{ group_name: "Group A" }] } });
      const ctx = createMockCtx({
        groupMappings: [{ groupName: "Group A", companyId: "c-1" }],
        companies: [{ id: "c-2", name: "Other" }]
      });
      const result = await resolveCompanyId(ctx, "proj-1");
      expect(result).toBe("c-1");
      expect(projectsFetch).toHaveBeenCalledWith(ctx, "GET", expect.stringContaining("projects/proj-1"));
    });

    it("resolves via name match if no mapping", async () => {
      (projectsFetch as any).mockResolvedValueOnce({ ok: true, data: { projects: [{ group_name: "Group B" }] } });
      const ctx = createMockCtx({
        companies: [{ id: "c-2", name: "Group B" }]
      });
      const result = await resolveCompanyId(ctx, "proj-1");
      expect(result).toBe("c-2");
    });

    it("resolves via the v3-style project_group.name shape (NEO-104 contract risk)", async () => {
      // The live API returns the group nested as `project_group.name` (verified
      // for PR-90 on 2026-06-12), not the classic `group_name`. Reading both
      // shapes keeps group→company resolution working either way.
      (projectsFetch as any).mockResolvedValueOnce({
        ok: true,
        data: { project_group: { id: "g-1", name: "Group C" }, key: "PR-90" },
      });
      const ctx = createMockCtx({
        groupMappings: [{ groupName: "Group C", companyId: "c-9" }],
        companies: [{ id: "c-2", name: "Other" }],
      });
      const result = await resolveCompanyId(ctx, "proj-1");
      expect(result).toBe("c-9");
    });

    it("falls back to single company", async () => {
      (projectsFetch as any).mockResolvedValueOnce({ ok: true, data: { projects: [{ group_name: "Unknown Group" }] } });
      const ctx = createMockCtx({
        companies: [{ id: "c-3", name: "Only Company" }]
      });
      const result = await resolveCompanyId(ctx, "proj-1");
      expect(result).toBe("c-3");
    });

    it("returns null if no single company fallback and no match", async () => {
      (projectsFetch as any).mockResolvedValueOnce({ ok: true, data: { projects: [{ group_name: "Unknown Group" }] } });
      const ctx = createMockCtx({
        companies: [{ id: "c-3", name: "C3" }, { id: "c-4", name: "C4" }]
      });
      const result = await resolveCompanyId(ctx, "proj-1");
      expect(result).toBeNull();
    });
  });

  describe("project allowlist", () => {
    it("parses comma / space / newline separated ids and drops blanks", () => {
      expect([...parseAllowedProjectIds("123, 456")]).toEqual(["123", "456"]);
      expect([...parseAllowedProjectIds("123\n 456 \t789")]).toEqual(["123", "456", "789"]);
      expect([...parseAllowedProjectIds(" , , ")]).toEqual([]);
    });

    it("treats unset / empty allowlist as allow-all", () => {
      expect(parseAllowedProjectIds(undefined).size).toBe(0);
      expect(parseAllowedProjectIds("").size).toBe(0);
      expect(isProjectAllowed("anything", parseAllowedProjectIds(undefined))).toBe(true);
    });

    it("allows only listed projects when the allowlist is non-empty", () => {
      const allowed = parseAllowedProjectIds("test-proj-1, test-proj-2");
      expect(isProjectAllowed("test-proj-1", allowed)).toBe(true);
      expect(isProjectAllowed("test-proj-2", allowed)).toBe(true);
      expect(isProjectAllowed("prod-proj-99", allowed)).toBe(false);
    });
  });

  describe("findThinTaskRef", () => {
    it("extracts ids from a thin notification (snake or camel)", () => {
      expect(findThinTaskRef({ type: "task", taskId: "t1", projectId: "p1" })).toEqual({ taskId: "t1", projectId: "p1" });
      expect(findThinTaskRef({ task_id: "t2", project_id: "p2" })).toEqual({ taskId: "t2", projectId: "p2" });
      expect(findThinTaskRef({ id: 99, Project: { id: "p3" } })).toEqual({ taskId: "99", projectId: "p3" });
    });

    it("returns null when ids are missing", () => {
      expect(findThinTaskRef({ type: "project", projectId: "p1" })).toBeNull();
      expect(findThinTaskRef({ taskId: "t1" })).toBeNull();
    });
  });

  describe("hydrateInboundPayload", () => {
    const ctxWith = (portalId?: string) => ({
      config: { get: async () => ({ portalId }) },
      logger: { info: vi.fn(), warn: vi.fn(), debug: vi.fn() },
    }) as any;

    it("passes a full inline-task payload through unchanged (no fetch)", async () => {
      const raw = { Task: { id: 1, name: "Inline", status: { name: "open" } }, Project: { id: "p1" } };
      const out = await hydrateInboundPayload(ctxWith("portal-1"), raw);
      expect(out).toBe(raw);
      expect(projectsFetch).not.toHaveBeenCalled();
    });

    it("fetches the task from the Zoho API for a thin ping and wraps it", async () => {
      (projectsFetch as any).mockResolvedValueOnce({
        ok: true,
        data: { tasks: [{ id: "t9", name: "Fetched Task", status: { name: "open", type: "open" }, priority: "high" }] },
      });
      const out = await hydrateInboundPayload(ctxWith("portal-1"), { type: "task", taskId: "t9", projectId: "p9" });
      expect(projectsFetch).toHaveBeenCalledWith(
        expect.anything(),
        "GET",
        expect.stringContaining("/portal/portal-1/projects/p9/tasks/t9/"),
      );
      const normalized = normalizeProjectsPayload(out);
      expect(normalized.taskId).toBe("t9");
      expect(normalized.taskName).toBe("Fetched Task");
      expect(normalized.projectId).toBe("p9");
      expect(normalized.priority).toBe("high");
    });

    it("uses portalId from the ping over config when provided", async () => {
      (projectsFetch as any).mockResolvedValueOnce({ ok: true, data: { tasks: [{ id: "t1", name: "X" }] } });
      await hydrateInboundPayload(ctxWith("config-portal"), { taskId: "t1", projectId: "p1", portalId: "ping-portal" });
      expect(projectsFetch).toHaveBeenCalledWith(expect.anything(), "GET", expect.stringContaining("/portal/ping-portal/"));
    });

    it("leaves non-task pings (e.g. project) untouched", async () => {
      const raw = { type: "project", projectId: "p1" };
      const out = await hydrateInboundPayload(ctxWith("portal-1"), raw);
      expect(out).toBe(raw);
      expect(projectsFetch).not.toHaveBeenCalled();
    });

    it("falls back to the original payload when the fetch fails", async () => {
      (projectsFetch as any).mockResolvedValueOnce({ ok: false, status: 404 });
      const raw = { taskId: "t1", projectId: "p1" };
      const out = await hydrateInboundPayload(ctxWith("portal-1"), raw);
      expect(out).toBe(raw);
    });
  });

  describe("handleProjectNotification", () => {
    const projCtx = (opts: { allowedProjectIds?: string; mappings?: any[]; portalId?: string } = {}) => ({
      config: { get: async () => ({ allowedProjectIds: opts.allowedProjectIds, portalId: opts.portalId ?? "portal-1" }) },
      state: {
        get: async (k: any) => (k.stateKey === "zoho.projectMapping" ? opts.mappings ?? [] : []),
        set: vi.fn(),
      },
      logger: { info: vi.fn(), warn: vi.fn(), debug: vi.fn(), error: vi.fn() },
      projects: { list: vi.fn(async () => []) },
      companies: { list: async () => [] },
    }) as any;

    it("is a no-op (no API call) when the project is already mapped", async () => {
      const ctx = projCtx({ mappings: [{ zohoProjectId: "p1", paperclipProjectId: "x", paperclipCompanyId: "c" }] });
      await handleProjectNotification(ctx, { type: "project", projectId: "p1", portalId: "portal-1" });
      expect(projectsFetch).not.toHaveBeenCalled();
    });

    it("ignores a project that is not in the allowlist", async () => {
      const ctx = projCtx({ allowedProjectIds: "other-proj" });
      await handleProjectNotification(ctx, { type: "project", projectId: "p1", portalId: "portal-1" });
      expect(projectsFetch).not.toHaveBeenCalled();
    });

    it("ignores a payload with no project id", async () => {
      const ctx = projCtx();
      await handleProjectNotification(ctx, { type: "project" });
      expect(projectsFetch).not.toHaveBeenCalled();
    });
  });
});
