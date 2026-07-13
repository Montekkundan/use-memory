import {
  createRequestId,
  errorKind,
  logEvent,
  opaqueReference,
} from "#shared/observability";

function requiredEnv(name: string) {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`${name} is required for authentication delivery.`);
  }
  return value;
}

export async function sendPhoneSignInCode(phoneNumber: string, code: string) {
  const startedAt = Date.now();
  const requestId = createRequestId();
  const origin = (
    process.env.EVE_INTERNAL_URL?.trim()
    || process.env.BETTER_AUTH_URL?.trim()
    || "http://localhost:3000"
  ).replace(/\/$/u, "");
  try {
    const response = await fetch(`${origin}/eve/v1/auth/phone-otp`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${requiredEnv("INTERNAL_API_SECRET")}`,
        "Content-Type": "application/json",
        "X-Request-ID": requestId,
      },
      body: JSON.stringify({ phoneNumber, code }),
      signal: AbortSignal.timeout(15_000),
    });

    if (!response.ok) {
      throw new Error(`Phone verification delivery failed (${response.status}).`);
    }
    logEvent("info", "auth.phone_otp.accepted", {
      requestId,
      phoneRef: opaqueReference(phoneNumber),
      durationMs: Date.now() - startedAt,
    });
  }
  catch (error) {
    logEvent("error", "auth.phone_otp.failed", {
      requestId,
      phoneRef: opaqueReference(phoneNumber),
      durationMs: Date.now() - startedAt,
      errorKind: errorKind(error),
    });
    throw error;
  }
}

export async function sendConnectionConfirmation(
  phoneNumber: string,
  connector: "GitHub",
) {
  const origin = (
    process.env.EVE_INTERNAL_URL?.trim()
    || process.env.BETTER_AUTH_URL?.trim()
    || "http://localhost:3000"
  ).replace(/\/$/u, "");
  const response = await fetch(`${origin}/eve/v1/system/connection-confirmed`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${requiredEnv("INTERNAL_API_SECRET")}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ phoneNumber, connector }),
  });

  if (!response.ok) {
    throw new Error(`Connection confirmation delivery failed (${response.status}).`);
  }
}

export async function sendWaitlistInvitation(phoneNumber: string, requestId?: string) {
  const origin = (
    process.env.EVE_INTERNAL_URL?.trim()
    || process.env.BETTER_AUTH_URL?.trim()
    || "http://localhost:3000"
  ).replace(/\/$/u, "");
  const response = await fetch(`${origin}/eve/v1/system/waitlist-invitation`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${requiredEnv("INTERNAL_API_SECRET")}`,
      "Content-Type": "application/json",
      ...(requestId ? { "X-Request-ID": requestId } : {}),
    },
    body: JSON.stringify({ phoneNumber }),
    signal: AbortSignal.timeout(15_000),
  });

  if (!response.ok) {
    throw new Error(`Waitlist invitation was not accepted by Photon (${response.status}).`);
  }
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

export async function sendRecoveryEmail(input: {
  email: string;
  url: string;
  purpose: "recovery" | "verification";
}) {
  const startedAt = Date.now();
  const requestId = createRequestId();
  const apiKey = requiredEnv("RESEND_API_KEY");
  const from = requiredEnv("AUTH_EMAIL_FROM");
  const subject = input.purpose === "recovery"
    ? "Sign in to use-memory"
    : "Verify your recovery email";
  const action = input.purpose === "recovery"
    ? "Sign in"
    : "Verify recovery email";
  const safeUrl = escapeHtml(input.url);

  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: [input.email],
        subject,
        text: `${action}: ${input.url}\n\nThis link expires shortly.`,
        html: [
          "<p>Use the link below to continue to use-memory.</p>",
          `<p><a href="${safeUrl}">${action}</a></p>`,
          "<p>This link expires shortly. If you did not request it, you can ignore this email.</p>",
        ].join(""),
      }),
      signal: AbortSignal.timeout(15_000),
    });

    if (!response.ok) {
      throw new Error(`Recovery email delivery failed (${response.status}).`);
    }
    logEvent("info", "auth.recovery_email.accepted", {
      requestId,
      emailRef: opaqueReference(input.email.toLowerCase()),
      purpose: input.purpose,
      durationMs: Date.now() - startedAt,
    });
  }
  catch (error) {
    logEvent("error", "auth.recovery_email.failed", {
      requestId,
      emailRef: opaqueReference(input.email.toLowerCase()),
      purpose: input.purpose,
      durationMs: Date.now() - startedAt,
      errorKind: errorKind(error),
    });
    throw error;
  }
}
