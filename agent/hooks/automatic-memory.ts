import { defineHook } from "eve/hooks";
import {
  errorKind,
  logEvent,
  opaqueReference,
} from "../../shared/observability.js";
import { stageAutomaticMemoryRemote } from "../lib/mem0-internal.js";
import { sessionUserId } from "../lib/session-user.js";

interface TurnPair {
  userMessage?: string;
  assistantMessage?: string;
  staged?: boolean;
}

const activeTurns = new Map<string, TurnPair>();

function turnKey(sessionId: string, turnId: string) {
  return `${sessionId}\n${turnId}`;
}

async function stageSafely(input: Parameters<typeof stageAutomaticMemoryRemote>[0]) {
  try {
    const result = await stageAutomaticMemoryRemote(input);
    if (input.assistantMessage || input.deliveryRequested) {
      logEvent("info", "mem0.turn.staged", {
        userRef: opaqueReference(input.userId),
        sessionRef: opaqueReference(input.sessionId),
        turnRef: opaqueReference(input.turnId),
        staged: result.staged,
        reason: result.reason,
        processed: result.delivery?.processed,
        delivered: result.delivery?.delivered,
      });
    }
    return true;
  }
  catch (error) {
    logEvent("warn", "mem0.turn.stage_deferred", {
      userRef: opaqueReference(input.userId),
      sessionRef: opaqueReference(input.sessionId),
      turnRef: opaqueReference(input.turnId),
      errorKind: errorKind(error),
    });
    return false;
  }
}

export default defineHook({
  events: {
    async "message.received"(event, ctx) {
      const userId = sessionUserId(ctx.session.auth.current);
      if (!userId) return;

      const key = turnKey(ctx.session.id, event.data.turnId);
      const pair = activeTurns.get(key) ?? {};
      pair.userMessage = event.data.message;
      activeTurns.set(key, pair);

      await stageSafely({
        userId,
        sessionId: ctx.session.id,
        turnId: event.data.turnId,
        userMessage: event.data.message,
      });
    },
    async "message.completed"(event, ctx) {
      if (event.data.finishReason === "tool-calls" || !event.data.message) return;
      const userId = sessionUserId(ctx.session.auth.current);
      if (!userId) return;

      const key = turnKey(ctx.session.id, event.data.turnId);
      const pair = activeTurns.get(key) ?? {};
      pair.assistantMessage = event.data.message;
      activeTurns.set(key, pair);

      pair.staged = await stageSafely({
        userId,
        sessionId: ctx.session.id,
        turnId: event.data.turnId,
        userMessage: pair.userMessage,
        assistantMessage: event.data.message,
      });
    },
    async "turn.completed"(event, ctx) {
      const key = turnKey(ctx.session.id, event.data.turnId);
      const pair = activeTurns.get(key);
      activeTurns.delete(key);

      const userId = sessionUserId(ctx.session.auth.current);
      if (!userId || !pair?.userMessage || !pair.assistantMessage || pair.staged) return;
      await stageSafely({
        userId,
        sessionId: ctx.session.id,
        turnId: event.data.turnId,
        userMessage: pair.userMessage,
        assistantMessage: pair.assistantMessage,
      });
    },
    async "turn.failed"(event, ctx) {
      const key = turnKey(ctx.session.id, event.data.turnId);
      const pair = activeTurns.get(key);
      activeTurns.delete(key);

      const userId = sessionUserId(ctx.session.auth.current);
      if (!userId || !pair?.userMessage) return;

      await stageSafely({
        userId,
        sessionId: ctx.session.id,
        turnId: event.data.turnId,
        userMessage: pair.userMessage,
        deliveryRequested: true,
      });
    },
  },
});
