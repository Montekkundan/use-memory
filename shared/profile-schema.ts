import { z } from "zod";

export const PROFILE_LANGUAGES = ["en", "fr"] as const;

function isIanaTimezone(value: string) {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: value }).format();
    return true;
  }
  catch {
    return false;
  }
}

export const profileNameSchema = z.string().trim().min(1).max(100);
export const profileBioSchema = z.string().trim().max(500);
export const profileTimezoneSchema = z.string()
  .trim()
  .min(1)
  .max(64)
  .refine(isIanaTimezone, "Timezone must be a valid IANA timezone");
export const profileLanguageSchema = z.enum(PROFILE_LANGUAGES);

export const editableProfilePatchSchema = z.strictObject({
  name: profileNameSchema.optional(),
  timezone: profileTimezoneSchema.optional(),
  locale: profileLanguageSchema.optional(),
  bio: profileBioSchema.optional(),
}).refine(
  patch => Object.values(patch).some(value => value !== undefined),
  "At least one profile field is required",
);

export const updateProfileToolInputSchema = z.strictObject({
  reason: z.string().trim().min(1).max(240)
    .describe("Brief restatement of the user's explicit profile update request"),
  changes: z.strictObject({
    name: profileNameSchema.optional().describe("How the assistant should address the user"),
    bio: profileBioSchema.optional().describe("Short profile introduction"),
    timezone: profileTimezoneSchema.optional().describe("IANA timezone, such as America/Toronto"),
    language: profileLanguageSchema.optional().describe("Preferred reply language: en or fr"),
  }).refine(
    changes => Object.values(changes).some(value => value !== undefined),
    "At least one profile change is required",
  ),
});

export const safeEditableProfileSchema = z.strictObject({
  name: profileNameSchema,
  bio: profileBioSchema,
  timezone: profileTimezoneSchema,
  language: profileLanguageSchema,
});

export const internalProfileUpdateBodySchema = z.strictObject({
  userId: z.string().trim().min(1),
  patch: editableProfilePatchSchema,
});

export const internalProfileUpdateResponseSchema = z.strictObject({
  profile: safeEditableProfileSchema,
});

export const updateProfileToolResultSchema = z.strictObject({
  updated: z.array(z.enum(["name", "bio", "timezone", "language"])).min(1).max(4),
  profile: safeEditableProfileSchema,
});

export type EditableProfilePatch = z.infer<typeof editableProfilePatchSchema>;
export type ProfileLanguage = z.infer<typeof profileLanguageSchema>;
export type UpdateProfileToolInput = z.infer<typeof updateProfileToolInputSchema>;
export type SafeEditableProfile = z.infer<typeof safeEditableProfileSchema>;
export type InternalProfileUpdateResponse = z.infer<typeof internalProfileUpdateResponseSchema>;

export function toolChangesToProfilePatch(
  changes: UpdateProfileToolInput["changes"],
): EditableProfilePatch {
  return {
    ...(changes.name !== undefined ? { name: changes.name } : {}),
    ...(changes.bio !== undefined ? { bio: changes.bio } : {}),
    ...(changes.timezone !== undefined ? { timezone: changes.timezone } : {}),
    ...(changes.language !== undefined ? { locale: changes.language } : {}),
  };
}

export function profileTableFields(patch: EditableProfilePatch) {
  const fields = {
    ...(patch.bio !== undefined ? { bio: patch.bio } : {}),
    ...(patch.timezone !== undefined ? { timezone: patch.timezone } : {}),
    ...(patch.locale !== undefined ? { locale: patch.locale } : {}),
  };

  return Object.keys(fields).length ? fields : undefined;
}
