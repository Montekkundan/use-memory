import type { EditableProfilePatch, ProfileLanguage } from "../profile-schema";
import type { ActionPreferences } from "../personality-schema";

export interface UserProfile {
  userId: string;
  timezone: string;
  locale: ProfileLanguage;
  bio: string;
  personalityMarkdown: string;
  actionPreferences: ActionPreferences;
  updatedAt: number;
}

export type UserProfilePatch = EditableProfilePatch;

export interface UserProfileWithUser extends UserProfile {
  name: string;
  email: string;
  phoneNumber?: string;
}
