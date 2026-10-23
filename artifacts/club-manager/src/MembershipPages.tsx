import { useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  useActOnSubscription, useCreateMember, useCreateSubscription, useCreateSubscriptionPayment,
  useDeleteMember, useGetClubSession, useGetMember, useListMembers, useListPlans, useListSubscriptions,
  useUpdateMember, useUpdateSubscription,
  getGetMemberQueryKey,
} from "@workspace/api-client-react";
import type { Member, Subscription } from "@workspace/api-client-react";
import { Plus, Search, X } from "lucide-react";
import { Link, useLocation } from "wouter";

const today = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Amman" }).format(new Date());
const fmtJod = (fils: number) => (fils / 1000).toLocaleString("ar-JO", { minimumFractionDigits: 3, maximumFractionDigits: 3 });
function Jod({ fils }: { fils: number }) { return <>{fmtJod(fils)} <small>د.أ</small></>; }
function errMsg(e: unknown, fallback = "تعذر تنفيذ الطلب"): string {
  const x = e as { status?: number; data?: { error?: string } | null; message?: string };
  if (x?.data && typeof x.data === "object" && x.data.error) return x.data.error;
  if (x?.status === 403) return "ليست لديك صلاحية لتنفيذ هذا الإجراء";
  return x?.message || fallback;
}
/** JOD text with up to 3 decimals -> fils; null when invalid */
function toFils(raw: string): number | null {
  const t = raw.trim().replace(",", ".");
  if (!t) return 0;
  if (!/^\d+(\.\d{1,3})?$/.test(t)) return null;
  const fils = Math.round(Number(t) * 1000);
  return Number.isSafeInteger(fils) && fils <= 2_000_000_000 ? fils : null;
}
function addDays(date: string, n: number) { const d = new Date(`${date}T00:00:00Z`); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); }
const STATUS: Record<string, [string, string]> = { active: ["نشط", "success"], paused: ["موقوف مؤقتًا", "warn"], expired: ["منتهي", "muted"], cancelled: ["ملغي", "muted"] };
const METHODS = [["cash", "نقدًا"], ["card", "بطاقة"], ["bank_transfer", "تحويل بنكي"], ["wallet", "محفظة"]] as const;
type Method = typeof METHODS[number][0];

function useRefresh() { const qc = useQueryClient(); return () => { void qc.invalidateQueries(); }; }
function useIsAdmin() { return useGetClubSession().data?.role === "admin"; }

function Modal({ title, onClose, busy, children }: { title: string; onClose: () => void; busy?: boolean; children: ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => { const dialog = ref.current; dialog?.showModal(); return () => dialog?.close(); }, []);
  return <dialog ref={ref} className="mship-dialog" dir="rtl" aria-label={title} onCancel={e => { e.preventDefault(); if (!busy) onClose(); }} onClick={e => {
    if (e.target !== e.currentTarget || busy) return;
    const rect = e.currentTarget.getBoundingClientRect();
    if (e.clientX < rect.left || e.clientX > rect.right || e.clientY < rect.top || e.clientY > rect.bottom) onClose();
  }}>
      <div className="mship-dialog-head"><h2>{title}</h2><button type="button" className="mship-x" onClick={onClose} disabled={busy} aria-label="إغلاق"><X size={18} /></button></div>
      {children}
    </dialog>;
}
function Banner({ kind, children }: { kind: "ok" | "err"; children: ReactNode }) { return <div className={`mship-banner ${kind}`} role={kind === "err" ? "alert" : "status"}>{children}</div>; }

/* ---------- Member form (create / edit) ---------- */
export function MemberForm({ member, onDone, onCancel }: { member?: Member; onDone: (m: Member) => void; onCancel: () => void }) {
  const refresh = useRefresh();
  const create = useCreateMember(); const update = useUpdateMember();
  const [f, setF] = useState({ name: member?.name ?? "", phone: member?.phone ?? "", email: member?.email ?? "", birthDate: member?.birthDate ?? "", notes: member?.notes ?? "", active: member?.active ?? true });
  const [error, setError] = useState("");
  const pending = create.isPending || update.isPending;
  const set = (k: keyof typeof f, v: string | boolean) => setF(p => ({ ...p, [k]: v }));
  function submit(e: FormEvent) {
    e.preventDefault(); setError("");
    if (f.birthDate && f.birthDate > today()) { setError("تاريخ الميلاد لا يمكن أن يكون في المستقبل"); return; }
    const base = { name: f.name.trim(), phone: f.phone.trim(), email: f.email.trim() || null, birthDate: f.birthDate || null, notes: f.notes.trim() || null };
    const opts = { onSuccess: (m: Member) => { refresh(); onDone(m); }, onError: (er: unknown) => setError(errMsg(er, "تعذر حفظ المشترك")) };
    if (member) update.mutate({ id: member.id, data: { ...base, active: f.active } }, opts);
    else create.mutate({ data: base }, opts);
  }
  return <form className="mship-form" onSubmit={submit}>
    <div className="form-grid">
      <label>الاسم الكامل<input required minLength={2} maxLength={120} value={f.name} onChange={e => set("name", e.target.value)} /></label>
      <label>رقم الهاتف<input required minLength={7} maxLength={24} inputMode="tel" dir="ltr" value={f.phone} onChange={e => set("phone", e.target.value)} placeholder="+962 7X XXX XXXX" /></label>
      <label>البريد الإلكتروني<input type="email" dir="ltr" value={f.email} onChange={e => set("email", e.target.value)} placeholder="اختياري" /></label>
      <label>تاريخ الميلاد<input type="date" max={today()} value={f.birthDate} onChange={e => set("birthDate", e.target.value)} /></label>
      <label className="mship-wide">ملاحظات<textarea maxLength={1000} rows={3} value={f.notes} onChange={e => set("notes", e.target.value)} /></label>
      {member && <label className="checkbox-label mship-wide"><input type="checkbox" checked={f.active} onChange={e => set("active", e.target.checked)} />الحساب مفعّل (منفصل عن حالة الاشتراك)</label>}
    </div>
    {error && <Banner kind="err">{error}</Banner>}
    <div className="form-actions"><button className="button primary" disabled={pending}>{pending ? "جارٍ الحفظ…" : member ? "حفظ التعديلات" : "حفظ المشترك"}</button><button type="button" className="button ghost" onClick={onCancel} disabled={pending}>إلغاء</button></div>
  </form>;
}

/* ---------- Delete with archive fallback ---------- */
export function MemberDeleteDialog({ member, onClose, onDeleted, onArchived }: { member: Member; onClose: () => void; onDeleted: () => void; onArchived: () => void }) {
  const refresh = useRefresh(); const del = useDeleteMember(); const upd = useUpdateMember();
  const [error, setError] = useState(""); const [canArchive, setCanArchive] = useState(false);
  const busy = del.isPending || upd.isPending;
  function doDelete() {
    setError("");
    del.mutate({ id: member.id }, {
      onSuccess: () => { refresh(); onDeleted(); },
      onError: (e: unknown) => { const x = e as { status?: number; data?: { canArchive?: boolean } | null }; setCanArchive(x.status === 409 && !!x.data?.canArchive); setError(errMsg(e, "تعذر حذف المشترك")); },
    });
  }
  function archive() {
    setError("");
    upd.mutate({ id: member.id, data: { active: false } }, { onSuccess: () => { refresh(); onArchived(); }, onError: e => setError(errMsg(e, "تعذرت الأرشفة")) });
  }
  return <Modal title="حذف المشترك" onClose={onClose} busy={busy}>
    <p className="mship-text">سيتم حذف المشترك <strong>{member.name}</strong> نهائيًا. لا يمكن حذف مشترك لديه اشتراكات أو حركات مالية أو تذكيرات مرتبطة، ولن يُحذف أي سجل مرتبط تلقائيًا.</p>
    {error && <Banner kind="err">{error}</Banner>}
    {canArchive && <p className="mship-text">يمكنك أرشفة المشترك بدلًا من ذلك (تعطيل الحساب) مع بقاء السجل المالي كاملًا. يمكن إعادة تفعيله لاحقًا.</p>}
    <div className="form-actions">
      {canArchive ? <button className="button primary" onClick={archive} disabled={busy}>{upd.isPending ? "جارٍ الأرشفة…" : "أرشفة المشترك"}</button>
        : <button className="button mship-danger" onClick={doDelete} disabled={busy}>{del.isPending ? "جارٍ الحذف…" : `تأكيد حذف ${member.name}`}</button>}
      <button className="button ghost" onClick={onClose} disabled={busy}>إغلاق</button>
    </div>
  </Modal>;
}

function ArchiveToggle({ member, onError, onDone, mini }: { member: Member; onError: (m: string) => void; onDone: (m: string) => void; mini?: boolean }) {
  const refresh = useRefresh(); const upd = useUpdateMember();
  const next = !member.active;
  return <button className={mini ? "mini-button" : "button ghost"} disabled={upd.isPending} onClick={() => upd.mutate({ id: member.id, data: { active: next } }, { onSuccess: () => { refresh(); onDone(next ? `تمت إعادة تفعيل ${member.name}` : `تمت أرشفة ${member.name}`); }, onError: e => onError(errMsg(e)) })}>
    {upd.isPending ? "…" : next ? "إعادة تفعيل" : "أرشفة"}</button>;
}

/* ---------- Members page ---------- */
export function MembersPage() {
  const isAdmin = useIsAdmin();
  const [search, setSearch] = useState(""); const [form, setForm] = useState<"new" | Member | null>(null);
  const [del, setDel] = useState<Member | null>(null); const [msg, setMsg] = useState(""); const [err, setErr] = useState("");
  const q = useListMembers({ search: search.trim() || undefined, limit: 100 });
  const rows = q.data;
  return <>
    <div className="page-heading"><div><p className="eyebrow">إدارة الأعضاء</p><h1>المشتركون</h1></div><button className="button primary" onClick={() => { setForm("new"); setMsg(""); }}><Plus size={16} />مشترك جديد</button></div>
    {msg && <Banner kind="ok">{msg}</Banner>}{err && <Banner kind="err">{err}</Banner>}
    {form && <div className="panel form-panel"><h2>{form === "new" ? "إضافة مشترك" : `تعديل ${form.name}`}</h2>
      <MemberForm key={form === "new" ? "new" : form.id} member={form === "new" ? undefined : form} onCancel={() => setForm(null)} onDone={m => { setMsg(`تم حفظ بيانات ${m.name}`); setForm(null); }} /></div>}
    <div className="panel table-panel"><div className="table-toolbar"><div><h2>قائمة المشتركين</h2><small>{rows ? `${rows.length} مشترك` : ""}</small></div>
      <label className="searchbox"><Search size={16} /><input value={search} onChange={e => setSearch(e.target.value)} placeholder="ابحث بالاسم أو الهاتف" /></label></div>
      {q.isLoading ? <div className="loading-panel">جارٍ تحميل المشتركين…</div>
        : q.isError ? <div className="error-panel">تعذر تحميل المشتركين: {errMsg(q.error)} <div><button className="button ghost" onClick={() => void q.refetch()}>إعادة المحاولة</button></div></div>
        : rows && rows.length ? <div className="table-scroll"><table><thead><tr><th>المشترك</th><th>رقم الهاتف</th><th>تاريخ التسجيل</th><th>الحساب</th><th>إجراء</th></tr></thead><tbody>
          {rows.map(m => <tr key={m.id}><td><Link href={`/members/${m.id}`} className="member-name"><span className="avatar soft">{m.name.slice(0, 1)}</span><strong>{m.name}</strong></Link></td>
            <td dir="ltr" className="ltr">{m.phone}</td><td>{new Intl.DateTimeFormat("ar-JO", { dateStyle: "medium", timeZone: "Asia/Amman" }).format(new Date(m.joinedAt))}</td>
            <td><span className={`status-pill ${m.active ? "success" : "muted"}`}>{m.active ? "مفعّل" : "مؤرشف"}</span></td>
            <td className="row-actions"><button className="mini-button" onClick={() => { setForm(m); setMsg(""); window.scrollTo({ top: 0, behavior: "smooth" }); }}>تعديل</button>
              <ArchiveToggle mini member={m} onError={setErr} onDone={s => { setErr(""); setMsg(s); }} />
              <Link href={`/subscriptions?memberId=${m.id}`} className="mini-button">اشتراك</Link>
              {isAdmin && <button className="mini-button mship-danger-mini" onClick={() => setDel(m)}>حذف</button>}</td></tr>)}
        </tbody></table></div>
        : <div className="empty-state"><p>{search ? "لا توجد نتائج مطابقة." : "لا يوجد مشتركون بعد. سجّل أول مشترك للنادي."}</p></div>}
    </div>
    {del && <MemberDeleteDialog member={del} onClose={() => setDel(null)} onDeleted={() => { setMsg(`تم حذف ${del.name}`); setDel(null); }} onArchived={() => { setMsg(`تمت أرشفة ${del.name}`); setDel(null); }} />}
  </>;
}

/* ---------- Profile tools: edit / archive / delete ---------- */
export function MemberProfileTools({ member }: { member: Member }) {
  const isAdmin = useIsAdmin(); const [, nav] = useLocation();
  const [edit, setEdit] = useState(false); const [del, setDel] = useState(false); const [msg, setMsg] = useState(""); const [err, setErr] = useState("");
  return <div className="mship-tools">
    <div className="mship-tools-row">
      <span className={`status-pill ${member.active ? "success" : "muted"}`}>{member.active ? "الحساب مفعّل" : "الحساب مؤرشف"}</span>
      <button className="button ghost" onClick={() => setEdit(!edit)}>تعديل البيانات</button>
      <ArchiveToggle member={member} onError={setErr} onDone={s => { setErr(""); setMsg(s); }} />
      {isAdmin && <button className="button mship-danger" onClick={() => setDel(true)}>حذف</button>}
    </div>
    {msg && <Banner kind="ok">{msg}</Banner>}{err && <Banner kind="err">{err}</Banner>}
    {edit && <div className="panel form-panel"><h2>تعديل بيانات المشترك</h2><MemberForm member={member} onCancel={() => setEdit(false)} onDone={() => { setEdit(false); setMsg("تم حفظ التعديلات"); }} /></div>}
    {del && <MemberDeleteDialog member={member} onClose={() => setDel(false)} onDeleted={() => nav("/members")} onArchived={() => { setDel(false); setMsg("تمت أرشفة المشترك"); }} />}
  </div>;
}

/* ---------- Subscription manager ---------- */
type Dlg = { kind: "create" } | { kind: "edit" | "renew" | "payment" | "cancel"; sub: Subscription };

export function SubscriptionManager({ memberId, presetMemberId, openCreate }: { memberId?: number; presetMemberId?: number; openCreate?: boolean }) {
  const isAdmin = useIsAdmin(); const refresh = useRefresh();
  const q = useListSubscriptions({ status: "all" });
  const act = useActOnSubscription();
  const [dlg, setDlg] = useState<Dlg | null>(openCreate ? { kind: "create" } : null);
  const [msg, setMsg] = useState(""); const [err, setErr] = useState(""); const [busyId, setBusyId] = useState<number | null>(null);
  const all = q.data ?? [];
  const rows = memberId ? all.filter(s => s.memberId === memberId) : all;
  const renewed = new Set(all.map(s => s.renewedFromId).filter((x): x is number => typeof x === "number"));
  const done = (m: string) => { setMsg(m); setErr(""); setDlg(null); refresh(); };
  function quick(s: Subscription, action: "pause" | "resume", ok: string) {
    setBusyId(s.id); setMsg(""); setErr("");
    act.mutate({ id: s.id, data: { action } }, { onSuccess: () => { setMsg(ok); refresh(); }, onError: e => setErr(errMsg(e)), onSettled: () => setBusyId(null) });
  }
  return <div className="panel table-panel">
    <div className="table-toolbar"><div><h2>{memberId ? "اشتراكات المشترك" : "سجل الاشتراكات"}</h2><small>الباقات والرصيد الحالي</small></div>
      <div className="quick-actions">{memberId && <Link href={`/subscriptions?memberId=${memberId}`} className="button ghost">صفحة الاشتراكات</Link>}<button className="button primary" onClick={() => { setDlg({ kind: "create" }); setMsg(""); }}><Plus size={16} />اشتراك جديد</button></div></div>
    {(msg || err) && <div className="mship-pad">{msg && <Banner kind="ok">{msg}</Banner>}{err && <Banner kind="err">{err}</Banner>}</div>}
    {q.isLoading ? <div className="loading-panel">جارٍ تحميل الاشتراكات…</div>
      : q.isError ? <div className="error-panel">تعذر تحميل الاشتراكات: {errMsg(q.error)} <div><button className="button ghost" onClick={() => void q.refetch()}>إعادة المحاولة</button></div></div>
      : rows.length ? <div className="table-scroll"><table><thead><tr>{!memberId && <th>المشترك</th>}<th>الباقة</th><th>الفترة</th><th>الصافي</th><th>المدفوع</th><th>المتبقي</th><th>الحالة</th><th>إجراء</th></tr></thead><tbody>
        {rows.map(s => { const [label, tone] = STATUS[s.status] ?? [s.status, "muted"]; const busy = busyId === s.id;
          const canRenew = (s.status === "active" || s.status === "expired") && !renewed.has(s.id);
          return <tr key={s.id}>{!memberId && <td><Link href={`/members/${s.memberId}`} className="text-link">{s.memberName}</Link></td>}
            <td>{s.planName}{s.renewedFromId ? <small className="mship-sub"> تجديد</small> : null}</td><td>{s.startDate} — {s.endDate}</td>
            <td><Jod fils={s.priceFils - s.discountFils} /></td><td><Jod fils={s.paidFils} /></td><td><Jod fils={s.balanceFils} /></td>
            <td><span className={`status-pill ${tone}`}>{label}</span></td>
            <td className="row-actions">
              {s.balanceFils > 0 && <button className="mini-button" onClick={() => { setDlg({ kind: "payment", sub: s }); setMsg(""); }}>تحصيل</button>}
              {s.status === "active" && <button className="mini-button" disabled={busy} onClick={() => quick(s, "pause", "تم إيقاف الاشتراك مؤقتًا")}>إيقاف</button>}
              {s.status === "paused" && <button className="mini-button" disabled={busy} onClick={() => quick(s, "resume", "تم استئناف الاشتراك")}>استئناف</button>}
              {canRenew && <button className="mini-button" onClick={() => { setDlg({ kind: "renew", sub: s }); setMsg(""); }}>تجديد</button>}
              {isAdmin && (s.status === "active" || s.status === "paused") && <button className="mini-button" onClick={() => { setDlg({ kind: "edit", sub: s }); setMsg(""); }}>تعديل</button>}
              {(s.status === "active" || s.status === "paused") && <button className="mini-button mship-danger-mini" onClick={() => { setDlg({ kind: "cancel", sub: s }); setMsg(""); }}>إلغاء</button>}
            </td></tr>; })}
      </tbody></table></div>
      : <div className="empty-state"><p>{memberId ? "لا توجد اشتراكات لهذا المشترك." : "لا توجد اشتراكات مسجلة بعد."}</p></div>}
    {dlg?.kind === "create" && <CreateDialog memberId={memberId} preset={presetMemberId} onClose={() => setDlg(null)} onDone={done} />}
    {dlg?.kind === "edit" && <EditDialog sub={dlg.sub} onClose={() => setDlg(null)} onDone={done} />}
    {dlg?.kind === "renew" && <RenewDialog sub={dlg.sub} onClose={() => setDlg(null)} onDone={done} />}
    {dlg?.kind === "payment" && <PaymentDialog sub={dlg.sub} onClose={() => setDlg(null)} onDone={done} />}
    {dlg?.kind === "cancel" && <CancelDialog sub={dlg.sub} onClose={() => setDlg(null)} onDone={done} />}
  </div>;
}

type DP = { onClose: () => void; onDone: (m: string) => void };

function CreateDialog({ memberId, preset, onClose, onDone }: DP & { memberId?: number; preset?: number }) {
  const [memberSearch, setMemberSearch] = useState("");
  const members = useListMembers({ search: memberSearch.trim() || undefined, limit: 100 }); const plans = useListPlans(); const create = useCreateSubscription();
  const [f, setF] = useState({ memberId: (memberId ?? preset) ? String(memberId ?? preset) : "", planId: "", startDate: today(), discount: "0", paid: "0", method: "cash" as Method });
  const selectedMember = useGetMember(Number(f.memberId) || 0, { query: { queryKey: getGetMemberQueryKey(Number(f.memberId) || 0), enabled: Number(f.memberId) > 0 } });
  const [error, setError] = useState(""); const set = (k: keyof typeof f, v: string) => setF(p => ({ ...p, [k]: v }));
  const active = plans.data?.filter(p => p.active) ?? [];
  const choices = [...(members.data ?? [])];
  if (selectedMember.data && !choices.some(m => m.id === selectedMember.data.member.id)) choices.push(selectedMember.data.member);
  const mems = choices.filter(m => m.active || String(m.id) === f.memberId);
  function submit(e: FormEvent) {
    e.preventDefault(); setError("");
    const d = toFils(f.discount), p = toFils(f.paid);
    if (d === null || p === null) { setError("أدخل المبالغ بالدينار بثلاث خانات عشرية كحد أقصى"); return; }
    create.mutate({ data: { memberId: Number(f.memberId), planId: Number(f.planId), startDate: f.startDate, discountFils: d, initialPaymentFils: p, paymentMethod: f.method } },
      { onSuccess: () => onDone("تم إنشاء الاشتراك"), onError: e2 => setError(errMsg(e2, "تعذر إنشاء الاشتراك")) });
  }
  return <Modal title="اشتراك جديد" onClose={onClose} busy={create.isPending}><form onSubmit={submit}>
    <div className="form-grid">
      {!memberId && <label className="mship-wide">بحث عن مشترك<input value={memberSearch} onChange={e => setMemberSearch(e.target.value)} placeholder="ابحث بالاسم أو رقم الهاتف للوصول إلى أي مشترك"/></label>}
      <label>المشترك<select required value={f.memberId} disabled={!!memberId} onChange={e => set("memberId", e.target.value)}><option value="" disabled>{members.isLoading ? "جارٍ التحميل…" : "اختر مشتركًا"}</option>{mems.map(m => <option key={m.id} value={m.id}>{m.name} — {m.phone}</option>)}</select></label>
      <label>الباقة<select required value={f.planId} onChange={e => set("planId", e.target.value)}><option value="" disabled>{plans.isLoading ? "جارٍ التحميل…" : "اختر باقة"}</option>{active.map(p => <option key={p.id} value={p.id}>{p.name} — {fmtJod(p.priceFils)} د.أ</option>)}</select></label>
      <label>تاريخ البداية<input required type="date" value={f.startDate} onChange={e => set("startDate", e.target.value)} /></label>
      <label>الخصم (د.أ)<input inputMode="decimal" dir="ltr" value={f.discount} onChange={e => set("discount", e.target.value)} /></label>
      <label>دفعة أولى (د.أ)<input inputMode="decimal" dir="ltr" value={f.paid} onChange={e => set("paid", e.target.value)} /></label>
      <label>طريقة الدفع<select value={f.method} onChange={e => set("method", e.target.value)}>{METHODS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></label>
    </div>
    {(members.isError || plans.isError) && <Banner kind="err">تعذر تحميل قائمة المشتركين أو الباقات</Banner>}
    {error && <Banner kind="err">{error}</Banner>}
    <div className="form-actions"><button className="button primary" disabled={create.isPending}>{create.isPending ? "جارٍ الحفظ…" : "حفظ الاشتراك"}</button><button type="button" className="button ghost" onClick={onClose} disabled={create.isPending}>إلغاء</button></div>
  </form></Modal>;
}

function EditDialog({ sub, onClose, onDone }: DP & { sub: Subscription }) {
  const plans = useListPlans(); const upd = useUpdateSubscription();
  const [f, setF] = useState({ planId: String(sub.planId), startDate: sub.startDate, endDate: sub.endDate, price: (sub.priceFils / 1000).toFixed(3) });
  const [error, setError] = useState(""); const set = (k: keyof typeof f, v: string) => setF(p => ({ ...p, [k]: v }));
  const minFils = sub.paidFils + sub.discountFils;
  function submit(e: FormEvent) {
    e.preventDefault(); setError("");
    const p = toFils(f.price);
    if (p === null) { setError("السعر غير صالح"); return; }
    if (p < minFils) { setError(`لا يمكن أن يقل السعر عن المدفوع الصافي + الخصم (${fmtJod(minFils)} د.أ)`); return; }
    if (f.endDate < f.startDate) { setError("تاريخ النهاية يسبق تاريخ البداية"); return; }
    upd.mutate({ id: sub.id, data: { planId: Number(f.planId), startDate: f.startDate, endDate: f.endDate, priceFils: p } }, { onSuccess: () => onDone("تم تعديل الاشتراك"), onError: e2 => setError(errMsg(e2, "تعذر تعديل الاشتراك")) });
  }
  const list = plans.data?.filter(p => p.active || p.id === sub.planId) ?? [];
  return <Modal title={`تعديل اشتراك ${sub.memberName}`} onClose={onClose} busy={upd.isPending}><form onSubmit={submit}>
    <p className="mship-text">سجل الدفعات والخصم لا يتغيران بالتعديل. الحد الأدنى للسعر {fmtJod(minFils)} د.أ.</p>
    <div className="form-grid">
      <label>الباقة<select required value={f.planId} onChange={e => set("planId", e.target.value)}>{list.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select></label>
      <label>السعر (د.أ)<input required inputMode="decimal" dir="ltr" value={f.price} onChange={e => set("price", e.target.value)} /></label>
      <label>تاريخ البداية<input required type="date" value={f.startDate} onChange={e => set("startDate", e.target.value)} /></label>
      <label>تاريخ النهاية<input required type="date" value={f.endDate} onChange={e => set("endDate", e.target.value)} /></label>
    </div>
    {error && <Banner kind="err">{error}</Banner>}
    <div className="form-actions"><button className="button primary" disabled={upd.isPending}>{upd.isPending ? "جارٍ الحفظ…" : "حفظ التعديل"}</button><button type="button" className="button ghost" onClick={onClose} disabled={upd.isPending}>إلغاء</button></div>
  </form></Modal>;
}

function RenewDialog({ sub, onClose, onDone }: DP & { sub: Subscription }) {
  const plans = useListPlans(); const act = useActOnSubscription();
  const t = today(); const nextDay = addDays(sub.endDate, 1);
  const [planId, setPlanId] = useState(String(sub.planId)); const [startDate, setStart] = useState(nextDay > t ? nextDay : t); const [error, setError] = useState("");
  const list = plans.data?.filter(p => p.active || p.id === sub.planId) ?? [];
  function submit(e: FormEvent) {
    e.preventDefault(); setError("");
    act.mutate({ id: sub.id, data: { action: "renew", planId: Number(planId), startDate } }, { onSuccess: () => onDone("تم إنشاء اشتراك التجديد. يمكنك تحصيل الدفعة من الجدول."), onError: e2 => setError(errMsg(e2, "تعذر التجديد")) });
  }
  return <Modal title={`تجديد اشتراك ${sub.memberName}`} onClose={onClose} busy={act.isPending}><form onSubmit={submit}>
    <p className="mship-text">يُنشأ اشتراك جديد، ويبقى الاشتراك الحالي ودفعاته ورصيده المتبقي ({fmtJod(sub.balanceFils)} د.أ) كما هي. التحصيل يتم بشكل منفصل بعد التجديد.</p>
    <div className="form-grid">
      <label>الباقة<select required value={planId} onChange={e => setPlanId(e.target.value)}>{list.map(p => <option key={p.id} value={p.id}>{p.name} — {fmtJod(p.priceFils)} د.أ</option>)}</select></label>
      <label>تاريخ البداية<input required type="date" value={startDate} onChange={e => setStart(e.target.value)} /></label>
    </div>
    {error && <Banner kind="err">{error}</Banner>}
    <div className="form-actions"><button className="button primary" disabled={act.isPending}>{act.isPending ? "جارٍ التجديد…" : "تأكيد التجديد"}</button><button type="button" className="button ghost" onClick={onClose} disabled={act.isPending}>إلغاء</button></div>
  </form></Modal>;
}

function PaymentDialog({ sub, onClose, onDone }: DP & { sub: Subscription }) {
  const pay = useCreateSubscriptionPayment();
  const [amount, setAmount] = useState(sub.balanceFils > 0 ? (sub.balanceFils / 1000).toFixed(3) : ""); const [method, setMethod] = useState<Method>("cash"); const [note, setNote] = useState(""); const [error, setError] = useState("");
  function submit(e: FormEvent) {
    e.preventDefault(); setError("");
    const a = toFils(amount);
    if (!a || a < 1) { setError("أدخل مبلغًا صحيحًا أكبر من صفر (حتى ثلاث خانات عشرية)"); return; }
    pay.mutate({ id: sub.id, data: { amountFils: a, method, note: note.trim() || null } }, { onSuccess: () => onDone("تم تسجيل الدفعة"), onError: e2 => setError(errMsg(e2, "تعذر تسجيل الدفعة")) });
  }
  return <Modal title={`تحصيل دفعة — ${sub.memberName}`} onClose={onClose} busy={pay.isPending}><form onSubmit={submit}>
    <p className="mship-text">{sub.planName} · المتبقي الحالي <strong><Jod fils={sub.balanceFils} /></strong></p>
    <div className="form-grid">
      <label>المبلغ (د.أ)<input required inputMode="decimal" dir="ltr" value={amount} onChange={e => setAmount(e.target.value)} /></label>
      <label>طريقة الدفع<select value={method} onChange={e => setMethod(e.target.value as Method)}>{METHODS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></label>
      <label className="mship-wide">ملاحظة<input maxLength={500} value={note} onChange={e => setNote(e.target.value)} placeholder="اختياري" /></label>
    </div>
    {error && <Banner kind="err">{error}</Banner>}
    <div className="form-actions"><button className="button primary" disabled={pay.isPending}>{pay.isPending ? "جارٍ التسجيل…" : "تسجيل الدفعة"}</button><button type="button" className="button ghost" onClick={onClose} disabled={pay.isPending}>إلغاء</button></div>
  </form></Modal>;
}

function CancelDialog({ sub, onClose, onDone }: DP & { sub: Subscription }) {
  const act = useActOnSubscription(); const [error, setError] = useState("");
  return <Modal title="إلغاء الاشتراك" onClose={onClose} busy={act.isPending}>
    <p className="mship-text">سيتم إلغاء اشتراك <strong>{sub.memberName}</strong> في باقة {sub.planName}.</p>
    <p className="mship-text">الإلغاء لا يُسقط الدين المتبقي ({fmtJod(sub.balanceFils)} د.أ)، ولا يُنشئ استردادًا، ولا يحذف الدفعات أو سجل الاشتراك.</p>
    {error && <Banner kind="err">{error}</Banner>}
    <div className="form-actions"><button className="button mship-danger" disabled={act.isPending} onClick={() => { setError(""); act.mutate({ id: sub.id, data: { action: "cancel" } }, { onSuccess: () => onDone("تم إلغاء الاشتراك"), onError: e => setError(errMsg(e, "تعذر الإلغاء")) }); }}>{act.isPending ? "جارٍ الإلغاء…" : "تأكيد الإلغاء"}</button><button className="button ghost" onClick={onClose} disabled={act.isPending}>تراجع</button></div>
  </Modal>;
}

/* ---------- Subscriptions page ---------- */
export function SubscriptionsPage() {
  const raw = new URLSearchParams(window.location.search).get("memberId"); const pre = raw && Number(raw) > 0 ? Number(raw) : undefined;
  return <>
    <div className="page-heading"><div><p className="eyebrow">العضويات</p><h1>الاشتراكات</h1></div></div>
    <SubscriptionManager key={pre ?? "all"} openCreate={!!pre} presetMemberId={pre} />
  </>;
}
