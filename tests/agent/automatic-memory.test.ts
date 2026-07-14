import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  stageAutomaticMemoryRemote: vi.fn(),
}));

vi.mock("../../agent/lib/mem0-internal.js", () => ({
  stageAutomaticMemoryRemote: mocks.stageAutomaticMemoryRemote,
}));

import automaticMemoryHook from "../../agent/hooks/automatic-memory";

describe("automatic memory hook", () => {
  beforeEach(() => {
    mocks.stageAutomaticMemoryRemote.mockReset();
    mocks.stageAutomaticMemoryRemote.mockResolvedValue({ staged: true });
  });

  it("stages the completed pair once and keeps turn.completed as a retry fallback", async () => {
    const events = automaticMemoryHook.events as Record<string, (event: never, ctx: never) => Promise<void>>;
    const ctx = {
      session: {
        id: "session-1",
        auth: { current: { principalId: "user-1", principalType: "user" } },
      },
    } as never;

    await events["message.received"]!({
      data: { turnId: "turn-1", message: "Remember that I prefer concise replies." },
    } as never, ctx);
    await events["message.completed"]!({
      data: { turnId: "turn-1", message: "I will keep replies concise.", finishReason: "stop" },
    } as never, ctx);
    await events["turn.completed"]!({ data: { turnId: "turn-1" } } as never, ctx);

    expect(mocks.stageAutomaticMemoryRemote).toHaveBeenCalledTimes(2);
    expect(mocks.stageAutomaticMemoryRemote).toHaveBeenLastCalledWith({
      userId: "user-1",
      sessionId: "session-1",
      turnId: "turn-1",
      userMessage: "Remember that I prefer concise replies.",
      assistantMessage: "I will keep replies concise.",
    });
  });
});
