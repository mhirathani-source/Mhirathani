import { ReplitConnectors } from "@replit/connectors-sdk";
import { and, eq, inArray } from "drizzle-orm";
import { db, membersTable, plansTable, subscriptionsTable, systemSettingsTable, whatsappReminderLogsTable, whatsappTemplatesTable } from "@workspace/db";
import { logger } from "./logger";
import { readClubSettings } from "./clubSettings";

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
] as const;

export async function readWhatsAppSettings() {
  const rows = await db.select().from(systemSettingsTable).where(inArray(systemSettingsTable.key, Object.values(SETTING_KEYS)));
  const values = new Map(rows.map((row) => [row.key, row.value]));
  return {
    wabaId: values.get(SETTING_KEYS.wabaId) ?? "",
    phoneNumberId: values.get(SETTING_KEYS.phoneNumberId) ?? "",
    enabled: values.get(SETTING_KEYS.enabled) === "true",
  };
}

export async function writeWhatsAppSettings(input: { wabaId: string; phoneNumberId: string; enabled: boolean }) {
  const values = [
    [SETTING_KEYS.wabaId, input.wabaId.trim()],
    [SETTING_KEYS.phoneNumberId, input.phoneNumberId.trim()],
    [SETTING_KEYS.enabled, String(input.enabled)],
  ] as const;
  for (const [key, value] of values) {
    await db.insert(systemSettingsTable).values({ key, value }).onConflictDoUpdate({
      target: systemSettingsTable.key, set: { value, updatedAt: new Date() },
    });
  }
}

export async function ensureDefaultWhatsAppTemplates() {
  for (const template of DEFAULT_TEMPLATES) {
    await db.insert(whatsappTemplatesTable).values({
      name: template.key, language: "ar", body: template.body, providerTemplateName: template.name, status: "draft",
    }).onConflictDoNothing();
  }
}

async function graph(path: string, init: {method?:string;headers?:Record<string,string>;body?:unknown} = {}) {
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

function jordanPhone(raw: string) {
  let digits = raw.replace(/\D/g, "");
  if (digits.startsWith("0")) digits = `962${digits.slice(1)}`;
  if (digits.length < 8 || digits.length > 15) throw new Error("رقم هاتف المشترك غير صالح للإرسال عبر واتساب");
  return digits;
}

export async function sendWhatsAppReminder(subscriptionId: number, trigger: string) {
  if (trigger !== "manual" && !/^(?:[0-9]|[12][0-9]|30)$/.test(trigger)) return {ok:false as const,reason:"موعد التذكير غير صالح"};
  const settings = await readWhatsAppSettings();
  if (!settings.enabled || !settings.wabaId || !settings.phoneNumberId) {
    return { ok: false as const, reason: "ربط واتساب أو الإرسال التلقائي غير مكتمل" };
  }
  const [subscription] = await db.select().from(subscriptionsTable).where(eq(subscriptionsTable.id, subscriptionId)).limit(1);
  if (!subscription) return { ok: false as const, reason: "الاشتراك غير موجود" };
  const [[member], [plan], [template]] = await Promise.all([
    db.select().from(membersTable).where(eq(membersTable.id, subscription.memberId)).limit(1),
    db.select().from(plansTable).where(eq(plansTable.id, subscription.planId)).limit(1),
    db.select().from(whatsappTemplatesTable).where(eq(whatsappTemplatesTable.name, trigger === "2" ? "expiry_2_days" : trigger === "0" ? "expiry_today" : trigger === "manual" ? "manual" : "expiry_custom")).limit(1),
  ]);
  if (member && !member.active) return { ok: false as const, reason: "المشترك معطّل؛ لن يتم إرسال تذكيرات له" };
  if (!member || !plan || !template || template.status !== "approved" || !template.providerTemplateName) {
    return { ok: false as const, reason: "قالب واتساب العربي غير معتمد بعد" };
  }
  let phone: string;
  try { phone = jordanPhone(member.phone); } catch (error) { return { ok: false as const, reason: error instanceof Error ? error.message : "رقم الهاتف غير صالح" }; }
  const triggerKey = trigger === "manual" ? `manual:${new Date().toISOString().slice(0,16)}` : trigger;
  const [log] = await db.insert(whatsappReminderLogsTable).values({
    memberId: member.id, subscriptionId, templateId: template.id, triggerDays: triggerKey, status: "queued",
  }).onConflictDoNothing().returning();
  if (!log) return { ok: false as const, reason: "تم تسجيل هذا التذكير مسبقًا" };
  try {
    const result = await graph(`/${encodeURIComponent(settings.phoneNumberId)}/messages`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        messaging_product: "whatsapp", to: phone, type: "template",
        template: {
          name: template.providerTemplateName, language: { code: "ar" },
          components: [{ type: "body", parameters: [
            { type: "text", text: member.name },
            { type: "text", text: plan.name },
            { type: "text", text: subscription.endDate },
          ] }],
        },
      }),
    });
    const messageId = result.messages?.[0]?.id;
    if (typeof messageId !== "string") throw new Error("لم تُرجع Meta معرّف رسالة يؤكد قبول الطلب");
    await db.update(whatsappReminderLogsTable).set({ status: "accepted", providerMessageId: messageId }).where(eq(whatsappReminderLogsTable.id, log.id));
    return { ok: true as const, logId: log.id, providerMessageId: messageId };
  } catch (error) {
    const message = error instanceof Error ? error.message.slice(0, 500) : "تعذر إرسال الرسالة";
    await db.update(whatsappReminderLogsTable).set({ status: "failed", error: message }).where(eq(whatsappReminderLogsTable.id, log.id));
    logger.warn({ subscriptionId, trigger }, "WhatsApp reminder failed");
    return { ok: false as const, logId: log.id, reason: message };
  }
}

export async function runWhatsAppReminderBatch() {
  const settings = await readWhatsAppSettings();
  if (!settings.enabled || !settings.wabaId || !settings.phoneNumberId) return;
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Amman" }).format(new Date());
  const addDays = (date: string, days: number) => {
    const value = new Date(`${date}T12:00:00Z`);
    value.setUTCDate(value.getUTCDate() + days);
    return value.toISOString().slice(0, 10);
  };
  const { reminderDays } = await readClubSettings();
  const dueDates = new Map(reminderDays.map(days => [addDays(today, days), String(days)]));
  const rows = await db.select().from(subscriptionsTable).where(and(eq(subscriptionsTable.status, "active")));
  for (const subscription of rows) {
    const trigger = dueDates.get(subscription.endDate);
    if (!trigger) continue;
    await sendWhatsAppReminder(subscription.id, trigger);
  }
}
