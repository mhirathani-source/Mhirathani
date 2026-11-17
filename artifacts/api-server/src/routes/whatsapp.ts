import { desc, eq } from "drizzle-orm";
import { Router, type IRouter } from "express";
import { db, whatsappReminderLogsTable } from "@workspace/db";
import { requireAdmin, requireClubUser } from "../middlewares/clubAuth";

const router: IRouter = Router();
const businessDisabledMessage = "الإرسال عبر WhatsApp Business متوقف. افتح رابط واتساب العادي من ملف المشترك وأرسل الرسالة يدويًا.";

router.get("/club/whatsapp/settings", requireClubUser, (_req, res): void => {
  res.json({ mode: "manual", enabled: false, configured: false, businessSettingsPreserved: true });
});

router.put("/club/whatsapp/settings", requireClubUser, requireAdmin, (_req, res): void => {
  res.status(409).json({ error: businessDisabledMessage });
});

router.post("/club/whatsapp/templates/create", requireClubUser, requireAdmin, (_req, res): void => {
  res.status(409).json({ error: businessDisabledMessage });
});

router.post("/club/whatsapp/templates/sync", requireClubUser, requireAdmin, (_req, res): void => {
  res.status(409).json({ error: businessDisabledMessage });
});

router.get("/members/:id/whatsapp-reminders", requireClubUser, async (req, res): Promise<void> => {
  const memberId = Number(req.params.id);
  if (!Number.isInteger(memberId) || memberId < 1) { res.status(400).json({ error: "رقم المشترك غير صالح" }); return; }
  const rows = await db.select().from(whatsappReminderLogsTable).where(eq(whatsappReminderLogsTable.memberId, memberId)).orderBy(desc(whatsappReminderLogsTable.createdAt)).limit(50);
  res.json(rows);
});

router.post("/members/:id/whatsapp-reminder", requireClubUser, (_req, res): void => {
  res.status(410).json({ error: businessDisabledMessage });
});

export default router;
