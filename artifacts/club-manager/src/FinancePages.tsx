import { useMemo, useState, type FormEvent } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  getGetCashRegisterQueryKey, getGetFinancePeriodReportQueryKey, getGetClubSessionQueryKey, getListEmployeesV2QueryKey,
  getListFinanceCategoriesV2QueryKey, getListFinanceTransactionsV2QueryKey, getListPayrollV2QueryKey,
  useCreateEmployeeV2, useCreateFinanceCategoryV2, useCreateFinanceTransactionV2, useCreatePayrollV2,
  useGetCashRegister, useGetClubSession, useGetFinancePeriodReport, useListEmployeesV2, useListFinanceCategoriesV2,
  useListFinanceTransactionsV2, useListPayrollV2, useRecordCashMovement, useRecordPayrollPayment,
  useUpdateEmployee, useUpdateFinanceCategory, useUpdateFinanceTransaction,
} from "@workspace/api-client-react";
import type { ManagedEmployee, ManagedFinanceTransaction, GetFinancePeriodReportParams } from "@workspace/api-client-react";
import { Banknote, BriefcaseBusiness, Download, Plus, Printer, RefreshCw, Tags, Users, Wallet } from "lucide-react";

const today = () => new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Amman" });
const amountFils = (value: FormDataEntryValue | null) => Math.round(Number(value || 0) * 1000);
const amountValue = (fils: number) => (fils / 1000).toFixed(3);
function Money({ fils }: { fils: number }) {
  return <>{(fils / 1000).toLocaleString("ar-JO", { minimumFractionDigits: 3, maximumFractionDigits: 3 })} <small>د.أ</small></>;
}
function dateText(value: string) { return new Intl.DateTimeFormat("ar-JO", { dateStyle: "medium", timeZone: "Asia/Amman" }).format(new Date(`${value.slice(0, 10)}T12:00:00`)); }
function errorText(error: unknown) {
  if (error && typeof error === "object" && "message" in error && typeof error.message === "string") return error.message;
  return "تعذر إتمام العملية. تحقق من البيانات والاتصال ثم أعد المحاولة.";
}
function EmptyLedger({ title }: { title: string }) {
  return <div className="empty-state" data-testid="empty-finance"><span className="empty-icon"><Banknote size={19}/></span><p>{title}</p></div>;
}

export function FinancePage() {
  const [section, setSection] = useState<"transactions" | "payroll" | "people" | "categories" | "cash">("transactions");
  const [kindFilter, setKindFilter] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [editTxn, setEditTxn] = useState<ManagedFinanceTransaction | null>(null);
  const [editEmployee, setEditEmployee] = useState<ManagedEmployee | null>(null);
  const [payingId, setPayingId] = useState<number | null>(null);
  const [error, setError] = useState("");
  const qc = useQueryClient();
  const categories = useListFinanceCategoriesV2();
  const transactions = useListFinanceTransactionsV2(kindFilter ? { kind: kindFilter as "income" | "expense" } : undefined);
  const employees = useListEmployeesV2();
  const payroll = useListPayrollV2();
  const cash = useGetCashRegister();
  const createTxn = useCreateFinanceTransactionV2(), updateTxn = useUpdateFinanceTransaction();
  const createCategory = useCreateFinanceCategoryV2(), updateCategory = useUpdateFinanceCategory();
  const createEmployee = useCreateEmployeeV2(), updateEmployee = useUpdateEmployee();
  const createPayroll = useCreatePayrollV2(), recordPayment = useRecordPayrollPayment();
  const recordMovement = useRecordCashMovement();
  const session = useGetClubSession({ query: { queryKey: getGetClubSessionQueryKey() } });
  const isAdmin = session.data?.role === "admin";
  const busy = createTxn.isPending || updateTxn.isPending || createCategory.isPending || updateCategory.isPending || createEmployee.isPending || updateEmployee.isPending || createPayroll.isPending || recordPayment.isPending || recordMovement.isPending;

  function refreshFinance() {
    void qc.invalidateQueries({ queryKey: getListFinanceTransactionsV2QueryKey() });
    void qc.invalidateQueries({ queryKey: getGetCashRegisterQueryKey() });
    void qc.invalidateQueries({ queryKey: getListPayrollV2QueryKey() });
    void qc.invalidateQueries({ queryKey: getListEmployeesV2QueryKey() });
    void qc.invalidateQueries({ queryKey: getListFinanceCategoriesV2QueryKey() });
    void qc.invalidateQueries({ queryKey: getGetFinancePeriodReportQueryKey() });
  }
  function submitTransaction(e: FormEvent<HTMLFormElement>) {
    e.preventDefault(); setError("");
    const form = new FormData(e.currentTarget);
    const data = {
      kind: String(form.get("kind")) as "income" | "expense",
      categoryId: form.get("categoryId") ? Number(form.get("categoryId")) : null,
      amountFils: amountFils(form.get("amount")),
      method: String(form.get("method")) as "cash" | "card" | "bank_transfer" | "wallet",
      description: String(form.get("description") || "").trim(),
      transactionDate: String(form.get("transactionDate") || today()),
    };
    const done = () => { refreshFinance(); setFormOpen(false); setEditTxn(null); };
    if (editTxn) updateTxn.mutate({ id: editTxn.id, data }, { onSuccess: done, onError: e => setError(errorText(e)) });
    else createTxn.mutate({ data }, { onSuccess: done, onError: e => setError(errorText(e)) });
  }
  function submitCategory(e: FormEvent<HTMLFormElement>) {
    e.preventDefault(); setError(""); const f = new FormData(e.currentTarget);
    createCategory.mutate({ data: { name: String(f.get("name")).trim(), kind: String(f.get("kind")) as "income" | "expense" } },
      { onSuccess: () => { refreshFinance(); setFormOpen(false); }, onError: e => setError(errorText(e)) });
  }
  function submitEmployee(e: FormEvent<HTMLFormElement>) {
    e.preventDefault(); setError(""); const f = new FormData(e.currentTarget);
    const data = { name: String(f.get("name")).trim(), phone: String(f.get("phone") || "").trim() || null, position: String(f.get("position")).trim(), baseSalaryFils: amountFils(f.get("salary")), hiredAt: String(f.get("hiredAt") || "") || null };
    const done = () => { refreshFinance(); setEditEmployee(null); setFormOpen(false); };
    if (editEmployee) updateEmployee.mutate({ id: editEmployee.id, data }, { onSuccess: done, onError: e => setError(errorText(e)) });
    else createEmployee.mutate({ data }, { onSuccess: done, onError: e => setError(errorText(e)) });
  }
  function submitPayroll(e: FormEvent<HTMLFormElement>) {
    e.preventDefault(); setError(""); const f = new FormData(e.currentTarget);
    createPayroll.mutate({ data: { employeeId: Number(f.get("employeeId")), period: String(f.get("period")), amountFils: amountFils(f.get("amount")), dueDate: String(f.get("dueDate")) } },
      { onSuccess: () => { refreshFinance(); setFormOpen(false); }, onError: e => setError(errorText(e)) });
  }
  function submitPayment(e: FormEvent<HTMLFormElement>, id: number) {
    e.preventDefault(); setError(""); const f = new FormData(e.currentTarget);
    recordPayment.mutate({ id, data: { amountFils: amountFils(f.get("amount")), method: String(f.get("method")) as "cash" | "card" | "bank_transfer" | "wallet" } },
      { onSuccess: () => { refreshFinance(); setPayingId(null); }, onError: e => setError(errorText(e)) });
  }
  function submitCash(e: FormEvent<HTMLFormElement>) {
    e.preventDefault(); setError(""); const f = new FormData(e.currentTarget);
    recordMovement.mutate({ data: { direction: String(f.get("direction")) as "in" | "out", amountFils: amountFils(f.get("amount")), description: String(f.get("description")).trim() } },
      { onSuccess: () => { refreshFinance(); setFormOpen(false); }, onError: e => setError(errorText(e)) });
  }
  function openCreate() { setError(""); setEditTxn(null); setEditEmployee(null); setFormOpen(true); }

  const tabItems = [
    ["transactions", "الحركات المالية", Banknote], ["payroll", "الرواتب", Wallet],
    ["people", "الموظفون", Users], ["categories", "التصنيفات", Tags], ["cash", "الصندوق", BriefcaseBusiness],
  ] as const;
  const incomeSum = transactions.data?.filter(x => x.kind === "income").reduce((s, x) => s + x.amountFils, 0) ?? 0;
  const expenseSum = transactions.data?.filter(x => x.kind === "expense").reduce((s, x) => s + x.amountFils, 0) ?? 0;

  return <div className="finance-page">
    <div className="finance-hero" data-testid="finance-header">
      <div><p className="eyebrow">إدارة المال والتشغيل</p><h1>المالية والصندوق</h1><p>سجل واضح لكل دينار — من الحركة اليومية حتى استحقاقات الرواتب.</p></div>
      <div className="finance-hero-side"><small>الرصيد النقدي المتحقق</small><div className="finance-hero-balance" data-testid="value-cash-balance"><Money fils={cash.data?.balanceFils ?? 0}/></div></div>
    </div>
    <div className="finance-tabs" role="tablist" aria-label="أقسام المالية">{tabItems.map(([id, label, Icon]) => <button key={id} role="tab" aria-selected={section === id} data-testid={`tab-finance-${id}`} className={section === id ? "active" : ""} onClick={() => { setSection(id); setFormOpen(false); setError(""); }}><Icon size={15} style={{ verticalAlign: "middle", marginLeft: 6 }}/>{label}</button>)}</div>
    {error && <div className="finance-alert" role="alert" data-testid="error-finance">{error}</div>}
    {section === "transactions" && <>
      <div className="finance-summary">
        <div className="finance-metric"><span>إجمالي الإيرادات الظاهرة</span><strong data-testid="value-income"><Money fils={incomeSum}/></strong></div>
        <div className="finance-metric"><span>إجمالي المصروفات الظاهرة</span><strong data-testid="value-expense"><Money fils={expenseSum}/></strong></div>
        <div className="finance-metric highlight"><span>صافي الحركات الظاهرة</span><strong data-testid="value-net"><Money fils={incomeSum - expenseSum}/></strong></div>
        <div className="finance-metric"><span>الرصيد النقدي</span><strong><Money fils={cash.data?.balanceFils ?? 0}/></strong></div>
      </div>
      <div className="finance-card">
        <div className="finance-card-head"><div><h2>سجل الحركات</h2><p>الإيرادات والمصروفات المسجلة في النظام</p></div><div className="finance-actions">{isAdmin && <button className="button primary" data-testid="button-new-transaction" onClick={openCreate}><Plus size={14}/>تسجيل حركة</button>}<button className="finance-refresh" data-testid="button-refresh-transactions" onClick={() => void transactions.refetch()}><RefreshCw size={13}/> تحديث</button></div></div>
        {formOpen && <form key={editTxn ? `transaction-${editTxn.id}` : "new-transaction"} className="finance-form" onSubmit={submitTransaction} data-testid="form-finance-transaction">
          <h3>{editTxn ? "تعديل الحركة المالية" : "تسجيل حركة مالية"}</h3>
          <div className="finance-form-grid">
            <label>نوع الحركة<select name="kind" defaultValue={editTxn?.kind ?? "income"} data-testid="select-transaction-kind"><option value="income">إيراد</option><option value="expense">مصروف</option></select></label>
            <label>التصنيف<select name="categoryId" defaultValue={editTxn?.categoryId ?? ""} data-testid="select-transaction-category"><option value="">بدون تصنيف</option>{categories.data?.filter(c => c.active).map(c => <option value={c.id} key={c.id}>{c.name}</option>)}</select></label>
            <label>المبلغ بالدينار<input required type="number" min="0.001" step="0.001" name="amount" defaultValue={editTxn ? amountValue(editTxn.amountFils) : ""} data-testid="input-transaction-amount" placeholder="0.000"/></label>
            <label>طريقة الدفع<select name="method" defaultValue={editTxn?.method ?? "cash"} data-testid="select-transaction-method"><option value="cash">نقدًا</option><option value="card">بطاقة</option><option value="bank_transfer">تحويل بنكي</option><option value="wallet">محفظة</option></select></label>
            <label>التاريخ<input required type="date" name="transactionDate" defaultValue={editTxn?.transactionDate.slice(0, 10) ?? today()} data-testid="input-transaction-date"/></label>
            <label>البيان<input required minLength={1} maxLength={500} name="description" defaultValue={editTxn?.description ?? ""} data-testid="input-transaction-description" placeholder="سبب الحركة أو تفاصيلها"/></label>
          </div><div className="finance-form-footer"><button className="button primary" disabled={busy} data-testid="button-save-transaction">{busy ? "جارٍ الحفظ…" : "حفظ الحركة"}</button><button type="button" className="button ghost" data-testid="button-cancel-transaction" onClick={() => { setFormOpen(false); setEditTxn(null); }}>إلغاء</button></div>
        </form>}
        <div className="finance-card-body finance-toolbar"><label>عرض <select value={kindFilter} data-testid="filter-transaction-kind" onChange={e => setKindFilter(e.target.value)}><option value="">كل الحركات</option><option value="income">الإيرادات</option><option value="expense">المصروفات</option></select></label><span className="muted">المبالغ بالدينار الأردني، معتمدة على بيانات النظام.</span></div>
        {transactions.isLoading ? <div className="loading-panel" data-testid="loading-transactions">جارٍ تحميل الحركات المالية…</div> : transactions.isError ? <div className="error-panel" data-testid="error-transactions">تعذر تحميل الحركات المالية. <button className="finance-refresh" onClick={() => void transactions.refetch()}>إعادة المحاولة</button></div> : transactions.data?.length ? <div className="table-scroll"><table className="finance-table"><thead><tr><th>البيان</th><th>التصنيف</th><th>التاريخ</th><th>الطريقة</th><th>المبلغ</th>{isAdmin && <th>إجراء</th>}</tr></thead><tbody>{transactions.data.map(tx => <tr key={tx.id} data-testid={`row-transaction-${tx.id}`}><td><span className="finance-row-title">{tx.description}</span><span className="finance-row-sub">{tx.kind === "income" ? "إيراد" : "مصروف"}</span></td><td>{tx.categoryName || "—"}</td><td>{dateText(tx.transactionDate)}</td><td>{methodLabel(tx.method)}</td><td className={`finance-amount ${tx.kind}`}><Money fils={tx.amountFils}/></td>{isAdmin && <td><button className="mini-button" data-testid={`button-edit-transaction-${tx.id}`} onClick={() => { setEditTxn(tx); setFormOpen(true); }}>تعديل</button></td>}</tr>)}</tbody></table></div> : <EmptyLedger title="لا توجد حركات مسجلة ضمن هذا الاختيار."/>}
      </div>
    </>}
    {section === "categories" && <div className="finance-layout">
      <section className="finance-card"><div className="finance-card-head"><div><h2>تصنيفات المالية</h2><p>إدارة تصنيفات الإيرادات والمصروفات</p></div>{isAdmin && <button className="button primary" data-testid="button-new-category" onClick={openCreate}><Plus size={14}/>تصنيف جديد</button>}</div>
        {formOpen && <form className="finance-form" onSubmit={submitCategory} data-testid="form-finance-category"><h3>إضافة تصنيف</h3><div className="finance-form-grid"><label>اسم التصنيف<input required minLength={2} maxLength={100} name="name" data-testid="input-category-name" placeholder="مثال: إيجار القاعة"/></label><label>نوعه<select name="kind" data-testid="select-category-kind"><option value="income">إيراد</option><option value="expense">مصروف</option></select></label></div><div className="finance-form-footer"><button className="button primary" disabled={busy} data-testid="button-save-category">حفظ التصنيف</button><button type="button" className="button ghost" onClick={() => setFormOpen(false)} data-testid="button-cancel-category">إلغاء</button></div></form>}
        {categories.isLoading ? <div className="loading-panel">جارٍ تحميل التصنيفات…</div> : categories.isError ? <div className="error-panel">تعذر تحميل التصنيفات. <button className="finance-refresh" data-testid="button-retry-categories" onClick={() => void categories.refetch()}>إعادة المحاولة</button></div> : categories.data?.length ? <div className="table-scroll"><table><thead><tr><th>التصنيف</th><th>النوع</th><th>الحالة</th>{isAdmin && <th>إجراء</th>}</tr></thead><tbody>{categories.data.map(c => <tr key={c.id} data-testid={`row-category-${c.id}`}><td>{c.name}</td><td>{c.kind === "income" ? "إيراد" : "مصروف"}</td><td><span className={`finance-status ${c.active ? "active" : ""}`} data-testid={`status-category-${c.id}`}>{c.active ? "نشط" : "متوقف"}</span></td>{isAdmin && <td className="row-actions"><button className="mini-button" data-testid={`button-rename-category-${c.id}`} disabled={updateCategory.isPending} onClick={() => { const name = window.prompt("اسم التصنيف الجديد", c.name)?.trim(); if (name && name !== c.name) updateCategory.mutate({ id: c.id, data: { name } }, { onSuccess: refreshFinance, onError: e => setError(errorText(e)) }); }}>تعديل الاسم</button><button className="mini-button" data-testid={`button-toggle-category-${c.id}`} disabled={updateCategory.isPending} onClick={() => updateCategory.mutate({ id: c.id, data: { active: !c.active } }, { onSuccess: refreshFinance, onError: e => setError(errorText(e)) })}>{c.active ? "إيقاف" : "تفعيل"}</button></td>}</tr>)}</tbody></table></div> : <EmptyLedger title="لا توجد تصنيفات مالية بعد."/>}
      </section>
      <aside className="finance-card"><div className="finance-card-head"><div><h2>التقسيم الأساسي</h2><p>التصنيفات الفعالة فقط تظهر عند إدخال حركة</p></div></div><div className="finance-card-body"><div className="finance-list-row"><span>تصنيفات الإيرادات</span><strong>{categories.data?.filter(c => c.kind === "income" && c.active).length ?? "—"}</strong></div><div className="finance-list-row"><span>تصنيفات المصروفات</span><strong>{categories.data?.filter(c => c.kind === "expense" && c.active).length ?? "—"}</strong></div></div></aside>
    </div>}
    {section === "people" && <div className="finance-card"><div className="finance-card-head"><div><h2>الموظفون</h2><p>بيانات العمل والراتب الأساسي والالتزامات المفتوحة</p></div>{isAdmin && <button className="button primary" data-testid="button-new-employee" onClick={() => { setEditEmployee(null); openCreate(); }}><Plus size={14}/>موظف جديد</button>}</div>
      {formOpen && <form key={editEmployee ? `employee-${editEmployee.id}` : "new-employee"} className="finance-form" onSubmit={submitEmployee} data-testid="form-finance-employee"><h3>{editEmployee ? "تعديل بيانات الموظف" : "إضافة موظف"}</h3><div className="finance-form-grid"><label>الاسم<input required minLength={2} maxLength={120} name="name" defaultValue={editEmployee?.name ?? ""} data-testid="input-employee-name"/></label><label>المسمى الوظيفي<input required minLength={2} maxLength={100} name="position" defaultValue={editEmployee?.position ?? ""} data-testid="input-employee-position"/></label><label>الهاتف<input maxLength={24} name="phone" defaultValue={editEmployee?.phone ?? ""} data-testid="input-employee-phone"/></label><label>الراتب الأساسي (د.أ)<input required type="number" min="0" step=".001" name="salary" defaultValue={editEmployee ? amountValue(editEmployee.baseSalaryFils) : ""} data-testid="input-employee-salary"/></label><label>تاريخ المباشرة<input type="date" name="hiredAt" defaultValue={editEmployee?.hiredAt?.slice(0, 10) ?? ""} data-testid="input-employee-hired"/></label></div><div className="finance-form-footer"><button className="button primary" disabled={busy} data-testid="button-save-employee">حفظ الموظف</button><button type="button" className="button ghost" onClick={() => { setFormOpen(false); setEditEmployee(null); }} data-testid="button-cancel-employee">إلغاء</button></div></form>}
      {employees.isLoading ? <div className="loading-panel">جارٍ تحميل الموظفين…</div> : employees.isError ? <div className="error-panel">تعذر تحميل الموظفين. <button className="finance-refresh" data-testid="button-retry-employees" onClick={() => void employees.refetch()}>إعادة المحاولة</button></div> : employees.data?.length ? <div className="table-scroll"><table><thead><tr><th>الموظف</th><th>المسمى</th><th>الراتب الأساسي</th><th>مستحقات غير مدفوعة</th><th>الحالة</th>{isAdmin && <th>إجراء</th>}</tr></thead><tbody>{employees.data.map(emp => <tr key={emp.id} data-testid={`row-employee-${emp.id}`}><td><span className="finance-row-title">{emp.name}</span><span className="finance-row-sub">{emp.phone || "لا يوجد هاتف"}</span></td><td>{emp.position}</td><td><Money fils={emp.baseSalaryFils}/></td><td><Money fils={emp.outstandingFils}/></td><td><span className={`finance-status ${emp.active ? "active" : ""}`} data-testid={`status-employee-${emp.id}`}>{emp.active ? "نشط" : "غير نشط"}</span></td>{isAdmin && <td className="row-actions"><button className="mini-button" data-testid={`button-edit-employee-${emp.id}`} onClick={() => { setEditEmployee(emp); setFormOpen(true); }}>تعديل</button><button className="mini-button" data-testid={`button-toggle-employee-${emp.id}`} onClick={() => updateEmployee.mutate({ id: emp.id, data: { active: !emp.active } }, { onSuccess: refreshFinance, onError: e => setError(errorText(e)) })}>{emp.active ? "إيقاف" : "تفعيل"}</button></td>}</tr>)}</tbody></table></div> : <EmptyLedger title="لا يوجد موظفون مسجلون."/>}
    </div>}
    {section === "payroll" && <div className="finance-card"><div className="finance-card-head"><div><h2>استحقاقات الرواتب</h2><p>سجل شهري مع دفعات جزئية أو تسوية كاملة</p></div>{isAdmin && <button className="button primary" data-testid="button-new-payroll" onClick={openCreate}><Plus size={14}/>استحقاق جديد</button>}</div>
      {formOpen && <form className="finance-form" onSubmit={submitPayroll} data-testid="form-finance-payroll"><h3>إضافة استحقاق راتب</h3><div className="finance-form-grid"><label>الموظف<select required name="employeeId" defaultValue="" data-testid="select-payroll-employee"><option value="" disabled>اختر الموظف</option>{employees.data?.filter(x => x.active).map(x => <option value={x.id} key={x.id}>{x.name}</option>)}</select></label><label>الفترة<input required type="month" name="period" defaultValue={today().slice(0, 7)} data-testid="input-payroll-period"/></label><label>المبلغ المستحق (د.أ)<input required type="number" min=".001" step=".001" name="amount" data-testid="input-payroll-amount"/></label><label>تاريخ الاستحقاق<input required type="date" name="dueDate" defaultValue={today()} data-testid="input-payroll-due-date"/></label></div><div className="finance-form-footer"><button className="button primary" disabled={busy} data-testid="button-save-payroll">حفظ الاستحقاق</button><button type="button" className="button ghost" onClick={() => setFormOpen(false)} data-testid="button-cancel-payroll">إلغاء</button></div></form>}
      {payroll.isLoading ? <div className="loading-panel">جارٍ تحميل استحقاقات الرواتب…</div> : payroll.isError ? <div className="error-panel">تعذر تحميل الرواتب. <button className="finance-refresh" data-testid="button-retry-payroll" onClick={() => void payroll.refetch()}>إعادة المحاولة</button></div> : payroll.data?.length ? <div className="table-scroll"><table><thead><tr><th>الموظف</th><th>الفترة</th><th>الاستحقاق</th><th>المدفوع</th><th>المتبقي</th><th>موعد الاستحقاق</th><th>الحالة</th>{isAdmin && <th>إجراء</th>}</tr></thead><tbody>{payroll.data.map(p => <tr key={p.id} data-testid={`row-payroll-${p.id}`}><td>{p.employeeName}</td><td>{p.period}</td><td><Money fils={p.amountFils}/></td><td><Money fils={p.paidFils}/></td><td><span className="finance-amount"><Money fils={p.outstandingFils}/></span></td><td>{dateText(p.dueDate)}</td><td><span className={`finance-status ${p.status}`} data-testid={`status-payroll-${p.id}`}>{p.status === "due" ? "مستحق" : p.status === "partial" ? "دفعة جزئية" : "مدفوع"}</span></td>{isAdmin && <td>{p.outstandingFils > 0 && <button className="mini-button" data-testid={`button-pay-payroll-${p.id}`} onClick={() => setPayingId(payingId === p.id ? null : p.id)}>تسجيل دفعة</button>}</td>}</tr>)}</tbody></table>{payingId !== null && payroll.data.find(p => p.id === payingId) && <form className="finance-form" onSubmit={e => submitPayment(e, payingId)} data-testid="form-payroll-payment"><h3>تسجيل دفعة راتب</h3><div className="finance-form-grid"><label>المبلغ (د.أ)<input required type="number" min=".001" step=".001" max={(payroll.data.find(p => p.id === payingId)?.outstandingFils ?? 0) / 1000} name="amount" data-testid="input-payroll-payment-amount"/></label><label>طريقة الدفع<select name="method" data-testid="select-payroll-payment-method"><option value="cash">نقدًا</option><option value="card">بطاقة</option><option value="bank_transfer">تحويل بنكي</option><option value="wallet">محفظة</option></select></label></div><div className="finance-form-footer"><button className="button primary" disabled={busy} data-testid="button-save-payroll-payment">تأكيد الدفعة</button><button type="button" className="button ghost" onClick={() => setPayingId(null)} data-testid="button-cancel-payroll-payment">إلغاء</button></div></form>}</div> : <EmptyLedger title="لا توجد استحقاقات رواتب مسجلة."/>}
    </div>}
    {section === "cash" && <div className="finance-layout">
      <section className="finance-card"><div className="finance-card-head"><div><h2>حركات الصندوق</h2><p>التحصيل والمصروفات النقدية والتسويات المسجلة</p></div>{isAdmin && <button className="button primary" data-testid="button-new-cash-movement" onClick={openCreate}><Plus size={14}/>تسوية نقدية</button>}</div>
        <div className="finance-card-body"><small>الرصيد الحالي</small><div className="cash-balance" data-testid="value-cash-register"><Money fils={cash.data?.balanceFils ?? 0}/></div></div>
        {formOpen && <form className="finance-form" onSubmit={submitCash} data-testid="form-cash-movement"><h3>تسجيل حركة نقدية</h3><div className="finance-form-grid"><label>الاتجاه<select name="direction" data-testid="select-cash-direction"><option value="in">إيداع / زيادة</option><option value="out">سحب / نقصان</option></select></label><label>المبلغ (د.أ)<input required type="number" min=".001" step=".001" name="amount" data-testid="input-cash-amount"/></label><label>البيان<input required minLength={2} maxLength={500} name="description" data-testid="input-cash-description" placeholder="سبب التسوية"/></label></div><div className="finance-form-footer"><button className="button primary" disabled={busy} data-testid="button-save-cash-movement">حفظ الحركة</button><button type="button" className="button ghost" onClick={() => setFormOpen(false)} data-testid="button-cancel-cash-movement">إلغاء</button></div></form>}
        {cash.isLoading ? <div className="loading-panel">جارٍ تحميل سجل الصندوق…</div> : cash.isError ? <div className="error-panel">تعذر تحميل سجل الصندوق. <button className="finance-refresh" data-testid="button-retry-cash" onClick={() => void cash.refetch()}>إعادة المحاولة</button></div> : cash.data?.movements.length ? <div className="finance-list finance-card-body">{cash.data.movements.map(m => <div className="finance-list-row" key={m.id} data-testid={`row-cash-movement-${m.id}`}><div><strong>{m.description}</strong><small>{dateText(m.createdAt)} · {m.createdBy}</small></div><strong className={`finance-amount ${m.direction === "in" ? "income" : "expense"}`}>{m.direction === "in" ? "+" : "−"} <Money fils={m.amountFils}/></strong></div>)}</div> : <EmptyLedger title="لا توجد حركات صندوق مسجلة."/>}
      </section><aside className="finance-card"><div className="finance-card-head"><div><h2>مطابقة النقد</h2><p>الرصيد بعد احتساب التحصيل والمصروفات النقدية</p></div></div><div className="finance-card-body"><div className="finance-metric highlight"><span>الرصيد المتحقق حاليًا</span><strong><Money fils={cash.data?.balanceFils ?? 0}/></strong></div><p className="finance-row-sub">تظهر جميع الحركات النقدية والتسويات المسجلة، ويتحدث الرصيد بعد كل عملية.</p></div></aside>
    </div>}
    {busy && <span className="finance-row-sub" role="status" data-testid="status-finance-saving">جارٍ تحديث السجل…</span>}
  </div>;
}

function methodLabel(method: string) {
  return method === "cash" ? "نقدًا" : method === "card" ? "بطاقة" : method === "bank_transfer" ? "تحويل بنكي" : "محفظة";
}

export function ReportsPage() {
  const [period, setPeriod] = useState<GetFinancePeriodReportParams["period"]>("month");
  const [date, setDate] = useState(today().slice(0, 7) + "-01");
  const params = useMemo(() => ({ period, date }), [period, date]);
  const report = useGetFinancePeriodReport(params);
  const r = report.data;
  function csvExport() {
    if (!r) return;
    const rows = [
      ["نوع التقرير", periodLabel(r.period)], ["من تاريخ", r.fromDate], ["إلى تاريخ", r.toDate],
      ["إجمالي الإيرادات (فلس)", r.incomeFils], ["إجمالي المصروفات (فلس)", r.expenseFils], ["الصافي (فلس)", r.netFils],
          ["الرواتب المستحقة غير المدفوعة (فلس)", r.payrollOutstandingFils], ["رصيد الصندوق (فلس)", r.cashBalanceFils], [],
      ["تصنيف الإيرادات", "المبلغ (فلس)"], ...r.incomeByCategory.map(c => [c.categoryName, c.amountFils]),
      [], ["تصنيف المصروفات", "المبلغ (فلس)"], ...r.expenseByCategory.map(c => [c.categoryName, c.amountFils]),
      [], ["التاريخ", "النوع", "البيان", "التصنيف", "طريقة الدفع", "المبلغ (فلس)"],
      ...r.transactions.map(t => [t.transactionDate, t.kind === "income" ? "إيراد" : "مصروف", t.description, t.categoryName || "", methodLabel(t.method), t.amountFils]),
    ];
    const csv = "\uFEFF" + rows.map(row => row.map(cell => `"${String(cell ?? "").replaceAll('"', '""')}"`).join(",")).join("\r\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob); const a = document.createElement("a"); a.href = url; a.download = `prime-finance-${period}-${date}.csv`; a.click(); window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  const categories = (items: { categoryId: number | null; categoryName: string; amountFils: number }[], key: string) => items.length ? items.map((c, i) => <div className="category-line" key={`${key}-${c.categoryId}-${i}`} data-testid={`${key}-category-${c.categoryId ?? i}`}><span>{c.categoryName}</span><strong><Money fils={c.amountFils}/></strong></div>) : <p className="finance-row-sub">لا توجد حركات مصنفة ضمن الفترة.</p>;
  return <div className="finance-page">
    <div className="finance-hero"><div><p className="eyebrow">قراءة الأداء المالي</p><h1>التقارير المالية</h1><p>راجع الحركة حسب اليوم أو الشهر أو السنة، واحتفظ بنسخة قابلة للطباعة.</p></div><div className="finance-hero-side"><small>التقرير الحالي</small><div className="finance-hero-balance">{periodLabel(period)}</div></div></div>
    <section className="finance-card">
      <div className="finance-card-head"><div><h2>تحديد الفترة</h2><p>يعرض التقرير بيانات مالية حقيقية مسجلة في النظام</p></div><button className="finance-refresh" data-testid="button-refresh-report" onClick={() => void report.refetch()}><RefreshCw size={13}/> تحديث التقرير</button></div>
      <div className="report-controls finance-controls"><label>الفترة<select value={period} data-testid="select-report-period" onChange={e => { const next = e.target.value as GetFinancePeriodReportParams["period"]; setPeriod(next); if (next === "year") setDate(`${today().slice(0, 4)}-01-01`); else if (next === "month") setDate(`${today().slice(0, 7)}-01`); else setDate(today()); }}><option value="day">يومي</option><option value="month">شهري</option><option value="year">سنوي</option></select></label><label>{period === "year" ? "السنة" : period === "month" ? "الشهر" : "التاريخ"}<input type={period === "year" ? "number" : period === "month" ? "month" : "date"} value={period === "year" ? date.slice(0, 4) : period === "month" ? date.slice(0, 7) : date} data-testid="input-report-date" onChange={e => setDate(period === "year" ? `${e.target.value}-01-01` : period === "month" ? `${e.target.value}-01` : e.target.value)}/></label><button className="button primary" type="button" data-testid="button-export-report-csv" onClick={csvExport} disabled={!r}><Download size={15}/>تصدير CSV</button><button className="button ghost" type="button" data-testid="button-print-report" onClick={() => window.print()}><Printer size={15}/>طباعة التقرير</button></div>
    </section>
    {report.isLoading ? <div className="finance-card loading-panel" data-testid="loading-report">جارٍ إعداد التقرير…</div> : report.isError ? <div className="finance-card error-panel" role="alert" data-testid="error-report">تعذر تحميل التقرير المالي. <button className="finance-refresh" data-testid="button-retry-report" onClick={() => void report.refetch()}>إعادة المحاولة</button></div> : r ? <>
      <div className="report-print-head"><h1>Prime Boxing Academy — التقرير المالي</h1><p>{dateText(r.fromDate)} — {dateText(r.toDate)}</p></div>
      <div className="finance-summary" style={{ marginTop: 15 }}>
        <div className="finance-metric"><span>إجمالي الإيرادات</span><strong data-testid="report-income"><Money fils={r.incomeFils}/></strong></div>
        <div className="finance-metric"><span>إجمالي المصروفات</span><strong data-testid="report-expense"><Money fils={r.expenseFils}/></strong></div>
        <div className="finance-metric highlight"><span>صافي الفترة</span><strong data-testid="report-net"><Money fils={r.netFils}/></strong></div>
        <div className="finance-metric"><span>رواتب غير مدفوعة · رصيد الصندوق</span><strong data-testid="report-payroll-cash"><Money fils={r.payrollOutstandingFils}/> · <Money fils={r.cashBalanceFils}/></strong></div>
      </div>
      <div className="finance-split">
        <section className="finance-card"><div className="finance-card-head"><div><h2>الإيرادات حسب التصنيف</h2><p>مجموع الحركة حسب تصنيفها</p></div></div><div className="finance-card-body">{categories(r.incomeByCategory, "report-income")}</div></section>
        <section className="finance-card"><div className="finance-card-head"><div><h2>المصروفات حسب التصنيف</h2><p>مجموع الحركة حسب تصنيفها</p></div></div><div className="finance-card-body">{categories(r.expenseByCategory, "report-expense")}</div></section>
      </div>
      <section className="finance-card" style={{ marginTop: 15 }}><div className="finance-card-head"><div><h2>تفاصيل الإيرادات والمصروفات الإضافية</h2><p>لا تشمل دفعات الاشتراكات المفصلة، وهي محتسبة ضمن إجمالي الإيرادات · {r.fromDate} — {r.toDate}</p></div></div>{r.transactions.length ? <div className="table-scroll"><table className="finance-table"><thead><tr><th>التاريخ</th><th>البيان</th><th>التصنيف</th><th>النوع</th><th>طريقة الدفع</th><th>المبلغ</th></tr></thead><tbody>{r.transactions.map(t => <tr key={t.id} data-testid={`report-transaction-${t.id}`}><td>{dateText(t.transactionDate)}</td><td>{t.description}</td><td>{t.categoryName || "—"}</td><td>{t.kind === "income" ? "إيراد" : "مصروف"}</td><td>{methodLabel(t.method)}</td><td className={`finance-amount ${t.kind}`}><Money fils={t.amountFils}/></td></tr>)}</tbody></table></div> : <EmptyLedger title="لا توجد حركات إضافية مسجلة خلال هذه الفترة."/>}</section>
    </> : <div className="finance-card"><EmptyLedger title="لا تتوفر بيانات تقرير لهذه الفترة."/></div>}
  </div>;
}
function periodLabel(period: string) { return period === "day" ? "يومي" : period === "year" ? "سنوي" : "شهري"; }
