import { Router } from "express";
import { and, desc, eq } from "drizzle-orm";
import { z } from "zod/v4";
import { db, membersTable, plansTable, subscriptionsTable } from "@workspace/db";
import { ActOnSubscriptionBody, CreateSubscriptionBody } from "@workspace/api-zod";
import { correctSubscription, jordanToday, MembershipError, startSubscription, subscriptionAction, subscriptionStatus, validCalendarDate } from "../lib/membership";
import { hasPermission } from "../lib/permissions";
import { readClubSettings } from "../lib/clubSettings";

const router = Router();
function id(value: unknown) {
  const parsed = z.coerce.number().int().positive().safeParse(value);
  if (!parsed.success) throw new MembershipError(400, "معرّف الاشتراك غير صالح");
  return parsed.data;
}
async function operationView(row: typeof subscriptionsTable.$inferSelect) {
  const [[member], [plan]] = await Promise.all([
    db.select({ name: membersTable.name }).from(membersTable).where(eq(membersTable.id, row.memberId)),
    db.select({ name: plansTable.name }).from(plansTable).where(eq(plansTable.id, row.planId)),
  ]);
  return { id: row.id, memberId: row.memberId, memberName: member?.name ?? "", planId: row.planId, planName: plan?.name ?? "", startDate: row.startDate, endDate: row.endDate, status: subscriptionStatus(row) };
}
router.get("/club/operations/plans", async (_req, res) => {
  res.json(await db.select({ id: plansTable.id, name: plansTable.name, durationDays: plansTable.durationDays, active: plansTable.active }).from(plansTable).where(eq(plansTable.active, true)));
});
router.get("/club/operations/subscriptions", async (req, res) => {
  const memberId = req.query.memberId ? id(req.query.memberId) : undefined;
  const rows = await db.select().from(subscriptionsTable).where(memberId ? eq(subscriptionsTable.memberId, memberId) : undefined).orderBy(desc(subscriptionsTable.id)).limit(500);
  res.json(await Promise.all(rows.map(operationView)));
});
router.post("/club/operations/subscriptions", async (req, res) => {
  const input = z.object({ memberId: z.number().int().positive(), planId: z.number().int().positive(), startDate: z.string().refine(validCalendarDate) }).strict().safeParse(req.body);
  if (!input.success) throw new MembershipError(400, "اختر المشترك والباقة وتاريخ بداية صحيحًا؛ لا تسمح هذه الواجهة بتعديل الأسعار أو المدفوعات");
  const body = CreateSubscriptionBody.parse({ ...input.data, discountFils: 0, initialPaymentFils: 0 });
  const created = await startSubscription(body, req.clubUser!.clerkUserId);
  res.status(201).json(await operationView(created));
});
router.patch("/club/operations/subscriptions/:id", async (req, res) => {
  const input = z.object({ planId: z.number().int().positive().optional(), startDate: z.string().refine(validCalendarDate).optional(), endDate: z.string().refine(validCalendarDate).optional() }).strict().safeParse(req.body);
  if (!input.success || !Object.keys(input.data).length) throw new MembershipError(400, "بيانات تعديل الاشتراك غير صحيحة");
  const [current] = await db.select().from(subscriptionsTable).where(eq(subscriptionsTable.id, id(req.params.id)));
  if (!current) throw new MembershipError(404, "الاشتراك غير موجود");
  const [plan] = await db.select().from(plansTable).where(eq(plansTable.id, input.data.planId ?? current.planId));
  if (!plan?.active) throw new MembershipError(409, "الباقة غير متاحة");
  const updated = await correctSubscription(current.id, {
    planId: plan.id, priceFils: plan.id === current.planId ? current.priceFils : plan.priceFils,
    startDate: input.data.startDate ?? current.startDate, endDate: input.data.endDate ?? current.endDate,
  }, req.clubUser!.clerkUserId);
  res.json(await operationView(updated));
});
router.post("/club/operations/subscriptions/:id/action", async (req, res) => {
  const input = ActOnSubscriptionBody.safeParse(req.body);
  if (!input.success) throw new MembershipError(400, "عملية الاشتراك غير صحيحة");
  if (input.data.action === "renew" && !hasPermission(req, "subscriptions.create")) throw new MembershipError(403, "التجديد يحتاج صلاحية إضافة اشتراك");
  if (input.data.action === "cancel" && !hasPermission(req, "subscriptions.delete")) throw new MembershipError(403, "الإلغاء يحتاج صلاحية حذف / إلغاء الاشتراك");
  const updated = await subscriptionAction(id(req.params.id), input.data, req.clubUser!.clerkUserId);
  res.json(await operationView(updated));
});
router.get("/club/operations/settings", async (_req, res) => {
  const settings = await readClubSettings();
  res.json({ clubName: settings.clubName, memberRequiredFields: settings.memberRequiredFields, paymentMethods: settings.paymentMethods, maxDiscountPercent: settings.maxDiscountPercent });
});
export default router;
