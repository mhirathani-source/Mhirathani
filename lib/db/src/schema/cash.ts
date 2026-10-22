import { createInsertSchema } from "drizzle-zod";
import { integer, pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";
import { z } from "zod/v4";

export const cashMovementsTable = pgTable("cash_movements", {
  id: serial("id").primaryKey(),
  direction: text("direction").notNull(),
  amountFils: integer("amount_fils").notNull(),
  description: text("description").notNull(),
  referenceType: text("reference_type"),
  referenceId: integer("reference_id"),
  createdBy: text("created_by").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertCashMovementSchema = createInsertSchema(cashMovementsTable).omit({ id: true, createdAt: true });
export type InsertCashMovement = z.infer<typeof insertCashMovementSchema>;
