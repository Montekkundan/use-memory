import { describe, expect, it } from "vitest";
import { normalizeWaitlistSubmission } from "./waitlist";

describe("normalizeWaitlistSubmission", () => {
  it("normalizes phone numbers and email addresses", () => {
    expect(normalizeWaitlistSubmission({
      phoneNumber: "1 (416) 555-1234",
      platform: "iphone",
      email: "  Person@Example.com ",
    })).toEqual({
      phoneNumber: "+14165551234",
      platform: "iphone",
      email: "person@example.com",
    });
  });

  it("allows an iPhone entry without email", () => {
    expect(normalizeWaitlistSubmission({
      phoneNumber: "+14165551234",
      platform: "iphone",
    }).email).toBeNull();
  });

  it("requires an email for Android notification", () => {
    expect(() => normalizeWaitlistSubmission({
      phoneNumber: "+14165551234",
      platform: "android",
    })).toThrow("Email is required");
  });

  it("rejects malformed input", () => {
    expect(() => normalizeWaitlistSubmission({
      phoneNumber: "555",
      platform: "iphone",
    })).toThrow("E.164");
    expect(() => normalizeWaitlistSubmission({
      phoneNumber: "+14165551234",
      platform: "android",
      email: "not-an-email",
    })).toThrow("Email must be valid");
  });
});
