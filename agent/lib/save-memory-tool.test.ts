import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  saveMemoryRemote: vi.fn(),
}));

vi.mock("./memory-internal.js", () => ({
  saveMemoryRemote: mocks.saveMemoryRemote,
}));

import saveMemoryTool from "../tools/save_memory";

describe("save_memory tool", () => {
  beforeEach(() => {
    mocks.saveMemoryRemote.mockReset();
    mocks.saveMemoryRemote.mockResolvedValue({ saved: true });
  });

  it("saves an explicit memory without opening an Eve approval request", () => {
    expect(saveMemoryTool.approval).toBeUndefined();
  });

  it("returns a conversational confirmation after saving", async () => {
    const result = await saveMemoryTool.execute!(
      {
        reason: "The user explicitly asked to remember this",
        updates: [{ category: "personal_context", content: "The variable x is 50." }],
      },
      {
        session: {
          auth: { current: { principalId: "user-1", principalType: "user" } },
        },
      } as never,
    );

    expect(result).toEqual({
      message: "Got it — I’ll remember that.",
      results: [{ category: "personal_context", saved: true }],
    });
  });
});
