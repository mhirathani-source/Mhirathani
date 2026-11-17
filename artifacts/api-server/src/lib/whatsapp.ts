import { ReplitConnectors } from "@replit/connectors-sdk";
import { eq, inArray } from "drizzle-orm";
import { db, systemSettingsTable, whatsappTemplatesTable } from "@workspace/db";
import {metaConfiguration, metaGraphRequest} from "../../../../api/whatsapp/reminders.js";

const connectors = new ReplitConnectors();
const GRAPH_VERSION = "v23.0";
const SETTING_KEYS = {
  wabaId: "whatsapp_waba_id",
  phoneNumberId: "whatsapp_phone_number_id",
  enabled: "whatsapp_reminders_enabled",
} as const;

export const DEFAULT_TEMPLATES = [
  { key: "expiry_2_days", name: "prime_subscription_expiry_2_days", body: "مرحبًا {{1}}، يتبقى يومان على انتهاء اشتراكك في {{2}} بتاريخ {{3}}. نرحب بتجديد اشتراكك." },
  { key: "expiry_today", name: "prime_subscription_expiry_today", body: "مرحبًا {{1}}، ينتهي اشتراكك في {{2}} اليوم {{3}}. نرحب بتجديد اشتراكك." },
  { key: "manual", name: "prime_subscription_manual_reminder", body: "مرحبًا {{1}}، نذكّرك باشتراكك في {{2}} الذي ينتهي بتاريخ {{3}}. تواصل معنا لأي استفسار." },
  { key: "expiry_custom", name: "prime_subscription_expiry_custom", body: "مرحبًا {{1}}، نذكّرك بقرب انتهاء اشتراكك في {{2}} بتاريخ {{3}}. نرحب بتجديد اشتراكك." },
  { key: "expiry_expired", name: "prime_subscription_expired", body: "مرحبًا {{1}}، انتهى اشتراكك في {{2}} بتاريخ {{3}}. نرحب بتجديد اشتراكك في الأكاديمية." },
] as const;

export async function readWhatsAppSettings() {
  const rows = await db.select().from(systemSettingsTable).where(inArray(systemSettingsTable.key, Object.values(SETTING_KEYS)));
  const values = new Map(rows.map((row) => [row.key, row.value]));
  const phoneNumberId = process.env.META_PHONE_NUMBER_ID || values.get(SETTING_KEYS.phoneNumberId) || "";
  const wabaId = values.get(SETTING_KEYS.wabaId) ?? "";
  return {
    wabaId,
    phoneNumberId,
    enabled: values.get(SETTING_KEYS.enabled) === "true",
    configured: metaConfiguration().configured || Boolean(wabaId && phoneNumberId),
    provider: process.env.META_WHATSAPP_TOKEN ? "meta" : "connector",
  };
}

export async function writeWhatsAppSettings(input: { wabaId: string; phoneNumberId: string; enabled: boolean }) {
  const values = [
    [SETTING_KEYS.wabaId, input.wabaId.trim()],
    [SETTING_KEYS.phoneNumberId, input.phoneNumberId.trim()],
    [SETTING_KEYS.enabled, String(input.enabled)],
  ] as const;
  await db.transaction(async trx => { for (const [key, value] of values) {
    await trx.insert(systemSettingsTable).values({ key, value }).onConflictDoUpdate({
      target: systemSettingsTable.key, set: { value, updatedAt: new Date() },
    });
  } });
}

export async function ensureDefaultWhatsAppTemplates() {
  // Business templates are retained as stored; manual-only mode does not seed or mutate them.
}

async function graph(path: string, init: {method?:string;headers?:Record<string,string>;body?:unknown} = {}) {
  if (process.env.META_WHATSAPP_TOKEN) return metaGraphRequest(path, init);
  const response = await connectors.proxy("whatsapp-business", `/${GRAPH_VERSION}${path}`, init);
  const body = await response.json().catch(() => ({})) as Record<string, any>;
  if (!response.ok) {
    const message = typeof body.error?.message === "string" ? body.error.message : `WhatsApp API returned ${response.status}`;
    throw new Error(message);
  }
  return body;
}

export async function syncWhatsAppTemplates() {
  const settings = await readWhatsAppSettings();
  if (!settings.wabaId) throw new Error("أدخل معرّف حساب WhatsApp Business أولًا");
  const result = await graph(`/${encodeURIComponent(settings.wabaId)}/message_templates?fields=name,status,language&limit=100`);
  const providerTemplates = Array.isArray(result.data) ? result.data as { name: string; status: string; language: string }[] : [];
  const local = await db.select().from(whatsappTemplatesTable);
  for (const template of local) {
    const match = providerTemplates.find((item) => item.name === template.providerTemplateName && item.language === template.language);
    if (match && template.status !== match.status.toLowerCase()) {
      await db.update(whatsappTemplatesTable).set({ status: match.status.toLowerCase() }).where(eq(whatsappTemplatesTable.id, template.id));
    }
  }
  return providerTemplates;
}

export async function createProviderTemplate(key: string, body: string) {
  const definition = DEFAULT_TEMPLATES.find((item) => item.key === key);
  if (!definition) throw new Error("نوع القالب غير معروف");
  const settings = await readWhatsAppSettings();
  if (!settings.wabaId) throw new Error("أدخل معرّف حساب WhatsApp Business أولًا");
  if (!body.includes("{{1}}") || !body.includes("{{2}}") || !body.includes("{{3}}")) {
    throw new Error("يجب أن يحتوي النص على المتغيرات {{1}} و{{2}} و{{3}} بالترتيب");
  }
  const response = await graph(`/${encodeURIComponent(settings.wabaId)}/message_templates`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name: definition.name, language: "ar", category: "UTILITY",
      components: [{ type: "BODY", text: body, example: { body_text: [["اسم المشترك", "اسم الباقة", "2026-12-31"]] } }],
    }),
  });
  await db.insert(whatsappTemplatesTable).values({
    name: key, language: "ar", body, providerTemplateName: definition.name,
    status: String(response.status ?? "pending").toLowerCase(),
  }).onConflictDoUpdate({
    target: whatsappTemplatesTable.name,
    set: { body, providerTemplateName: definition.name, status: String(response.status ?? "pending").toLowerCase() },
  });
  return response;
}

export async function sendWhatsAppReminder(_subscriptionId: number, _trigger: string) {
  return { ok: false as const, reason: "الإرسال عبر واتساب العادي يتم يدويًا من رابط المحادثة." };
}

export async function runWhatsAppReminderBatch() {
  return { disabled: true as const };
}
