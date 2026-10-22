import { createInsertSchema } from "drizzle-zod";
import { pgTable, serial, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";
import { z } from "zod/v4";

export const clubUsersTable = pgTable(
  "club_users",
  {
    id: serial("id").primaryKey(),
    clerkUserId: text("clerk_user_id").notNull(),
    email: text("email").notNull(),
    role: text("role").notNull().default("staff"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [uniqueIndex("club_users_clerk_user_id_idx").on(table.clerkUserId)],
);

export const insertClubUserSchema = createInsertSchema(clubUsersTable).omit({ id: true, createdAt: true });
export type InsertClubUser = z.infer<typeof insertClubUserSchema>;
export type ClubUser = typeof clubUsersTable.$inferSelect;
