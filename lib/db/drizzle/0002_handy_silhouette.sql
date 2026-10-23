ALTER TABLE "members" ADD COLUMN "birth_date" date;--> statement-breakpoint
ALTER TABLE "subscriptions" ADD COLUMN "renewed_from_id" integer;--> statement-breakpoint
CREATE UNIQUE INDEX "subscriptions_renewed_from_idx" ON "subscriptions" USING btree ("renewed_from_id");