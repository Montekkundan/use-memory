import { relations } from "drizzle-orm";
import { pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { user } from "./auth";

export const userProfiles = pgTable("user_profiles", {
  userId: text("user_id")
    .primaryKey()
    .references(() => user.id, { onDelete: "cascade" }),
  timezone: text("timezone").notNull().default("UTC"),
  locale: text("locale").notNull().default("en"),
  bio: text("bio").notNull().default(""),
  personalityMarkdown: text("personality_markdown").notNull().default(""),
  commitPreference: text("commit_preference").notNull().default("ask"),
  pushPreference: text("push_preference").notNull().default("ask"),
  pullRequestPreference: text("pull_request_preference").notNull().default("ask"),
  updatedAt: timestamp("updated_at", { mode: "date", withTimezone: true })
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
});

export const userProfilesRelations = relations(userProfiles, ({ one }) => ({
  user: one(user, {
    fields: [userProfiles.userId],
    references: [user.id],
  }),
}));
