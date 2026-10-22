import { createInsertSchema } from "drizzle-zod";
import { boolean, date, index, integer, pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";
import { membersTable } from "./members";
import { z } from "zod/v4";

export const financeCategoriesTable = pgTable("finance_categories", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  kind: text("kind").notNull(),
  active: boolean("active").notNull().default(true),
});

export const financialTransactionsTable = pgTable(
  "financial_transactions",
  {
    id: serial("id").primaryKey(),
    kind: text("kind").notNull(),
    categoryId: integer("category_id").references(() => financeCategoriesTable.id),
    memberId: integer("member_id").references(() => membersTable.id),
    amountFils: integer("amount_fils").notNull(),
    method: text("method").notNull(),
    description: text("description").notNull(),
    transactionDate: date("transaction_date", { mode: "string" }).notNull(),
    createdBy: text("created_by").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("financial_transactions_date_idx").on(table.transactionDate)],
);

export const insertFinancialTransactionSchema = createInsertSchema(financialTransactionsTable).omit({ id: true, createdAt: true });
export type InsertFinancialTransaction = z.infer<typeof insertFinancialTransactionSchema>;
