DROP INDEX "members_phone_idx";--> statement-breakpoint
CREATE INDEX "members_phone_idx" ON "members" USING btree ("phone");