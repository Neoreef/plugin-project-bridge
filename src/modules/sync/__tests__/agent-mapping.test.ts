import { describe, it, expect } from "vitest";
import { resolveAgent } from "../agent-mapping.js";

describe("agent-mapping", () => {
  describe("resolveAgent", () => {
    it("resolves exact match", async () => {
      const mockCtx = {
        state: {
          get: async () => [{ zohoName: "Ada", paperclipAgentId: "agent-1" }],
        },
      } as any;
      expect(await resolveAgent(mockCtx, "Ada")).toBe("agent-1");
    });

    it("resolves match with ' - '", async () => {
      const mockCtx = {
        state: {
          get: async () => [{ zohoName: "Ada", paperclipAgentId: "agent-1" }],
        },
      } as any;
      expect(await resolveAgent(mockCtx, "Ada - EA (Brian)")).toBe("agent-1");
    });

    it("resolves match with trailing period removed", async () => {
      const mockCtx = {
        state: {
          get: async () => [{ zohoName: "David O", paperclipAgentId: "agent-2" }],
        },
      } as any;
      expect(await resolveAgent(mockCtx, "David O.")).toBe("agent-2");
    });

    it("returns null if no match", async () => {
      const mockCtx = {
        state: {
          get: async () => [{ zohoName: "Ada", paperclipAgentId: "agent-1" }],
        },
      } as any;
      expect(await resolveAgent(mockCtx, "Unknown")).toBeNull();
    });

    it("returns null if agentName is empty", async () => {
      const mockCtx = {} as any;
      expect(await resolveAgent(mockCtx, "")).toBeNull();
    });
  });
});
