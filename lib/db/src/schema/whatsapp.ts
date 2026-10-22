import { createInsertSchema } from "drizzle-zod";
import { index, integer, pgTable, serial, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";
import { z } from "zod/v4";

export const whatsappTemplatesTable = pgTable(
  "whatsapp_templates",
  {
    id: serial("id").primaryKey(),
    name: text("name").notNull(),
    language: text("language").notNull().default("ar"),
    body: text("body").notNull(),
    providerTemplateName: text("provider_template_name"),
    status: text("status").notNull().default("draft"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [uniqueIndex("whatsapp_templates_name_idx").on(table.name)],
);

export const whatsappReminderLogsTable = pgTable(
  "whatsapp_reminder_logs",
  {
    id: serial("id").primaryKey(),
    memberId: integer("member_id").notNull(),
    subscriptionId: integer("subscription_id").notNull(),
    templateId: integer("template_id").references(() => whatsappTemplatesTable.id),
    triggerDays: text("trigger_days").notNull(),
    status: text("status").notNull().default("queued"),
    providerMessageId: text("provider_message_id"),
    error: text("error"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("whatsapp_logs_created_at_idx").on(table.createdAt),
    uniqueIndex("whatsapp_no_duplicate_reminder_idx").on(table.subscriptionId, table.triggerDays),
  ],
);

export const insertWhatsAppTemplateSchema = createInsertSchema(whatsappTemplatesTable).omit({ id: true, createdAt: true });
export type InsertWhatsAppTemplate = z.infer<typeof insertWhatsAppTemplateSchema>;

export const systemSettingsTable = pgTable("system_settings", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});
