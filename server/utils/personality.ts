import { eq } from "drizzle-orm";
import { db, schema } from "@nuxthub/db";
import {
  applyPersonalityPatch,
  type PersonalityPatch,
  type PersonalityState,
} from "#shared/personality-schema";
import { getOrCreateProfileForUser } from "~~/server/utils/profile";

export async function updatePersonalityForUser(
  userId: string,
  patch: PersonalityPatch,
): Promise<PersonalityState> {
  const profile = await getOrCreateProfileForUser(userId);
  const next = applyPersonalityPatch({
    markdown: profile.personalityMarkdown,
    actions: profile.actionPreferences,
  }, patch);

  await db.update(schema.userProfiles)
    .set({
      personalityMarkdown: next.markdown,
      commitPreference: next.actions.commit,
      pushPreference: next.actions.push,
      pullRequestPreference: next.actions.openPullRequest,
    })
    .where(eq(schema.userProfiles.userId, userId));

  return next;
}
