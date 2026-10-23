CREATE TABLE IF NOT EXISTS "club_backups" (
	"id" serial PRIMARY KEY NOT NULL,
	"label" text NOT NULL,
	"created_by" text NOT NULL,
	"encrypted" text NOT NULL,
	"bytes" integer NOT NULL,
	"counts" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "club_users" ADD COLUMN IF NOT EXISTS "display_name" text;--> statement-breakpoint
ALTER TABLE "club_users" ADD COLUMN IF NOT EXISTS "status" text DEFAULT 'active' NOT NULL;--> statement-breakpoint
ALTER TABLE "club_users" ALTER COLUMN "status" SET DEFAULT 'pending';--> statement-breakpoint
ALTER TABLE "club_users" ADD COLUMN IF NOT EXISTS "is_owner" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "club_users" ADD COLUMN IF NOT EXISTS "permission_overrides" jsonb DEFAULT '{}'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "club_users" ADD COLUMN IF NOT EXISTS "updated_at" timestamp with time zone DEFAULT now() NOT NULL;