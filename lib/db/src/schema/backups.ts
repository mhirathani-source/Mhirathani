import { integer, jsonb, pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";

export const clubBackupsTable = pgTable("club_backups", {
  id: serial("id").primaryKey(),
  label: text("label").notNull(),
  createdBy: text("created_by").notNull(),
  encrypted: text("encrypted").notNull(),
  bytes: integer("bytes").notNull(),
  counts: jsonb("counts").$type<Record<string, number>>().notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
