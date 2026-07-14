import { beforeEach, describe, expect, it, vi } from "vitest";

const memory = vi.hoisted(() => ({
  retryPendingAutomaticMemoryTurns: vi.fn(),
  stageAutomaticMemoryTurn: vi.fn(),
}));

vi.mock("./mem0", () => memory);

describe("onboarding automatic memory", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    memory.stageAutomaticMemoryTurn.mockResolvedValue({ staged: true });
    memory.retryPendingAutomaticMemoryTurns.mockResolvedValue({ processed: 1, delivered: 1 });
  });

  it("stages consented onboarding conversation in the same Better Auth user namespace", async () => {
    const { stageOnboardingMemory } = await import("./onboarding-memory");

    await stageOnboardingMemory({
      appUserId: "user-123",
      consented: true,
      messageId: "photon-message-1",
      phoneNumber: "+14165550123",
      userMessage: "I have a meeting with Jai tomorrow at 3:30.",
      assistantMessage: "Got it. Do you want to connect GitHub?",
    });

    expect(memory.stageAutomaticMemoryTurn).toHaveBeenCalledWith({
      userId: "user-123",
      sessionId: expect.stringMatching(/^onboarding:/u),
      turnId: "photon-message-1",
      userMessage: "I have a meeting with Jai tomorrow at 3:30.",
      assistantMessage: "Got it. Do you want to connect GitHub?",
    });
    expect(memory.retryPendingAutomaticMemoryTurns).toHaveBeenCalledWith("user-123", 1);
  });

  it("does not stage onboarding before consent and identity exist", async () => {
    const { stageOnboardingMemory } = await import("./onboarding-memory");

    await stageOnboardingMemory({
      appUserId: null,
      consented: false,
      messageId: "photon-message-1",
      phoneNumber: "+14165550123",
      userMessage: "123456",
      assistantMessage: "Phone verified.",
    });

    expect(memory.stageAutomaticMemoryTurn).not.toHaveBeenCalled();
    expect(memory.retryPendingAutomaticMemoryTurns).not.toHaveBeenCalled();
  });
});
