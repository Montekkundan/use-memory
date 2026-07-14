import { z } from "zod";

export const ACTION_PREFERENCE_VALUES = ["ask", "always"] as const;
export const actionPreferenceSchema = z.enum(ACTION_PREFERENCE_VALUES);

export const actionPreferencesSchema = z.strictObject({
  commit: actionPreferenceSchema,
  push: actionPreferenceSchema,
  openPullRequest: actionPreferenceSchema,
});

export const DEFAULT_ACTION_PREFERENCES = {
  commit: "ask",
  push: "ask",
  openPullRequest: "ask",
} as const satisfies ActionPreferences;

export const personalityMarkdownSchema = z.string().trim().max(4_000);
export const personalityPreferenceSchema = z.string().trim().min(1).max(300);

export const personalityPatchSchema = z.strictObject({
  remember: z.array(personalityPreferenceSchema).max(12).optional(),
  forget: z.array(personalityPreferenceSchema).max(12).optional(),
  actions: z.strictObject({
    commit: actionPreferenceSchema.optional(),
    push: actionPreferenceSchema.optional(),
    openPullRequest: actionPreferenceSchema.optional(),
  }).optional(),
}).refine(
  patch => Boolean(
    patch.remember?.length
    || patch.forget?.length
    || (patch.actions && Object.values(patch.actions).some(value => value !== undefined)),
  ),
  "At least one personality change is required",
);

export const updatePersonalityToolInputSchema = z.strictObject({
  reason: z.string().trim().min(1).max(240)
    .describe("The user's explicit request to remember or change a durable preference"),
  changes: personalityPatchSchema,
});

export const personalityStateSchema = z.strictObject({
  markdown: personalityMarkdownSchema,
  actions: actionPreferencesSchema,
});

export const internalPersonalityUpdateBodySchema = z.strictObject({
  userId: z.string().trim().min(1),
  patch: personalityPatchSchema,
});

export const internalPersonalityUpdateResponseSchema = z.strictObject({
  personality: personalityStateSchema,
});

export const updatePersonalityToolResultSchema = personalityStateSchema;

export type ActionPreference = z.infer<typeof actionPreferenceSchema>;
export type ActionPreferences = z.infer<typeof actionPreferencesSchema>;
export type PersonalityPatch = z.infer<typeof personalityPatchSchema>;
export type PersonalityState = z.infer<typeof personalityStateSchema>;

function normalizedPreference(value: string) {
  return value.trim().replace(/\s+/gu, " ");
}

export function personalityPreferencesFromMarkdown(markdown: string) {
  return markdown
    .split("\n")
    .map(line => line.match(/^\s*-\s+(.+)$/u)?.[1])
    .filter((line): line is string => Boolean(line))
    .map(normalizedPreference);
}

export function personalityMarkdownFromPreferences(preferences: readonly string[]) {
  const unique = [...new Map(
    preferences
      .map(normalizedPreference)
      .filter(Boolean)
      .map(preference => [preference.toLocaleLowerCase(), preference]),
  ).values()];

  return unique.length
    ? `## Preferences\n\n${unique.map(preference => `- ${preference}`).join("\n")}`
    : "";
}

export function applyPersonalityPatch(
  current: PersonalityState,
  patch: PersonalityPatch,
): PersonalityState {
  const forgotten = new Set((patch.forget ?? []).map(value => normalizedPreference(value).toLocaleLowerCase()));
  const preferences = personalityPreferencesFromMarkdown(current.markdown)
    .filter(preference => !forgotten.has(preference.toLocaleLowerCase()));
  preferences.push(...(patch.remember ?? []));

  return {
    markdown: personalityMarkdownFromPreferences(preferences),
    actions: {
      ...current.actions,
      ...patch.actions,
    },
  };
}
