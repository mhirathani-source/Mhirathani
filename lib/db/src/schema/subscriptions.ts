import { createInsertSchema } from "drizzle-zod";
import { date, index, integer, pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";
import { membersTable } from "./members";
import { plansTable } from "./plans";
import { z } from "zod/v4";

export const subscriptionsTable = pgTable(
  "subscriptions",
  {
    id: serial("id").primaryKey(),
    memberId: integer("member_id").notNull().references(() => membersTable.id),
    planId: integer("plan_id").notNull().references(() => plansTable.id),
    priceFils: integer("price_fils").notNull(),
    discountFils: integer("discount_fils").notNull().default(0),
    startDate: date("start_date", { mode: "string" }).notNull(),
    endDate: date("end_date", { mode: "string" }).notNull(),
    status: text("status").notNull().default("active"),
    pausedAt: date("paused_at", { mode: "string" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("subscriptions_member_idx").on(table.memberId),
    index("subscriptions_end_date_idx").on(table.endDate),
  ],
);

export const insertSubscriptionSchema = createInsertSchema(subscriptionsTable).omit({ id: true, createdAt: true });
export type InsertSubscription = z.infer<typeof insertSubscriptionSchema>;
export type Subscription = typeof subscriptionsTable.$inferSelect;
