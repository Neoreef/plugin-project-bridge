import { describe, it, expect } from "vitest";
import { PROJECTS_STATUS_MAP, PAPERCLIP_TO_PROJECTS_STATUS, PRIORITY_MAP } from "../../../constants.js";

describe("constants maps", () => {
  describe("PROJECTS_STATUS_MAP", () => {
    it("maps Zoho statuses to Paperclip statuses correctly", () => {
      expect(PROJECTS_STATUS_MAP["open"]).toBe("todo");
      expect(PROJECTS_STATUS_MAP["in progress"]).toBe("in_progress");
      expect(PROJECTS_STATUS_MAP["completed"]).toBe("done");
      expect(PROJECTS_STATUS_MAP["closed"]).toBe("done");
    });
  });

  describe("PAPERCLIP_TO_PROJECTS_STATUS", () => {
    it("maps Paperclip statuses to Zoho statuses correctly", () => {
      expect(PAPERCLIP_TO_PROJECTS_STATUS["todo"]).toBe("Open");
      expect(PAPERCLIP_TO_PROJECTS_STATUS["in_progress"]).toBe("In Progress");
      expect(PAPERCLIP_TO_PROJECTS_STATUS["done"]).toBe("Closed");
    });
  });

  describe("PRIORITY_MAP", () => {
    it("maps priority correctly", () => {
      expect(PRIORITY_MAP["none"]).toBe("low");
      expect(PRIORITY_MAP["high"]).toBe("high");
    });
  });
});
