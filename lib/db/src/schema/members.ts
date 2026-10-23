import { createInsertSchema } from "drizzle-zod";
import { boolean, date, index, pgTable, serial, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";
import { z } from "zod/v4";

export const membersTable = pgTable(
  "members",
  {
    id: serial("id").primaryKey(),
    name: text("name").notNull(),
    phone: text("phone").notNull(),
    email: text("email"),
    birthDate: date("birth_date", { mode: "string" }),
    notes: text("notes"),
    joinedAt: timestamp("joined_at", { withTimezone: true }).notNull().defaultNow(),
    active: boolean("active").notNull().default(true),
  },
  (table) => [
    uniqueIndex("members_phone_idx").on(table.phone),
    index("members_name_idx").on(table.name),
  ],
);

export const insertMemberSchema = createInsertSchema(membersTable).omit({ id: true, joinedAt: true });
export type InsertMember = z.infer<typeof insertMemberSchema>;
export type Member = typeof membersTable.$inferSelect;
