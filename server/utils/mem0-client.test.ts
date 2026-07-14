import { beforeEach, describe, expect, it, vi } from "vitest";

const sdk = vi.hoisted(() => ({
  add: vi.fn(),
  delete: vi.fn(),
  deleteAll: vi.fn(),
  get: vi.fn(),
  search: vi.fn(),
}));

vi.mock("mem0ai", () => ({
  MemoryClient: vi.fn(function MemoryClient() {
    return sdk;
  }),
}));

describe("Mem0 Cloud namespace", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("MEM0_API_KEY", "test-key");
    vi.stubEnv("NODE_ENV", "test");
    delete process.env.UPSTASH_REDIS_REST_URL;
    delete process.env.UPSTASH_REDIS_REST_TOKEN;
    delete process.env.KV_REST_API_URL;
    delete process.env.KV_REST_API_TOKEN;
  });

  it("scopes recall to the Better Auth user without combining separate Mem0 entity scopes", async () => {
    sdk.search.mockResolvedValue({ results: [] });
    const { searchMem0 } = await import("./mem0-client");

    await searchMem0("user-123", "favorite editor", 8);

    expect(sdk.search).toHaveBeenCalledWith("favorite editor", expect.objectContaining({
      filters: {
        AND: [
          { user_id: "user-123" },
          { metadata: { source: "automatic_chat" } },
        ],
      },
      topK: 8,
    }));
  });

  it("writes turns into the same user, agent, and app namespace", async () => {
    sdk.add.mockResolvedValue([]);
    const { addMem0Turn } = await import("./mem0-client");

    await addMem0Turn({
      id: "stage-1",
      userId: "user-123",
      sessionId: "session-1",
      turnId: "turn-1",
      userMessage: "I like concise answers",
      assistantMessage: "Understood",
    });

    expect(sdk.add).toHaveBeenCalledWith([
      { role: "user", content: "I like concise answers" },
    ], expect.objectContaining({
      userId: "user-123",
      agentId: "use-memory",
      appId: "use-memory",
      runId: "session-1",
      infer: true,
      customInstructions: expect.stringContaining("Only extract facts explicitly stated by the user"),
      metadata: expect.objectContaining({
        source: "automatic_chat",
        app_id: "use-memory",
        agent_id: "use-memory",
      }),
    }));
  });

  it("rejects cloud results outside the requested user and app-owned source", async () => {
    sdk.search.mockResolvedValue({
      results: [
        {
          id: "wrong-user",
          memory: "Another user's private fact",
          userId: "user-b",
          metadata: { source: "automatic_chat", app_id: "use-memory" },
        },
        {
          id: "wrong-app",
          memory: "A different application's fact",
          userId: "user-a",
          metadata: { source: "automatic_chat", app_id: "other-app" },
        },
        {
          id: "owned-legacy",
          memory: "Meeting with Jai tomorrow at 3:30",
          userId: "user-a",
          metadata: { source: "automatic_chat" },
        },
      ],
    });
    const { searchMem0 } = await import("./mem0-client");

    await expect(searchMem0("user-a", "meeting with Jai", 8)).resolves.toEqual([
      expect.objectContaining({ id: "owned-legacy" }),
    ]);
  });

  it("does not cache an empty cloud recall while Mem0 is still indexing", async () => {
    sdk.search.mockResolvedValue({ results: [] });
    const { searchMem0 } = await import("./mem0-client");

    await searchMem0("user-empty-cache", "meeting with Jai", 8);
    await searchMem0("user-empty-cache", "meeting with Jai", 8);

    expect(sdk.search).toHaveBeenCalledTimes(2);
  });

  it("recalls a just-delivered user fact while Mem0 is still indexing it", async () => {
    sdk.add.mockResolvedValue({ status: "PENDING" });
    sdk.search.mockResolvedValue({ results: [] });
    const { addMem0Turn, searchMem0 } = await import("./mem0-client");

    await addMem0Turn({
      id: "stage-recent",
      userId: "user-recent",
      sessionId: "session-imessage",
      turnId: "turn-imessage",
      userMessage: "I have a meeting with Jai tomorrow at 3:30.",
      assistantMessage: "Got it.",
    });
    const memories = await searchMem0(
      "user-recent",
      "When is my meeting with Jai?",
      8,
      { includeRecent: true },
    );

    expect(memories).toEqual(expect.arrayContaining([
      expect.objectContaining({
        id: "recent:stage-recent",
        memory: "I have a meeting with Jai tomorrow at 3:30.",
        userId: "user-recent",
      }),
    ]));

    await expect(searchMem0("user-recent", "When is my meeting with Jai?", 8))
      .resolves.toEqual([]);
  });

  it("never exposes a recent turn to another Better Auth user", async () => {
    sdk.add.mockResolvedValue({ status: "PENDING" });
    sdk.search.mockResolvedValue({ results: [] });
    const { addMem0Turn, searchMem0 } = await import("./mem0-client");

    await addMem0Turn({
      id: "stage-private",
      userId: "user-a",
      sessionId: "session-a",
      turnId: "turn-a",
      userMessage: "My private reminder is at 4 PM.",
      assistantMessage: "Understood.",
    });

    await expect(searchMem0("user-b", "private reminder", 8, { includeRecent: true }))
      .resolves.toEqual([]);
  });

  it("clears the recent read-through buffer for memory deletion and forget-all", async () => {
    sdk.add.mockResolvedValue({ status: "PENDING" });
    sdk.search.mockResolvedValue({ results: [] });
    const { addMem0Turn, clearRecentMem0Turns, searchMem0 } = await import("./mem0-client");

    await addMem0Turn({
      id: "stage-forget",
      userId: "user-forget",
      sessionId: "session-forget",
      turnId: "turn-forget",
      userMessage: "Forget this temporary fact.",
      assistantMessage: "Understood.",
    });
    await clearRecentMem0Turns("user-forget");

    await expect(searchMem0("user-forget", "temporary fact", 8, { includeRecent: true }))
      .resolves.toEqual([]);
  });

  it("requires the Better Auth user and app-owned source for deletion", async () => {
    const { isOwnedMem0Memory } = await import("./mem0-client");
    const base = { id: "memory-1", memory: "fact", categories: [] };

    expect(isOwnedMem0Memory({ ...base, userId: "user-123" }, "user-123")).toBe(false);
    expect(isOwnedMem0Memory({
      ...base,
      userId: "user-123",
      metadata: { source: "automatic_chat", app_id: "use-memory" },
    }, "user-123")).toBe(true);
    expect(isOwnedMem0Memory({
      ...base,
      userId: "someone-else",
      metadata: { source: "automatic_chat", app_id: "use-memory" },
    }, "user-123")).toBe(false);
  });
});
