import { z } from "zod/v4";
import { and, desc, eq, inArray } from "drizzle-orm";
import { Router, type IRouter } from "express";
import { db, auditLogTable, membersTable, plansTable, subscriptionsTable, whatsappReminderLogsTable } from "@workspace/db";
import { requireAdmin, requireClubUser } from "../middlewares/clubAuth";
import { buildManualWhatsAppLink } from "../../../../api/whatsapp/manual.js";
import { readWhatsAppSettings, writeWhatsAppSettings } from "../lib/whatsapp";

const router: IRouter = Router();
const settingsSchema = z.object({ messageTemplate: z.string().trim().min(10).max(1024) }).strict();

router.get("/club/whatsapp/settings", requireClubUser, async (_req, res): Promise<void> => {
  res.json(await readWhatsAppSettings());
});

router.put("/club/whatsapp/settings", requireClubUser, requireAdmin, async (req, res): Promise<void> => {
  const parsed = settingsSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "نص تذكير واتساب غير صالح" }); return; }
  const settings = await writeWhatsAppSettings(parsed.data.messageTemplate);
  await db.insert(auditLogTable).values({
    actorId: req.clubUser!.clerkUserId,
    action: "whatsapp.manual_template_updated",
    entityType: "system_setting",
    details: { key: "whatsapp_manual_message_template" },
  });
  res.json(settings);
});

router.get("/members/:id/whatsapp-reminders", requireClubUser, async (req, res): Promise<void> => {
  const memberId = Number(req.params.id);
  if (!Number.isInteger(memberId) || memberId < 1) { res.status(400).json({ error: "رقم المشترك غير صالح" }); return; }
  const [manualRows, legacyRows] = await Promise.all([
    db.select({ id: auditLogTable.id, createdAt: auditLogTable.createdAt })
      .from(auditLogTable)
      .where(and(
        eq(auditLogTable.entityType, "member"),
        eq(auditLogTable.entityId, memberId),
        eq(auditLogTable.action, "whatsapp.manual_link_requested"),
      ))
      .orderBy(desc(auditLogTable.createdAt))
      .limit(50),
    db.select({
      id: whatsappReminderLogsTable.id,
      createdAt: whatsappReminderLogsTable.createdAt,
      triggerDays: whatsappReminderLogsTable.triggerDays,
      status: whatsappReminderLogsTable.status,
    })
      .from(whatsappReminderLogsTable)
      .where(eq(whatsappReminderLogsTable.memberId, memberId))
      .orderBy(desc(whatsappReminderLogsTable.createdAt))
      .limit(50),
  ]);
  const rows = [
    ...manualRows.map((row) => ({
      ...row,
      triggerDays: "manual",
      status: "link_requested",
      source: "manual" as const,
      error: "طُلب فتح المحادثة؛ لا يؤكد ذلك إرسال الرسالة أو استلامها.",
    })),
    ...legacyRows.map((row) => ({
      ...row,
      source: "legacy" as const,
      status: "legacy",
      error: "سجل قديم من طريقة الإرسال السابقة؛ لا يؤكد وصول الرسالة.",
    })),
  ].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).slice(0, 50);
  res.json(rows);
});

router.post("/members/:id/whatsapp-reminder", requireClubUser, async (req, res): Promise<void> => {
  const memberId = Number(req.params.id);
  if (!Number.isInteger(memberId) || memberId < 1) { res.status(400).json({ error: "رقم المشترك غير صالح" }); return; }
  const [member] = await db.select().from(membersTable).where(eq(membersTable.id, memberId)).limit(1);
  if (!member) { res.status(404).json({ error: "المشترك غير موجود" }); return; }
  const [subscription] = await db.select().from(subscriptionsTable)
    .where(and(eq(subscriptionsTable.memberId, memberId), inArray(subscriptionsTable.status, ["active","expired"])))
    .orderBy(desc(subscriptionsTable.endDate)).limit(1);
  if (!subscription) { res.status(409).json({ error: "لا يوجد اشتراك نشط لهذا المشترك" }); return; }
  const [plan] = await db.select({ name: plansTable.name }).from(plansTable).where(eq(plansTable.id, subscription.planId)).limit(1);
  if (!plan) { res.status(409).json({ error: "تعذر تحديد باقة الاشتراك" }); return; }
  const settings = await readWhatsAppSettings();
  let chat;
  try {
    chat = buildManualWhatsAppLink({
      phone: member.phone,
      name: member.name,
      plan: plan.name,
      endDate: subscription.endDate,
      template: settings.messageTemplate,
    });
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : "رقم الهاتف غير صالح" });
    return;
  }
  await db.insert(auditLogTable).values({
    actorId: req.clubUser!.clerkUserId,
    action: "whatsapp.manual_link_requested",
    entityType: "member",
    entityId: member.id,
    details: { subscriptionId: subscription.id, channel: "wa.me" },
  });
  res.json({
    status: "link_requested",
    url: chat.url,
    message: "ستفتح محادثة WhatsApp بالنص الجاهز؛ راجع الرسالة واضغط إرسال داخل التطبيق.",
  });
});

export default router;
