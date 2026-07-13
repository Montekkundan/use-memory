import { describe, expect, it } from "vitest";
import {
  editableProfilePatchSchema,
  internalProfileUpdateBodySchema,
  internalProfileUpdateResponseSchema,
  profileTableFields,
  toolChangesToProfilePatch,
  updateProfileToolInputSchema,
} from "./profile-schema";

describe("profile validation", () => {
  it("accepts and normalizes the editable profile fields", () => {
    expect(editableProfilePatchSchema.parse({
      name: "  Monte  ",
      bio: "  Builder  ",
      timezone: "America/Toronto",
      locale: "en",
    })).toEqual({
      name: "Monte",
      bio: "Builder",
      timezone: "America/Toronto",
      locale: "en",
    });
  });

  it.each(["email", "phoneNumber", "userId", "image", "emailVerified"])(
    "rejects the unsafe field %s",
    (field) => {
      expect(editableProfilePatchSchema.safeParse({ name: "Monte", [field]: "unsafe" }).success)
        .toBe(false);
    },
  );

  it("rejects empty updates, unsupported languages, and invalid timezones", () => {
    expect(editableProfilePatchSchema.safeParse({}).success).toBe(false);
    expect(editableProfilePatchSchema.safeParse({ locale: "es" }).success).toBe(false);
    expect(editableProfilePatchSchema.safeParse({ timezone: "Toronto-ish" }).success).toBe(false);
  });

  it("keeps the tool language field separate from stored locale", () => {
    const input = updateProfileToolInputSchema.parse({
      reason: "Use the user's preferred language",
      changes: { language: "fr", bio: "Bonjour" },
    });

    expect(toolChangesToProfilePatch(input.changes)).toEqual({
      bio: "Bonjour",
      locale: "fr",
    });
    expect(updateProfileToolInputSchema.safeParse({
      reason: "Target another account",
      changes: { name: "Someone", userId: "user-2" },
    }).success).toBe(false);
  });

  it("does not create an empty user_profiles update for a name-only patch", () => {
    expect(profileTableFields({ name: "Monte" })).toBeUndefined();
    expect(profileTableFields({ name: "Monte", bio: "Builder" })).toEqual({ bio: "Builder" });
  });

  it("rejects sensitive fields in the internal response", () => {
    const safeProfile = {
      name: "Monte",
      bio: "Builder",
      timezone: "America/Toronto",
      language: "en",
    };

    expect(internalProfileUpdateResponseSchema.parse({ profile: safeProfile }))
      .toEqual({ profile: safeProfile });
    expect(internalProfileUpdateResponseSchema.safeParse({
      profile: { ...safeProfile, email: "monte@example.com" },
    }).success).toBe(false);
  });

  it("keeps contact and identity fields outside the internal endpoint patch", () => {
    expect(internalProfileUpdateBodySchema.parse({
      userId: "user-1",
      patch: { name: "Monte" },
    })).toEqual({
      userId: "user-1",
      patch: { name: "Monte" },
    });
    expect(internalProfileUpdateBodySchema.safeParse({
      userId: "user-1",
      patch: { name: "Monte", phoneNumber: "+14165550123" },
    }).success).toBe(false);
    expect(internalProfileUpdateBodySchema.safeParse({
      userId: "user-1",
      email: "monte@example.com",
      patch: { name: "Monte" },
    }).success).toBe(false);
  });
});
