import { eq } from "drizzle-orm";
import { db, systemSettingsTable } from "@workspace/db";

export const DEFAULT_MANUAL_WHATSAPP_TEMPLATE =
  "مرحبًا {{name}}، نذكّرك باشتراكك في {{plan}}، وينتهي بتاريخ {{endDate}}. نرجو التواصل مع الأكاديمية عند الرغبة بالتجديد.";

const MANUAL_TEMPLATE_KEY = "whatsapp_manual_message_template";

export async function readWhatsAppSettings() {
  const [setting] = await db
    .select({ value: systemSettingsTable.value })
    .from(systemSettingsTable)
    .where(eq(systemSettingsTable.key, MANUAL_TEMPLATE_KEY))
    .limit(1);
  return {
    mode: "manual" as const,
    messageTemplate: setting?.value ?? DEFAULT_MANUAL_WHATSAPP_TEMPLATE,
  };
}

export async function writeWhatsAppSettings(messageTemplate: string) {
  const value = messageTemplate.trim();
  await db.insert(systemSettingsTable).values({
    key: MANUAL_TEMPLATE_KEY,
    value,
  }).onConflictDoUpdate({
    target: systemSettingsTable.key,
    set: { value, updatedAt: new Date() },
  });
  return { mode: "manual" as const, messageTemplate: value };
}
