import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  updateProfileRemote: vi.fn(),
}));

vi.mock("./profile-internal.js", () => ({
  updateProfileRemote: mocks.updateProfileRemote,
}));

import updateProfileTool from "../tools/update_profile";

describe("update_profile tool", () => {
  beforeEach(() => {
    mocks.updateProfileRemote.mockReset();
    mocks.updateProfileRemote.mockResolvedValue({
      profile: {
        name: "Monte",
        bio: "Builder",
        timezone: "America/Toronto",
        language: "fr",
      },
    });
  });

  it("does not require an Eve approval UI", () => {
    expect(updateProfileTool.approval).toBeUndefined();
  });

  it("derives the target user from current session auth", async () => {
    const result = await updateProfileTool.execute!(
      {
        reason: "Use the user's current preferences",
        changes: { name: "Monte", language: "fr" },
      },
      {
        session: {
          auth: { current: { principalId: "user-1", principalType: "user" } },
        },
      } as never,
    );

    expect(mocks.updateProfileRemote).toHaveBeenCalledWith({
      userId: "user-1",
      patch: { name: "Monte", locale: "fr" },
    });
    expect(result).toEqual({
      updated: ["name", "language"],
      profile: {
        name: "Monte",
        bio: "Builder",
        timezone: "America/Toronto",
        language: "fr",
      },
    });
    expect(JSON.stringify(result)).not.toMatch(/email|phone|userId/u);
  });

  it("rejects missing and runtime principals", async () => {
    await expect(updateProfileTool.execute!(
      { reason: "Update", changes: { name: "Monte" } },
      { session: { auth: { current: null } } } as never,
    )).rejects.toThrow("Cannot update a profile without an authenticated user");

    await expect(updateProfileTool.execute!(
      { reason: "Update", changes: { name: "Monte" } },
      { session: { auth: { current: { principalId: "eve:app", principalType: "app" } } } } as never,
    )).rejects.toThrow("Cannot update a profile without an authenticated user");
    expect(mocks.updateProfileRemote).not.toHaveBeenCalled();
  });
});
