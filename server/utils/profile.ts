import { eq } from "drizzle-orm";
import { db, schema } from "@nuxthub/db";
import { profileLanguageSchema, profileTableFields } from "#shared/profile-schema";
import {
  actionPreferenceSchema,
  DEFAULT_ACTION_PREFERENCES,
} from "#shared/personality-schema";
import type { UserProfile, UserProfilePatch, UserProfileWithUser } from "#shared/types/profile";
import { getPhoneLinkForAppUser } from "~~/server/utils/phone-links";

function rowToProfile(row: typeof schema.userProfiles.$inferSelect): UserProfile {
  return {
    userId: row.userId,
    timezone: row.timezone,
    locale: profileLanguageSchema.parse(row.locale),
    bio: row.bio,
    personalityMarkdown: row.personalityMarkdown,
    actionPreferences: {
      commit: actionPreferenceSchema.catch(DEFAULT_ACTION_PREFERENCES.commit).parse(row.commitPreference),
      push: actionPreferenceSchema.catch(DEFAULT_ACTION_PREFERENCES.push).parse(row.pushPreference),
      openPullRequest: actionPreferenceSchema
        .catch(DEFAULT_ACTION_PREFERENCES.openPullRequest)
        .parse(row.pullRequestPreference),
    },
    updatedAt: row.updatedAt.getTime(),
  };
}

export async function getProfileForUser(userId: string): Promise<UserProfile | undefined> {
  const [row] = await db.select()
    .from(schema.userProfiles)
    .where(eq(schema.userProfiles.userId, userId))
    .limit(1);

  return row ? rowToProfile(row) : undefined;
}

export async function getOrCreateProfileForUser(userId: string): Promise<UserProfile> {
  const existing = await getProfileForUser(userId);
  if (existing) {
    return existing;
  }

  await db.insert(schema.userProfiles).values({ userId });

  const created = await getProfileForUser(userId);
  if (!created) {
    throw createError({
      statusCode: 500,
      statusMessage: "Failed to create profile",
    });
  }

  return created;
}

export async function getProfileWithUser(userId: string): Promise<UserProfileWithUser | undefined> {
  const [row] = await db.select({
    profile: schema.userProfiles,
    user: schema.user,
  })
    .from(schema.user)
    .leftJoin(schema.userProfiles, eq(schema.userProfiles.userId, schema.user.id))
    .where(eq(schema.user.id, userId))
    .limit(1);

  if (!row?.user) {
    return undefined;
  }

  const profile = row.profile
    ? rowToProfile(row.profile)
    : await getOrCreateProfileForUser(userId);

  const phoneLink = await getPhoneLinkForAppUser(userId);

  return {
    ...profile,
    name: row.user.name,
    email: row.user.email,
    phoneNumber: phoneLink?.phoneNumber,
  };
}

export async function updateProfileForUser(userId: string, patch: UserProfilePatch) {
  await getOrCreateProfileForUser(userId);

  if (patch.name !== undefined) {
    await db.update(schema.user)
      .set({ name: patch.name.trim() })
      .where(eq(schema.user.id, userId));
  }

  const profileFields = profileTableFields(patch);
  if (profileFields) {
    await db.update(schema.userProfiles)
      .set(profileFields)
      .where(eq(schema.userProfiles.userId, userId));
  }

  return getProfileWithUser(userId);
}
