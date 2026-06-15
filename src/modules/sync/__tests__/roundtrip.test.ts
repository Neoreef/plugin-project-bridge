import { describe, it, expect, vi, beforeEach } from "vitest";
import { handleProjectsWebhook } from "../projects-handler.js";
import { handleIssueUpdated } from "../outbound-sync.js";
import { projectsFetch } from "../../../lib/zoho-client.js";

vi.mock("../../../lib/zoho-client.js", () => ({
  projectsFetch: vi.fn(),
}));

describe("round-trip integration", () => {
  let mockState: Record<string, any>;
  let ctx: any;

  beforeEach(() => {
    vi.clearAllMocks();
    mockState = {};

    ctx = {
      config: {
        get: async () => ({ portalId: "portal-123" }),
      },
      state: {
        get: async (key: any) => mockState[key.stateKey] ?? null,
        set: async (key: any, val: any) => { mockState[key.stateKey] = val; },
        delete: async (key: any) => { delete mockState[key.stateKey]; },
      },
      companies: {
        list: async () => [{ id: "c-1", name: "Single Company" }],
      },
      projects: {
        list: async () => [{ id: "p-1", name: "Test Project" }],
      },
      agents: {
        list: async () => [],
      },
      issues: {
        list: async () => [], // initially no issue exists
        create: vi.fn().mockResolvedValue({ id: "iss-1" }),
        update: vi.fn().mockResolvedValue({ id: "iss-1" }),
        get: vi.fn().mockResolvedValue({
          id: "iss-1",
          originKind: "plugin:project-bridge:projects-task",
          originId: "t-123",
        }),
      },
      activity: {
        log: vi.fn(),
      },
      logger: {
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
        debug: vi.fn(),
      },
    };
  });

  it("handles inbound webhook -> issue created -> no outbound loop", async () => {
    // 1. Inbound webhook from Zoho
    const rawPayload = {
      Task: {
        id: "t-123",
        name: "Test Round Trip",
        status: { name: "in progress" },
        priority: "high",
      },
      Project: {
        id: "z-proj-1",
        name: "Test Project",
      },
    };

    // Pre-populate project mapping so it maps directly
    mockState["zoho.projectMapping"] = [{
      zohoProjectId: "z-proj-1",
      paperclipProjectId: "p-1",
      paperclipCompanyId: "c-1",
    }];

    await handleProjectsWebhook(ctx, JSON.stringify(rawPayload), rawPayload);

    // Expect issue to be created with correct normalized fields
    expect(ctx.issues.create).toHaveBeenCalledWith(expect.objectContaining({
      title: "Test Round Trip",
      status: "todo",
      priority: "high",
      originId: "t-123",
    }));

    // The inbound handler should have set outbound suppression marker to prevent loop
    // Status written was 'todo'
    const suppressKey = mockState["zoho.suppress.out.iss-1"];
    expect(suppressKey).toBeDefined();
    expect(suppressKey.status).toBe("todo");

    // 2. The host triggers issue.updated as a result of the creation (or update)
    // Event shape: entityId/companyId at top level; flat status + _previous in payload.
    const updateEvent = {
      entityId: "iss-1",
      companyId: "c-1",
      payload: {
        status: "todo",
        _previous: { status: "backlog" },
      },
    };

    await handleIssueUpdated(ctx, updateEvent as any);

    // The loop guard should consume the marker and NOT call Zoho API
    expect(projectsFetch).not.toHaveBeenCalled();

    // The marker should be consumed
    expect(mockState["zoho.suppress.out.iss-1"]).toBeUndefined();
  });

  it("handles user changing issue in Paperclip -> outbound sync -> no inbound loop", async () => {
    // 1. Task mapping must exist
    mockState["zoho.taskMapping.t-123"] = {
      zohoTaskId: "t-123",
      zohoProjectId: "z-proj-1",
      portalId: "portal-123",
      paperclipIssueId: "iss-1",
      paperclipCompanyId: "c-1",
      paperclipProjectId: "p-1",
    };

    // User changes issue status to 'done' in Paperclip
    const updateEvent = {
      entityId: "iss-1",
      companyId: "c-1",
      payload: {
        status: "done",
        _previous: { status: "todo" },
      },
    };

    (projectsFetch as any).mockResolvedValueOnce({ ok: true, data: {} });

    await handleIssueUpdated(ctx, updateEvent as any);

    // Should have called Zoho API with Closed status
    expect(projectsFetch).toHaveBeenCalledWith(
      ctx,
      "PUT",
      "/portal/portal-123/projects/z-proj-1/tasks/t-123/",
      { status: { name: "Closed" } }
    );

    // Should have set inbound suppression
    const suppressKey = mockState["zoho.suppress.in.t-123"];
    expect(suppressKey).toBeDefined();
    expect(suppressKey.status).toBe("Closed");

    // 2. Zoho fires webhook echo
    const echoPayload = {
      Task: {
        id: "t-123",
        name: "Test Round Trip",
        status: { name: "Closed" },
      },
      Project: {
        id: "z-proj-1",
        name: "Test Project",
      },
    };

    await handleProjectsWebhook(ctx, JSON.stringify(echoPayload), echoPayload);

    // The inbound suppression should catch it, so issue shouldn't be updated
    expect(ctx.issues.update).not.toHaveBeenCalled();
    expect(ctx.issues.create).not.toHaveBeenCalled(); // since it echoes an existing task

    // The marker should be consumed
    expect(mockState["zoho.suppress.in.t-123"]).toBeUndefined();
  });

  it("handles duplicate inbound deliveries via fingerprint idempotency", async () => {
    const rawPayload = {
      Task: {
        id: "t-999",
        name: "Idempotency Test",
        status: { name: "open" },
        priority: "low",
        last_updated_time: "2026-06-10T10:00:00Z",
      },
      Project: {
        id: "z-proj-2",
      },
    };

    mockState["zoho.projectMapping"] = [{
      zohoProjectId: "z-proj-2",
      paperclipProjectId: "p-1",
      paperclipCompanyId: "c-1",
    }];

    // First delivery
    await handleProjectsWebhook(ctx, JSON.stringify(rawPayload), rawPayload);
    expect(ctx.issues.create).toHaveBeenCalledTimes(1);

    // Duplicate delivery
    await handleProjectsWebhook(ctx, JSON.stringify(rawPayload), rawPayload);
    // Should still be 1 (ignored by idempotency)
    expect(ctx.issues.create).toHaveBeenCalledTimes(1);
    expect(ctx.issues.update).toHaveBeenCalledTimes(0);
  });
});
