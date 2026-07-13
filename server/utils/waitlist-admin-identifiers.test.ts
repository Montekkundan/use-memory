import { afterEach, describe, expect, it } from "vitest";
import {
  isConfiguredWaitlistAdminPhone,
  isWaitlistAdminIdentity,
  waitlistAdminIdentifiers,
} from "./waitlist-admin-identifiers";

const originalValue = process.env.WAITLIST_ADMIN_IDENTIFIERS;

afterEach(() => {
  if (originalValue === undefined) {
    delete process.env.WAITLIST_ADMIN_IDENTIFIERS;
  }
  else {
    process.env.WAITLIST_ADMIN_IDENTIFIERS = originalValue;
  }
});

describe("waitlist admin identifiers", () => {
  it("normalizes comma-separated identifiers", () => {
    process.env.WAITLIST_ADMIN_IDENTIFIERS = " Admin@Example.com, +14165550123 ";
    expect(waitlistAdminIdentifiers()).toEqual(new Set(["admin@example.com", "+14165550123"]));
  });

  it("allows only configured E.164 phones to bootstrap", () => {
    process.env.WAITLIST_ADMIN_IDENTIFIERS = "+14165550123,admin@example.com";
    expect(isConfiguredWaitlistAdminPhone("+14165550123")).toBe(true);
    expect(isConfiguredWaitlistAdminPhone("admin@example.com")).toBe(false);
    expect(isConfiguredWaitlistAdminPhone("+14165550999")).toBe(false);
  });

  it("requires verified contact details for email and phone admin access", () => {
    const identifiers = new Set(["admin@example.com", "+14165550123"]);

    expect(isWaitlistAdminIdentity({
      id: "user-1",
      email: "admin@example.com",
      emailVerified: false,
      phoneNumber: "+14165550123",
      phoneNumberVerified: false,
    }, identifiers)).toBe(false);

    expect(isWaitlistAdminIdentity({
      id: "user-1",
      email: "admin@example.com",
      emailVerified: true,
      phoneNumber: null,
      phoneNumberVerified: false,
    }, identifiers)).toBe(true);

    expect(isWaitlistAdminIdentity({
      id: "user-1",
      email: null,
      emailVerified: false,
      phoneNumber: "+14165550123",
      phoneNumberVerified: true,
    }, identifiers)).toBe(true);
  });

  it("allows a configured immutable user id without a contact verification flag", () => {
    expect(isWaitlistAdminIdentity({
      id: "user-1",
      email: null,
      emailVerified: false,
      phoneNumber: null,
      phoneNumberVerified: false,
    }, new Set(["user-1"]))).toBe(true);
  });
});
