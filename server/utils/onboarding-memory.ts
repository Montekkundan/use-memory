import { errorKind, logEvent, opaqueReference } from "#shared/observability";
import {
  retryPendingAutomaticMemoryTurns,
  stageAutomaticMemoryTurn,
} from "~~/server/utils/mem0";

export async function stageOnboardingMemory(input: {
  appUserId?: string | null;
  consented: boolean;
  messageId?: string;
  phoneNumber: string;
  userMessage: string;
  assistantMessage: string;
}) {
  if (
    !input.appUserId
    || !input.consented
    || !input.messageId
    || !input.userMessage.trim()
    || !input.assistantMessage.trim()
  ) {
    return { staged: false as const, reason: "not_eligible" as const };
  }

  const sessionId = `onboarding:${opaqueReference(input.phoneNumber)}`;
  try {
    const staged = await stageAutomaticMemoryTurn({
      userId: input.appUserId,
      sessionId,
      turnId: input.messageId,
      userMessage: input.userMessage,
      assistantMessage: input.assistantMessage,
    });
    const delivery = staged.staged
      ? await retryPendingAutomaticMemoryTurns(input.appUserId, 1)
      : undefined;
    logEvent("info", "mem0.onboarding.staged", {
      userRef: opaqueReference(input.appUserId),
      turnRef: opaqueReference(input.messageId),
      staged: staged.staged,
      reason: staged.reason,
      delivered: delivery?.delivered,
    });
    return { ...staged, delivery };
  }
  catch (error) {
    logEvent("warn", "mem0.onboarding.stage_deferred", {
      userRef: opaqueReference(input.appUserId),
      turnRef: opaqueReference(input.messageId),
      errorKind: errorKind(error),
    });
    return { staged: false as const, reason: "deferred" as const };
  }
}
