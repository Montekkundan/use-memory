import { and, eq, isNotNull, isNull, lt, lte, or } from "drizzle-orm";
import { db, schema } from "@nuxthub/db";
import { errorKind, logEvent, opaqueReference } from "#shared/observability";
import {
  addMem0Turn,
  clearMem0RecallCache,
  clearRecentMem0Turns,
  deleteAllMem0Memories,
  deleteMem0Memory,
  getMem0Memory,
  isOwnedMem0Memory,
  searchMem0,
} from "~~/server/utils/mem0-client";
import { containsSensitiveMemoryContent, safeMemoryText } from "~~/server/utils/mem0-safety";

const MAX_DELIVERY_ATTEMPTS = 6;
const PROCESSING_STALE_AFTER_MS = 5 * 60 * 1000;
const RETRY_DELAYS_MS = [30_000, 2 * 60_000, 10 * 60_000, 60 * 60_000, 6 * 60 * 60_000];

export interface AutomaticMemorySettings {
  enabled: boolean;
  consentedAt?: number;
}

export async function getAutomaticMemorySettings(userId: string): Promise<AutomaticMemorySettings> {
  const [settings] = await db.select()
    .from(schema.mem0UserSettings)
    .where(eq(schema.mem0UserSettings.userId, userId))
    .limit(1);

  return {
    enabled: settings?.automaticMemoryEnabled ?? false,
    consentedAt: settings?.consentedAt?.getTime(),
  };
}

export async function setAutomaticMemoryConsent(userId: string, enabled: boolean) {
  const now = new Date();
  await db.insert(schema.mem0UserSettings)
    .values({
      userId,
      automaticMemoryEnabled: enabled,
      consentedAt: enabled ? now : null,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: schema.mem0UserSettings.userId,
      set: {
        automaticMemoryEnabled: enabled,
        consentedAt: enabled ? now : null,
        updatedAt: now,
      },
    });

  if (!enabled) {
    await db.update(schema.mem0TurnStages)
      .set({
        userMessage: null,
        assistantMessage: null,
        status: "skipped",
        nextAttemptAt: null,
        lastError: "Automatic memory disabled before delivery",
        updatedAt: now,
      })
      .where(and(
        eq(schema.mem0TurnStages.userId, userId),
        or(
          eq(schema.mem0TurnStages.status, "pending"),
          eq(schema.mem0TurnStages.status, "processing"),
          eq(schema.mem0TurnStages.status, "failed"),
        ),
      ));
    await clearMem0RecallCache(userId);
    await clearRecentMem0Turns(userId);
  }

  return getAutomaticMemorySettings(userId);
}

async function findStage(sessionId: string, turnId: string) {
  const [stage] = await db.select()
    .from(schema.mem0TurnStages)
    .where(and(
      eq(schema.mem0TurnStages.sessionId, sessionId),
      eq(schema.mem0TurnStages.turnId, turnId),
    ))
    .limit(1);
  return stage;
}

export async function stageAutomaticMemoryTurn(input: {
  userId: string;
  sessionId: string;
  turnId: string;
  userMessage?: unknown;
  assistantMessage?: unknown;
}) {
  const settings = await getAutomaticMemorySettings(input.userId);
  if (!settings.enabled) {
    return { staged: false as const, reason: "consent_required" as const };
  }

  const userMessage = safeMemoryText(input.userMessage);
  const assistantMessage = safeMemoryText(input.assistantMessage);
  if (!userMessage && !assistantMessage) {
    return { staged: false as const, reason: "empty" as const };
  }

  const now = new Date();
  const existing = await findStage(input.sessionId, input.turnId);
  const containsSensitiveContent = containsSensitiveMemoryContent(userMessage)
    || containsSensitiveMemoryContent(assistantMessage);

  if (containsSensitiveContent || existing?.status === "skipped") {
    if (existing) {
      await db.update(schema.mem0TurnStages)
        .set({
          userMessage: null,
          assistantMessage: null,
          status: "skipped",
          nextAttemptAt: null,
          lastError: "Sensitive content was not stored",
          updatedAt: now,
        })
        .where(eq(schema.mem0TurnStages.id, existing.id));
    }
    else {
      await db.insert(schema.mem0TurnStages)
        .values({
          id: crypto.randomUUID(),
          userId: input.userId,
          sessionId: input.sessionId,
          turnId: input.turnId,
          status: "skipped",
          lastError: "Sensitive content was not stored",
          updatedAt: now,
        })
        .onConflictDoNothing();
    }
    return { staged: false as const, reason: "sensitive" as const };
  }

  if (!existing) {
    await db.insert(schema.mem0TurnStages)
      .values({
        id: crypto.randomUUID(),
        userId: input.userId,
        sessionId: input.sessionId,
        turnId: input.turnId,
        userMessage,
        assistantMessage,
        status: "pending",
        updatedAt: now,
      })
      .onConflictDoNothing();
  }
  else if (existing.status !== "completed") {
    await db.update(schema.mem0TurnStages)
      .set({
        userMessage: userMessage ?? existing.userMessage,
        assistantMessage: assistantMessage ?? existing.assistantMessage,
        status: existing.status === "processing" ? "processing" : "pending",
        nextAttemptAt: null,
        lastError: null,
        updatedAt: now,
      })
      .where(eq(schema.mem0TurnStages.id, existing.id));
  }

  const stage = await findStage(input.sessionId, input.turnId);
  return { staged: Boolean(stage), stage };
}

function retryAt(attempts: number) {
  const delay = RETRY_DELAYS_MS[Math.min(Math.max(attempts - 1, 0), RETRY_DELAYS_MS.length - 1)]!;
  return new Date(Date.now() + delay);
}

function safeDeliveryError(error: unknown) {
  if (error instanceof Error) {
    return `${error.name}: ${error.message}`.slice(0, 500);
  }
  return "Unknown Mem0 delivery error";
}

export async function retryPendingAutomaticMemoryTurns(userId: string, limit = 3) {
  const settings = await getAutomaticMemorySettings(userId);
  if (!settings.enabled) {
    return { processed: 0, delivered: 0 };
  }

  const now = new Date();
  const staleBefore = new Date(now.getTime() - PROCESSING_STALE_AFTER_MS);
  const candidates = await db.select()
    .from(schema.mem0TurnStages)
    .where(and(
      eq(schema.mem0TurnStages.userId, userId),
      isNotNull(schema.mem0TurnStages.userMessage),
      isNotNull(schema.mem0TurnStages.assistantMessage),
      lt(schema.mem0TurnStages.attempts, MAX_DELIVERY_ATTEMPTS),
      or(
        eq(schema.mem0TurnStages.status, "pending"),
        and(
          eq(schema.mem0TurnStages.status, "failed"),
          or(
            lte(schema.mem0TurnStages.nextAttemptAt, now),
            isNull(schema.mem0TurnStages.nextAttemptAt),
          ),
        ),
        and(
          eq(schema.mem0TurnStages.status, "processing"),
          lte(schema.mem0TurnStages.updatedAt, staleBefore),
        ),
      ),
    ))
    .limit(Math.max(1, Math.min(10, limit)));

  let delivered = 0;
  for (const stage of candidates) {
    const attempts = stage.attempts + 1;
    const [claimed] = await db.update(schema.mem0TurnStages)
      .set({ status: "processing", attempts, updatedAt: new Date() })
      .where(and(
        eq(schema.mem0TurnStages.id, stage.id),
        eq(schema.mem0TurnStages.status, stage.status),
        eq(schema.mem0TurnStages.attempts, stage.attempts),
      ))
      .returning();

    if (!claimed?.userMessage || !claimed.assistantMessage) {
      continue;
    }

    try {
      await addMem0Turn({
        id: claimed.id,
        userId: claimed.userId,
        sessionId: claimed.sessionId,
        turnId: claimed.turnId,
        userMessage: claimed.userMessage,
        assistantMessage: claimed.assistantMessage,
        createdAt: claimed.createdAt,
      });
      await db.update(schema.mem0TurnStages)
        .set({
          userMessage: null,
          assistantMessage: null,
          status: "completed",
          nextAttemptAt: null,
          lastError: null,
          completedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(schema.mem0TurnStages.id, claimed.id));
      delivered += 1;
      logEvent("info", "mem0.delivery.completed", {
        userRef: opaqueReference(claimed.userId),
        stageRef: opaqueReference(claimed.id),
        attempt: attempts,
      });
    }
    catch (error) {
      await db.update(schema.mem0TurnStages)
        .set({
          status: "failed",
          nextAttemptAt: retryAt(attempts),
          lastError: safeDeliveryError(error),
          updatedAt: new Date(),
        })
        .where(eq(schema.mem0TurnStages.id, claimed.id));
      logEvent("error", "mem0.delivery.failed", {
        userRef: opaqueReference(claimed.userId),
        stageRef: opaqueReference(claimed.id),
        attempt: attempts,
        errorKind: errorKind(error),
      });
    }
  }

  return { processed: candidates.length, delivered };
}

export async function recallAutomaticMemories(userId: string, query: string, limit = 8) {
  const startedAt = Date.now();
  const fields = {
    userRef: opaqueReference(userId),
    queryRef: opaqueReference(query.trim().toLocaleLowerCase()),
  };
  const settings = await getAutomaticMemorySettings(userId);
  if (!settings.enabled) {
    logEvent("info", "mem0.recall.completed", {
      ...fields,
      resultCount: 0,
      reason: "consent_required",
      durationMs: Date.now() - startedAt,
    });
    return [];
  }

  await retryPendingAutomaticMemoryTurns(userId, 2).catch(() => undefined);
  try {
    const memories = await searchMem0(userId, query, limit, { includeRecent: true });
    logEvent("info", "mem0.recall.completed", {
      ...fields,
      resultCount: memories.length,
      durationMs: Date.now() - startedAt,
    });
    return memories;
  }
  catch (error) {
    logEvent("error", "mem0.recall.failed", {
      ...fields,
      errorKind: errorKind(error),
      durationMs: Date.now() - startedAt,
    });
    throw error;
  }
}

export async function searchAutomaticMemories(userId: string, query: string, limit = 8) {
  return searchMem0(userId, query, limit);
}

export async function deleteAutomaticMemory(userId: string, memoryId: string) {
  const memory = await getMem0Memory(memoryId);
  if (!isOwnedMem0Memory(memory, userId)) {
    return false;
  }
  await deleteMem0Memory(memoryId);
  await clearMem0RecallCache(userId);
  await clearRecentMem0Turns(userId);
  return true;
}

export async function forgetAllAutomaticMemories(userId: string) {
  await deleteAllMem0Memories(userId);
  await db.delete(schema.mem0TurnStages)
    .where(eq(schema.mem0TurnStages.userId, userId));
  await clearMem0RecallCache(userId);
  await clearRecentMem0Turns(userId);
}
