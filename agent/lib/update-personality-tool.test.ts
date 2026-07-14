import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  updatePersonalityRemote: vi.fn(),
}));

vi.mock("./personality-internal.js", () => ({
  updatePersonalityRemote: mocks.updatePersonalityRemote,
}));

import updatePersonalityTool from "../tools/update_personality";

describe("update_personality tool", () => {
  beforeEach(() => {
    mocks.updatePersonalityRemote.mockReset();
    mocks.updatePersonalityRemote.mockResolvedValue({
      personality: {
        markdown: "# Personality\n\n- Keep replies concise.",
        actions: {
          commit: "always",
          push: "always",
          openPullRequest: "ask",
        },
      },
    });
  });

  it("updates only the current authenticated user's structured preferences", async () => {
    const changes = {
      remember: ["Keep replies concise."],
      actions: { commit: "always" as const, push: "always" as const },
    };
    const result = await updatePersonalityTool.execute!(
      { reason: "The user said to always commit and push", changes },
      {
        session: {
          auth: { current: { principalId: "user-1", principalType: "user" } },
        },
      } as never,
    );

    expect(mocks.updatePersonalityRemote).toHaveBeenCalledWith({
      userId: "user-1",
      patch: changes,
    });
    expect(result.actions).toEqual({
      commit: "always",
      push: "always",
      openPullRequest: "ask",
    });
  });

  it("cannot run without a user principal", async () => {
    await expect(updatePersonalityTool.execute!(
      {
        reason: "Remember this",
        changes: { remember: ["Keep replies concise."] },
      },
      { session: { auth: { current: null } } } as never,
    )).rejects.toThrow("Cannot update personality without an authenticated user");
  });
});
