import { relations } from "drizzle-orm";
import { boolean, index, integer, pgTable, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";
import { user } from "./auth";

export const mem0UserSettings = pgTable("mem0_user_settings", {
  userId: text("user_id")
    .primaryKey()
    .references(() => user.id, { onDelete: "cascade" }),
  automaticMemoryEnabled: boolean("automatic_memory_enabled")
    .default(false)
    .notNull(),
  consentedAt: timestamp("consented_at", { mode: "date", withTimezone: true }),
  createdAt: timestamp("created_at", { mode: "date", withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", { mode: "date", withTimezone: true })
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
});

export const mem0TurnStages = pgTable("mem0_turn_stages", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  sessionId: text("session_id").notNull(),
  turnId: text("turn_id").notNull(),
  userMessage: text("user_message"),
  assistantMessage: text("assistant_message"),
  status: text("status").default("pending").notNull(),
  attempts: integer("attempts").default(0).notNull(),
  nextAttemptAt: timestamp("next_attempt_at", { mode: "date", withTimezone: true }),
  lastError: text("last_error"),
  completedAt: timestamp("completed_at", { mode: "date", withTimezone: true }),
  createdAt: timestamp("created_at", { mode: "date", withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", { mode: "date", withTimezone: true })
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
}, (table) => [
  uniqueIndex("mem0_turn_stages_session_turn_idx").on(table.sessionId, table.turnId),
  index("mem0_turn_stages_user_status_idx").on(table.userId, table.status, table.nextAttemptAt),
]);

export const mem0UserSettingsRelations = relations(mem0UserSettings, ({ one }) => ({
  user: one(user, {
    fields: [mem0UserSettings.userId],
    references: [user.id],
  }),
}));

export const mem0TurnStagesRelations = relations(mem0TurnStages, ({ one }) => ({
  user: one(user, {
    fields: [mem0TurnStages.userId],
    references: [user.id],
  }),
}));
