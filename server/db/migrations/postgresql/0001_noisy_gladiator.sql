CREATE TABLE "waitlist_entries" (
	"id" text PRIMARY KEY NOT NULL,
	"phone_number" text NOT NULL,
	"platform" text NOT NULL,
	"email" text,
	"status" text DEFAULT 'pending' NOT NULL,
	"invitation_accepted_at" timestamp with time zone,
	"invited_at" timestamp with time zone,
	"claimed_at" timestamp with time zone,
	"last_invitation_error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "waitlist_entries_phone_unique" ON "waitlist_entries" USING btree ("phone_number");--> statement-breakpoint
CREATE INDEX "waitlist_entries_status_created_idx" ON "waitlist_entries" USING btree ("status","created_at");