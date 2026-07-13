export const WAITLIST_PLATFORMS = ["iphone", "android"] as const;
export type WaitlistPlatform = (typeof WAITLIST_PLATFORMS)[number];

export const WAITLIST_STATUSES = ["pending", "invited", "claimed"] as const;
export type WaitlistStatus = (typeof WAITLIST_STATUSES)[number];

export interface WaitlistEntry {
  id: string;
  phoneNumber: string;
  platform: WaitlistPlatform;
  email: string | null;
  status: WaitlistStatus;
  invitationAcceptedAt: string | null;
  invitedAt: string | null;
  claimedAt: string | null;
  lastInvitationError: string | null;
  createdAt: string;
  updatedAt: string;
}
