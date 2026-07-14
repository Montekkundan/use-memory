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
const RECENT_TURN_TTL_SECONDS = 10 * 60;
const RECENT_TURN_LIMIT = 2;
const MAX_LOCAL_CACHE_ENTRIES = 250;
export const MEM0_AGENT_ID = "use-memory";
export const MEM0_APP_ID = "use-memory";
const MEM0_SOURCE = "automatic_chat";
const USER_MEMORY_EXTRACTION_INSTRUCTIONS = `Only extract facts explicitly stated by the user.
Ignore assistant messages, assistant limitations, tool output, questions, requests for information, guesses, and unconfirmed suggestions.
Keep useful personal facts, preferences, relationships, plans, commitments, dates, and times.
Preserve names and temporal details exactly as the user stated them. Do not replace a stated date or time with "unknown".
If the message contains no user fact worth remembering, extract no memory.`;

const localRecallCache = new Map<string, { expiresAt: number; memories: Mem0Memory[] }>();
const localRecentTurnCache = new Map<string, {
  expiresAt: number;
  turns: RecentMem0Turn[];
}>();
let singletonClient: MemoryClient | undefined;
let singletonClientKey = "";
let singletonRedis: Redis | null | undefined;

export class Mem0ConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "Mem0ConfigurationError";
  }
}

interface RecentMem0Turn {
  id: string;
  memory: string;
  userId: string;
  createdAt: string;
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
  if (!memories.length) {
    return;
  }

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

function recentTurnKey(userId: string) {
  return `mem0:recent-turns:${digest(userId)}`;
}

async function getRecentMem0Turns(userId: string) {
  const key = recentTurnKey(userId);
  const redis = getRedis();
  if (redis) {
    try {
      return await redis.lrange<RecentMem0Turn>(key, 0, RECENT_TURN_LIMIT - 1);
    }
    catch {
      return [];
    }
  }

  if (!isLocalDevelopment()) {
    return [];
  }
  const cached = localRecentTurnCache.get(key);
  if (!cached || cached.expiresAt <= Date.now()) {
    localRecentTurnCache.delete(key);
    return [];
  }
  return cached.turns;
}

async function storeRecentMem0Turn(turn: RecentMem0Turn) {
  const key = recentTurnKey(turn.userId);
  const redis = getRedis();
  if (redis) {
    try {
      await redis.pipeline()
        .lpush(key, turn)
        .ltrim(key, 0, RECENT_TURN_LIMIT - 1)
        .expire(key, RECENT_TURN_TTL_SECONDS)
        .exec();
    }
    catch {
      // Mem0 remains the durable source if the short read-through buffer is unavailable.
    }
    return;
  }

  if (!isLocalDevelopment()) {
    return;
  }
  const current = localRecentTurnCache.get(key)?.turns ?? [];
  localRecentTurnCache.set(key, {
    expiresAt: Date.now() + RECENT_TURN_TTL_SECONDS * 1_000,
    turns: [turn, ...current.filter(item => item.id !== turn.id)].slice(0, RECENT_TURN_LIMIT),
  });
}

export async function clearRecentMem0Turns(userId: string) {
  const key = recentTurnKey(userId);
  localRecentTurnCache.delete(key);
  const redis = getRedis();
  if (redis) {
    await redis.del(key);
  }
}

function mergeRecentMem0Turns(
  recentTurns: RecentMem0Turn[],
  memories: Mem0Memory[],
  limit: number,
) {
  const merged: Mem0Memory[] = [];
  const seen = new Set<string>();
  for (const memory of [
    ...recentTurns.map(turn => ({
      ...turn,
      categories: ["recent_conversation"],
      metadata: { source: "recent_turn_buffer" },
    } satisfies Mem0Memory)),
    ...memories,
  ]) {
    const key = memory.memory.trim().toLocaleLowerCase();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    merged.push(memory);
    if (merged.length >= limit) break;
  }
  return merged;
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

function isUseMemoryRecord(memory: Mem0Memory, userId: string) {
  if (memory.userId !== userId) {
    return false;
  }

  const source = memory.metadata?.source;
  const appId = memory.metadata?.app_id;
  const agentId = memory.metadata?.agent_id;
  return source === MEM0_SOURCE
    && (appId === undefined || appId === MEM0_APP_ID)
    && (agentId === undefined || agentId === MEM0_AGENT_ID);
}

export async function searchMem0(
  userId: string,
  query: string,
  limit = 8,
  options: { includeRecent?: boolean } = {},
) {
  const normalizedLimit = Math.max(1, Math.min(8, limit));
  const [cached, recentTurns] = await Promise.all([
    getCachedRecall(userId, query, normalizedLimit),
    options.includeRecent ? getRecentMem0Turns(userId) : Promise.resolve([]),
  ]);
  if (cached) {
    return mergeRecentMem0Turns(recentTurns, cached, normalizedLimit);
  }

  const response = await getMem0Client().search(query, {
    filters: {
      AND: [
        { user_id: userId },
        { metadata: { source: MEM0_SOURCE } },
      ],
    },
    topK: normalizedLimit,
    rerank: true,
    latestOnly: true,
  });
  const memories = response.results
    .map(normalizeMemory)
    .filter((memory): memory is Mem0Memory => Boolean(memory))
    .filter(memory => isUseMemoryRecord(memory, userId))
    .slice(0, normalizedLimit);

  await setCachedRecall(userId, query, normalizedLimit, memories);
  return mergeRecentMem0Turns(recentTurns, memories, normalizedLimit);
}

export async function addMem0Turn(input: {
  id: string;
  userId: string;
  sessionId: string;
  turnId: string;
  userMessage: string;
  assistantMessage?: string;
  createdAt?: Date;
}) {
  await getMem0Client().add([
    { role: "user", content: input.userMessage },
  ], {
    userId: input.userId,
    agentId: MEM0_AGENT_ID,
    appId: MEM0_APP_ID,
    runId: input.sessionId,
    infer: true,
    customInstructions: USER_MEMORY_EXTRACTION_INSTRUCTIONS,
    metadata: {
      source: MEM0_SOURCE,
      app_id: MEM0_APP_ID,
      agent_id: MEM0_AGENT_ID,
      stage_id: input.id,
      session_id: input.sessionId,
      turn_id: input.turnId,
      ...(input.createdAt ? { message_created_at: input.createdAt.toISOString() } : {}),
    },
  });
  const createdAt = input.createdAt?.toISOString() ?? new Date().toISOString();
  await storeRecentMem0Turn({
    id: `recent:${input.id}`,
    memory: input.userMessage.slice(0, 2_000),
    userId: input.userId,
    createdAt,
  });
  await clearMem0RecallCache(input.userId);
}

export async function getMem0Memory(memoryId: string) {
  const memory = await getMem0Client().get(memoryId);
  return normalizeMemory(memory);
}

export function isOwnedMem0Memory(memory: Mem0Memory | undefined, userId: string) {
  return Boolean(memory && isUseMemoryRecord(memory, userId));
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
