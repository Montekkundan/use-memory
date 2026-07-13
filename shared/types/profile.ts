import type { EditableProfilePatch, ProfileLanguage } from "../profile-schema";

export interface UserProfile {
  userId: string;
  timezone: string;
  locale: ProfileLanguage;
  bio: string;
  updatedAt: number;
}

export type UserProfilePatch = EditableProfilePatch;

export interface UserProfileWithUser extends UserProfile {
  name: string;
  email: string;
  phoneNumber?: string;
}
