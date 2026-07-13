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

  it("scopes recall to the Better Auth user and the app namespace", async () => {
    sdk.search.mockResolvedValue({ results: [] });
    const { searchMem0 } = await import("./mem0-client");

    await searchMem0("user-123", "favorite editor", 8);

    expect(sdk.search).toHaveBeenCalledWith("favorite editor", expect.objectContaining({
      filters: {
        AND: [
          { user_id: "user-123" },
          { agent_id: "use-memory" },
          { app_id: "use-memory" },
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

    expect(sdk.add).toHaveBeenCalledWith(expect.any(Array), expect.objectContaining({
      userId: "user-123",
      agentId: "use-memory",
      appId: "use-memory",
      runId: "session-1",
    }));
  });

  it("denies delete ownership when any namespace field is absent", async () => {
    const { isOwnedMem0Memory } = await import("./mem0-client");
    const base = { id: "memory-1", memory: "fact", categories: [] };

    expect(isOwnedMem0Memory({ ...base, userId: "user-123" }, "user-123")).toBe(false);
    expect(isOwnedMem0Memory({
      ...base,
      userId: "user-123",
      agentId: "use-memory",
      appId: "use-memory",
    }, "user-123")).toBe(true);
  });
});
