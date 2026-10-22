import { z } from "zod/v4";
import { and, desc, eq } from "drizzle-orm";
import { Router, type IRouter } from "express";
import { db, auditLogTable, membersTable, subscriptionsTable, whatsappReminderLogsTable, whatsappTemplatesTable } from "@workspace/db";
import { requireAdmin, requireClubUser } from "../middlewares/clubAuth";
import { createProviderTemplate, ensureDefaultWhatsAppTemplates, readWhatsAppSettings, sendWhatsAppReminder, syncWhatsAppTemplates, writeWhatsAppSettings } from "../lib/whatsapp";

const router: IRouter = Router();
const settingsSchema = z.object({
  wabaId: z.string().trim().max(80),
  phoneNumberId: z.string().trim().max(80),
  enabled: z.boolean(),
});
const templateSchema = z.object({
  key: z.enum(["expiry_2_days", "expiry_today", "manual"]),
  body: z.string().min(10).max(1024),
});

router.get("/club/whatsapp/settings", requireClubUser, async (_req, res): Promise<void> => {
  await ensureDefaultWhatsAppTemplates();
  const [settings, templates] = await Promise.all([
    readWhatsAppSettings(),
    db.select().from(whatsappTemplatesTable).orderBy(whatsappTemplatesTable.name),
  ]);
  res.json({ ...settings, configured: Boolean(settings.wabaId && settings.phoneNumberId), templates });
});

router.put("/club/whatsapp/settings", requireClubUser, requireAdmin, async (req, res): Promise<void> => {
  const parsed = settingsSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "إعدادات واتساب غير صالحة" }); return; }
  if (parsed.data.enabled && (!parsed.data.wabaId || !parsed.data.phoneNumberId)) {
    res.status(400).json({ error: "أدخل معرّف حساب واتساب ومعرّف رقم الهاتف قبل التفعيل" }); return;
  }
  await writeWhatsAppSettings(parsed.data);
  await db.insert(auditLogTable).values({ actorId: req.clubUser!.clerkUserId, action: "whatsapp.settings_updated", entityType: "system_setting", details: { enabled: parsed.data.enabled } });
  res.json({ ...parsed.data, configured: Boolean(parsed.data.wabaId && parsed.data.phoneNumberId) });
});

router.post("/club/whatsapp/templates/create", requireClubUser, requireAdmin, async (req, res): Promise<void> => {
  const parsed = templateSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "بيانات القالب غير صالحة" }); return; }
  try {
    const created = await createProviderTemplate(parsed.data.key, parsed.data.body);
    await syncWhatsAppTemplates();
    await db.insert(auditLogTable).values({ actorId: req.clubUser!.clerkUserId, action: "whatsapp.template_submitted", entityType: "whatsapp_template", details: { key: parsed.data.key } });
    res.status(201).json({ status: String(created.status ?? "pending"), message: "أُرسل القالب إلى Meta للمراجعة؛ لا يمكن الإرسال حتى اعتماده." });
  } catch (error) {
    res.status(502).json({ error: error instanceof Error ? error.message : "تعذر الوصول إلى WhatsApp Business" });
  }
});

router.post("/club/whatsapp/templates/sync", requireClubUser, requireAdmin, async (_req, res): Promise<void> => {
  try { res.json({ templates: await syncWhatsAppTemplates() }); }
  catch (error) { res.status(502).json({ error: error instanceof Error ? error.message : "تعذر تحديث حالة القوالب" }); }
});

router.get("/members/:id/whatsapp-reminders", requireClubUser, async (req, res): Promise<void> => {
  const memberId = Number(req.params.id);
  if (!Number.isInteger(memberId) || memberId < 1) { res.status(400).json({ error: "رقم المشترك غير صالح" }); return; }
  const rows = await db.select().from(whatsappReminderLogsTable).where(eq(whatsappReminderLogsTable.memberId, memberId)).orderBy(desc(whatsappReminderLogsTable.createdAt)).limit(50);
  res.json(rows);
});

router.post("/members/:id/whatsapp-reminder", requireClubUser, async (req, res): Promise<void> => {
  const memberId = Number(req.params.id);
  if (!Number.isInteger(memberId) || memberId < 1) { res.status(400).json({ error: "رقم المشترك غير صالح" }); return; }
  const [member] = await db.select().from(membersTable).where(eq(membersTable.id, memberId)).limit(1);
  if (!member) { res.status(404).json({ error: "المشترك غير موجود" }); return; }
  const [subscription] = await db.select().from(subscriptionsTable)
    .where(and(eq(subscriptionsTable.memberId, memberId), eq(subscriptionsTable.status, "active")))
    .orderBy(desc(subscriptionsTable.endDate)).limit(1);
  if (!subscription) { res.status(409).json({ error: "لا يوجد اشتراك نشط لهذا المشترك" }); return; }
  const result = await sendWhatsAppReminder(subscription.id, "manual");
  await db.insert(auditLogTable).values({ actorId: req.clubUser!.clerkUserId, action: "whatsapp.manual_reminder_attempted", entityType: "subscription", entityId: subscription.id, details: { accepted: result.ok } });
  if (!result.ok) { res.status(409).json({ error: result.reason }); return; }
  res.status(202).json({ status: "accepted", message: "قبلت Meta الرسالة للإرسال؛ هذا لا يؤكد وصولها إلى الهاتف." });
});

export default router;
