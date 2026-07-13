import { Modal, Select, SelectOption } from "chat";
import { chatSdkChannel } from "eve/channels/chat-sdk";
import { agent } from "../../shared/agent.js";
import {
  createRequestId,
  errorKind,
  logEvent,
  opaqueReference,
} from "../../shared/observability.js";
import { buildAppSessionAuth } from "../../shared/session-auth.js";
import type {
  OnboardingGatewayResponse,
  OnboardingNativeChoice,
} from "../../shared/types/onboarding.js";
import { runOnboardingGateway } from "../lib/onboarding-internal.js";
import {
  createPhotonChannelRegistration,
  parsePhotonOnboardingPollVote,
  photonAdapter,
  photonState,
} from "../lib/photon.js";

const IMESSAGE_CONTEXT = [
  "Channel: iMessage via Photon Cloud. There is no browser UI in this thread.",
  "Keep responses easy to scan in Messages and avoid wide tables.",
  "Do not claim to have read audio when only attachment metadata is available.",
] as const;

const bridge = chatSdkChannel({
  concurrency: "queue",
  userName: agent.name,
  ...createPhotonChannelRegistration(photonAdapter),
  state: photonState,
});

export const { bot, send } = bridge;
export default bridge.channel;

function normalizeInboundPhone(value: string) {
  const compact = value.trim().replace(/[\s().-]/gu, "");
  return /^\+[1-9]\d{7,14}$/u.test(compact) ? compact : null;
}

function parseModalMetadata(value: string | undefined) {
  if (!value) return null;
  try {
    const parsed = JSON.parse(value) as { phoneNumber?: unknown; threadId?: unknown };
    if (typeof parsed.phoneNumber !== "string" || typeof parsed.threadId !== "string") return null;
    return parsed as { phoneNumber: string; threadId: string };
  }
  catch {
    return null;
  }
}

async function offerNativeChoice(
  threadId: string,
  phoneNumber: string,
  choice: OnboardingNativeChoice | undefined,
) {
  if (!choice) return;

  try {
    await photonAdapter.openModal(
      threadId,
      Modal({
        callbackId: choice.callbackId,
        title: choice.title,
        privateMetadata: JSON.stringify({ phoneNumber, threadId }),
        children: [
          Select({
            id: choice.fieldId,
            label: choice.title,
            options: choice.options.map(option => SelectOption(option)),
          }),
        ],
      }),
      threadId,
    );
  }
  catch (error) {
    // Typed numbered choices remain the durable fallback when native polls are
    // unavailable or their in-memory callback registry was lost on a cold start.
    logEvent("warn", "photon.onboarding.choice_unavailable", {
      errorKind: errorKind(error),
      phoneRef: opaqueReference(phoneNumber),
    });
  }
}

async function postGatewayResponse(
  threadId: string,
  phoneNumber: string,
  response: Exclude<OnboardingGatewayResponse, { kind: "ready" }>,
) {
  await photonAdapter.postMessage(threadId, response.message);
  await offerNativeChoice(threadId, phoneNumber, response.nativeChoice);
}

bot.onDirectMessage(async (thread, message) => {
  const startedAt = Date.now();
  const requestId = createRequestId(message.id);
  const phoneNumber = normalizeInboundPhone(message.author.userId);
  if (!phoneNumber) {
    await thread.post(
      "For privacy, use-memory currently accepts iMessage DMs from phone-number identities only. Apple ID email handles are not supported yet.",
    );
    return;
  }

  const fields = {
    requestId,
    phoneRef: opaqueReference(phoneNumber),
    attachmentCount: message.attachments.length,
  };
  logEvent("info", "photon.message.received", fields);

  const onboardingPollVote = parsePhotonOnboardingPollVote(message.raw);
  if (onboardingPollVote !== undefined) {
    if (onboardingPollVote === null) return;

    const response = await runOnboardingGateway({
      interaction: { kind: "consent", value: onboardingPollVote },
      messageId: message.id,
      phoneNumber,
      text: "",
      threadId: thread.id,
    });

    logEvent("info", "photon.onboarding.poll_vote", {
      ...fields,
      onboardingKind: response.kind,
      durationMs: Date.now() - startedAt,
    });
    if (response.kind !== "ready") {
      await postGatewayResponse(thread.id, phoneNumber, response);
    }
    return;
  }

  try {
    await photonAdapter.markRead(thread.id, message.id);
  }
  catch {
    // Read receipts are helpful but not required for message processing.
  }

  const response = await runOnboardingGateway({
    attachments: message.attachments.map(attachment => ({
      type: attachment.type,
      mimeType: attachment.mimeType,
      name: attachment.name,
    })),
    messageId: message.id,
    phoneNumber,
    text: message.text,
    threadId: thread.id,
  });

  if (response.kind !== "ready") {
    logEvent("info", "photon.onboarding.responded", {
      ...fields,
      onboardingKind: response.kind,
      durationMs: Date.now() - startedAt,
    });
    await postGatewayResponse(thread.id, phoneNumber, response);
    return;
  }

  const text = message.text.trim();
  if (!text) {
    const hasAudio = message.attachments.some(attachment => attachment.type === "audio");
    await thread.post(
      hasAudio
        ? "I can see your voice message, but Photon does not expose its audio bytes through Chat SDK yet. Please type the request."
        : "I received the attachment, but I need a typed message to act on it here.",
    );
    return;
  }

  await thread.startTyping("Thinking…");
  const auth = buildAppSessionAuth(response.appUserId, {
    channel: "photon",
    phone_number: phoneNumber,
  });

  try {
    await send(
      { message: text, context: [...IMESSAGE_CONTEXT] },
      { auth, thread, title: `iMessage · ${opaqueReference(phoneNumber)}` },
    );
    logEvent("info", "photon.agent_turn.completed", {
      ...fields,
      userRef: opaqueReference(response.appUserId),
      durationMs: Date.now() - startedAt,
    });
  }
  catch (error) {
    logEvent("error", "photon.agent_turn.failed", {
      ...fields,
      userRef: opaqueReference(response.appUserId),
      durationMs: Date.now() - startedAt,
      errorKind: errorKind(error),
    });
    throw error;
  }
});

bot.onNewMention(async (thread) => {
  if (!thread.isDM) {
    await thread.post(
      "For privacy, I only work in a one-to-one iMessage conversation. Please message me directly.",
    );
  }
});

bot.onModalSubmit("use-memory-onboarding-consent", async (event) => {
  const metadata = parseModalMetadata(event.privateMetadata);
  if (!metadata) return;

  const response = await runOnboardingGateway({
    messageId: `photon-poll:${event.viewId}`,
    phoneNumber: metadata.phoneNumber,
    text: event.values.consent ?? "",
    threadId: metadata.threadId,
  });

  if (response.kind !== "ready") {
    await postGatewayResponse(metadata.threadId, metadata.phoneNumber, response);
  }
});
