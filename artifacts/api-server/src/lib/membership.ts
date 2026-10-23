import {
  db, auditLogTable, cashMovementsTable, membersTable, paymentsTable, plansTable,
  subscriptionsTable, financialTransactionsTable, whatsappReminderLogsTable,
} from "@workspace/db";
import type { CreateSubscriptionBody, UpdateSubscriptionBody, ActOnSubscriptionBody } from "@workspace/api-zod";
import { and, eq, ne, lte, gte } from "drizzle-orm";
import type { ErrorRequestHandler } from "express";
import { readClubSettings } from "./clubSettings";

type Transaction = Parameters<Parameters<typeof db.transaction>[0]>[0];
type Subscription = typeof subscriptionsTable.$inferSelect;
type CreateInput = ReturnType<typeof CreateSubscriptionBody.parse>;
type UpdateInput = ReturnType<typeof UpdateSubscriptionBody.parse>;
type ActionInput = ReturnType<typeof ActOnSubscriptionBody.parse>;

export class MembershipError extends Error {
  constructor(public status: number, message: string, public canArchive = false) { super(message); }
}

export function jordanToday() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Amman", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
}
export function dateString(value: string | Date) {
  return value instanceof Date ? value.toISOString().slice(0, 10) : value;
}
export function validCalendarDate(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T12:00:00.000Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value && value >= "0001-01-01";
}
export function addCalendarDays(date: string, days: number) {
  const value = new Date(`${date}T12:00:00.000Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}
export function subscriptionStatus(row: Subscription) {
  if (row.status === "paused" || row.status === "cancelled") return row.status;
  return row.endDate < jordanToday() ? "expired" : "active";
}
export function normalizedMemberBody(raw: Record<string, unknown>) {
  const value = { ...raw };
  if (typeof value.name === "string") value.name = value.name.trim();
  if (typeof value.phone === "string") {
    value.phone = value.phone.trim().replace(/[()\s-]/g, "");
    if (!/^\+?\d{7,15}$/.test(value.phone as string)) throw new MembershipError(400, "رقم الهاتف غير صالح؛ استخدم 7 إلى 15 رقمًا مع رمز الدولة عند الحاجة");
  }
  if (typeof value.email === "string") value.email = value.email.trim() || null;
  if (typeof value.notes === "string") value.notes = value.notes.trim() || null;
  if (value.birthDate != null) {
    if (!validCalendarDate(value.birthDate) || value.birthDate > jordanToday()) {
      throw new MembershipError(400, "تاريخ الميلاد غير صالح أو يقع في المستقبل");
    }
  }
  return value;
}

async function writeAudit(trx: Transaction, actorId: string, action: string, entityType: string, entityId: number, details: Record<string, unknown> = {}) {
  await trx.insert(auditLogTable).values({ actorId, action, entityType, entityId, details });
}
async function lockMember(trx: Transaction, id: number, requireActive = true) {
  const [member] = await trx.select().from(membersTable).where(eq(membersTable.id, id)).for("update");
  if (!member) throw new MembershipError(404, "المشترك غير موجود");
  if (requireActive && !member.active) throw new MembershipError(409, "المشترك معطّل؛ أعد تفعيله قبل إنشاء أو تجديد الاشتراك");
  return member;
}
async function activePlan(trx: Transaction, id: number) {
  const [plan] = await trx.select().from(plansTable).where(eq(plansTable.id, id));
  if (!plan || !plan.active) throw new MembershipError(404, "الباقة غير موجودة أو غير مفعّلة");
  return plan;
}
async function noOverlap(trx: Transaction, memberId: number, planId: number, start: string, end: string, exceptId?: number) {
  const [overlap] = await trx.select({ id: subscriptionsTable.id }).from(subscriptionsTable).where(and(
    eq(subscriptionsTable.memberId, memberId), eq(subscriptionsTable.planId, planId),
    ne(subscriptionsTable.status, "cancelled"), lte(subscriptionsTable.startDate, end), gte(subscriptionsTable.endDate, start),
    exceptId ? ne(subscriptionsTable.id, exceptId) : undefined,
  )).limit(1);
  if (overlap) throw new MembershipError(409, "يوجد اشتراك آخر لهذه الباقة يتداخل مع الفترة المحددة؛ راجع السجل بدل تكرار الاشتراك");
}
async function netPaid(trx: Transaction, subscriptionId: number) {
  const rows = await trx.select().from(paymentsTable).where(eq(paymentsTable.subscriptionId, subscriptionId));
  return rows.reduce((total, row) => total + (row.kind === "payment" ? row.amountFils : row.kind === "refund" ? -row.amountFils : 0), 0);
}

export async function addSubscriptionPayment(trx: Transaction, subscriptionId: number, amountFils: number, method: string, actorId: string, note: string | null = null, kind = "payment") {
  const receiptNumber = `N-${new Date().toISOString().replace(/\D/g, "").slice(0, 14)}-${crypto.randomUUID().slice(0, 6).toUpperCase()}`;
  const [payment] = await trx.insert(paymentsTable).values({ subscriptionId, amountFils, method, createdBy: actorId, note, kind, receiptNumber }).returning();
  if (method === "cash" && (kind === "payment" || kind === "refund")) {
    await trx.insert(cashMovementsTable).values({
      direction: kind === "payment" ? "in" : "out", amountFils, description: `اشتراك #${subscriptionId}`,
      referenceType: "subscription_payment", referenceId: payment.id, createdBy: actorId,
    });
  }
  return payment;
}

export async function deleteUnlinkedMember(id: number, actorId: string) {
  await db.transaction(async (trx) => {
    const member = await lockMember(trx, id, false);
    const [[subscription], [finance], [reminder]] = await Promise.all([
      trx.select({ id: subscriptionsTable.id }).from(subscriptionsTable).where(eq(subscriptionsTable.memberId, id)).limit(1),
      trx.select({ id: financialTransactionsTable.id }).from(financialTransactionsTable).where(eq(financialTransactionsTable.memberId, id)).limit(1),
      trx.select({ id: whatsappReminderLogsTable.id }).from(whatsappReminderLogsTable).where(eq(whatsappReminderLogsTable.memberId, id)).limit(1),
    ]);
    if (subscription || finance || reminder) {
      throw new MembershipError(409, "لا يمكن الحذف النهائي لوجود اشتراكات أو سجلات مالية أو تذكيرات مرتبطة. يمكنك تعطيل المشترك مع الاحتفاظ بجميع السجلات والديون.", true);
    }
    await writeAudit(trx, actorId, "member.deleted", "member", id, { name: member.name });
    await trx.delete(membersTable).where(eq(membersTable.id, id));
  });
}

export async function startSubscription(input: CreateInput, actorId: string) {
  const settings = await readClubSettings();
  return db.transaction(async (trx) => {
    const member = await lockMember(trx, input.memberId);
    const plan = await activePlan(trx, input.planId);
    const start = dateString(input.startDate), end = addCalendarDays(start, plan.durationDays - 1);
    const discount = input.discountFils ?? 0, paid = input.initialPaymentFils ?? 0;
    if (discount > Math.floor(plan.priceFils * settings.maxDiscountPercent / 100)) throw new MembershipError(400, "الخصم يتجاوز الحد المسموح في إعدادات النادي");
    if (discount > plan.priceFils) throw new MembershipError(400, "الخصم أكبر من سعر الباقة");
    if (paid > plan.priceFils - discount) throw new MembershipError(400, "المبلغ المدفوع أكبر من المستحق");
    await noOverlap(trx, member.id, plan.id, start, end);
    const [created] = await trx.insert(subscriptionsTable).values({
      memberId: member.id, planId: plan.id, priceFils: plan.priceFils, discountFils: discount, startDate: start, endDate: end,
    }).returning();
    if (discount > 0) await addSubscriptionPayment(trx, created.id, discount, "cash", actorId, "خصم", "discount");
    if (paid > 0) await addSubscriptionPayment(trx, created.id, paid, input.paymentMethod ?? "cash", actorId);
    await writeAudit(trx, actorId, "subscription.created", "subscription", created.id, { discountFils: discount, initialPaymentFils: paid, paymentMethod: input.paymentMethod ?? "cash" });
    return created;
  });
}

async function lockedSubscription(trx: Transaction, id: number, activeMember = false) {
  const [identity] = await trx.select({ memberId: subscriptionsTable.memberId }).from(subscriptionsTable).where(eq(subscriptionsTable.id, id));
  if (!identity) throw new MembershipError(404, "الاشتراك غير موجود");
  await lockMember(trx, identity.memberId, activeMember);
  const [row] = await trx.select().from(subscriptionsTable).where(eq(subscriptionsTable.id, id)).for("update");
  if (!row) throw new MembershipError(404, "الاشتراك غير موجود");
  return row;
}

export async function correctSubscription(id: number, input: UpdateInput, actorId: string, allowHistorical = false) {
  return db.transaction(async (trx) => {
    const current = await lockedSubscription(trx, id);
    if (!allowHistorical && !["active", "paused"].includes(subscriptionStatus(current))) throw new MembershipError(409, "لا يمكن تعديل اشتراك منتهي أو ملغي؛ السجل التاريخي محفوظ، ويمكن إنشاء تجديد بدلًا منه");
    const start = dateString(input.startDate), end = dateString(input.endDate);
    if (end < start) throw new MembershipError(400, "تاريخ الانتهاء يجب ألا يسبق تاريخ البداية");
    if (!allowHistorical && end < jordanToday() && current.status !== "paused") throw new MembershipError(400, "لا يمكن تحويل الاشتراك الحالي إلى سجل منتهٍ بالتعديل؛ استخدم الإلغاء عند الحاجة");
    if (input.planId !== current.planId) await activePlan(trx, input.planId);
    const paid = await netPaid(trx, id);
    if (input.priceFils < current.discountFils + paid || input.priceFils < current.discountFils) {
      throw new MembershipError(409, "السعر لا يمكن أن يقل عن مجموع المدفوع الصافي والخصم المسجل؛ لا تُعدّل المدفوعات التاريخية بهذه الشاشة");
    }
    await noOverlap(trx, current.memberId, input.planId, start, end, id);
    const [updated] = await trx.update(subscriptionsTable).set({ planId: input.planId, startDate: start, endDate: end, priceFils: input.priceFils }).where(eq(subscriptionsTable.id, id)).returning();
    await writeAudit(trx, actorId, "subscription.updated", "subscription", id, {
      before: { planId: current.planId, startDate: current.startDate, endDate: current.endDate, priceFils: current.priceFils },
      after: { planId: updated.planId, startDate: updated.startDate, endDate: updated.endDate, priceFils: updated.priceFils },
    });
    return updated;
  });
}

export async function subscriptionAction(id: number, input: ActionInput, actorId: string) {
  const settings = await readClubSettings();
  return db.transaction(async (trx) => {
    const current = await lockedSubscription(trx, id, input.action === "renew" || input.action === "resume");
    if (input.action === "renew") {
      if (settings.renewalPolicy === "after_expiry_only" && subscriptionStatus(current) !== "expired") throw new MembershipError(409,"سياسة النادي تسمح بالتجديد بعد انتهاء الاشتراك فقط");
      if (current.status === "paused" || current.status === "cancelled") throw new MembershipError(409, "لا يمكن تجديد اشتراك موقوف مؤقتًا أو ملغي؛ استأنفه أولًا أو أنشئ اشتراكًا جديدًا");
      const [prior] = await trx.select({ id: subscriptionsTable.id }).from(subscriptionsTable).where(eq(subscriptionsTable.renewedFromId, id)).limit(1);
      if (prior) throw new MembershipError(409, "تم تجديد هذا الاشتراك بالفعل؛ استخدم أحدث اشتراك للتجديد التالي");
      const plan = await activePlan(trx, input.planId ?? current.planId);
      const start = input.startDate ? dateString(input.startDate) : (current.endDate >= jordanToday() ? addCalendarDays(current.endDate, 1) : jordanToday());
      if (start <= current.endDate) throw new MembershipError(409, "تاريخ التجديد يجب أن يكون بعد انتهاء الاشتراك السابق");
      const end = addCalendarDays(start, plan.durationDays - 1);
      await noOverlap(trx, current.memberId, plan.id, start, end);
      const [renewed] = await trx.insert(subscriptionsTable).values({
        memberId: current.memberId, planId: plan.id, startDate: start, endDate: end, priceFils: plan.priceFils, renewedFromId: id,
      }).returning();
      await writeAudit(trx, actorId, "subscription.renewed", "subscription", renewed.id, { previousSubscriptionId: id });
      return renewed;
    }
    let changes: Partial<typeof subscriptionsTable.$inferInsert>;
    if (input.action === "pause") {
      if (subscriptionStatus(current) !== "active") throw new MembershipError(409, "لا يمكن إيقاف اشتراك غير نشط مؤقتًا");
      changes = { status: "paused", pausedAt: jordanToday() };
    } else if (input.action === "resume") {
      if (current.status !== "paused" || !current.pausedAt) throw new MembershipError(409, "الاشتراك ليس موقوفًا مؤقتًا");
      const days = Math.max(0, Math.round((Date.parse(`${jordanToday()}T12:00:00Z`) - Date.parse(`${current.pausedAt}T12:00:00Z`)) / 86400000));
      const end = addCalendarDays(current.endDate, days);
      await noOverlap(trx, current.memberId, current.planId, current.startDate, end, id);
      changes = { status: "active", endDate: end, pausedAt: null };
    } else {
      if (current.status === "cancelled") return current;
      if (subscriptionStatus(current) === "expired") throw new MembershipError(409, "الاشتراك منتهٍ ومحفوظ في السجل؛ لا يمكن إلغاؤه بأثر رجعي");
      changes = { status: "cancelled", pausedAt: null };
    }
    const [updated] = await trx.update(subscriptionsTable).set(changes).where(eq(subscriptionsTable.id, id)).returning();
    await writeAudit(trx, actorId, `subscription.${input.action}`, "subscription", id, { previousStatus: current.status, status: updated.status });
    return updated;
  });
}

export const membershipErrorHandler: ErrorRequestHandler = (error, req, res, next) => {
  if (!/^\/(members|subscriptions)(\/|$)/.test(req.path)) { next(error); return; }
  if (error instanceof MembershipError) {
    res.status(error.status).json({ error: error.message, ...(error.canArchive ? { canArchive: true } : {}) }); return;
  }
  const code = error?.cause?.code ?? error?.code;
  if (code === "23505") {
    res.status(409).json({ error: req.path.startsWith("/members") ? "رقم الهاتف مسجل لمشترك آخر؛ استخدم رقمًا مختلفًا" : "الاشتراك أو التجديد مسجل مسبقًا؛ حدّث السجل وراجعه" }); return;
  }
  if (code === "23503") {
    res.status(409).json({ error: "السجل مرتبط ببيانات أخرى؛ لا يمكن حذفه. استخدم التعطيل للحفاظ على التاريخ المالي.", ...(req.method === "DELETE" ? { canArchive: true } : {}) }); return;
  }
  req.log.error({ code, operation: req.method }, "Membership database operation failed");
  res.status(503).json({ error: "تعذر إتمام العملية بسبب الاتصال بقاعدة البيانات. لم نؤكد الحفظ؛ حدّث السجل قبل إعادة المحاولة." });
};
