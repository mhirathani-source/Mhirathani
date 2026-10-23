import { createInsertSchema } from "drizzle-zod";
import { boolean, check, foreignKey, jsonb, pgTable, serial, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { rolesTable } from "./roles";
import { z } from "zod/v4";

export const clubUsersTable = pgTable(
  "club_users",
  {
    id: serial("id").primaryKey(),
    clerkUserId: text("clerk_user_id").notNull(),
    email: text("email").notNull(),
    role: text("role").notNull().default("staff"),
    displayName: text("display_name"),
    status: text("status").notNull().default("pending"),
    isOwner: boolean("is_owner").notNull().default(false),
    permissionOverrides: jsonb("permission_overrides").$type<Record<string, boolean>>().notNull().default({}),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("club_users_clerk_user_id_idx").on(table.clerkUserId),
    foreignKey({name:"club_users_role_fk",columns:[table.role],foreignColumns:[rolesTable.name]}),
    check("club_users_status_check",sql`${table.status} in ('pending','active','rejected','suspended')`),
    check("club_users_owner_check",sql`NOT ${table.isOwner} OR (${table.role}='admin' AND ${table.status}='active')`),
  ],
);

export const insertClubUserSchema = createInsertSchema(clubUsersTable).omit({ id: true, createdAt: true });
export type InsertClubUser = z.infer<typeof insertClubUserSchema>;
export type ClubUser = typeof clubUsersTable.$inferSelect;
