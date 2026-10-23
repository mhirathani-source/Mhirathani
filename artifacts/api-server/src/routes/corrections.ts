import { Router } from "express";
import { and, eq } from "drizzle-orm";
import { z } from "zod/v4";
import { db, auditLogTable, employeesTable, financeCategoriesTable, financialTransactionsTable, paymentsTable, payrollEntriesTable, subscriptionsTable, membersTable, plansTable } from "@workspace/db";
import { addSubscriptionPayment, jordanToday, MembershipError, validCalendarDate } from "../lib/membership";
import { csv } from "./admin";
import { hasPermission } from "../lib/permissions";

const router = Router();
const positiveId = (value:unknown) => z.coerce.number().int().positive().parse(value);
const reasonSchema = z.object({reason:z.string().trim().min(3).max(500)}).strict();
router.delete("/plans/:id",async(req,res)=>{
  const id=positiveId(req.params.id);
  const archived=await db.transaction(async trx=>{
    const [before]=await trx.select().from(plansTable).where(eq(plansTable.id,id)).for("update");
    if(!before)throw new MembershipError(404,"الباقة غير موجودة");
    const [linked]=await trx.select({id:subscriptionsTable.id}).from(subscriptionsTable).where(eq(subscriptionsTable.planId,id)).limit(1);
    if(linked)await trx.update(plansTable).set({active:false}).where(eq(plansTable.id,id));
    else await trx.delete(plansTable).where(eq(plansTable.id,id));
    await trx.insert(auditLogTable).values({actorId:req.clubUser!.clerkUserId,action:linked?"plan.archived":"plan.deleted",entityType:"plan",entityId:id,details:{before}});
    return !!linked;
  });
  res.json({archived});
});
router.post("/payments/:id/reverse", async (req,res) => {
  const input=reasonSchema.safeParse(req.body);
  if(!input.success)throw new MembershipError(400,"اكتب سبب تصحيح الدفعة (ثلاثة أحرف على الأقل)");
  const id=positiveId(req.params.id);
  const result=await db.transaction(async trx=>{
    const [identity]=await trx.select().from(paymentsTable).where(eq(paymentsTable.id,id));
    if(!identity)throw new MembershipError(404,"الدفعة غير موجودة");
    await trx.select().from(subscriptionsTable).where(eq(subscriptionsTable.id,identity.subscriptionId)).for("update");
    const [original]=await trx.select().from(paymentsTable).where(eq(paymentsTable.id,id)).for("update");
    if(original.kind!=="payment")throw new MembershipError(409,"يمكن عكس دفعة تحصيل أصلية فقط");
    const [reversed]=await trx.select().from(auditLogTable).where(and(eq(auditLogTable.action,"payment.reversed"),eq(auditLogTable.entityId,id)));
    if(reversed)throw new MembershipError(409,"عُكست هذه الدفعة بالفعل؛ السجل الأصلي محفوظ");
    const prior=await trx.select().from(paymentsTable).where(eq(paymentsTable.subscriptionId,original.subscriptionId));
    const net=prior.reduce((sum,p)=>sum+(p.kind==="payment"?p.amountFils:p.kind==="refund"?-p.amountFils:0),0);
    if(net<original.amountFils)throw new MembershipError(409,"المبلغ المتاح للاسترداد لا يكفي؛ راجع الاستردادات السابقة");
    const refund=await addSubscriptionPayment(trx,original.subscriptionId,original.amountFils,original.method,req.clubUser!.clerkUserId,`عكس الإيصال ${original.receiptNumber}: ${input.data.reason}`,"refund");
    await trx.insert(auditLogTable).values({actorId:req.clubUser!.clerkUserId,action:"payment.reversed",entityType:"payment",entityId:id,details:{before:original,refundId:refund.id,reason:input.data.reason}});
    return refund;
  });
  res.status(201).json(result);
});
router.post("/finance/transactions/:id/reverse",async(req,res)=>{
  const input=reasonSchema.safeParse(req.body);
  if(!input.success)throw new MembershipError(400,"اكتب سبب إلغاء الحركة");
  const id=positiveId(req.params.id);
  const result=await db.transaction(async trx=>{
    const [original]=await trx.select().from(financialTransactionsTable).where(eq(financialTransactionsTable.id,id)).for("update");
    if(!original)throw new MembershipError(404,"الحركة غير موجودة");
    if(original.reversed||original.reversalOfId)throw new MembershipError(409,"الحركة معكوسة أو حركة عكس ولا يمكن عكسها مرة أخرى");
    if(original.description.startsWith("صرف راتب |")||original.description.startsWith("راتب "))throw new MembershipError(409,"هذه الحركة مرتبطة بصرف راتب؛ لا يمكن عكسها بمعزل عن سجل الرواتب");
    const [counter]=await trx.insert(financialTransactionsTable).values({
      kind:original.kind,amountFils:-original.amountFils,method:original.method,
      memberId:original.memberId,categoryId:original.categoryId,description:`عكس حركة #${id}: ${input.data.reason}`,
      transactionDate:jordanToday(),createdBy:req.clubUser!.clerkUserId,reversalOfId:id,
    }).returning();
    await trx.update(financialTransactionsTable).set({reversed:true}).where(eq(financialTransactionsTable.id,id));
    await trx.insert(auditLogTable).values({actorId:req.clubUser!.clerkUserId,action:"finance_transaction.reversed",entityType:"financial_transaction",entityId:id,details:{before:original,counterTransactionId:counter.id,reason:input.data.reason}});
    return counter;
  });
  res.status(201).json(result);
});
router.patch("/finance/payroll/:id",async(req,res)=>{
  const input=z.object({amountFils:z.number().int().positive().max(2_000_000_000).optional(),dueDate:z.string().refine(validCalendarDate).optional(),period:z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/).optional()}).strict().safeParse(req.body);
  if(!input.success||!Object.keys(input.data).length)throw new MembershipError(400,"بيانات تصحيح الراتب غير صحيحة");
  const id=positiveId(req.params.id);
  const saved=await db.transaction(async trx=>{
    const [before]=await trx.select().from(payrollEntriesTable).where(eq(payrollEntriesTable.id,id)).for("update");
    if(!before)throw new MembershipError(404,"سجل الراتب غير موجود");
    const amount=input.data.amountFils??before.amountFils;
    if(amount<before.paidFils)throw new MembershipError(409,"لا يمكن خفض الاستحقاق عن المبلغ المصروف؛ سجل الصرف محفوظ");
    const [updated]=await trx.update(payrollEntriesTable).set({...input.data,status:before.paidFils>=amount?"paid":before.paidFils>0?"partial":"due"}).where(eq(payrollEntriesTable.id,id)).returning();
    await trx.insert(auditLogTable).values({actorId:req.clubUser!.clerkUserId,action:"payroll.corrected",entityType:"payroll_entry",entityId:id,details:{before,after:updated}});
    return updated;
  });
  res.json(saved);
});
router.delete("/finance/payroll/:id",async(req,res)=>{
  const id=positiveId(req.params.id);
  await db.transaction(async trx=>{
    const [before]=await trx.select().from(payrollEntriesTable).where(eq(payrollEntriesTable.id,id)).for("update");
    if(!before)throw new MembershipError(404,"الراتب غير موجود");
    if(before.paidFils>0)throw new MembershipError(409,"لا يمكن حذف راتب صُرف منه مبلغ؛ يمكن تصحيح الاستحقاق دون فقدان الصرف");
    await trx.delete(payrollEntriesTable).where(eq(payrollEntriesTable.id,id));
    await trx.insert(auditLogTable).values({actorId:req.clubUser!.clerkUserId,action:"payroll.cancelled",entityType:"payroll_entry",entityId:id,details:{before}});
  });
  res.sendStatus(204);
});
router.delete("/finance/employees/:id",async(req,res)=>{
  const id=positiveId(req.params.id);
  const archived=await db.transaction(async trx=>{
    const [before]=await trx.select().from(employeesTable).where(eq(employeesTable.id,id)).for("update");
    if(!before)throw new MembershipError(404,"الموظف غير موجود");
    const [linked]=await trx.select({id:payrollEntriesTable.id}).from(payrollEntriesTable).where(eq(payrollEntriesTable.employeeId,id)).limit(1);
    if(linked)await trx.update(employeesTable).set({active:false}).where(eq(employeesTable.id,id));
    else await trx.delete(employeesTable).where(eq(employeesTable.id,id));
    await trx.insert(auditLogTable).values({actorId:req.clubUser!.clerkUserId,action:linked?"employee.archived":"employee.deleted",entityType:"employee",entityId:id,details:{before}});
    return !!linked;
  });
  res.json({archived});
});
router.delete("/finance/categories/:id",async(req,res)=>{
  const id=positiveId(req.params.id);
  const archived=await db.transaction(async trx=>{
    const [before]=await trx.select().from(financeCategoriesTable).where(eq(financeCategoriesTable.id,id)).for("update");
    if(!before)throw new MembershipError(404,"التصنيف غير موجود");
    const [linked]=await trx.select({id:financialTransactionsTable.id}).from(financialTransactionsTable).where(eq(financialTransactionsTable.categoryId,id)).limit(1);
    if(linked)await trx.update(financeCategoriesTable).set({active:false}).where(eq(financeCategoriesTable.id,id));
    else await trx.delete(financeCategoriesTable).where(eq(financeCategoriesTable.id,id));
    await trx.insert(auditLogTable).values({actorId:req.clubUser!.clerkUserId,action:linked?"category.archived":"category.deleted",entityType:"finance_category",entityId:id,details:{before}});
    return !!linked;
  });
  res.json({archived});
});
router.get("/club/exports/:section",async(req,res)=>{
  const section=String(req.params.section);
  let rows:Record<string,unknown>[];
  if(section==="members") rows=await db.select().from(membersTable);
  else if(section==="finance") rows=await db.select().from(financialTransactionsTable);
  else if(section==="payroll") rows=await db.select().from(payrollEntriesTable);
  else if(section==="subscriptions") {
    const data=await db.select().from(subscriptionsTable);
    rows=hasPermission(req,"payments.view")?data:data.map(({id,memberId,planId,startDate,endDate,status})=>({id,memberId,planId,startDate,endDate,status}));
  } else throw new MembershipError(404,"التصدير غير متاح لهذا القسم");
  res.attachment(`${section}.csv`).type("text/csv").send(csv(rows));
});
export default router;
