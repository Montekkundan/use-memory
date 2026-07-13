import { createHmac } from "node:crypto";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { magicLink, phoneNumber } from "better-auth/plugins";
import { betterAuth } from "better-auth";
import { db, schema } from "@nuxthub/db";
import { eq } from "drizzle-orm";
import { sendPhoneSignInCode, sendRecoveryEmail } from "./auth-delivery";
import { imessageBrowserLoginPlugin } from "./imessage-browser-login";
import { getPhoneLinkByPhoneNumber, normalizePhoneNumber } from "./phone-links";
import { isPhoneInvited } from "./waitlist";
import { isConfiguredWaitlistAdminPhone } from "./waitlist-admin-identifiers";

const TEMP_PHONE_EMAIL_DOMAIN = "phone.use-memory.invalid";
const productionUrl = process.env.BETTER_AUTH_URL?.trim();

function temporaryEmailForPhone(phone: string) {
  const secret = process.env.BETTER_AUTH_SECRET?.trim();
  if (!secret) {
    throw new Error("BETTER_AUTH_SECRET is required for phone authentication.");
  }

  const subject = createHmac("sha256", secret)
    .update(phone)
    .digest("hex")
    .slice(0, 40);
  return `${subject}@${TEMP_PHONE_EMAIL_DOMAIN}`;
}

function isCanonicalPhoneNumber(phone: string) {
  try {
    return normalizePhoneNumber(phone) === phone;
  }
  catch {
    return false;
  }
}

export const auth = betterAuth({
  baseURL: productionUrl,
  secret: process.env.BETTER_AUTH_SECRET,
  trustedOrigins: productionUrl ? [productionUrl] : undefined,
  database: drizzleAdapter(db, {
    provider: "pg",
    schema,
    // Neon HTTP has no interactive transactions. The PostgreSQL adapter still
    // consumes one-time verification rows atomically with DELETE ... RETURNING.
    transaction: false,
  }),
  emailAndPassword: {
    enabled: false,
  },
  emailVerification: {
    expiresIn: 10 * 60,
    sendVerificationEmail: async ({ user, url }) => {
      await sendRecoveryEmail({
        email: user.email,
        url,
        purpose: "verification",
      });
    },
  },
  user: {
    changeEmail: {
      enabled: true,
      updateEmailWithoutVerification: false,
    },
  },
  plugins: [
    imessageBrowserLoginPlugin(),
    phoneNumber({
      otpLength: 6,
      expiresIn: 5 * 60,
      allowedAttempts: 3,
      phoneNumberValidator: isCanonicalPhoneNumber,
      sendOTP: async ({ phoneNumber, code }) => {
        const existing = await getPhoneLinkByPhoneNumber(phoneNumber);
        if (
          !existing
          && !isConfiguredWaitlistAdminPhone(phoneNumber)
          && !await isPhoneInvited(phoneNumber)
        ) {
          throw new Error("This number does not have access yet. Join the waitlist first.");
        }
        await sendPhoneSignInCode(phoneNumber, code);
      },
      signUpOnVerification: {
        getTempEmail: temporaryEmailForPhone,
        getTempName: phone => `User ${phone.slice(-4)}`,
      },
      callbackOnVerification: async ({ user }) => {
        await db.update(schema.user)
          .set({ phoneNumberVerifiedAt: new Date() })
          .where(eq(schema.user.id, user.id));
      },
    }),
    magicLink({
      expiresIn: 10 * 60,
      disableSignUp: true,
      storeToken: "hashed",
      sendMagicLink: async ({ email, url }) => {
        await sendRecoveryEmail({
          email,
          url,
          purpose: "recovery",
        });
      },
    }),
  ],
});
