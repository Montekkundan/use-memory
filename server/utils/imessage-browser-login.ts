import { createHmac, randomBytes, randomUUID } from "node:crypto";
import { createAuthEndpoint } from "better-auth/api";
import { setSessionCookie } from "better-auth/cookies";
import { db, schema } from "@nuxthub/db";
import { eq } from "drizzle-orm";
import { z } from "zod";

const TOKEN_TTL_MS = 5 * 60 * 1000;
const ALLOWED_DESTINATIONS = new Set([
  "/connect/github",
  "/connect/linear",
  "/settings/integrations",
  "/settings/profile",
]);

function authSecret() {
  const secret = process.env.BETTER_AUTH_SECRET?.trim();
  if (!secret) {
    throw new Error("BETTER_AUTH_SECRET is required for iMessage browser links.");
  }
  return secret;
}

function tokenIdentifier(token: string) {
  const digest = createHmac("sha256", authSecret())
    .update(token)
    .digest("hex");
  return `imessage-browser:${digest}`;
}

function safeDestination(value: string) {
  return ALLOWED_DESTINATIONS.has(value) ? value : "/settings/integrations";
}

function redirectUrl(baseURL: string, path: string) {
  return new URL(path, baseURL).toString();
}

export async function createImessageBrowserLoginLink(userId: string, destination: string) {
  const baseURL = process.env.BETTER_AUTH_URL?.trim();
  if (!baseURL) {
    throw new Error("BETTER_AUTH_URL is required for iMessage browser links.");
  }

  const token = randomBytes(32).toString("base64url");
  const callbackPath = safeDestination(destination);

  await db.insert(schema.verification).values({
    id: randomUUID(),
    identifier: tokenIdentifier(token),
    value: JSON.stringify({ userId, callbackPath }),
    expiresAt: new Date(Date.now() + TOKEN_TTL_MS),
  });

  const url = new URL("/api/auth/imessage-login", baseURL);
  url.searchParams.set("token", token);
  return url.toString();
}

export function imessageBrowserLoginPlugin() {
  return {
    id: "imessage-browser-login",
    endpoints: {
      imessageBrowserLogin: createAuthEndpoint("/imessage-login", {
        method: "GET",
        requireHeaders: true,
        query: z.object({
          token: z.string().min(32).max(128),
        }),
      }, async (ctx) => {
        const invalidUrl = redirectUrl(ctx.context.baseURL, "/login?error=invalid_or_expired_link");
        const verification = await ctx.context.internalAdapter.consumeVerificationValue(
          tokenIdentifier(ctx.query.token),
        );

        if (!verification) {
          throw ctx.redirect(invalidUrl);
        }

        let payload: { userId?: unknown; callbackPath?: unknown };
        try {
          payload = JSON.parse(verification.value) as typeof payload;
        }
        catch {
          throw ctx.redirect(invalidUrl);
        }

        if (typeof payload.userId !== "string") {
          throw ctx.redirect(invalidUrl);
        }

        const user = await ctx.context.internalAdapter.findUserById(payload.userId);
        const [phoneIdentity] = await db.select({
          phoneNumber: schema.user.phoneNumber,
          phoneNumberVerified: schema.user.phoneNumberVerified,
        })
          .from(schema.user)
          .where(eq(schema.user.id, payload.userId))
          .limit(1);
        if (!user || !phoneIdentity?.phoneNumber || !phoneIdentity.phoneNumberVerified) {
          throw ctx.redirect(invalidUrl);
        }

        const session = await ctx.context.internalAdapter.createSession(user.id);
        await setSessionCookie(ctx, { session, user });

        const destination = typeof payload.callbackPath === "string"
          ? safeDestination(payload.callbackPath)
          : "/settings/integrations";
        throw ctx.redirect(redirectUrl(ctx.context.baseURL, destination));
      }),
    },
  };
}
