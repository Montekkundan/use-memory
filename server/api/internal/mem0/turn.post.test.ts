import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  body: {
    userId: "user-1",
    sessionId: "session-1",
    turnId: "turn-1",
    userMessage: "Remember that x is 50.",
    deliveryRequested: true,
  },
  retryPendingAutomaticMemoryTurns: vi.fn(),
  stageAutomaticMemoryTurn: vi.fn(),
}));

vi.mock("~~/server/utils/internal-api", () => ({
  requireInternalRequest: vi.fn(),
}));

vi.mock("~~/server/utils/mem0", () => ({
  retryPendingAutomaticMemoryTurns: mocks.retryPendingAutomaticMemoryTurns,
  stageAutomaticMemoryTurn: mocks.stageAutomaticMemoryTurn,
}));

vi.stubGlobal("defineEventHandler", (handler: unknown) => handler);
vi.stubGlobal("readValidatedBody", async (_event: unknown, parse: (value: unknown) => unknown) =>
  parse(mocks.body));

let handler: (event: never) => Promise<unknown>;

describe("automatic memory turn endpoint", () => {
  beforeAll(async () => {
    handler = (await import("./turn.post")).default;
  });

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.stageAutomaticMemoryTurn.mockResolvedValue({ staged: true });
    mocks.retryPendingAutomaticMemoryTurns.mockResolvedValue({ processed: 1, delivered: 1 });
  });

  it("delivers a staged user message when a failed turn requests delivery", async () => {
    await handler({} as never);

    expect(mocks.retryPendingAutomaticMemoryTurns).toHaveBeenCalledWith("user-1", 3);
  });
});
