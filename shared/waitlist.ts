import { normalizeE164 } from "./phone";
import type { WaitlistPlatform } from "./types/waitlist";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/u;

export function normalizeWaitlistSubmission(input: {
  phoneNumber: string;
  platform: WaitlistPlatform;
  email?: string | null;
}) {
  const email = input.email?.trim().toLowerCase() || null;

  if (input.platform === "android" && !email) {
    throw new RangeError("Email is required for Android waitlist entries");
  }
  if (email && !EMAIL_PATTERN.test(email)) {
    throw new RangeError("Email must be valid");
  }

  return {
    phoneNumber: normalizeE164(input.phoneNumber),
    platform: input.platform,
    email,
  };
}
