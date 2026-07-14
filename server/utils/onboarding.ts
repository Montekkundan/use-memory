import { createHash, randomInt, randomUUID, timingSafeEqual } from "node:crypto";
import { eq } from "drizzle-orm";
import { db, schema } from "@nuxthub/db";
import type {
  OnboardingGatewayRequest,
  OnboardingGatewayResponse,
  OnboardingNativeChoice,
  OnboardingSnapshot,
  OnboardingStep,
} from "#shared/types/onboarding";
import {
  isIanaTimezone,
  parseNumberedChoices,
  parseOnboardingConsent,
} from "#shared/onboarding-input";
import { imessageOnboardingSessions } from "~~/server/db/schema/onboarding";
import { sendPhoneSignInCode } from "~~/server/utils/auth-delivery";
import { createImessageBrowserLoginLink } from "~~/server/utils/imessage-browser-login";
import {
  getPhoneLinkByPhoneNumber,
  normalizePhoneNumber,
} from "~~/server/utils/phone-links";
import { isPhoneInvited, markWaitlistClaimed } from "~~/server/utils/waitlist";

type OnboardingRow = typeof imessageOnboardingSessions.$inferSelect;

const INTEREST_OPTIONS = [
  "work",
  "personal organization",
  "learning",
  "health",
  "creative projects",
  "finance",
] as const;

const INTEGRATION_OPTIONS = ["github"] as const;
const OTP_TTL_MS = 10 * 60 * 1000;
const OTP_RESEND_INTERVAL_MS = 60 * 1000;
const OTP_MAX_ATTEMPTS = 5;

function parseStringList(value: string): string[] {
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed)
      ? parsed.filter((item): item is string => typeof item === "string")
      : [];
  }
  catch {
    return [];
  }
}

function rowToSnapshot(row: OnboardingRow): OnboardingSnapshot {
  return {
    appUserId: row.appUserId,
    completedAt: row.completedAt?.getTime() ?? null,
    consent: row.consent,
    integrations: parseStringList(row.integrationsJson).filter(id => id === "github"),
    interests: parseStringList(row.interestsJson),
    name: row.name,
    phoneNumber: row.phoneNumber,
    preferences: parseStringList(row.preferencesJson),
    step: row.step as OnboardingStep,
    threadId: row.threadId,
    timezone: row.timezone,
    updatedAt: row.updatedAt.getTime(),
  };
}

function consentChoice(phoneNumber: string): OnboardingNativeChoice {
  const suffix = createHash("sha256").update(phoneNumber).digest("hex").slice(0, 6);
  return {
    callbackId: "use-memory-onboarding-consent",
    fieldId: "consent",
    options: [
      { label: "Yes, continue", value: "yes" },
      { label: "No, stop", value: "no" },
    ],
    title: `Set up use-memory? ${suffix}`,
  };
}

function promptFor(row: OnboardingRow): { message: string; nativeChoice?: OnboardingNativeChoice } {
  switch (row.step as OnboardingStep) {
    case "verify_phone":
      return {
        message: "I sent a six-digit verification code to this iMessage number. Reply with the code. Reply RESEND if it expires.",
      };
    case "consent":
      return {
        message: [
          "Welcome to use-memory. I can remember your preferences and use connected services on your behalf.",
          "Messages may be processed by the AI and services you choose. Continue?",
          "Reply YES or 1 to continue. Reply NO or 2 to stop.",
        ].join("\n\n"),
        nativeChoice: consentChoice(row.phoneNumber),
      };
    case "name":
      return { message: "What should I call you?" };
    case "timezone":
      return {
        message: "What is your timezone? Send an IANA name such as America/Toronto, Europe/London, or Asia/Kolkata.",
      };
    case "preferences":
      return {
        message: "How should I work with you? Tell me your communication style, routines, and any boundaries in one message. Reply SKIP if you prefer.",
      };
    case "interests":
      return {
        message: [
          "What should I be especially useful for? Reply with several numbers separated by commas, or write your own interests.",
          "1. Work\n2. Personal organization\n3. Learning\n4. Health\n5. Creative projects\n6. Finance",
        ].join("\n\n"),
      };
    case "integrations":
      return {
        message: [
          "Do you want to connect GitHub?",
          "1. GitHub\n2. None for now",
        ].join("\n\n"),
      };
    case "complete":
      return { message: "Onboarding is complete. Send me anything to get started." };
  }
}

async function getRow(phoneNumber: string) {
  const [row] = await db.select()
    .from(imessageOnboardingSessions)
    .where(eq(imessageOnboardingSessions.phoneNumber, phoneNumber))
    .limit(1);
  return row;
}

async function updateRow(phoneNumber: string, patch: Partial<typeof imessageOnboardingSessions.$inferInsert>) {
  await db.update(imessageOnboardingSessions)
    .set(patch)
    .where(eq(imessageOnboardingSessions.phoneNumber, phoneNumber));

  const row = await getRow(phoneNumber);
  if (!row) throw new Error("Onboarding session disappeared during update");
  return row;
}

async function ensureConsentedUserResources(appUserId: string) {
  await db.insert(schema.userProfiles)
    .values({ userId: appUserId })
    .onConflictDoNothing();
  await db.insert(schema.mem0UserSettings)
    .values({
      userId: appUserId,
      automaticMemoryEnabled: true,
      consentedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: schema.mem0UserSettings.userId,
      set: {
        automaticMemoryEnabled: true,
        consentedAt: new Date(),
        updatedAt: new Date(),
      },
    });
}

async function provisionPhoneUser(phoneNumber: string) {
  const linked = await getPhoneLinkByPhoneNumber(phoneNumber);
  if (linked) {
    await ensureConsentedUserResources(linked.appUserId);
    return linked.appUserId;
  }

  const emailHash = createHash("sha256").update(phoneNumber).digest("hex").slice(0, 32);
  const email = `imessage-${emailHash}@users.use-memory.local`;
  const [existingUser] = await db.select({ id: schema.user.id })
    .from(schema.user)
    .where(eq(schema.user.email, email))
    .limit(1);
  const appUserId = existingUser?.id ?? randomUUID();

  if (!existingUser) {
    await db.insert(schema.user).values({
      id: appUserId,
      name: "iMessage user",
      email,
      emailVerified: true,
      phoneNumber,
      phoneNumberVerified: true,
      phoneNumberVerifiedAt: new Date(),
    });
  }
  else {
    await db.update(schema.user)
      .set({
        phoneNumber,
        phoneNumberVerified: true,
        phoneNumberVerifiedAt: new Date(),
      })
      .where(eq(schema.user.id, appUserId));
  }

  await ensureConsentedUserResources(appUserId);
  return appUserId;
}

function otpPepper() {
  const secret = process.env.INTERNAL_API_SECRET?.trim();
  if (!secret) throw new Error("INTERNAL_API_SECRET is required for phone verification");
  return secret;
}

function hashOtp(phoneNumber: string, code: string) {
  return createHash("sha256")
    .update(`${otpPepper()}:${phoneNumber}:${code}`)
    .digest("hex");
}

function otpMatches(expectedHash: string, phoneNumber: string, code: string) {
  const expected = Buffer.from(expectedHash, "hex");
  const actual = Buffer.from(hashOtp(phoneNumber, code), "hex");
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

async function issueOtp(phoneNumber: string) {
  const code = randomInt(0, 1_000_000).toString().padStart(6, "0");
  const now = new Date();
  await sendPhoneSignInCode(phoneNumber, code);
  return {
    otpAttempts: 0,
    otpExpiresAt: new Date(now.getTime() + OTP_TTL_MS),
    otpHash: hashOtp(phoneNumber, code),
    otpLastSentAt: now,
  };
}

async function persistResponse(
  input: OnboardingGatewayRequest,
  response: OnboardingGatewayResponse,
  patch: Partial<typeof imessageOnboardingSessions.$inferInsert> = {},
) {
  const row = await updateRow(input.phoneNumber, {
    ...patch,
    threadId: input.threadId,
    lastInboundMessageId: input.messageId ?? null,
    lastResponseJson: JSON.stringify(response),
  });
  return { row, response };
}

export async function getOnboardingSnapshot(phoneNumber: string) {
  const normalized = normalizePhoneNumber(phoneNumber);
  const row = await getRow(normalized);
  return row ? rowToSnapshot(row) : null;
}

export async function handleOnboardingGateway(
  rawInput: OnboardingGatewayRequest,
): Promise<OnboardingGatewayResponse> {
  let input = {
    ...rawInput,
    phoneNumber: normalizePhoneNumber(rawInput.phoneNumber),
    text: rawInput.text.trim(),
    threadId: rawInput.threadId.trim(),
  };

  let row = await getRow(input.phoneNumber);
  if (!row) {
    const linked = await getPhoneLinkByPhoneNumber(input.phoneNumber);
    if (linked) {
      await db.insert(imessageOnboardingSessions).values({
        appUserId: linked.appUserId,
        phoneNumber: input.phoneNumber,
        threadId: input.threadId,
        step: "consent",
        otpVerifiedAt: new Date(),
      });
      row = (await getRow(input.phoneNumber))!;
      const prompt = promptFor(row);
      const response: OnboardingGatewayResponse = {
        kind: "prompt",
        message: `This phone is already verified.\n\n${prompt.message}`,
        nativeChoice: prompt.nativeChoice,
        snapshot: rowToSnapshot(row),
      };
      return (await persistResponse(input, response)).response;
    }

    if (!await isPhoneInvited(input.phoneNumber)) {
      const siteUrl = (process.env.NUXT_PUBLIC_SITE_URL?.trim() || "https://use-memory.vercel.app")
        .replace(/\/$/u, "");
      return {
        kind: "prompt",
        message: `Use Memory is invite-only right now. Join the waitlist at ${siteUrl} and I will message this number when access is ready.`,
        snapshot: null,
      };
    }

    const otp = await issueOtp(input.phoneNumber);
    await db.insert(imessageOnboardingSessions).values({
      phoneNumber: input.phoneNumber,
      threadId: input.threadId,
      step: "verify_phone",
      ...otp,
    });
    row = (await getRow(input.phoneNumber))!;
    const prompt = promptFor(row);
    const response: OnboardingGatewayResponse = {
      kind: "prompt",
      snapshot: rowToSnapshot(row),
      ...prompt,
    };
    return (await persistResponse(input, response)).response;
  }

  if (
    input.messageId
    && row.lastInboundMessageId === input.messageId
    && row.lastResponseJson
  ) {
    try {
      return JSON.parse(row.lastResponseJson) as OnboardingGatewayResponse;
    }
    catch {
      // Fall through and rebuild the response from durable state.
    }
  }

  if (row.step === "complete") {
    const appUserId = row.appUserId
      ?? (await getPhoneLinkByPhoneNumber(input.phoneNumber))?.appUserId;
    if (!appUserId) throw new Error("Completed onboarding session has no linked user");
    return { appUserId, kind: "ready", snapshot: rowToSnapshot(row) };
  }

  if (input.interaction?.kind === "consent") {
    if (row.step !== "consent") {
      const prompt = promptFor(row);
      const response: OnboardingGatewayResponse = {
        kind: "prompt",
        message: `That choice is no longer active.\n\n${prompt.message}`,
        nativeChoice: prompt.nativeChoice,
        snapshot: rowToSnapshot(row),
      };
      return (await persistResponse(input, response)).response;
    }

    input = { ...input, text: input.interaction.value };
  }

  if (!input.text) {
    const hasAudio = input.attachments?.some(attachment => attachment.type === "audio");
    const prompt = promptFor(row);
    const response: OnboardingGatewayResponse = {
      kind: "prompt",
      message: hasAudio
        ? "I can see your voice message, but Photon does not expose its audio bytes here yet. Please type your answer."
        : "Please type your answer so I can continue onboarding.",
      snapshot: rowToSnapshot(row),
      nativeChoice: prompt.nativeChoice,
    };
    return (await persistResponse(input, response)).response;
  }

  switch (row.step as OnboardingStep) {
    case "verify_phone": {
      const normalized = input.text.toLowerCase();
      if (normalized === "resend") {
        const waitMs = row.otpLastSentAt
          ? OTP_RESEND_INTERVAL_MS - (Date.now() - row.otpLastSentAt.getTime())
          : 0;
        if (waitMs > 0) {
          const response: OnboardingGatewayResponse = {
            kind: "prompt",
            message: `Please wait ${Math.ceil(waitMs / 1000)} seconds before requesting another code.`,
            snapshot: rowToSnapshot(row),
          };
          return (await persistResponse(input, response)).response;
        }

        const otp = await issueOtp(input.phoneNumber);
        row = await updateRow(input.phoneNumber, otp);
        const response: OnboardingGatewayResponse = {
          kind: "prompt",
          message: promptFor(row).message,
          snapshot: rowToSnapshot(row),
        };
        return (await persistResponse(input, response)).response;
      }

      if (!/^\d{6}$/u.test(input.text)) {
        const response: OnboardingGatewayResponse = {
          kind: "prompt",
          message: "Reply with the six-digit code, or reply RESEND for a new one.",
          snapshot: rowToSnapshot(row),
        };
        return (await persistResponse(input, response)).response;
      }

      if (!row.otpHash || !row.otpExpiresAt || row.otpExpiresAt.getTime() <= Date.now()) {
        const otp = await issueOtp(input.phoneNumber);
        row = await updateRow(input.phoneNumber, otp);
        const response: OnboardingGatewayResponse = {
          kind: "prompt",
          message: "That code expired. I sent a new one; reply with the new six-digit code.",
          snapshot: rowToSnapshot(row),
        };
        return (await persistResponse(input, response)).response;
      }

      if (row.otpAttempts >= OTP_MAX_ATTEMPTS) {
        const response: OnboardingGatewayResponse = {
          kind: "prompt",
          message: "Too many incorrect attempts. Reply RESEND to request a new code.",
          snapshot: rowToSnapshot(row),
        };
        return (await persistResponse(input, response)).response;
      }

      if (!otpMatches(row.otpHash, input.phoneNumber, input.text)) {
        row = await updateRow(input.phoneNumber, { otpAttempts: row.otpAttempts + 1 });
        const remaining = Math.max(0, OTP_MAX_ATTEMPTS - row.otpAttempts);
        const response: OnboardingGatewayResponse = {
          kind: "prompt",
          message: remaining
            ? `That code is not correct. ${remaining} attempt${remaining === 1 ? "" : "s"} remaining.`
            : "Too many incorrect attempts. Reply RESEND to request a new code.",
          snapshot: rowToSnapshot(row),
        };
        return (await persistResponse(input, response)).response;
      }

      row = await updateRow(input.phoneNumber, {
        otpHash: null,
        otpExpiresAt: null,
        otpAttempts: 0,
        otpVerifiedAt: new Date(),
        step: "consent",
      });
      const prompt = promptFor(row);
      const response: OnboardingGatewayResponse = {
        kind: "prompt",
        message: `Phone verified.\n\n${prompt.message}`,
        nativeChoice: prompt.nativeChoice,
        snapshot: rowToSnapshot(row),
      };
      return (await persistResponse(input, response)).response;
    }

    case "consent": {
      if (!row.otpVerifiedAt) throw new Error("Consent cannot proceed before phone verification");
      const consent = parseOnboardingConsent(input.text);
      if (consent === null) {
        const prompt = promptFor(row);
        const response: OnboardingGatewayResponse = {
          kind: "prompt",
          message: `I did not understand that choice.\n\n${prompt.message}`,
          nativeChoice: prompt.nativeChoice,
          snapshot: rowToSnapshot(row),
        };
        return (await persistResponse(input, response)).response;
      }
      if (!consent) {
        const response: OnboardingGatewayResponse = {
          kind: "prompt",
          message: "No problem. I will not set up an account. Reply YES whenever you want to continue.",
          nativeChoice: consentChoice(input.phoneNumber),
          snapshot: rowToSnapshot(row),
        };
        return (await persistResponse(input, response)).response;
      }

      const appUserId = await provisionPhoneUser(input.phoneNumber);
      await markWaitlistClaimed(input.phoneNumber);
      row = await updateRow(input.phoneNumber, {
        appUserId,
        consent: true,
        step: "name",
      });
      const response: OnboardingGatewayResponse = {
        kind: "prompt",
        message: promptFor(row).message,
        snapshot: rowToSnapshot(row),
      };
      return (await persistResponse(input, response)).response;
    }

    case "name": {
      if (input.text.length > 80) {
        const response: OnboardingGatewayResponse = {
          kind: "prompt",
          message: "Please send a name that is 80 characters or fewer.",
          snapshot: rowToSnapshot(row),
        };
        return (await persistResponse(input, response)).response;
      }
      if (!row.appUserId) throw new Error("Onboarding user was not provisioned");
      await db.update(schema.user)
        .set({ name: input.text })
        .where(eq(schema.user.id, row.appUserId));
      row = await updateRow(input.phoneNumber, { name: input.text, step: "timezone" });
      const response: OnboardingGatewayResponse = {
        kind: "prompt",
        message: `Nice to meet you, ${input.text}.\n\n${promptFor(row).message}`,
        snapshot: rowToSnapshot(row),
      };
      return (await persistResponse(input, response)).response;
    }

    case "timezone": {
      if (!isIanaTimezone(input.text)) {
        const response: OnboardingGatewayResponse = {
          kind: "prompt",
          message: `I could not recognize that timezone. ${promptFor(row).message}`,
          snapshot: rowToSnapshot(row),
        };
        return (await persistResponse(input, response)).response;
      }
      if (!row.appUserId) throw new Error("Onboarding user was not provisioned");
      await db.update(schema.userProfiles)
        .set({ timezone: input.text })
        .where(eq(schema.userProfiles.userId, row.appUserId));
      row = await updateRow(input.phoneNumber, { timezone: input.text, step: "preferences" });
      const response: OnboardingGatewayResponse = {
        kind: "prompt",
        message: promptFor(row).message,
        snapshot: rowToSnapshot(row),
      };
      return (await persistResponse(input, response)).response;
    }

    case "preferences": {
      const preferences = /^skip$/iu.test(input.text) ? [] : [input.text];
      row = await updateRow(input.phoneNumber, {
        preferencesJson: JSON.stringify(preferences),
        step: "interests",
      });
      const response: OnboardingGatewayResponse = {
        kind: "prompt",
        message: promptFor(row).message,
        snapshot: rowToSnapshot(row),
      };
      return (await persistResponse(input, response)).response;
    }

    case "interests": {
      const interests = parseNumberedChoices(input.text, INTEREST_OPTIONS, true);
      if (!interests?.length) {
        const response: OnboardingGatewayResponse = {
          kind: "prompt",
          message: `Choose at least one option or write an interest.\n\n${promptFor(row).message}`,
          snapshot: rowToSnapshot(row),
        };
        return (await persistResponse(input, response)).response;
      }
      row = await updateRow(input.phoneNumber, {
        interestsJson: JSON.stringify(interests),
        step: "integrations",
      });
      const response: OnboardingGatewayResponse = {
        kind: "prompt",
        message: promptFor(row).message,
        snapshot: rowToSnapshot(row),
      };
      return (await persistResponse(input, response)).response;
    }

    case "integrations": {
      const normalized = input.text.trim().toLowerCase();
      const integrations = normalized === "2" || normalized === "none"
        ? []
        : parseNumberedChoices(input.text, INTEGRATION_OPTIONS, false);
      if (integrations === null) {
        const response: OnboardingGatewayResponse = {
          kind: "prompt",
          message: `Choose 1 for GitHub or 2 for none.\n\n${promptFor(row).message}`,
          snapshot: rowToSnapshot(row),
        };
        return (await persistResponse(input, response)).response;
      }
      row = await updateRow(input.phoneNumber, {
        integrationsJson: JSON.stringify(integrations),
        step: "complete",
        completedAt: new Date(),
      });
      const selected = integrations.length ? integrations.join(", ") : "none yet";
      const appUserId = row.appUserId;
      const authorizationLinks = appUserId
        ? await Promise.all(integrations.map(async () => {
            const url = await createImessageBrowserLoginLink(appUserId, "/connect/github");
            return `GitHub: ${url}`;
          }))
        : [];
      const response: OnboardingGatewayResponse = {
        kind: "complete",
        message: [
          `You're all set. Selected integrations: ${selected}.`,
          authorizationLinks.length
            ? `Open each secure, five-minute link to authorize your own account:\n${authorizationLinks.join("\n")}`
            : "You can connect GitHub later in Settings → Integrations.",
          "Send your next message to start using use-memory.",
        ].join("\n\n"),
        snapshot: rowToSnapshot(row),
      };
      return (await persistResponse(input, response)).response;
    }

    case "complete": {
      if (!row.appUserId) throw new Error("Completed onboarding session has no linked user");
      return { appUserId: row.appUserId, kind: "ready", snapshot: rowToSnapshot(row) };
    }
  }
}
