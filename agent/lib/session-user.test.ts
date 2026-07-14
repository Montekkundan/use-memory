import { describe, expect, it } from "vitest";
import { sessionUserId } from "./session-user";

describe("sessionUserId", () => {
  it("returns only real user principals", () => {
    expect(sessionUserId({ principalId: "user-1", principalType: "user" })).toBe("user-1");
    expect(sessionUserId({ principalId: "project-1", principalType: "app" })).toBeUndefined();
    expect(sessionUserId({ principalId: "eve:local", principalType: "user" })).toBeUndefined();
    expect(sessionUserId(null)).toBeUndefined();
  });
});
