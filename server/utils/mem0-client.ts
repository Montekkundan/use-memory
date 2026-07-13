import { createHash } from "node:crypto";
import { Redis } from "@upstash/redis";
import { MemoryClient, type Memory } from "mem0ai";

export interface Mem0Memory {
  id: string;
  memory: string;
  userId?: string;
  agentId?: string;
  appId?: string;
  score?: number;
  categories: string[];
  createdAt?: string;
  updatedAt?: string;
  metadata?: Record<string, unknown>;
}

const RECALL_CACHE_TTL_SECONDS = 20;
const MAX_LOCAL_CACHE_ENTRIES = 250;
export const MEM0_AGENT_ID = "use-memory";
export const MEM0_APP_ID = "use-memory";

const localRecallCache = new Map<string, { expiresAt: number; memories: Mem0Memory[] }>();
let singletonClient: MemoryClient | undefined;
let singletonClientKey = "";
let singletonRedis: Redis | null | undefined;

export class Mem0ConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "Mem0ConfigurationError";
  }
}

function getMem0Client() {
  const apiKey = process.env.MEM0_API_KEY?.trim();
  if (!apiKey) {
    throw new Mem0ConfigurationError("MEM0_API_KEY is not configured");
  }

  const host = process.env.MEM0_API_URL?.trim().replace(/\/$/, "");
  const key = `${apiKey}\n${host ?? ""}`;
  if (!singletonClient || singletonClientKey !== key) {
    singletonClient = new MemoryClient({ apiKey, ...(host ? { host } : {}) });
    singletonClientKey = key;
  }
  return singletonClient;
}

function getRedis() {
  if (singletonRedis !== undefined) {
    return singletonRedis;
  }

  const url = process.env.UPSTASH_REDIS_REST_URL?.trim()
    || process.env.KV_REST_API_URL?.trim();
  const token = process.env.UPSTASH_REDIS_REST_TOKEN?.trim()
    || process.env.KV_REST_API_TOKEN?.trim();

  singletonRedis = url && token
    ? new Redis({ url, token, enableTelemetry: false })
    : null;
  return singletonRedis;
}

function isLocalDevelopment() {
  return process.env.NODE_ENV !== "production";
}

function digest(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

async function recallVersion(userId: string) {
  const redis = getRedis();
  if (!redis) {
    return "0";
  }

  try {
    return String(await redis.get<number>(`mem0:recall-version:${digest(userId)}`) ?? 0);
  }
  catch {
    return "0";
  }
}

async function recallCacheKey(userId: string, query: string, limit: number) {
  const version = await recallVersion(userId);
  return `mem0:recall:${digest(`${userId}\n${version}\n${limit}\n${query.trim().toLocaleLowerCase()}`)}`;
}

async function getCachedRecall(userId: string, query: string, limit: number) {
  const key = await recallCacheKey(userId, query, limit);
  const redis = getRedis();
  if (redis) {
    try {
      const cached = await redis.get<Mem0Memory[]>(key);
      return cached ?? undefined;
    }
    catch {
      return undefined;
    }
  }

  if (!isLocalDevelopment()) {
    return undefined;
  }
  const cached = localRecallCache.get(key);
  if (!cached) {
    return undefined;
  }
  if (cached.expiresAt <= Date.now()) {
    localRecallCache.delete(key);
    return undefined;
  }
  return cached.memories;
}

async function setCachedRecall(userId: string, query: string, limit: number, memories: Mem0Memory[]) {
  const key = await recallCacheKey(userId, query, limit);
  const redis = getRedis();
  if (redis) {
    try {
      await redis.set(key, memories, { ex: RECALL_CACHE_TTL_SECONDS });
    }
    catch {
      // Recall still succeeds if the optional cache is unavailable.
    }
    return;
  }

  if (!isLocalDevelopment()) {
    return;
  }
  if (localRecallCache.size >= MAX_LOCAL_CACHE_ENTRIES) {
    const oldestKey = localRecallCache.keys().next().value;
    if (oldestKey) {
      localRecallCache.delete(oldestKey);
    }
  }
  localRecallCache.set(key, {
    expiresAt: Date.now() + RECALL_CACHE_TTL_SECONDS * 1_000,
    memories,
  });
}

export async function clearMem0RecallCache(userId: string) {
  const redis = getRedis();
  if (redis) {
    try {
      await redis.incr(`mem0:recall-version:${digest(userId)}`);
    }
    catch {
      // A stale recall expires after twenty seconds even if invalidation fails.
    }
  }
  localRecallCache.clear();
}

function normalizeDate(value: unknown) {
  if (value instanceof Date) {
    return value.toISOString();
  }
  return typeof value === "string" ? value : undefined;
}

function normalizeMemory(memory: Memory): Mem0Memory | undefined {
  const text = typeof memory.memory === "string"
    ? memory.memory
    : typeof memory.data?.memory === "string" ? memory.data.memory : undefined;
  if (!memory.id || !text?.trim()) {
    return undefined;
  }

  return {
    id: memory.id,
    memory: text.trim(),
    userId: memory.userId,
    agentId: memory.agentId ?? undefined,
    appId: memory.appId ?? undefined,
    score: memory.score,
    categories: memory.categories ?? [],
    createdAt: normalizeDate(memory.createdAt),
    updatedAt: normalizeDate(memory.updatedAt),
    metadata: memory.metadata && typeof memory.metadata === "object"
      ? memory.metadata as Record<string, unknown>
      : undefined,
  };
}

export async function searchMem0(userId: string, query: string, limit = 8) {
  const normalizedLimit = Math.max(1, Math.min(8, limit));
  const cached = await getCachedRecall(userId, query, normalizedLimit);
  if (cached) {
    return cached;
  }

  const response = await getMem0Client().search(query, {
    filters: {
      AND: [
        { user_id: userId },
        { agent_id: MEM0_AGENT_ID },
        { app_id: MEM0_APP_ID },
      ],
    },
    topK: normalizedLimit,
    rerank: true,
    latestOnly: true,
  });
  const memories = response.results
    .map(normalizeMemory)
    .filter((memory): memory is Mem0Memory => Boolean(memory))
    .slice(0, normalizedLimit);

  await setCachedRecall(userId, query, normalizedLimit, memories);
  return memories;
}

export async function addMem0Turn(input: {
  id: string;
  userId: string;
  sessionId: string;
  turnId: string;
  userMessage: string;
  assistantMessage: string;
}) {
  await getMem0Client().add([
    { role: "user", content: input.userMessage },
    { role: "assistant", content: input.assistantMessage },
  ], {
    userId: input.userId,
    agentId: MEM0_AGENT_ID,
    appId: MEM0_APP_ID,
    runId: input.sessionId,
    infer: true,
    metadata: {
      source: "automatic_chat",
      stage_id: input.id,
      session_id: input.sessionId,
      turn_id: input.turnId,
    },
  });
  await clearMem0RecallCache(input.userId);
}

export async function getMem0Memory(memoryId: string) {
  const memory = await getMem0Client().get(memoryId);
  return normalizeMemory(memory);
}

export function isOwnedMem0Memory(memory: Mem0Memory | undefined, userId: string) {
  return memory?.userId === userId
    && memory.agentId === MEM0_AGENT_ID
    && memory.appId === MEM0_APP_ID;
}

export async function deleteMem0Memory(memoryId: string) {
  await getMem0Client().delete(memoryId);
}

export async function deleteAllMem0Memories(userId: string) {
  await getMem0Client().deleteAll({
    userId,
    agentId: MEM0_AGENT_ID,
    appId: MEM0_APP_ID,
  });
  await clearMem0RecallCache(userId);
}
