import { clerkClient, getAuth } from "@clerk/express";
import {
  ActOnSubscriptionBody,
  ActOnSubscriptionParams,
  ActOnSubscriptionResponse,
  CreateMemberBody,
  CreateMemberResponse,
  CreateFinanceCategoryBody, CreateFinanceCategoryResponse,
  CreateFinanceTransactionBody, CreateFinanceTransactionResponse,
  GetFinanceReportQueryParams, GetFinanceReportResponse,
  ListFinanceCategoriesResponse, ListFinanceTransactionsQueryParams, ListFinanceTransactionsResponse,
  ListCashMovementsResponse,
  CreateEmployeeBody, CreateEmployeeResponse, ListEmployeesResponse,
  CreatePayrollBody, CreatePayrollResponse, ListPayrollResponse, PayPayrollBody, PayPayrollParams, PayPayrollResponse,
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
import { db, auditLogTable, cashMovementsTable, clubUsersTable, employeesTable, financeCategoriesTable, financialTransactionsTable, membersTable, payrollEntriesTable, paymentsTable, plansTable, subscriptionsTable } from "@workspace/db";
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
  if (method === "cash" && (kind === "payment" || kind === "refund")) await trx.insert(cashMovementsTable).values({
    direction: kind === "payment" ? "in" : "out", amountFils, description: `اشتراك #${subscriptionId}`,
    referenceType: "subscription_payment", referenceId: payment.id, createdBy,
  });
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

router.get("/club/finance/categories", requireClubUser, async (_req, res): Promise<void> => {
  const rows = await db.select().from(financeCategoriesTable).orderBy(financeCategoriesTable.kind, financeCategoriesTable.name);
  res.json(ListFinanceCategoriesResponse.parse(rows));
});

router.post("/club/finance/categories", requireClubUser, async (req, res): Promise<void> => {
  const body = CreateFinanceCategoryBody.safeParse(req.body);
  if (!body.success) { res.status(400).json({ error: body.error.message }); return; }
  const [row] = await db.insert(financeCategoriesTable).values(body.data).returning();
  await audit(req.clubUser!.clerkUserId, "finance_category.created", "finance_category", row.id);
  res.status(201).json(CreateFinanceCategoryResponse.parse(row));
});

router.get("/club/finance/transactions", requireClubUser, async (req, res): Promise<void> => {
  const from = typeof req.query.from === "string" ? req.query.from : undefined;
  const to = typeof req.query.to === "string" ? req.query.to : undefined;
  const datePattern = /^\d{4}-\d{2}-\d{2}$/;
  if ((from && !datePattern.test(from)) || (to && !datePattern.test(to)) || (from && to && from > to)) {
    res.status(400).json({ error: "نطاق التاريخ غير صالح" }); return;
  }
  const conditions = [from ? sql`${financialTransactionsTable.transactionDate} >= ${from}` : undefined, to ? sql`${financialTransactionsTable.transactionDate} <= ${to}` : undefined].filter(Boolean);
  const rows = await db.select({ transaction: financialTransactionsTable, categoryName: financeCategoriesTable.name })
    .from(financialTransactionsTable).leftJoin(financeCategoriesTable, eq(financialTransactionsTable.categoryId, financeCategoriesTable.id))
    .where(conditions.length ? and(...conditions as [any, ...any[]]) : undefined).orderBy(desc(financialTransactionsTable.transactionDate), desc(financialTransactionsTable.createdAt)).limit(500);
  res.json(ListFinanceTransactionsResponse.parse(rows.map(({ transaction, categoryName }) => ({ ...transaction, categoryName }))));
});

router.post("/club/finance/transactions", requireClubUser, async (req, res): Promise<void> => {
  const body = CreateFinanceTransactionBody.safeParse(req.body);
  if (!body.success) { res.status(400).json({ error: body.error.message }); return; }
  if (body.data.categoryId) {
    const [category] = await db.select().from(financeCategoriesTable).where(and(eq(financeCategoriesTable.id, body.data.categoryId), eq(financeCategoriesTable.active, true))).limit(1);
    if (!category || category.kind !== body.data.kind) { res.status(400).json({ error: "التصنيف غير صالح لنوع الحركة" }); return; }
  }
  const transactionDate = dateOnly(body.data.transactionDate);
  const [row] = await db.transaction(async (trx) => {
    const [created] = await trx.insert(financialTransactionsTable).values({ ...body.data, transactionDate, createdBy: req.clubUser!.clerkUserId }).returning();
    if (body.data.method === "cash") await trx.insert(cashMovementsTable).values({
      direction: body.data.kind === "income" ? "in" : "out", amountFils: body.data.amountFils,
      description: body.data.description, referenceType: "financial_transaction", referenceId: created.id, createdBy: req.clubUser!.clerkUserId,
    });
    return [created];
  });
  await audit(req.clubUser!.clerkUserId, `finance.${row.kind}.recorded`, "financial_transaction", row.id, { amountFils: row.amountFils });
  const [category] = row.categoryId ? await db.select({ name: financeCategoriesTable.name }).from(financeCategoriesTable).where(eq(financeCategoriesTable.id, row.categoryId)).limit(1) : [];
  res.status(201).json(CreateFinanceTransactionResponse.parse({ ...row, categoryName: category?.name ?? null }));
});

router.get("/club/finance/report", requireClubUser, async (req, res): Promise<void> => {
  const from = typeof req.query.from === "string" ? req.query.from : "";
  const to = typeof req.query.to === "string" ? req.query.to : "";
  const pattern = /^\d{4}-\d{2}-\d{2}$/;
  if (!pattern.test(from) || !pattern.test(to) || from > to) { res.status(400).json({ error: "حدد فترة صحيحة للتقرير" }); return; }
  const [transactions, paymentRows, subscriptions, payrollRows, cashRows] = await Promise.all([
    db.select().from(financialTransactionsTable).where(and(sql`${financialTransactionsTable.transactionDate} >= ${from}`, sql`${financialTransactionsTable.transactionDate} <= ${to}`)),
    db.select().from(paymentsTable).where(eq(paymentsTable.kind, "payment")),
    db.select().from(subscriptionsTable),
    db.select().from(payrollEntriesTable),
    db.select().from(cashMovementsTable),
  ]);
  const paymentsInRange = paymentRows.filter((p) => { const d = jordanDate(p.createdAt); return d >= from && d <= to; }).reduce((sum, p) => sum + p.amountFils, 0);
  const incomeFils = paymentsInRange + transactions.filter((t) => t.kind === "income").reduce((sum, t) => sum + t.amountFils, 0);
  const expensesFils = transactions.filter((t) => t.kind === "expense").reduce((sum, t) => sum + t.amountFils, 0);
  const totalPaid = new Map<number, number>();
  for (const p of paymentRows) totalPaid.set(p.subscriptionId, (totalPaid.get(p.subscriptionId) ?? 0) + p.amountFils);
  const debtFils = subscriptions.reduce((sum, s) => sum + Math.max(0, s.priceFils - s.discountFils - (totalPaid.get(s.id) ?? 0)), 0);
  const payrollDueFils = payrollRows.reduce((sum, p) => sum + Math.max(0, p.amountFils - p.paidFils), 0);
  const cashBalanceFils = cashRows.reduce((sum, row) => sum + (row.direction === "in" ? row.amountFils : -row.amountFils), 0);
  res.json(GetFinanceReportResponse.parse({ from, to, incomeFils, expensesFils, netFils: incomeFils - expensesFils, debtFils, payrollDueFils, cashBalanceFils }));
});

router.get("/club/cash-movements", requireClubUser, async (req, res): Promise<void> => {
  const from = typeof req.query.from === "string" ? req.query.from : undefined;
  const to = typeof req.query.to === "string" ? req.query.to : undefined;
  const valid = (value?: string) => !value || /^\d{4}-\d{2}-\d{2}$/.test(value);
  if (!valid(from) || !valid(to) || (from && to && from > to)) { res.status(400).json({ error: "نطاق التاريخ غير صالح" }); return; }
  const rows = await db.select().from(cashMovementsTable).orderBy(desc(cashMovementsTable.createdAt)).limit(1000);
  const filtered = rows.filter((row) => { const date = jordanDate(row.createdAt); return (!from || date >= from) && (!to || date <= to); });
  res.json(ListCashMovementsResponse.parse(filtered.map((row) => ({ ...row, createdAt: row.createdAt.toISOString() }))));
});

router.get("/club/employees", requireClubUser, async (_req, res): Promise<void> => {
  res.json(ListEmployeesResponse.parse(await db.select().from(employeesTable).orderBy(desc(employeesTable.createdAt))));
});

router.post("/club/employees", requireClubUser, async (req, res): Promise<void> => {
  const body = CreateEmployeeBody.safeParse(req.body);
  if (!body.success) { res.status(400).json({ error: body.error.message }); return; }
  const [row] = await db.insert(employeesTable).values({ ...body.data, hiredAt: body.data.hiredAt ? dateOnly(body.data.hiredAt) : null }).returning();
  await audit(req.clubUser!.clerkUserId, "employee.created", "employee", row.id);
  res.status(201).json(CreateEmployeeResponse.parse(row));
});

async function payrollViews() {
  const rows = await db.select({ payroll: payrollEntriesTable, employeeName: employeesTable.name })
    .from(payrollEntriesTable).innerJoin(employeesTable, eq(payrollEntriesTable.employeeId, employeesTable.id)).orderBy(desc(payrollEntriesTable.dueDate));
  return rows.map(({ payroll, employeeName }) => ({ ...payroll, employeeName, status: payroll.paidFils >= payroll.amountFils ? "paid" : payroll.paidFils > 0 ? "partial" : "due" }));
}

router.get("/club/payroll", requireClubUser, async (_req, res): Promise<void> => {
  res.json(ListPayrollResponse.parse(await payrollViews()));
});

router.post("/club/payroll", requireClubUser, async (req, res): Promise<void> => {
  const body = CreatePayrollBody.safeParse(req.body);
  if (!body.success) { res.status(400).json({ error: body.error.message }); return; }
  const [employee] = await db.select().from(employeesTable).where(and(eq(employeesTable.id, body.data.employeeId), eq(employeesTable.active, true))).limit(1);
  if (!employee) { res.status(404).json({ error: "الموظف غير موجود أو غير نشط" }); return; }
  const [duplicate] = await db.select().from(payrollEntriesTable).where(and(eq(payrollEntriesTable.employeeId, employee.id), eq(payrollEntriesTable.period, body.data.period))).limit(1);
  if (duplicate) { res.status(409).json({ error: "تم إنشاء راتب لهذا الموظف عن هذه الفترة" }); return; }
  const [row] = await db.insert(payrollEntriesTable).values({ ...body.data, dueDate: dateOnly(body.data.dueDate) }).onConflictDoNothing().returning();
  if (!row) { res.status(409).json({ error: "تم إنشاء راتب لهذا الموظف عن هذه الفترة" }); return; }
  await audit(req.clubUser!.clerkUserId, "payroll.created", "payroll", row.id);
  res.status(201).json(CreatePayrollResponse.parse({ ...row, employeeName: employee.name, status: "due" }));
});

router.post("/club/payroll/:id/pay", requireClubUser, async (req, res): Promise<void> => {
  const params = PayPayrollParams.safeParse(req.params);
  const body = PayPayrollBody.safeParse(req.body);
  if (!params.success || !body.success) { res.status(400).json({ error: "بيانات صرف الراتب غير صحيحة" }); return; }
  const [entry] = await db.select().from(payrollEntriesTable).where(eq(payrollEntriesTable.id, params.data.id)).limit(1);
  if (!entry) { res.status(404).json({ error: "سجل الراتب غير موجود" }); return; }
  if (body.data.amountFils > entry.amountFils - entry.paidFils) { res.status(400).json({ error: "المبلغ أكبر من الرصيد المستحق" }); return; }
  const [employee] = await db.select().from(employeesTable).where(eq(employeesTable.id, entry.employeeId)).limit(1);
  const [updated] = await db.transaction(async (trx) => {
    const [saved] = await trx.update(payrollEntriesTable).set({ paidFils: entry.paidFils + body.data.amountFils }).where(eq(payrollEntriesTable.id, entry.id)).returning();
    const [expense] = await trx.insert(financialTransactionsTable).values({
      kind: "expense", amountFils: body.data.amountFils, method: body.data.method,
      description: `راتب ${employee?.name ?? ""} - ${entry.period}`, transactionDate: jordanDate(),
      createdBy: req.clubUser!.clerkUserId,
    }).returning();
    if (body.data.method === "cash") await trx.insert(cashMovementsTable).values({
      direction: "out", amountFils: body.data.amountFils, description: expense.description,
      referenceType: "payroll", referenceId: entry.id, createdBy: req.clubUser!.clerkUserId,
    });
    return [saved];
  });
  await audit(req.clubUser!.clerkUserId, "payroll.payment_recorded", "payroll", entry.id, { amountFils: body.data.amountFils });
  res.json(PayPayrollResponse.parse({ ...updated, employeeName: employee?.name ?? "", status: updated.paidFils >= updated.amountFils ? "paid" : "partial" }));
});

export default router;
