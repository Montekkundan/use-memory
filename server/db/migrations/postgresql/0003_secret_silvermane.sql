ALTER TABLE "user_profiles" ADD COLUMN "personality_markdown" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "user_profiles" ADD COLUMN "commit_preference" text DEFAULT 'ask' NOT NULL;--> statement-breakpoint
ALTER TABLE "user_profiles" ADD COLUMN "push_preference" text DEFAULT 'ask' NOT NULL;--> statement-breakpoint
ALTER TABLE "user_profiles" ADD COLUMN "pull_request_preference" text DEFAULT 'ask' NOT NULL;
