import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  fetchAutomaticRecall: vi.fn(),
  fetchUserContext: vi.fn(),
}));

vi.mock("./memory-internal.js", async (importOriginal) => {
  const original = await importOriginal<typeof import("./memory-internal.js")>();
  return { ...original, fetchUserContext: mocks.fetchUserContext };
});

vi.mock("./mem0-internal.js", async (importOriginal) => {
  const original = await importOriginal<typeof import("./mem0-internal.js")>();
  return { ...original, fetchAutomaticRecall: mocks.fetchAutomaticRecall };
});

import dynamicInstructions from "../instructions";

describe("channel-specific instructions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.fetchUserContext.mockResolvedValue(undefined);
    mocks.fetchAutomaticRecall.mockResolvedValue([]);
  });

  it("recognizes Eve's qualified Photon channel kind", async () => {
    const events = dynamicInstructions.events as Record<
      string,
      (event: never, ctx: never) => Promise<{ markdown?: string } | null>
    >;
    const instructions = await events["session.started"]!({} as never, {
      channel: { kind: "channel:photon" },
      session: { auth: { current: null } },
    } as never);

    expect(instructions?.markdown).toContain("This conversation is over iMessage");
  });
});
