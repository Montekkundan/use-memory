import { relations } from "drizzle-orm";
import {
  index,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { user } from "./auth";

export const slackLinks = pgTable("slack_links", {
  appUserId: text("app_user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  slackTeamId: text("slack_team_id").notNull(),
  slackUserId: text("slack_user_id").notNull(),
  slackUserName: text("slack_user_name"),
  slackDisplayName: text("slack_display_name"),
  slackEmail: text("slack_email"),
  linkedAt: timestamp("linked_at", { mode: "date", withTimezone: true })
    .defaultNow()
    .notNull(),
}, table => [
  primaryKey({ columns: [table.slackTeamId, table.slackUserId] }),
  uniqueIndex("slack_links_app_user_idx").on(table.appUserId),
]);

export const slackLinkCodes = pgTable("slack_link_codes", {
  code: text("code").primaryKey(),
  appUserId: text("app_user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  expiresAt: timestamp("expires_at", { mode: "date", withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { mode: "date", withTimezone: true })
    .defaultNow()
    .notNull(),
}, table => [
  index("slack_link_codes_app_user_idx").on(table.appUserId),
]);

export const slackLinksRelations = relations(slackLinks, ({ one }) => ({
  user: one(user, {
    fields: [slackLinks.appUserId],
    references: [user.id],
  }),
}));

export const slackLinkCodesRelations = relations(slackLinkCodes, ({ one }) => ({
  user: one(user, {
    fields: [slackLinkCodes.appUserId],
    references: [user.id],
  }),
}));
