import {
  CreateEmployeeV2Body,
  CreateEmployeeV2Response,
  CreateFinanceCategoryV2Body,
  CreateFinanceCategoryV2Response,
  CreateFinanceTransactionV2Body,
  CreateFinanceTransactionV2Response,
  CreatePayrollV2Body,
  CreatePayrollV2Response,
  GetCashRegisterResponse,
  GetFinancePeriodReportQueryParams,
  GetFinancePeriodReportResponse,
  ListEmployeesV2Response,
  ListFinanceCategoriesV2Response,
  ListFinanceTransactionsV2QueryParams,
  ListFinanceTransactionsV2Response,
  ListPayrollV2Response,
  RecordCashMovementBody,
  RecordCashMovementResponse,
  RecordPayrollPaymentBody,
  RecordPayrollPaymentParams,
  RecordPayrollPaymentResponse,
  UpdateEmployeeBody,
  UpdateEmployeeParams,
  UpdateEmployeeResponse,
  UpdateFinanceCategoryBody,
  UpdateFinanceCategoryParams,
  UpdateFinanceCategoryResponse,
  UpdateFinanceTransactionBody,
  UpdateFinanceTransactionParams,
  UpdateFinanceTransactionResponse,
} from "@workspace/api-zod";
import {
  auditLogTable,
  cashMovementsTable,
  db,
  employeesTable,
  financeCategoriesTable,
  financialTransactionsTable,
  membersTable,
  paymentsTable,
  payrollEntriesTable,
  subscriptionsTable,
} from "@workspace/db";
import { and, desc, eq, gte, lte, sql } from "drizzle-orm";
import { Router, type IRouter } from "express";
import { requireAdmin, requireClubUser } from "../middlewares/clubAuth";

const router: IRouter = Router();
const JORDAN_TIME_ZONE = "Asia/Amman";
type Transaction = Parameters<Parameters<typeof db.transaction>[0]>[0];

function jordanDate(value: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: JORDAN_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(value);
}

function dateString(value: Date | string): string {
  return value instanceof Date ? value.toISOString().slice(0, 10) : value.slice(0, 10);
}

function isValidDate(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(`${value}T00:00:00.000Z`)) &&
    new Date(`${value}T00:00:00.000Z`).toISOString().slice(0, 10) === value;
}

function getPeriodRange(period: "day" | "month" | "year", date: string): { fromDate: string; toDate: string } {
  if (period === "day") return { fromDate: date, toDate: date };
  if (period === "month") {
    const fromDate = `${date.slice(0, 7)}-01`;
    const [year, month] = date.slice(0, 7).split("-").map(Number);
    const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
    return { fromDate, toDate: `${date.slice(0, 7)}-${String(lastDay).padStart(2, "0")}` };
  }
  const year = Number(date.slice(0, 4));
  return { fromDate: `${year}-01-01`, toDate: `${year}-12-31` };
}

async function logAudit(
  trx: Transaction,
  actorId: string,
  action: string,
  entityType: string,
  entityId: number | null,
  details: Record<string, unknown> = {},
): Promise<void> {
  await trx.insert(auditLogTable).values({ actorId, action, entityType, entityId, details });
}

async function transactionView(row: typeof financialTransactionsTable.$inferSelect) {
  const [category] = row.categoryId
    ? await db.select({ name: financeCategoriesTable.name }).from(financeCategoriesTable)
      .where(eq(financeCategoriesTable.id, row.categoryId)).limit(1)
    : [];
  return {
    ...row,
    categoryName: category?.name ?? null,
    transactionDate: row.transactionDate,
    createdAt: row.createdAt.toISOString(),
  };
}

async function employeeView(row: typeof employeesTable.$inferSelect) {
  const entries = await db.select().from(payrollEntriesTable).where(eq(payrollEntriesTable.employeeId, row.id));
  return {
    ...row,
    hiredAt: row.hiredAt,
    createdAt: row.createdAt.toISOString(),
    outstandingFils: entries.reduce((sum, item) => sum + item.amountFils - item.paidFils, 0),
  };
}

async function payrollView(row: typeof payrollEntriesTable.$inferSelect) {
  const [employee] = await db.select({ name: employeesTable.name }).from(employeesTable)
    .where(eq(employeesTable.id, row.employeeId)).limit(1);
  const outstandingFils = row.amountFils - row.paidFils;
  return {
    ...row,
    employeeName: employee?.name ?? "",
    outstandingFils,
    status: outstandingFils === 0 ? "paid" : row.paidFils > 0 ? "partial" : "due",
    dueDate: row.dueDate,
    createdAt: row.createdAt.toISOString(),
  };
}

async function validCategory(categoryId: number | null | undefined, kind: string): Promise<boolean> {
  if (categoryId == null) return true;
  const [category] = await db.select().from(financeCategoriesTable)
    .where(and(eq(financeCategoriesTable.id, categoryId), eq(financeCategoriesTable.kind, kind), eq(financeCategoriesTable.active, true)))
    .limit(1);
  return !!category;
}

router.get("/finance/categories", requireClubUser, async (_req, res): Promise<void> => {
  const rows = await db.select().from(financeCategoriesTable).orderBy(financeCategoriesTable.kind, financeCategoriesTable.name);
  res.json(ListFinanceCategoriesV2Response.parse(rows));
});

router.post("/finance/categories", requireClubUser, requireAdmin, async (req, res): Promise<void> => {
  const body = CreateFinanceCategoryV2Body.safeParse(req.body);
  if (!body.success) { res.status(400).json({ error: body.error.message }); return; }
  const duplicate = await db.select().from(financeCategoriesTable)
    .where(and(eq(financeCategoriesTable.kind, body.data.kind), sql`lower(${financeCategoriesTable.name}) = lower(${body.data.name.trim()})`))
    .limit(1);
  if (duplicate.length) { res.status(409).json({ error: "يوجد تصنيف بهذا الاسم لهذا النوع" }); return; }
  const row = await db.transaction(async (trx) => {
    const [created] = await trx.insert(financeCategoriesTable).values({ ...body.data, name: body.data.name.trim() }).returning();
    await logAudit(trx, req.clubUser!.clerkUserId, "finance_category.created", "finance_category", created.id, { kind: created.kind, name: created.name });
    return created;
  });
  res.status(201).json(CreateFinanceCategoryV2Response.parse(row));
});

router.patch("/finance/categories/:id", requireClubUser, requireAdmin, async (req, res): Promise<void> => {
  const params = UpdateFinanceCategoryParams.safeParse(req.params);
  const body = UpdateFinanceCategoryBody.safeParse(req.body);
  if (!params.success || !body.success || Object.keys(body.data).length === 0) {
    res.status(400).json({ error: "بيانات التصنيف غير صحيحة" }); return;
  }
  const [current] = await db.select().from(financeCategoriesTable).where(eq(financeCategoriesTable.id, params.data.id)).limit(1);
  if (!current) { res.status(404).json({ error: "التصنيف غير موجود" }); return; }
  if (body.data.name) {
    const [duplicate] = await db.select().from(financeCategoriesTable)
      .where(and(eq(financeCategoriesTable.kind, current.kind), sql`lower(${financeCategoriesTable.name}) = lower(${body.data.name.trim()})`, sql`${financeCategoriesTable.id} <> ${current.id}`))
      .limit(1);
    if (duplicate) { res.status(409).json({ error: "يوجد تصنيف بهذا الاسم لهذا النوع" }); return; }
  }
  const row = await db.transaction(async (trx) => {
    const [updated] = await trx.update(financeCategoriesTable)
      .set({ ...body.data, ...(body.data.name ? { name: body.data.name.trim() } : {}) })
      .where(eq(financeCategoriesTable.id, current.id)).returning();
    await logAudit(trx, req.clubUser!.clerkUserId, "finance_category.updated", "finance_category", current.id, { before: current, after: updated });
    return updated;
  });
  res.json(UpdateFinanceCategoryResponse.parse(row));
});

router.get("/finance/transactions", requireClubUser, async (req, res): Promise<void> => {
  const queryInput = {
    ...req.query,
    ...(req.query.startDate ? { startDate: new Date(`${String(req.query.startDate)}T00:00:00.000Z`) } : {}),
    ...(req.query.endDate ? { endDate: new Date(`${String(req.query.endDate)}T00:00:00.000Z`) } : {}),
  };
  const query = ListFinanceTransactionsV2QueryParams.safeParse(queryInput);
  if (!query.success) { res.status(400).json({ error: query.error.message }); return; }
  const startDate = query.data.startDate ? dateString(query.data.startDate) : undefined;
  const endDate = query.data.endDate ? dateString(query.data.endDate) : undefined;
  if (startDate && endDate && startDate > endDate) { res.status(400).json({ error: "بداية الفترة بعد نهايتها" }); return; }
  const conditions = [
    query.data.kind ? eq(financialTransactionsTable.kind, query.data.kind) : undefined,
    startDate ? gte(financialTransactionsTable.transactionDate, startDate) : undefined,
    endDate ? lte(financialTransactionsTable.transactionDate, endDate) : undefined,
  ].filter((condition): condition is NonNullable<typeof condition> => condition !== undefined);
  const rows = await db.select().from(financialTransactionsTable)
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(desc(financialTransactionsTable.transactionDate), desc(financialTransactionsTable.createdAt)).limit(500);
  res.json(ListFinanceTransactionsV2Response.parse(await Promise.all(rows.map(transactionView))));
});

router.post("/finance/transactions", requireClubUser, requireAdmin, async (req, res): Promise<void> => {
  const body = CreateFinanceTransactionV2Body.safeParse(req.body);
  if (!body.success) { res.status(400).json({ error: body.error.message }); return; }
  const normalizedDate = dateString(body.data.transactionDate);
  if (!isValidDate(normalizedDate)) { res.status(400).json({ error: "تاريخ الحركة غير صحيح" }); return; }
  if (!(await validCategory(body.data.categoryId, body.data.kind))) {
    res.status(400).json({ error: "التصنيف غير موجود أو لا يطابق نوع الحركة" }); return;
  }
  if (body.data.memberId != null) {
    const [member] = await db.select({ id: membersTable.id }).from(membersTable).where(eq(membersTable.id, body.data.memberId)).limit(1);
    if (!member) { res.status(404).json({ error: "المشترك غير موجود" }); return; }
  }
  const row = await db.transaction(async (trx) => {
    const [created] = await trx.insert(financialTransactionsTable).values({
      ...body.data,
      categoryId: body.data.categoryId ?? null,
      memberId: body.data.memberId ?? null,
      transactionDate: normalizedDate,
      description: body.data.description.trim(),
      createdBy: req.clubUser!.clerkUserId,
    }).returning();
    await logAudit(trx, req.clubUser!.clerkUserId, `finance_transaction.${created.kind}_created`, "financial_transaction", created.id, {
      kind: created.kind, amountFils: created.amountFils, categoryId: created.categoryId, method: created.method,
    });
    return created;
  });
  res.status(201).json(CreateFinanceTransactionV2Response.parse(await transactionView(row)));
});

router.patch("/finance/transactions/:id", requireClubUser, requireAdmin, async (req, res): Promise<void> => {
  const params = UpdateFinanceTransactionParams.safeParse(req.params);
  const body = UpdateFinanceTransactionBody.safeParse(req.body);
  if (!params.success || !body.success || Object.keys(body.data).length === 0) {
    res.status(400).json({ error: "بيانات الحركة غير صحيحة" }); return;
  }
  const [current] = await db.select().from(financialTransactionsTable)
    .where(eq(financialTransactionsTable.id, params.data.id)).limit(1);
  if (!current) { res.status(404).json({ error: "الحركة غير موجودة" }); return; }
  if (current.description.startsWith("صرف راتب |")) {
    res.status(409).json({ error: "حركة صرف الراتب مرتبطة بسجل الرواتب ولا يمكن تعديلها منفردة" }); return;
  }
  const kind = body.data.kind ?? current.kind;
  const categoryId = body.data.categoryId === undefined ? current.categoryId : body.data.categoryId;
  if (categoryId !== current.categoryId || kind !== current.kind) {
    if (!(await validCategory(categoryId, kind))) {
      res.status(400).json({ error: "التصنيف غير موجود أو لا يطابق نوع الحركة" }); return;
    }
  }
  if (body.data.memberId != null) {
    const [member] = await db.select({ id: membersTable.id }).from(membersTable).where(eq(membersTable.id, body.data.memberId)).limit(1);
    if (!member) { res.status(404).json({ error: "المشترك غير موجود" }); return; }
  }
  const { transactionDate: requestedTransactionDate, ...bodyChanges } = body.data;
  const changes: Partial<typeof financialTransactionsTable.$inferInsert> = {
    ...bodyChanges,
    ...(body.data.categoryId !== undefined ? { categoryId: body.data.categoryId } : {}),
    ...(body.data.memberId !== undefined ? { memberId: body.data.memberId } : {}),
    ...(requestedTransactionDate ? { transactionDate: dateString(requestedTransactionDate) } : {}),
    ...(body.data.description ? { description: body.data.description.trim() } : {}),
  };
  if (changes.transactionDate && !isValidDate(changes.transactionDate)) { res.status(400).json({ error: "تاريخ الحركة غير صحيح" }); return; }
  const row = await db.transaction(async (trx) => {
    const [updated] = await trx.update(financialTransactionsTable).set(changes)
      .where(eq(financialTransactionsTable.id, current.id)).returning();
    await logAudit(trx, req.clubUser!.clerkUserId, "finance_transaction.updated", "financial_transaction", current.id, {
      before: current, after: updated,
    });
    return updated;
  });
  res.json(UpdateFinanceTransactionResponse.parse(await transactionView(row)));
});

router.get("/finance/employees", requireClubUser, async (_req, res): Promise<void> => {
  const rows = await db.select().from(employeesTable).orderBy(desc(employeesTable.active), employeesTable.name);
  res.json(ListEmployeesV2Response.parse(await Promise.all(rows.map(employeeView))));
});

router.post("/finance/employees", requireClubUser, requireAdmin, async (req, res): Promise<void> => {
  const body = CreateEmployeeV2Body.safeParse(req.body);
  if (!body.success) { res.status(400).json({ error: body.error.message }); return; }
  const row = await db.transaction(async (trx) => {
    const [created] = await trx.insert(employeesTable).values({
      ...body.data,
      phone: body.data.phone ?? null,
      hiredAt: body.data.hiredAt ? dateString(body.data.hiredAt) : null,
      name: body.data.name.trim(),
      position: body.data.position.trim(),
    }).returning();
    await logAudit(trx, req.clubUser!.clerkUserId, "employee.created", "employee", created.id, {
      name: created.name, position: created.position, baseSalaryFils: created.baseSalaryFils,
    });
    return created;
  });
  res.status(201).json(CreateEmployeeV2Response.parse(await employeeView(row)));
});

router.patch("/finance/employees/:id", requireClubUser, requireAdmin, async (req, res): Promise<void> => {
  const params = UpdateEmployeeParams.safeParse(req.params);
  const body = UpdateEmployeeBody.safeParse(req.body);
  if (!params.success || !body.success || Object.keys(body.data).length === 0) {
    res.status(400).json({ error: "بيانات الموظف غير صحيحة" }); return;
  }
  const [current] = await db.select().from(employeesTable).where(eq(employeesTable.id, params.data.id)).limit(1);
  if (!current) { res.status(404).json({ error: "الموظف غير موجود" }); return; }
  const { hiredAt: requestedHiredAt, ...bodyChanges } = body.data;
  const changes: Partial<typeof employeesTable.$inferInsert> = {
    ...bodyChanges,
    ...(requestedHiredAt !== undefined ? { hiredAt: requestedHiredAt ? dateString(requestedHiredAt) : null } : {}),
    ...(body.data.name ? { name: body.data.name.trim() } : {}),
    ...(body.data.position ? { position: body.data.position.trim() } : {}),
  };
  const row = await db.transaction(async (trx) => {
    const [updated] = await trx.update(employeesTable).set(changes).where(eq(employeesTable.id, current.id)).returning();
    await logAudit(trx, req.clubUser!.clerkUserId, "employee.updated", "employee", current.id, { before: current, after: updated });
    return updated;
  });
  res.json(UpdateEmployeeResponse.parse(await employeeView(row)));
});

router.get("/finance/payroll", requireClubUser, async (_req, res): Promise<void> => {
  const rows = await db.select().from(payrollEntriesTable).orderBy(desc(payrollEntriesTable.period), desc(payrollEntriesTable.dueDate));
  res.json(ListPayrollV2Response.parse(await Promise.all(rows.map(payrollView))));
});

router.post("/finance/payroll", requireClubUser, requireAdmin, async (req, res): Promise<void> => {
  const body = CreatePayrollV2Body.safeParse(req.body);
  if (!body.success) { res.status(400).json({ error: body.error.message }); return; }
  const dueDate = dateString(body.data.dueDate);
  if (!isValidDate(dueDate)) { res.status(400).json({ error: "تاريخ استحقاق الراتب غير صحيح" }); return; }
  const [employee] = await db.select().from(employeesTable).where(eq(employeesTable.id, body.data.employeeId)).limit(1);
  if (!employee) { res.status(404).json({ error: "الموظف غير موجود" }); return; }
  const [duplicate] = await db.select().from(payrollEntriesTable).where(and(
    eq(payrollEntriesTable.employeeId, employee.id), eq(payrollEntriesTable.period, body.data.period),
  )).limit(1);
  if (duplicate) { res.status(409).json({ error: "تم تسجيل راتب هذا الموظف لهذه الفترة مسبقًا" }); return; }
  const row = await db.transaction(async (trx) => {
    const [created] = await trx.insert(payrollEntriesTable).values({
      ...body.data, dueDate, paidFils: 0, status: "due",
    }).returning();
    await logAudit(trx, req.clubUser!.clerkUserId, "payroll.created", "payroll_entry", created.id, {
      employeeId: created.employeeId, period: created.period, amountFils: created.amountFils,
    });
    return created;
  });
  res.status(201).json(CreatePayrollV2Response.parse(await payrollView(row)));
});

router.post("/finance/payroll/:id/payments", requireClubUser, requireAdmin, async (req, res): Promise<void> => {
  const params = RecordPayrollPaymentParams.safeParse(req.params);
  const body = RecordPayrollPaymentBody.safeParse(req.body);
  if (!params.success || !body.success) { res.status(400).json({ error: "بيانات دفعة الراتب غير صحيحة" }); return; }
  try {
    const row = await db.transaction(async (trx) => {
      const [current] = await trx.select().from(payrollEntriesTable)
        .where(eq(payrollEntriesTable.id, params.data.id)).for("update").limit(1);
      if (!current) throw new Error("PAYROLL_NOT_FOUND");
      const outstanding = current.amountFils - current.paidFils;
      if (body.data.amountFils > outstanding) throw new Error("PAYROLL_OVERPAYMENT");
      const paidFils = current.paidFils + body.data.amountFils;
      const [updated] = await trx.update(payrollEntriesTable).set({
        paidFils, status: paidFils === current.amountFils ? "paid" : "partial",
      }).where(eq(payrollEntriesTable.id, current.id)).returning();
      const [employee] = await trx.select().from(employeesTable).where(eq(employeesTable.id, current.employeeId)).limit(1);
      const [expense] = await trx.insert(financialTransactionsTable).values({
        kind: "expense",
        categoryId: null,
        memberId: null,
        amountFils: body.data.amountFils,
        method: body.data.method,
        description: `صرف راتب | ${employee?.name ?? ""} | ${current.period}`,
        transactionDate: jordanDate(),
        createdBy: req.clubUser!.clerkUserId,
      }).returning();
      await logAudit(trx, req.clubUser!.clerkUserId, "payroll.payment_recorded", "payroll_entry", current.id, {
        amountFils: body.data.amountFils, method: body.data.method, paidFils, expenseTransactionId: expense.id,
      });
      return updated;
    });
    res.status(201).json(RecordPayrollPaymentResponse.parse(await payrollView(row)));
  } catch (error) {
    if (error instanceof Error && error.message === "PAYROLL_NOT_FOUND") {
      res.status(404).json({ error: "سجل الراتب غير موجود" }); return;
    }
    if (error instanceof Error && error.message === "PAYROLL_OVERPAYMENT") {
      res.status(409).json({ error: "المبلغ أكبر من الرصيد المستحق للراتب" }); return;
    }
    throw error;
  }
});

router.get("/finance/reports", requireClubUser, async (req, res): Promise<void> => {
  const queryInput = {
    ...req.query,
    ...(req.query.date ? { date: new Date(`${String(req.query.date)}T00:00:00.000Z`) } : {}),
  };
  const query = GetFinancePeriodReportQueryParams.safeParse(queryInput);
  if (!query.success) { res.status(400).json({ error: query.error.message }); return; }
  const requestedDate = dateString(query.data.date);
  if (!isValidDate(requestedDate)) { res.status(400).json({ error: "تاريخ التقرير غير صحيح" }); return; }
  const { fromDate, toDate } = getPeriodRange(query.data.period, requestedDate);
  const transactionRows = await db.select().from(financialTransactionsTable)
    .where(and(gte(financialTransactionsTable.transactionDate, fromDate), lte(financialTransactionsTable.transactionDate, toDate)))
    .orderBy(desc(financialTransactionsTable.transactionDate), desc(financialTransactionsTable.createdAt));
  const transactionViews = await Promise.all(transactionRows.map(transactionView));
  const paymentRows = await db.select().from(paymentsTable);
  const periodPayments = paymentRows.filter((payment) => {
    const day = jordanDate(payment.createdAt);
    return day >= fromDate && day <= toDate;
  });
  const validPayments = periodPayments.filter((payment) => payment.kind === "payment" || payment.kind === "refund");
  const paymentRevenue = validPayments.reduce((sum, payment) => sum + (payment.kind === "refund" ? -payment.amountFils : payment.amountFils), 0);
  const manualIncome = transactionRows.filter((transaction) => transaction.kind === "income").reduce((sum, transaction) => sum + transaction.amountFils, 0);
  const expenseFils = transactionRows.filter((transaction) => transaction.kind === "expense").reduce((sum, transaction) => sum + transaction.amountFils, 0);
  const payrollRows = await db.select().from(payrollEntriesTable);
  const payrollPaymentAudits = await db.select({
    entityId: auditLogTable.entityId,
    details: auditLogTable.details,
    createdAt: auditLogTable.createdAt,
  }).from(auditLogTable).where(and(
    eq(auditLogTable.entityType, "payroll_entry"),
    eq(auditLogTable.action, "payroll.payment_recorded"),
  ));
  const payrollOutstandingFils = payrollRows
    .filter((entry) => entry.period <= toDate.slice(0, 7) && jordanDate(entry.createdAt) <= toDate)
    .reduce((sum, entry) => {
      const paymentsAfterReportDate = payrollPaymentAudits
        .filter((event) => event.entityId === entry.id && jordanDate(event.createdAt) > toDate)
        .reduce((paid, event) => {
          const amount = event.details.amountFils;
          return paid + (typeof amount === "number" ? amount : 0);
        }, 0);
      return sum + entry.amountFils - entry.paidFils + paymentsAfterReportDate;
    }, 0);

  const incomeTotals = new Map<string, { categoryId: number | null; categoryName: string; amountFils: number }>();
  const addTotal = (map: typeof incomeTotals, categoryId: number | null, categoryName: string, amountFils: number) => {
    const key = categoryId == null ? `null:${categoryName}` : String(categoryId);
    const previous = map.get(key);
    map.set(key, { categoryId, categoryName, amountFils: (previous?.amountFils ?? 0) + amountFils });
  };
  for (const payment of validPayments) {
    addTotal(incomeTotals, null, "اشتراكات", payment.kind === "refund" ? -payment.amountFils : payment.amountFils);
  }
  const expenseTotals = new Map<string, { categoryId: number | null; categoryName: string; amountFils: number }>();
  for (const transaction of transactionViews) {
    if (transaction.kind === "income") {
      addTotal(incomeTotals, transaction.categoryId, transaction.categoryName ?? "إيرادات أخرى", transaction.amountFils);
    } else {
      const payrollExpense = transaction.description.startsWith("صرف راتب |");
      addTotal(expenseTotals, payrollExpense ? null : transaction.categoryId, payrollExpense ? "رواتب مدفوعة" : transaction.categoryName ?? "مصروفات أخرى", transaction.amountFils);
    }
  }

  const allPayments = paymentRows.filter((payment) => payment.method === "cash" && (payment.kind === "payment" || payment.kind === "refund"));
  const allCashTransactions = await db.select().from(financialTransactionsTable).where(eq(financialTransactionsTable.method, "cash"));
  const allAdjustments = await db.select().from(cashMovementsTable);
  const cashMovements = [
    ...allPayments.map((payment) => ({
      id: `payment:${payment.id}`,
      direction: payment.kind === "refund" ? "out" as const : "in" as const,
      amountFils: payment.amountFils,
      description: payment.note ?? (payment.kind === "refund" ? "استرداد اشتراك" : "تحصيل اشتراك"),
      referenceType: "subscription_payment",
      referenceId: payment.id,
      createdBy: payment.createdBy,
      createdAt: payment.createdAt.toISOString(),
    })),
    ...allCashTransactions.map((transaction) => ({
      id: `transaction:${transaction.id}`,
      direction: transaction.kind === "income" ? "in" as const : "out" as const,
      amountFils: transaction.amountFils,
      description: transaction.description,
      referenceType: "financial_transaction",
      referenceId: transaction.id,
      createdBy: transaction.createdBy,
      createdAt: new Date(`${transaction.transactionDate}T12:00:00.000Z`).toISOString(),
    })),
    ...allAdjustments.map((movement) => ({
      id: `adjustment:${movement.id}`,
      direction: movement.direction === "in" ? "in" as const : "out" as const,
      amountFils: movement.amountFils,
      description: movement.description,
      referenceType: movement.referenceType,
      referenceId: movement.referenceId,
      createdBy: movement.createdBy,
      createdAt: movement.createdAt.toISOString(),
    })),
  ];
  const cashBalanceFils = cashMovements
    .filter((movement) => jordanDate(new Date(movement.createdAt)) <= toDate)
    .reduce((sum, movement) => sum + (movement.direction === "in" ? movement.amountFils : -movement.amountFils), 0);

  res.json(GetFinancePeriodReportResponse.parse({
    period: query.data.period,
    fromDate,
    toDate,
    incomeFils: paymentRevenue + manualIncome,
    expenseFils,
    netFils: paymentRevenue + manualIncome - expenseFils,
    payrollOutstandingFils,
    cashBalanceFils,
    incomeByCategory: [...incomeTotals.values()].filter((item) => item.amountFils !== 0),
    expenseByCategory: [...expenseTotals.values()].filter((item) => item.amountFils !== 0),
    transactions: transactionViews,
  }));
});

router.get("/finance/cash", requireClubUser, async (_req, res): Promise<void> => {
  const payments = await db.select().from(paymentsTable).where(eq(paymentsTable.method, "cash"));
  const transactions = await db.select().from(financialTransactionsTable).where(eq(financialTransactionsTable.method, "cash"));
  const adjustments = await db.select().from(cashMovementsTable);
  const movements = [
    ...payments.filter((row) => row.kind === "payment" || row.kind === "refund").map((row) => ({
      id: `payment:${row.id}`, direction: row.kind === "refund" ? "out" : "in", amountFils: row.amountFils,
      description: row.note ?? (row.kind === "refund" ? "استرداد اشتراك" : "تحصيل اشتراك"),
      referenceType: "subscription_payment", referenceId: row.id, createdBy: row.createdBy, createdAt: row.createdAt.toISOString(),
    })),
    ...transactions.map((row) => ({
      id: `transaction:${row.id}`, direction: row.kind === "income" ? "in" : "out", amountFils: row.amountFils,
      description: row.description, referenceType: "financial_transaction", referenceId: row.id,
      createdBy: row.createdBy, createdAt: new Date(`${row.transactionDate}T12:00:00.000Z`).toISOString(),
    })),
    ...adjustments.map((row) => ({
      id: `adjustment:${row.id}`, direction: row.direction, amountFils: row.amountFils, description: row.description,
      referenceType: row.referenceType, referenceId: row.referenceId, createdBy: row.createdBy, createdAt: row.createdAt.toISOString(),
    })),
  ].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const balanceFils = movements.reduce((sum, item) => sum + (item.direction === "in" ? item.amountFils : -item.amountFils), 0);
  res.json(GetCashRegisterResponse.parse({ balanceFils, movements: movements.slice(0, 200) }));
});

router.post("/finance/cash", requireClubUser, requireAdmin, async (req, res): Promise<void> => {
  const body = RecordCashMovementBody.safeParse(req.body);
  if (!body.success) { res.status(400).json({ error: body.error.message }); return; }
  const row = await db.transaction(async (trx) => {
    const [created] = await trx.insert(cashMovementsTable).values({
      ...body.data, description: body.data.description.trim(),
      createdBy: req.clubUser!.clerkUserId, referenceType: "manual_adjustment",
    }).returning();
    await logAudit(trx, req.clubUser!.clerkUserId, `cash.${created.direction}`, "cash_movement", created.id, {
      amountFils: created.amountFils, description: created.description,
    });
    return created;
  });
  res.status(201).json(RecordCashMovementResponse.parse({
    ...row, id: `adjustment:${row.id}`, createdAt: row.createdAt.toISOString(),
  }));
});

export default router;
