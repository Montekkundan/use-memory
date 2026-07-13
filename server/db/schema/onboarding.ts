import { boolean, index, integer, pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { user } from "./auth";

export const imessageOnboardingSessions = pgTable(
  "imessage_onboarding_sessions",
  {
    phoneNumber: text("phone_number").primaryKey(),
    threadId: text("thread_id").notNull(),
    appUserId: text("app_user_id").references(() => user.id, {
      onDelete: "set null",
    }),
    step: text("step").notNull().default("verify_phone"),
    otpHash: text("otp_hash"),
    otpExpiresAt: timestamp("otp_expires_at", { mode: "date", withTimezone: true }),
    otpLastSentAt: timestamp("otp_last_sent_at", { mode: "date", withTimezone: true }),
    otpAttempts: integer("otp_attempts").notNull().default(0),
    otpVerifiedAt: timestamp("otp_verified_at", { mode: "date", withTimezone: true }),
    consent: boolean("consent").notNull().default(false),
    name: text("name"),
    timezone: text("timezone"),
    preferencesJson: text("preferences_json").notNull().default("[]"),
    interestsJson: text("interests_json").notNull().default("[]"),
    integrationsJson: text("integrations_json").notNull().default("[]"),
    lastInboundMessageId: text("last_inbound_message_id"),
    lastResponseJson: text("last_response_json"),
    completedAt: timestamp("completed_at", { mode: "date", withTimezone: true }),
    createdAt: timestamp("created_at", { mode: "date", withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { mode: "date", withTimezone: true })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  table => [
    index("imessage_onboarding_thread_idx").on(table.threadId),
    index("imessage_onboarding_user_idx").on(table.appUserId),
  ],
);
