import { createInsertSchema } from "drizzle-zod";
import { index, integer, pgTable, serial, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";
import { subscriptionsTable } from "./subscriptions";
import { z } from "zod/v4";

export const paymentsTable = pgTable(
  "subscription_payments",
  {
    id: serial("id").primaryKey(),
    subscriptionId: integer("subscription_id").notNull().references(() => subscriptionsTable.id),
    amountFils: integer("amount_fils").notNull(),
    method: text("method").notNull(),
    kind: text("kind").notNull().default("payment"),
    note: text("note"),
    receiptNumber: text("receipt_number").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    createdBy: text("created_by").notNull(),
  },
  (table) => [
    index("payments_subscription_idx").on(table.subscriptionId),
    uniqueIndex("payments_receipt_number_idx").on(table.receiptNumber),
  ],
);

export const insertPaymentSchema = createInsertSchema(paymentsTable).omit({ id: true, createdAt: true });
export type InsertPayment = z.infer<typeof insertPaymentSchema>;
export type Payment = typeof paymentsTable.$inferSelect;
