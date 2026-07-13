import { z } from "zod";
import { logEvent, opaqueReference } from "#shared/observability";
import { requireInternalRequest } from "~~/server/utils/internal-api";
import {
  retryPendingAutomaticMemoryTurns,
  stageAutomaticMemoryTurn,
} from "~~/server/utils/mem0";

const turnBodySchema = z.object({
  userId: z.string().trim().min(1).max(300),
  sessionId: z.string().trim().min(1).max(300),
  turnId: z.string().trim().min(1).max(300),
  userMessage: z.string().trim().min(1).max(20_000).optional(),
  assistantMessage: z.string().trim().min(1).max(20_000).optional(),
}).refine(body => body.userMessage || body.assistantMessage, {
  message: "At least one message is required",
});

export default defineEventHandler(async (event) => {
  requireInternalRequest(event);
  const body = await readValidatedBody(event, turnBodySchema.parse);
  const staged = await stageAutomaticMemoryTurn(body);

  if (body.assistantMessage && staged.staged) {
    const delivery = await retryPendingAutomaticMemoryTurns(body.userId, 3);
    logEvent("info", "mem0.turn.delivery_processed", {
      userRef: opaqueReference(body.userId),
      sessionRef: opaqueReference(body.sessionId),
      turnRef: opaqueReference(body.turnId),
      processed: delivery.processed,
      delivered: delivery.delivered,
    });
    return { ...staged, delivery };
  }

  return staged;
});
