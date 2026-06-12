import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  normalizeProjectsPayload,
  resolveCompanyId,
  parseAllowedProjectIds,
  isProjectAllowed,
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
});
