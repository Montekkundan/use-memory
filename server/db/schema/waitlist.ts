import { index, pgTable, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";

export const waitlistEntries = pgTable("waitlist_entries", {
  id: text("id").primaryKey(),
  phoneNumber: text("phone_number").notNull(),
  platform: text("platform").notNull(),
  email: text("email"),
  messagingConsentAt: timestamp("messaging_consent_at", {
    mode: "date",
    withTimezone: true,
  }).defaultNow().notNull(),
  messagingConsentVersion: text("messaging_consent_version")
    .notNull()
    .default("waitlist-v1"),
  status: text("status").notNull().default("pending"),
  invitationAcceptedAt: timestamp("invitation_accepted_at", {
    mode: "date",
    withTimezone: true,
  }),
  invitedAt: timestamp("invited_at", { mode: "date", withTimezone: true }),
  claimedAt: timestamp("claimed_at", { mode: "date", withTimezone: true }),
  lastInvitationError: text("last_invitation_error"),
  createdAt: timestamp("created_at", { mode: "date", withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", { mode: "date", withTimezone: true })
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
}, table => [
  uniqueIndex("waitlist_entries_phone_unique").on(table.phoneNumber),
  index("waitlist_entries_status_created_idx").on(table.status, table.createdAt),
]);
