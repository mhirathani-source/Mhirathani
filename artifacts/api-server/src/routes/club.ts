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
  DeleteMemberParams,
  UpdateSubscriptionParams,
  UpdateSubscriptionBody,
  UpdateSubscriptionResponse,
} from "@workspace/api-zod";
import { db, auditLogTable, cashMovementsTable, clubUsersTable, employeesTable, financeCategoriesTable, financialTransactionsTable, membersTable, payrollEntriesTable, paymentsTable, plansTable, subscriptionsTable } from "@workspace/db";
import { and, desc, eq, ilike, inArray, or, sql } from "drizzle-orm";
import { Router, type IRouter } from "express";
import { requireClubUser, requireAdmin, resolveClubUser } from "../middlewares/clubAuth";
import { GetClubOverviewResponse, GetMemberProfileParams, GetMemberProfileResponse } from "@workspace/api-zod";
import { addSubscriptionPayment as addPayment, buildMemberSearch, deleteUnlinkedMember, memberSearchLimit, startSubscription, correctSubscription, subscriptionAction, MembershipError, membershipErrorHandler, normalizedMemberBody, validCalendarDate } from "../lib/membership";
import { effectivePermissions } from "../lib/permissions";
import { readClubSettings } from "../lib/clubSettings";
import { isIndependentCashMovement, signedPayment } from "../lib/cashLedger";
import { buildClubDashboard } from "../lib/dashboardMetrics";

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
    planName: plan?.name ?? "", priceFils: row.priceFils, discountFils: row.discountFils, renewedFromId: row.renewedFromId, paidFils,
    balanceFils: Math.max(0, row.priceFils - row.discountFils - paidFils),
    startDate: row.startDate, endDate: row.endDate, status: effectiveStatus(row), createdAt: row.createdAt.toISOString(),
  };
}

router.get("/club/session", async (req, res): Promise<void> => {
  const userId = getAuth(req).userId;
  if (!userId) {
    res.status(401).json({ error: "يلزم تسجيل الدخول" });
    return;
  }
  const identity = await clerkClient.users.getUser(userId);
  const email = identity.emailAddresses.find((item) => item.id === identity.primaryEmailAddressId)?.emailAddress ?? "";
  const user = await resolveClubUser(userId, identity);
  const [pending] = user?.isOwner ? await db.select({ count: sql<number>`count(*)::int` }).from(clubUsersTable).where(eq(clubUsersTable.status, "pending")) : [{ count: 0 }];
  res.json(GetClubSessionResponse.parse({
    userId,
    email,
    role: user?.status === "active" ? user.role : null,
    status: user?.status ?? "pending",
    isOwner: user?.status === "active" && !!user.isOwner,
    permissions: user?.status === "active" ? await effectivePermissions(user) : [],
    pendingCount: pending.count,
    setupRequired: !process.env.CLUB_ADMIN_EMAIL,
  }));
});

router.get("/club/overview", requireClubUser, async (_req, res): Promise<void> => {
  const today = jordanDate();
  const soon = addDays(today, 2);
  const members = await db.select({ id: membersTable.id, active: membersTable.active }).from(membersTable);
  const subscriptions = await db.select({ memberId: subscriptionsTable.memberId, endDate: subscriptionsTable.endDate, status: subscriptionsTable.status }).from(subscriptionsTable);
  const active = subscriptions.filter(s => s.status === "active" && s.endDate >= today);
  res.json(GetClubOverviewResponse.parse({
    activeMembers: new Set(active.filter(s => members.some(m => m.id === s.memberId && m.active)).map(s => s.memberId)).size,
    endingSoon: active.filter(s => s.endDate <= soon).length,
    expiredSubscriptions: subscriptions.filter(s => s.status === "expired" || (s.status === "active" && s.endDate < today)).length,
  }));
});

router.get("/members/:id/profile", requireClubUser, async (req, res): Promise<void> => {
  const params = GetMemberProfileParams.safeParse(req.params);
  if (!params.success || !Number.isSafeInteger(params.data.id)) { res.status(400).json({ error: "معرّف المشترك غير صالح" }); return; }
  const [member] = await db.select().from(membersTable).where(eq(membersTable.id, params.data.id)).limit(1);
  if (!member) { res.status(404).json({ error: "المشترك غير موجود" }); return; }
  res.json(GetMemberProfileResponse.parse({ ...member, joinedAt: member.joinedAt.toISOString() }));
});

router.get("/club/dashboard", requireClubUser, async (_req, res): Promise<void> => {
  const [members, subscriptions, payments, transactions, plans] = await Promise.all([
    db.select().from(membersTable),
    db.select().from(subscriptionsTable),
    db.select().from(paymentsTable),
    db.select().from(financialTransactionsTable),
    db.select({ id: plansTable.id, name: plansTable.name }).from(plansTable),
  ]);
  res.json(GetClubDashboardResponse.parse(buildClubDashboard({
    today: jordanDate(),
    members,
    subscriptions,
    payments,
    transactions,
    plans,
  })));
});

router.get("/members", requireClubUser, async (req, res): Promise<void> => {
  const query = ListMembersQueryParams.safeParse(req.query);
  if (!query.success) { res.status(400).json({ error: query.error.message }); return; }
  const search = query.data.search?.trim();
  const memberSearch = search ? buildMemberSearch(search) : undefined;
  const memberQuery = db.select().from(membersTable)
    .where(memberSearch?.condition)
    .orderBy(desc(membersTable.joinedAt));
  const resultLimit = memberSearchLimit(search, query.data.limit ?? 50);
  const rows = resultLimit === undefined
    ? await memberQuery
    : await memberQuery.limit(resultLimit);
  res.json(ListMembersResponse.parse(rows.map((m) => ({ ...m, joinedAt: m.joinedAt.toISOString() }))));
});

router.post("/members", requireClubUser, async (req, res): Promise<void> => {
  const settings = await readClubSettings();
  if (settings.memberRequiredFields.some(field => !String(req.body?.[field] ?? "").trim())) {
    res.status(400).json({ error: "أكمل حقول تسجيل المشترك المطلوبة في إعدادات النادي" }); return;
  }
  const body = CreateMemberBody.safeParse(normalizedMemberBody(req.body ?? {}));
  if (!body.success) { res.status(400).json({ error: "تحقق من الاسم ورقم الهاتف والبريد الإلكتروني وتاريخ الميلاد" }); return; }
  const row = await db.transaction(async (trx) => {
    const [created] = await trx.insert(membersTable).values({ ...body.data, birthDate: body.data.birthDate ? dateOnly(body.data.birthDate) : null }).returning();
    await trx.insert(auditLogTable).values({ actorId: req.clubUser!.clerkUserId, action: "member.created", entityType: "member", entityId: created.id });
    return created;
  });
  res.status(201).json(CreateMemberResponse.parse({ ...row, joinedAt: row.joinedAt.toISOString() }));
});

router.get("/members/:id", requireClubUser, async (req, res): Promise<void> => {
  const params = GetMemberParams.safeParse(req.params);
  if (!params.success || !Number.isSafeInteger(params.data.id) || params.data.id < 1) { res.status(400).json({ error: "معرّف المشترك غير صالح" }); return; }
  const [member] = await db.select().from(membersTable).where(eq(membersTable.id, params.data.id)).limit(1);
  if (!member) { res.status(404).json({ error: "المشترك غير موجود" }); return; }
  const subscriptions = await db.select().from(subscriptionsTable).where(eq(subscriptionsTable.memberId, member.id)).orderBy(desc(subscriptionsTable.createdAt));
  const subscriptionIds = subscriptions.map((s) => s.id);
  const payments = subscriptionIds.length
    ? await db.select().from(paymentsTable).where(inArray(paymentsTable.subscriptionId, subscriptionIds)).orderBy(desc(paymentsTable.createdAt))
    : [];
  const reversalRows = payments.length ? await db.select({ id: auditLogTable.entityId }).from(auditLogTable).where(and(eq(auditLogTable.action,"payment.reversed"),inArray(auditLogTable.entityId,payments.map(p=>p.id)))) : [];
  const reversedIds = new Set(reversalRows.map(r=>r.id));
  res.json(GetMemberResponse.parse({
    member: { ...member, joinedAt: member.joinedAt.toISOString() },
    subscriptions: await Promise.all(subscriptions.map(subscriptionView)),
    payments: payments.map((p) => ({ ...p, reversed: reversedIds.has(p.id), createdAt: p.createdAt.toISOString() })),
  }));
});

router.patch("/members/:id", requireClubUser, async (req, res): Promise<void> => {
  const params = UpdateMemberParams.safeParse(req.params);
  const body = UpdateMemberBody.safeParse(normalizedMemberBody(req.body ?? {}));
  if (!params.success || !Number.isSafeInteger(params.data.id) || params.data.id < 1 || !body.success || !Object.keys(body.data).length) { res.status(400).json({ error: "بيانات التعديل أو معرّف المشترك غير صحيح؛ تحقق من الحقول المطلوبة" }); return; }
  const values = { ...body.data, ...(body.data.birthDate !== undefined ? { birthDate: body.data.birthDate ? dateOnly(body.data.birthDate) : null } : {}) };
  const settings = await readClubSettings();
  for (const field of settings.memberRequiredFields) {
    if (Object.hasOwn(values,field) && !(values as Record<string,unknown>)[field]) throw new MembershipError(400,`لا يمكن إفراغ الحقل الإلزامي: ${{name:"الاسم",phone:"الهاتف",email:"البريد الإلكتروني",birthDate:"تاريخ الميلاد"}[field]}`);
  }
  const row = await db.transaction(async (trx) => {
    const [before] = await trx.select().from(membersTable).where(eq(membersTable.id, params.data.id)).for("update");
    if (!before) throw new MembershipError(404, "المشترك غير موجود");
    const [updated] = await trx.update(membersTable).set(values).where(eq(membersTable.id, params.data.id)).returning();
    await trx.insert(auditLogTable).values({ actorId: req.clubUser!.clerkUserId, action: "member.updated", entityType: "member", entityId: updated.id, details: { before, after: updated } });
    return updated;
  });
  res.json(UpdateMemberResponse.parse({ ...row, joinedAt: row.joinedAt.toISOString() }));
});

router.delete("/members/:id", requireClubUser, requireAdmin, async (req, res): Promise<void> => {
  const params = DeleteMemberParams.safeParse(req.params);
  if (!params.success || !Number.isSafeInteger(params.data.id) || params.data.id < 1) { res.status(400).json({ error: "معرّف المشترك غير صالح" }); return; }
  await deleteUnlinkedMember(params.data.id, req.clubUser!.clerkUserId);
  res.sendStatus(204);
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
  if (!validCalendarDate(req.body?.startDate)) { res.status(400).json({ error: "تاريخ بداية الاشتراك غير صالح" }); return; }
  const body = CreateSubscriptionBody.safeParse(req.body);
  if (!body.success) { res.status(400).json({ error: "بيانات الاشتراك أو المبالغ غير صحيحة" }); return; }
  const created = await startSubscription(body.data, req.clubUser!.clerkUserId);
  res.status(201).json(CreateSubscriptionResponse.parse(await subscriptionView(created)));
});

router.patch("/subscriptions/:id", requireClubUser, requireAdmin, async (req, res): Promise<void> => {
  const params = UpdateSubscriptionParams.safeParse(req.params);
  if (!validCalendarDate(req.body?.startDate) || !validCalendarDate(req.body?.endDate)) { res.status(400).json({ error: "تاريخ بداية الاشتراك أو نهايته غير صالح" }); return; }
  const body = UpdateSubscriptionBody.safeParse(req.body);
  if (!params.success || !Number.isSafeInteger(params.data.id) || params.data.id < 1 || !body.success) { res.status(400).json({ error: "معرّف الاشتراك أو بيانات التعديل غير صحيحة" }); return; }
  const updated = await correctSubscription(params.data.id, body.data, req.clubUser!.clerkUserId, req.clubUser!.isOwner);
  res.json(UpdateSubscriptionResponse.parse(await subscriptionView(updated)));
});

router.post("/subscriptions/:id/action", requireClubUser, async (req, res): Promise<void> => {
  const params = ActOnSubscriptionParams.safeParse(req.params);
  if (req.body?.startDate !== undefined && !validCalendarDate(req.body.startDate)) { res.status(400).json({ error: "تاريخ التجديد غير صالح" }); return; }
  const body = ActOnSubscriptionBody.safeParse(req.body);
  if (!params.success || !Number.isSafeInteger(params.data.id) || params.data.id < 1 || !body.success) { res.status(400).json({ error: "إجراء الاشتراك أو معرّفه غير صحيح" }); return; }
  const updated = await subscriptionAction(params.data.id, body.data, req.clubUser!.clerkUserId);
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
  if (!params.success || !Number.isSafeInteger(params.data.id) || params.data.id < 1 || !body.success) { res.status(400).json({ error: "بيانات الدفعة أو معرّف الاشتراك غير صحيحة" }); return; }
  const payment = await db.transaction(async (trx) => {
    const [subscription] = await trx.select().from(subscriptionsTable).where(eq(subscriptionsTable.id, params.data.id)).for("update");
    if (!subscription) throw new MembershipError(404, "الاشتراك غير موجود");
    const prior = await trx.select().from(paymentsTable).where(and(eq(paymentsTable.subscriptionId, subscription.id), eq(paymentsTable.kind, "payment")));
    const refunded = await trx.select().from(paymentsTable).where(and(eq(paymentsTable.subscriptionId, subscription.id), eq(paymentsTable.kind, "refund")));
    const alreadyPaid = prior.reduce((sum, item) => sum + item.amountFils, 0) - refunded.reduce((sum, item) => sum + item.amountFils, 0);
    const due = subscription.priceFils - subscription.discountFils - alreadyPaid;
    if (body.data.amountFils > due) throw new MembershipError(400, "المبلغ المدفوع أكبر من الرصيد المتبقي");
    const created = await addPayment(trx, subscription.id, body.data.amountFils, body.data.method, req.clubUser!.clerkUserId, body.data.note ?? null);
    await trx.insert(auditLogTable).values({
      actorId: req.clubUser!.clerkUserId,
      action: "payment.recorded",
      entityType: "payment",
      entityId: created.id,
      details: { amountFils: created.amountFils, method: created.method, subscriptionId: subscription.id },
    });
    return created;
  });
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
  const [transactions, paymentRows, subscriptions, payrollRows, cashRows, allCashTransactions] = await Promise.all([
    db.select().from(financialTransactionsTable).where(and(sql`${financialTransactionsTable.transactionDate} >= ${from}`, sql`${financialTransactionsTable.transactionDate} <= ${to}`)),
    db.select().from(paymentsTable),
    db.select().from(subscriptionsTable),
    db.select().from(payrollEntriesTable),
    db.select().from(cashMovementsTable),
    db.select().from(financialTransactionsTable).where(eq(financialTransactionsTable.method,"cash")),
  ]);
  const paymentsInRange = paymentRows.filter((p) => { const d = jordanDate(p.createdAt); return d >= from && d <= to; }).reduce((sum, p) => sum + signedPayment(p), 0);
  const incomeFils = paymentsInRange + transactions.filter((t) => t.kind === "income").reduce((sum, t) => sum + t.amountFils, 0);
  const expensesFils = transactions.filter((t) => t.kind === "expense").reduce((sum, t) => sum + t.amountFils, 0);
  const totalPaid = new Map<number, number>();
  for (const p of paymentRows) totalPaid.set(p.subscriptionId, (totalPaid.get(p.subscriptionId) ?? 0) + signedPayment(p));
  const debtFils = subscriptions.reduce((sum, s) => sum + Math.max(0, s.priceFils - s.discountFils - (totalPaid.get(s.id) ?? 0)), 0);
  const payrollDueFils = payrollRows.reduce((sum, p) => sum + Math.max(0, p.amountFils - p.paidFils), 0);
  const cashBalanceFils = cashRows.filter(isIndependentCashMovement).reduce((sum, row) => sum + (row.direction === "in" ? row.amountFils : -row.amountFils), 0)
    + paymentRows.filter(p=>p.method==="cash").reduce((sum,p)=>sum+signedPayment(p),0)
    + allCashTransactions.reduce((sum,t)=>sum+(t.kind==="income"?t.amountFils:-t.amountFils),0);
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

router.use(membershipErrorHandler);
export default router;
