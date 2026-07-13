export function waitlistAdminIdentifiers() {
  return new Set(
    (process.env.WAITLIST_ADMIN_IDENTIFIERS ?? "")
      .split(",")
      .map(value => value.trim().toLowerCase())
      .filter(Boolean),
  );
}

export function isConfiguredWaitlistAdminPhone(phoneNumber: string) {
  return phoneNumber.startsWith("+")
    && waitlistAdminIdentifiers().has(phoneNumber.toLowerCase());
}

interface WaitlistAdminIdentity {
  id: string;
  email: string | null;
  emailVerified: boolean;
  phoneNumber: string | null;
  phoneNumberVerified: boolean;
}

export function isWaitlistAdminIdentity(
  identity: WaitlistAdminIdentity,
  identifiers = waitlistAdminIdentifiers(),
) {
  if (identifiers.has(identity.id.toLowerCase())) return true;

  if (
    identity.emailVerified
    && identity.email
    && identifiers.has(identity.email.toLowerCase())
  ) {
    return true;
  }

  return Boolean(
    identity.phoneNumberVerified
    && identity.phoneNumber
    && identifiers.has(identity.phoneNumber.toLowerCase()),
  );
}
