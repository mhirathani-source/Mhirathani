import { clerkClient, getAuth } from "@clerk/express";
import {
  ActOnSubscriptionBody,
  ActOnSubscriptionParams,
  ActOnSubscriptionResponse,
  CreateMemberBody,
  CreateMemberResponse,
  CreatePlanBody,
  CreatePlanResponse,
  CreateSubscriptionBody,
  CreateSubscriptionPaymentBody,
  CreateSubscriptionPaymentParams,
  CreateSubscriptionPaymentResponse,
  CreateSubscriptionResponse,
  GetClubDashboardResponse,
  GetClubSessionResponse,
  GetMemberParams,
  GetMemberResponse,
  GetPaymentReceiptParams,
  GetPaymentReceiptResponse,
  ListMembersQueryParams,
  ListMembersResponse,
  ListPlansResponse,
  ListSubscriptionPaymentsParams,
  ListSubscriptionPaymentsResponse,
  ListSubscriptionsQueryParams,
  ListSubscriptionsResponse,
  UpdateMemberBody,
  UpdateMemberParams,
  UpdateMemberResponse,
  UpdatePlanBody,
  UpdatePlanParams,
  UpdatePlanResponse,
} from "@workspace/api-zod";
import { db, auditLogTable, clubUsersTable, membersTable, paymentsTable, plansTable, subscriptionsTable } from "@workspace/db";
import { and, desc, eq, ilike, inArray, or, sql } from "drizzle-orm";
import { Router, type IRouter } from "express";
import { requireClubUser } from "../middlewares/clubAuth";

const router: IRouter = Router();
const JORDAN_TIME_ZONE = "Asia/Amman";

function jordanDate(date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: JORDAN_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

function addDays(date: string, days: number): string {
  const value = new Date(`${date}T12:00:00.000Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}

function dateOnly(value: string | Date): string {
  return value instanceof Date ? value.toISOString().slice(0, 10) : value;
}

function effectiveStatus(subscription: typeof subscriptionsTable.$inferSelect) {
  if (subscription.status === "paused" || subscription.status === "cancelled") return subscription.status;
  return subscription.endDate < jordanDate() ? "expired" : "active";
}

function receiptNumber(): string {
  const time = new Date().toISOString().replace(/\D/g, "").slice(0, 14);
  return `N-${time}-${crypto.randomUUID().slice(0, 6).toUpperCase()}`;
}

async function audit(actorId: string, action: string, entityType: string, entityId: number | null, details: Record<string, unknown> = {}) {
  await db.insert(auditLogTable).values({ actorId, action, entityType, entityId, details });
}

async function subscriptionView(row: typeof subscriptionsTable.$inferSelect) {
  const [member] = await db.select({ name: membersTable.name }).from(membersTable).where(eq(membersTable.id, row.memberId)).limit(1);
  const [plan] = await db.select({ name: plansTable.name }).from(plansTable).where(eq(plansTable.id, row.planId)).limit(1);
  const paymentRows = await db.select().from(paymentsTable).where(eq(paymentsTable.subscriptionId, row.id));
  const paidFils = paymentRows.reduce((total, payment) => total + (payment.kind === "refund" ? -payment.amountFils : payment.kind === "payment" ? payment.amountFils : 0), 0);
  return {
    id: row.id, memberId: row.memberId, memberName: member?.name ?? "", planId: row.planId,
    planName: plan?.name ?? "", priceFils: row.priceFils, paidFils,
    balanceFils: Math.max(0, row.priceFils - row.discountFils - paidFils),
    startDate: row.startDate, endDate: row.endDate, status: effectiveStatus(row), createdAt: row.createdAt.toISOString(),
  };
}

async function addPayment(
  trx: Parameters<Parameters<typeof db.transaction>[0]>[0],
  subscriptionId: number,
  amountFils: number,
  method: string,
  createdBy: string,
  note: string | null = null,
  kind = "payment",
) {
  const [payment] = await trx.insert(paymentsTable).values({
    subscriptionId, amountFils, method, createdBy, note, kind, receiptNumber: receiptNumber(),
  }).returning();
  return payment;
}

router.get("/club/session", async (req, res): Promise<void> => {
  const userId = getAuth(req).userId;
  if (!userId) {
    res.status(401).json({ error: "يلزم تسجيل الدخول" });
    return;
  }
  const identity = await clerkClient.users.getUser(userId);
  const email = identity.emailAddresses.find((item) => item.id === identity.primaryEmailAddressId)?.emailAddress ?? "";
  let [user] = await db.select().from(clubUsersTable).where(eq(clubUsersTable.clerkUserId, userId)).limit(1);
  if (!user && process.env.CLUB_ADMIN_EMAIL && email.toLowerCase() === process.env.CLUB_ADMIN_EMAIL.trim().toLowerCase()) {
    [user] = await db.insert(clubUsersTable).values({ clerkUserId: userId, email, role: "admin" }).onConflictDoNothing().returning();
    if (!user) [user] = await db.select().from(clubUsersTable).where(eq(clubUsersTable.clerkUserId, userId)).limit(1);
  }
  res.json(GetClubSessionResponse.parse({
    userId,
    email,
    role: user?.role === "admin" || user?.role === "staff" ? user.role : null,
    setupRequired: !process.env.CLUB_ADMIN_EMAIL,
  }));
});

router.get("/club/dashboard", requireClubUser, async (_req, res): Promise<void> => {
  const today = jordanDate();
  const soon = addDays(today, 7);
  const members = await db.select().from(membersTable);
  const subscriptions = await db.select().from(subscriptionsTable).where(sql`${subscriptionsTable.status} <> 'cancelled'`);
  const payments = await db.select().from(paymentsTable).where(eq(paymentsTable.kind, "payment"));
  const expenses = 0;
  const activeMembers = new Set(subscriptions.filter((s) => effectiveStatus(s) === "active" && members.some((m) => m.id === s.memberId && m.active)).map((s) => s.memberId)).size;
  const endingSoon = subscriptions.filter((s) => effectiveStatus(s) === "active" && s.endDate >= today && s.endDate <= soon).length;
  const expiredSubscriptions = subscriptions.filter((s) => effectiveStatus(s) === "expired").length;
  const outstandingFils = subscriptions.reduce((total, s) => {
    const paid = payments.filter((p) => p.subscriptionId === s.id).reduce((sum, p) => sum + p.amountFils, 0);
    return total + Math.max(0, s.priceFils - s.discountFils - paid);
  }, 0);
  const monthPrefix = today.slice(0, 7);
  const collectedFils = payments.reduce((total, payment) => total + payment.amountFils, 0);
  const monthlyCollectedFils = payments.filter((p) => jordanDate(p.createdAt).slice(0, 7) === monthPrefix).reduce((total, p) => total + p.amountFils, 0);
  const recentMembers = [...members].sort((a, b) => b.joinedAt.getTime() - a.joinedAt.getTime()).slice(0, 5).map((m) => ({ ...m, joinedAt: m.joinedAt.toISOString() }));
  res.json(GetClubDashboardResponse.parse({ activeMembers, endingSoon, expiredSubscriptions, collectedFils, outstandingFils, monthlyCollectedFils, recentMembers }));
});

router.get("/members", requireClubUser, async (req, res): Promise<void> => {
  const query = ListMembersQueryParams.safeParse(req.query);
  if (!query.success) { res.status(400).json({ error: query.error.message }); return; }
  const search = query.data.search?.trim();
  const rows = await db.select().from(membersTable)
    .where(search ? or(ilike(membersTable.name, `%${search}%`), ilike(membersTable.phone, `%${search}%`)) : undefined)
    .orderBy(desc(membersTable.joinedAt)).limit(query.data.limit ?? 50);
  res.json(ListMembersResponse.parse(rows.map((m) => ({ ...m, joinedAt: m.joinedAt.toISOString() }))));
});

router.post("/members", requireClubUser, async (req, res): Promise<void> => {
  const body = CreateMemberBody.safeParse(req.body);
  if (!body.success) { res.status(400).json({ error: body.error.message }); return; }
  const phone = body.data.phone.replace(/[()\s-]/g, "");
  const [row] = await db.insert(membersTable).values({ ...body.data, phone }).returning();
  await audit(req.clubUser!.clerkUserId, "member.created", "member", row.id);
  res.status(201).json(CreateMemberResponse.parse({ ...row, joinedAt: row.joinedAt.toISOString() }));
});

router.get("/members/:id", requireClubUser, async (req, res): Promise<void> => {
  const params = GetMemberParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }
  const [member] = await db.select().from(membersTable).where(eq(membersTable.id, params.data.id)).limit(1);
  if (!member) { res.status(404).json({ error: "المشترك غير موجود" }); return; }
  const subscriptions = await db.select().from(subscriptionsTable).where(eq(subscriptionsTable.memberId, member.id)).orderBy(desc(subscriptionsTable.createdAt));
  const subscriptionIds = subscriptions.map((s) => s.id);
  const payments = subscriptionIds.length
    ? await db.select().from(paymentsTable).where(inArray(paymentsTable.subscriptionId, subscriptionIds)).orderBy(desc(paymentsTable.createdAt))
    : [];
  res.json(GetMemberResponse.parse({
    member: { ...member, joinedAt: member.joinedAt.toISOString() },
    subscriptions: await Promise.all(subscriptions.map(subscriptionView)),
    payments: payments.map((p) => ({ ...p, createdAt: p.createdAt.toISOString() })),
  }));
});

router.patch("/members/:id", requireClubUser, async (req, res): Promise<void> => {
  const params = UpdateMemberParams.safeParse(req.params);
  const body = UpdateMemberBody.safeParse(req.body);
  if (!params.success || !body.success) { res.status(400).json({ error: "بيانات التعديل غير صحيحة" }); return; }
  const values = { ...body.data, ...(body.data.phone ? { phone: body.data.phone.replace(/[()\s-]/g, "") } : {}) };
  const [row] = await db.update(membersTable).set(values).where(eq(membersTable.id, params.data.id)).returning();
  if (!row) { res.status(404).json({ error: "المشترك غير موجود" }); return; }
  await audit(req.clubUser!.clerkUserId, "member.updated", "member", row.id);
  res.json(UpdateMemberResponse.parse({ ...row, joinedAt: row.joinedAt.toISOString() }));
});

router.get("/plans", requireClubUser, async (_req, res): Promise<void> => {
  const rows = await db.select().from(plansTable).orderBy(plansTable.durationDays);
  res.json(ListPlansResponse.parse(rows));
});

router.post("/plans", requireClubUser, async (req, res): Promise<void> => {
  const body = CreatePlanBody.safeParse(req.body);
  if (!body.success) { res.status(400).json({ error: body.error.message }); return; }
  const [row] = await db.insert(plansTable).values(body.data).returning();
  await audit(req.clubUser!.clerkUserId, "plan.created", "plan", row.id);
  res.status(201).json(CreatePlanResponse.parse(row));
});

router.patch("/plans/:id", requireClubUser, async (req, res): Promise<void> => {
  const params = UpdatePlanParams.safeParse(req.params);
  const body = UpdatePlanBody.safeParse(req.body);
  if (!params.success || !body.success) { res.status(400).json({ error: "بيانات الباقة غير صحيحة" }); return; }
  const [row] = await db.update(plansTable).set(body.data).where(eq(plansTable.id, params.data.id)).returning();
  if (!row) { res.status(404).json({ error: "الباقة غير موجودة" }); return; }
  await audit(req.clubUser!.clerkUserId, "plan.updated", "plan", row.id);
  res.json(UpdatePlanResponse.parse(row));
});

router.get("/subscriptions", requireClubUser, async (req, res): Promise<void> => {
  const query = ListSubscriptionsQueryParams.safeParse(req.query);
  if (!query.success) { res.status(400).json({ error: query.error.message }); return; }
  const rows = await db.select().from(subscriptionsTable).orderBy(desc(subscriptionsTable.createdAt));
  const views = await Promise.all(rows.map(subscriptionView));
  const filtered = views.filter((s) => {
    const statusMatch = !query.data.status || query.data.status === "all" || s.status === query.data.status;
    const term = query.data.search?.trim().toLowerCase();
    return statusMatch && (!term || s.memberName.toLowerCase().includes(term));
  });
  res.json(ListSubscriptionsResponse.parse(filtered));
});

router.post("/subscriptions", requireClubUser, async (req, res): Promise<void> => {
  const body = CreateSubscriptionBody.safeParse(req.body);
  if (!body.success) { res.status(400).json({ error: body.error.message }); return; }
  const [member] = await db.select().from(membersTable).where(eq(membersTable.id, body.data.memberId)).limit(1);
  const [plan] = await db.select().from(plansTable).where(and(eq(plansTable.id, body.data.planId), eq(plansTable.active, true))).limit(1);
  if (!member || !plan) { res.status(404).json({ error: "المشترك أو الباقة غير موجودة أو غير مفعّلة" }); return; }
  if (body.data.discountFils > plan.priceFils) { res.status(400).json({ error: "الخصم أكبر من سعر الباقة" }); return; }
  if ((body.data.initialPaymentFils ?? 0) > plan.priceFils - (body.data.discountFils ?? 0)) { res.status(400).json({ error: "المبلغ المدفوع أكبر من المستحق" }); return; }
  const created = await db.transaction(async (trx) => {
    const [subscription] = await trx.insert(subscriptionsTable).values({
      memberId: member.id, planId: plan.id, priceFils: plan.priceFils,
      discountFils: body.data.discountFils ?? 0,
      startDate: dateOnly(body.data.startDate),
      endDate: addDays(dateOnly(body.data.startDate), plan.durationDays - 1),
    }).returning();
    if ((body.data.discountFils ?? 0) > 0) await addPayment(trx, subscription.id, body.data.discountFils!, "cash", req.clubUser!.clerkUserId, "خصم", "discount");
    if ((body.data.initialPaymentFils ?? 0) > 0) await addPayment(trx, subscription.id, body.data.initialPaymentFils!, body.data.paymentMethod ?? "cash", req.clubUser!.clerkUserId);
    return subscription;
  });
  await audit(req.clubUser!.clerkUserId, "subscription.created", "subscription", created.id);
  res.status(201).json(CreateSubscriptionResponse.parse(await subscriptionView(created)));
});

router.post("/subscriptions/:id/action", requireClubUser, async (req, res): Promise<void> => {
  const params = ActOnSubscriptionParams.safeParse(req.params);
  const body = ActOnSubscriptionBody.safeParse(req.body);
  if (!params.success || !body.success) { res.status(400).json({ error: "إجراء الاشتراك غير صحيح" }); return; }
  const [current] = await db.select().from(subscriptionsTable).where(eq(subscriptionsTable.id, params.data.id)).limit(1);
  if (!current) { res.status(404).json({ error: "الاشتراك غير موجود" }); return; }
  let changes: Partial<typeof subscriptionsTable.$inferInsert> = {};
  switch (body.data.action) {
    case "pause":
      if (effectiveStatus(current) !== "active") { res.status(409).json({ error: "لا يمكن إيقاف اشتراك غير نشط مؤقتًا" }); return; }
      changes = { status: "paused", pausedAt: jordanDate() };
      break;
    case "resume":
      if (current.status !== "paused" || !current.pausedAt) { res.status(409).json({ error: "الاشتراك ليس موقوفًا مؤقتًا" }); return; }
      changes = { status: "active", endDate: addDays(current.endDate, Math.max(0, Math.round((Date.parse(`${jordanDate()}T00:00:00Z`) - Date.parse(`${current.pausedAt}T00:00:00Z`)) / 86400000))), pausedAt: null };
      break;
    case "cancel":
      changes = { status: "cancelled", pausedAt: null };
      break;
    case "renew": {
      const [plan] = await db.select().from(plansTable).where(eq(plansTable.id, body.data.planId ?? current.planId)).limit(1);
      if (!plan) { res.status(404).json({ error: "الباقة غير موجودة" }); return; }
      const startDate = body.data.startDate ? dateOnly(body.data.startDate) : (current.endDate >= jordanDate() ? addDays(current.endDate, 1) : jordanDate());
      const [renewed] = await db.insert(subscriptionsTable).values({
        memberId: current.memberId, planId: plan.id, priceFils: plan.priceFils,
        startDate, endDate: addDays(startDate, plan.durationDays - 1),
      }).returning();
      await audit(req.clubUser!.clerkUserId, "subscription.renewed", "subscription", renewed.id, { previousSubscriptionId: current.id });
      res.json(ActOnSubscriptionResponse.parse(await subscriptionView(renewed)));
      return;
    }
  }
  const [updated] = await db.update(subscriptionsTable).set(changes).where(eq(subscriptionsTable.id, current.id)).returning();
  await audit(req.clubUser!.clerkUserId, `subscription.${body.data.action}`, "subscription", updated.id);
  res.json(ActOnSubscriptionResponse.parse(await subscriptionView(updated)));
});

router.get("/subscriptions/:id/payments", requireClubUser, async (req, res): Promise<void> => {
  const params = ListSubscriptionPaymentsParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }
  const rows = await db.select().from(paymentsTable).where(eq(paymentsTable.subscriptionId, params.data.id)).orderBy(desc(paymentsTable.createdAt));
  res.json(ListSubscriptionPaymentsResponse.parse(rows.map((p) => ({ ...p, createdAt: p.createdAt.toISOString() }))));
});

router.post("/subscriptions/:id/payments", requireClubUser, async (req, res): Promise<void> => {
  const params = CreateSubscriptionPaymentParams.safeParse(req.params);
  const body = CreateSubscriptionPaymentBody.safeParse(req.body);
  if (!params.success || !body.success) { res.status(400).json({ error: "بيانات الدفعة غير صحيحة" }); return; }
  const [subscription] = await db.select().from(subscriptionsTable).where(eq(subscriptionsTable.id, params.data.id)).limit(1);
  if (!subscription) { res.status(404).json({ error: "الاشتراك غير موجود" }); return; }
  const [payment] = await db.transaction(async (trx) => {
    const prior = await trx.select().from(paymentsTable).where(and(eq(paymentsTable.subscriptionId, subscription.id), eq(paymentsTable.kind, "payment")));
    const refunded = await trx.select().from(paymentsTable).where(and(eq(paymentsTable.subscriptionId, subscription.id), eq(paymentsTable.kind, "refund")));
    const alreadyPaid = prior.reduce((sum, item) => sum + item.amountFils, 0) - refunded.reduce((sum, item) => sum + item.amountFils, 0);
    const due = subscription.priceFils - subscription.discountFils - alreadyPaid;
    if (body.data.amountFils > due) throw new Error("المبلغ المدفوع أكبر من الرصيد المتبقي");
    return [await addPayment(trx, subscription.id, body.data.amountFils, body.data.method, req.clubUser!.clerkUserId, body.data.note ?? null)];
  });
  await audit(req.clubUser!.clerkUserId, "payment.recorded", "payment", payment.id, { amountFils: payment.amountFils });
  res.status(201).json(CreateSubscriptionPaymentResponse.parse({ ...payment, createdAt: payment.createdAt.toISOString() }));
});

router.get("/payments/:id/receipt", requireClubUser, async (req, res): Promise<void> => {
  const params = GetPaymentReceiptParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }
  const [payment] = await db.select().from(paymentsTable).where(eq(paymentsTable.id, params.data.id)).limit(1);
  if (!payment) { res.status(404).json({ error: "الإيصال غير موجود" }); return; }
  const [subscription] = await db.select().from(subscriptionsTable).where(eq(subscriptionsTable.id, payment.subscriptionId)).limit(1);
  if (!subscription) { res.status(404).json({ error: "الاشتراك غير موجود" }); return; }
  const [member] = await db.select().from(membersTable).where(eq(membersTable.id, subscription.memberId)).limit(1);
  const [plan] = await db.select().from(plansTable).where(eq(plansTable.id, subscription.planId)).limit(1);
  res.json(GetPaymentReceiptResponse.parse({
    receiptNumber: payment.receiptNumber, memberName: member?.name ?? "", memberPhone: member?.phone ?? "",
    planName: plan?.name ?? "", amountFils: payment.amountFils, method: payment.method,
    createdAt: payment.createdAt.toISOString(), currency: "JOD",
  }));
});

export default router;
