import { createInsertSchema } from "drizzle-zod";
import { boolean, date, index, integer, pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";
import { z } from "zod/v4";

export const employeesTable = pgTable("employees", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  phone: text("phone"),
  position: text("position").notNull(),
  baseSalaryFils: integer("base_salary_fils").notNull().default(0),
  active: boolean("active").notNull().default(true),
  hiredAt: date("hired_at", { mode: "string" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const payrollEntriesTable = pgTable(
  "payroll_entries",
  {
    id: serial("id").primaryKey(),
    employeeId: integer("employee_id").notNull().references(() => employeesTable.id),
    period: text("period").notNull(),
    amountFils: integer("amount_fils").notNull(),
    paidFils: integer("paid_fils").notNull().default(0),
    dueDate: date("due_date", { mode: "string" }).notNull(),
    status: text("status").notNull().default("due"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("payroll_due_date_idx").on(table.dueDate)],
);

export const insertEmployeeSchema = createInsertSchema(employeesTable).omit({ id: true, createdAt: true });
export const insertPayrollEntrySchema = createInsertSchema(payrollEntriesTable).omit({ id: true, createdAt: true });
export type InsertEmployee = z.infer<typeof insertEmployeeSchema>;
export type InsertPayrollEntry = z.infer<typeof insertPayrollEntrySchema>;
