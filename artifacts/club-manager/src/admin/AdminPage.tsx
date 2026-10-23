import { useState, type ReactNode } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "wouter";
import "./admin.css";
import WhatsAppToggle from "./WhatsAppToggle";

const base = import.meta.env.BASE_URL.replace(/\/$/, "");
const API = `${base}/api/club/admin`;
async function req<T>(path: string, init: RequestInit = {}): Promise<T> {
  const r = await fetch(`${API}${path}`, { credentials: "same-origin", ...init, headers: { ...(init.body ? { "Content-Type": "application/json" } : {}), ...(init.headers || {}) } });
  const b = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error((b as { error?: string }).error || "تعذر تنفيذ الطلب");
  return b as T;
}
const send = (m: string, body: unknown) => ({ method: m, body: JSON.stringify(body) });
async function download(path: string, name: string) {
  const r = await fetch(`${API}${path}`, { credentials: "same-origin" });
  if (!r.ok) { const b = await r.json().catch(() => ({})); throw new Error((b as { error?: string }).error || "تعذر التنزيل"); }
  const url = URL.createObjectURL(await r.blob());
  const a = document.createElement("a"); a.href = url; a.download = name; a.click(); URL.revokeObjectURL(url);
}

type User = { id: number; email: string; displayName: string | null; role: string; status: "pending" | "active" | "rejected" | "suspended"; isOwner: boolean; permissions: string[]; permissionOverrides: Record<string, boolean>; createdAt: string };
type Role = { name: string; label: string; builtIn: boolean; permissions: string[]; assignedCount: number };
type Cat = { name: string; label: string; section: string; sectionLabel: string; action: string; actionLabel: string };
const ownerOnlySections=new Set(["settings","users","roles","backups","audit","security"]);
type Settings = { clubName: string; currency: string; timezone: string; memberRequiredFields: string[]; paymentMethods: string[]; maxDiscountPercent: number; financialYearStartMonth: number; reminderDays: number[]; renewalPolicy: string };
type Backup = { id: number; label: string; createdAt: string; createdBy: string; bytes: number; counts: Record<string, number> };
type Preview = { counts: Record<string, number>; changes: Record<string, { current: number; backup: number }>; token: string; warning: string };

const fmt = (d: string) => new Intl.DateTimeFormat("ar-JO", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Amman" }).format(new Date(d));
const statusAr: Record<string, string> = { pending: "بانتظار الموافقة", active: "فعّال", rejected: "مرفوض", suspended: "موقوف" };
const methodAr: Record<string, string> = { cash: "نقدًا", card: "بطاقة", bank_transfer: "تحويل بنكي", wallet: "محفظة" };
const roleAr: Record<string, string> = { admin: "مدير إداري", accountant: "محاسب", staff: "استقبال", coach: "مدرب" };

function Msg({ ok, err }: { ok?: string; err?: unknown }) {
  if (err) return <div className="adm-msg err" role="alert">{err instanceof Error ? err.message : "حدث خطأ"}</div>;
  return ok ? <div className="adm-msg ok" role="status">{ok}</div> : null;
}
function Load<T>({ q, children }: { q: { isLoading: boolean; error: unknown; data: T | undefined; refetch: () => unknown }; children: (d: T) => ReactNode }) {
  if (q.isLoading) return <div className="loading-panel">جارٍ التحميل…</div>;
  if (q.error || !q.data) return <div className="error-panel"><Msg err={q.error} /><button className="button ghost" onClick={() => void q.refetch()}>إعادة المحاولة</button></div>;
  return <>{children(q.data)}</>;
}

function General() {
  const links: [string, string, string][] = [
    ["/members", "المشتركون", "الملفات والبيانات"], ["/subscriptions", "الاشتراكات", "التجديد والإنهاء"], ["/subscriptions", "الديون والدفعات", "الأرصدة المستحقة وتسجيل الدفع"],
    ["/plans", "الباقات", "الأسعار والمدد"], ["/finance", "المحاسبة", "الصندوق والتصنيفات"], ["/finance", "الإيرادات والمصاريف", "الحركات المالية"],
    ["/finance", "الرواتب", "الموظفون والاستحقاقات"], ["/reports", "التقارير", "ملخصات الفترة"], ["/settings/whatsapp", "واتساب", "القوالب والربط"]];
  const ov = useQuery({ queryKey: ["admin", "overview"], queryFn: () => req<{ pendingCount: number; userCount: number }>("/overview"), refetchInterval: 10000 });
  const st = useQuery({ queryKey: ["admin", "settings"], queryFn: () => req<Settings>("/settings") });
  const qc = useQueryClient();
  const [f, setF] = useState<Settings | null>(null);
  const [days, setDays] = useState("");
  const save = useMutation({ mutationFn: (s: Settings) => req<Settings>("/settings", send("PUT", s)), onSuccess: s => { qc.setQueryData(["admin", "settings"], s); void qc.invalidateQueries({queryKey:["clubSettings"]}); setF(null); } });
  return <>
    <Load q={ov}>{o => <div className="stats-grid"><div className="stat-card"><span className="stat-title">طلبات بانتظار الموافقة</span><strong>{o.pendingCount}</strong></div><div className="stat-card"><span className="stat-title">المستخدمون</span><strong>{o.userCount}</strong></div></div>}</Load>
    <div className="panel form-panel"><h2>الإعدادات العامة</h2>
      <Load q={st}>{s0 => { const s = f ?? s0; const set = (p: Partial<Settings>) => setF({ ...s, ...p });
        const req2 = (k: string) => s.memberRequiredFields.includes(k);
        return <form onSubmit={e => { e.preventDefault(); save.mutate(s); }}>
          <div className="form-grid">
            <label>اسم النادي<input required value={s.clubName} onChange={e => set({ clubName: e.target.value })} /></label>
            <label>العملة<input readOnly value={s.currency} /></label>
            <label>المنطقة الزمنية<input readOnly value={s.timezone} /></label>
            <label>سياسة التجديد<select value={s.renewalPolicy} onChange={e=>set({renewalPolicy:e.target.value})}><option value="after_end">السماح بالتجديد المبكر دون تداخل المدد</option><option value="after_expiry_only">التجديد بعد انتهاء الاشتراك فقط</option></select></label>
            <label>الحد الأقصى للخصم (%)<input type="number" min="0" max="100" value={s.maxDiscountPercent} onChange={e => set({ maxDiscountPercent: Number(e.target.value) })} /></label>
            <label>بداية السنة المالية (شهر)<input type="number" min="1" max="12" value={s.financialYearStartMonth} onChange={e => set({ financialYearStartMonth: Number(e.target.value) })} /></label>
          </div>
          <p><strong>حقول المشترك الإلزامية</strong> <small>(الاسم والهاتف دائمًا إلزاميان)</small></p>
          {["email", "birthDate"].map(k => <label className="adm-chk" key={k}><input type="checkbox" checked={req2(k)} onChange={e => set({ memberRequiredFields: e.target.checked ? [...s.memberRequiredFields, k] : s.memberRequiredFields.filter(x => x !== k) })} />{k === "email" ? "البريد الإلكتروني" : "تاريخ الميلاد"}</label>)}
          <p><strong>طرق الدفع المفعّلة</strong></p>
          {Object.keys(methodAr).map(k => <label className="adm-chk" key={k}><input type="checkbox" checked={s.paymentMethods.includes(k)} onChange={e => set({ paymentMethods: e.target.checked ? [...s.paymentMethods, k] : s.paymentMethods.filter(x => x !== k) })} />{methodAr[k]}</label>)}
          <p><strong>أيام التذكير قبل الانتهاء</strong> <small>(0 إلى 30، مفصولة بفاصلة)</small></p>
          <input value={days || s.reminderDays.join(",")} onChange={e => { setDays(e.target.value); set({ reminderDays: e.target.value.split(",").map(x => x.trim()).filter(Boolean).map(Number) }); }} />
          <p className="adm-warn">إضافة أيام تذكير جديدة تتطلب قالب رسالة عام معتمدًا من Meta قبل أن يعمل الإرسال، ولا تعني حفظ القيمة أن الخدمة جاهزة.</p>
          <Msg err={save.error} ok={save.isSuccess && !f ? "تم حفظ الإعدادات." : undefined} />
          <button className="button primary" disabled={save.isPending || !s.paymentMethods.length}>{save.isPending ? "جارٍ الحفظ…" : "حفظ الإعدادات"}</button>
        </form>; }}</Load>
    </div>
    <WhatsAppToggle/>
    <div className="panel"><h2>الأقسام الإدارية</h2><div className="adm-grid" style={{ marginTop: 14 }}>{links.map(([h, t, d]) => <Link key={t} href={h} className="adm-link">{t}<small>{d}</small></Link>)}</div></div>
  </>;
}

function Users() {
  const qc = useQueryClient();
  const [status, setStatus] = useState(""); const [search, setSearch] = useState("");
  const catalog = useQuery({ queryKey: ["admin", "roles"], queryFn: () => req<{ roles: Role[]; catalog: Cat[] }>("/roles") });
  const q = useQuery({ queryKey: ["admin", "users", status, search], queryFn: () => req<User[]>(`/users?status=${encodeURIComponent(status)}&search=${encodeURIComponent(search)}`), refetchInterval: 10000 });
  const patch = useMutation({ mutationFn: (v: { id: number; body: object }) => req<User>(`/users/${v.id}`, send("PATCH", v.body)), onSuccess: () => { void qc.invalidateQueries({ queryKey: ["admin", "users"] }); void qc.invalidateQueries({ queryKey: ["admin", "roles"] }); void qc.invalidateQueries({ queryKey: ["admin", "overview"] }); void qc.invalidateQueries({ queryKey: ["/api/club/session"] }); } });
  return <div className="panel table-panel"><div className="table-toolbar"><h2>طلبات انضمام الموظفين</h2>
    <div className="adm-row"><select value={status} onChange={e => setStatus(e.target.value)}><option value="">كل الحالات</option>{Object.entries(statusAr).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select><div className="searchbox"><input placeholder="بحث بالاسم أو البريد" value={search} onChange={e => setSearch(e.target.value)} /></div></div></div>
    <div style={{ padding: 16 }}><Msg err={patch.error} />
      <Load q={q}>{us => us.length === 0 ? <div className="empty-state">لا توجد حسابات مطابقة.</div> : <>{us.map(u => <UserCard key={u.id} u={u} roles={catalog.data?.roles ?? []} cat={catalog.data?.catalog ?? []} busy={patch.isPending} onPatch={body => patch.mutate({ id: u.id, body })} />)}</>}</Load></div></div>;
}
function UserCard({ u, roles, cat, busy, onPatch }: { u: User; roles: Role[]; cat: Cat[]; busy: boolean; onPatch: (b: object) => void }) {
  const [role, setRole] = useState(u.role || "staff");
  const [ov, setOv] = useState<Record<string, boolean>>(u.permissionOverrides || {});
  const [open, setOpen] = useState(false);
  const cls = u.status === "active" ? "success" : u.status === "pending" ? "warn" : "muted";
  const setO = (n: string, v: string) => setOv(o => { const c = { ...o }; if (v === "inherit") delete c[n]; else c[n] = v === "allow"; return c; });
  return <div className="adm-card"><div className="adm-row" style={{ justifyContent: "space-between" }}>
    <div><h3>{u.displayName || u.email}{u.isOwner && " (المالك)"}</h3><small>{u.email} · {fmt(u.createdAt)}</small></div><span className={`status-pill ${cls}`}>{statusAr[u.status]}</span></div>
    {!u.isOwner && <>
      <div className="adm-row" style={{ marginTop: 10 }}>
        <select value={role} onChange={e => setRole(e.target.value)}>{roles.map(r => <option key={r.name} value={r.name}>{r.label}</option>)}{!roles.length && <option value={role}>{roleAr[role] || role}</option>}</select>
        {u.status === "pending" && <><button className="button primary" disabled={busy} onClick={() => onPatch({ status: "active", role, permissionOverrides: ov })}>موافقة</button><button className="button ghost" disabled={busy} onClick={() => window.confirm("رفض هذا الطلب؟") && onPatch({ status: "rejected" })}>رفض</button></>}
        {u.status === "active" && <><button className="button ghost" disabled={busy} onClick={() => onPatch({ role, permissionOverrides: ov })}>حفظ الدور والصلاحيات</button><button className="button ghost" disabled={busy} onClick={() => window.confirm("إيقاف هذا المستخدم؟") && onPatch({ status: "suspended" })}>إيقاف</button></>}
        {(u.status === "suspended" || u.status === "rejected") && <button className="button primary" disabled={busy} onClick={() => onPatch({ status: "active", role, permissionOverrides: ov })}>إعادة التفعيل</button>}
        <button className="mini-button" onClick={() => setOpen(!open)}>{open ? "إخفاء" : "استثناءات الصلاحيات"}</button></div>
      {open && <><p className="muted">دون تخصيص تُورث الصلاحية من الدور. عند التخصيص اختر السماح أو اتركه غير محدد للمنع. إدارة الأمان والموافقات والأدوار والنسخ والإعدادات محصورة بالمالك.</p><div className="adm-ovr">{cat.filter(c=>!ownerOnlySections.has(c.section)).map(c=><fieldset key={c.name}><legend style={{fontSize:12}}>{c.sectionLabel} · {c.actionLabel}</legend><label className="adm-chk"><input type="checkbox" checked={c.name in ov} onChange={e=>setO(c.name,e.target.checked?"allow":"inherit")}/>تخصيص {c.label}</label>{c.name in ov?<label className="adm-chk"><input type="checkbox" checked={ov[c.name]===true} onChange={e=>setO(c.name,e.target.checked?"allow":"deny")}/>سماح {c.label}</label>:<small>وراثة من الدور</small>}</fieldset>)}</div></>}
    </>}</div>;
}

function Roles() {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["admin", "roles"], queryFn: () => req<{ roles: Role[]; catalog: Cat[] }>("/roles") });
  const done = () => { void qc.invalidateQueries({ queryKey: ["admin", "roles"] }); void qc.invalidateQueries({ queryKey: ["admin", "users"] }); void qc.invalidateQueries({ queryKey: ["/api/club/session"] }); };
  const save = useMutation({ mutationFn: (v: { name: string; label?: string; permissions: string[]; create?: boolean }) => v.create ? req("/roles", send("POST", { name: v.name, label: v.label, permissions: v.permissions })) : req(`/roles/${v.name}`, send("PATCH", { label: v.label, permissions: v.permissions })), onSuccess: done });
  const del = useMutation({ mutationFn: (n: string) => req(`/roles/${n}`, { method: "DELETE" }), onSuccess: done });
  const [nn, setNn] = useState(""); const [nl, setNl] = useState("");
  return <><Msg err={save.error || del.error} />
    <Load q={q}>{d => <>{d.roles.map(r => <RoleCard key={r.name} r={r} cat={d.catalog} busy={save.isPending} onSave={(label, permissions) => save.mutate({ name: r.name, label, permissions })} onDelete={() => window.confirm(`حذف الدور «${r.label}»؟`) && del.mutate(r.name)} />)}
      <form className="panel form-panel" onSubmit={e => { e.preventDefault(); save.mutate({ name: nn, label: nl, permissions: [], create: true }, { onSuccess: () => { setNn(""); setNl(""); } }); }}><h2>دور مخصص جديد</h2>
        <div className="form-grid"><label>المعرّف (أحرف إنجليزية صغيرة و _)<input required pattern="[a-z][a-z0-9_]*" value={nn} onChange={e => setNn(e.target.value)} dir="ltr" /></label><label>الاسم الظاهر<input required value={nl} onChange={e => setNl(e.target.value)} /></label></div>
        <button className="button primary" disabled={save.isPending}>إنشاء الدور</button></form></>}</Load></>;
}
function RoleCard({ r, cat, busy, onSave, onDelete }: { r: Role; cat: Cat[]; busy: boolean; onSave: (l: string, p: string[]) => void; onDelete: () => void }) {
  const [label, setLabel] = useState(r.label); const [perms, setPerms] = useState(r.permissions);
   const secs = [...new Set(cat.filter(c=>!ownerOnlySections.has(c.section)).map(c => c.section))];
  return <div className="panel form-panel"><div className="adm-row" style={{ justifyContent: "space-between" }}><div><h2>{r.label}</h2><small>{r.builtIn ? "دور أساسي" : "دور مخصص"} · {r.assignedCount} مستخدم</small></div>
    <div className="adm-row">{!r.builtIn && <input value={label} onChange={e => setLabel(e.target.value)} aria-label="اسم الدور" />}
      {!r.builtIn && <button className="button ghost" disabled={busy || r.assignedCount > 0} title={r.assignedCount ? "الدور مُسند لمستخدمين" : ""} onClick={onDelete}>حذف</button>}</div></div>
    <div className="adm-matrix">{secs.map(s => { const items = cat.filter(c => c.section === s); return <fieldset key={s}><legend>{items[0].sectionLabel}</legend>{items.map(c => <label key={c.name}><input type="checkbox" checked={perms.includes(c.name)} onChange={e => setPerms(e.target.checked ? [...perms, c.name] : perms.filter(x => x !== c.name))} />{c.actionLabel}</label>)}</fieldset>; })}</div>
    <button className="button primary" disabled={busy} onClick={() => onSave(label, perms)}>حفظ الصلاحيات</button></div>;
}

function Financial() {
  return <div className="panel"><h2>الإعدادات المالية</h2><p className="muted">الإدارة الفعلية تتم عبر الشاشات القائمة، ولا تُكرَّر هنا. صلاحيات المالية لا تُمنح افتراضيًا، والمالك وحده يملك وصولًا كاملًا ضمنيًا.</p>
    <div className="adm-grid"><Link href="/plans" className="adm-link">الباقات والأسعار<small>إضافة وتعديل الباقات</small></Link><Link href="/finance" className="adm-link">التصنيفات والحركات<small>إيرادات ومصاريف</small></Link><Link href="/finance" className="adm-link">الموظفون والرواتب<small>الاستحقاق والصرف</small></Link><Link href="/reports" className="adm-link">التقارير<small>ملخصات الفترة</small></Link></div>
    <p className="muted">طرق الدفع والحد الأقصى للخصم وبداية السنة المالية تُضبط من تبويب «عام».</p></div>;
}

function Audit() {
  const [page, setPage] = useState(1); const [search, setSearch] = useState(""); const [err, setErr] = useState<unknown>();
  const q = useQuery({ queryKey: ["admin", "audit", page, search], queryFn: () => req<{ items: { id: number; actorName: string | null; action: string; entityType: string; entityId: number | null; details: object; createdAt: string }[]; total: number; page: number }>(`/audit?page=${page}&search=${encodeURIComponent(search)}`) });
  const [openId, setOpenId] = useState<number | null>(null);
  return <div className="panel table-panel"><div className="table-toolbar"><h2>سجل التدقيق</h2><div className="adm-row"><div className="searchbox"><input placeholder="بحث" value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} /></div>
    <button className="button ghost" onClick={() => { setErr(undefined); download("/audit?format=csv", "audit.csv").catch(setErr); }}>تصدير CSV</button></div></div>
    <div style={{ padding: 16 }}><Msg err={err} /><Load q={q}>{d => d.items.length === 0 ? <div className="empty-state">لا توجد سجلات.</div> : <>
      {d.items.map(i => <div className="adm-card" key={i.id}><div className="adm-row" style={{ justifyContent: "space-between" }}><div><h3>{i.action}</h3><small>{i.actorName || "النظام"} · {i.entityType}{i.entityId ? ` #${i.entityId}` : ""} · {fmt(i.createdAt)}</small></div><button className="mini-button" onClick={() => setOpenId(openId === i.id ? null : i.id)}>{openId === i.id ? "إخفاء" : "التفاصيل"}</button></div>{openId === i.id && <pre className="adm-pre">{JSON.stringify(i.details, null, 2)}</pre>}</div>)}
      <div className="adm-row"><button className="button ghost" disabled={page <= 1} onClick={() => setPage(page - 1)}>السابق</button><span>صفحة {d.page} من {Math.max(1, Math.ceil(d.total / 20))}</span><button className="button ghost" disabled={d.page * 20 >= d.total} onClick={() => setPage(page + 1)}>التالي</button></div></>}</Load></div></div>;
}

function Backups() {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["admin", "backups"], queryFn: () => req<Backup[]>("/backups") });
  const refresh = () => void qc.invalidateQueries({ queryKey: ["admin", "backups"] });
  const [label, setLabel] = useState(""); const [err, setErr] = useState<unknown>(); const [ok, setOk] = useState("");
  const create = useMutation({ mutationFn: () => req<Backup>("/backups", send("POST", { label: label || undefined })), onSuccess: () => { setLabel(""); setOk("تم إنشاء النسخة."); refresh(); }, onError: setErr });
  const imp = useMutation({ mutationFn: (file: string) => req<Backup>("/backups/import", send("POST", { file })), onSuccess: () => { setOk("تم استيراد النسخة. لم تُستعد البيانات."); refresh(); }, onError: setErr });
  const [sel, setSel] = useState<Backup | null>(null);
  const [prev, setPrev] = useState<Preview | null>(null);
  const [typed, setTyped] = useState(""); const [sure, setSure] = useState(false);
  const preview = useMutation({ mutationFn: (b: Backup) => req<Preview>(`/backups/${b.id}/preview`, send("POST", {})), onSuccess: (p, b) => { setPrev(p); setSel(b); setTyped(""); setSure(false); }, onError: setErr });
  const restore = useMutation({ mutationFn: () => req<{ ok: true; preRestoreBackupId: number }>(`/backups/${sel!.id}/restore`, send("POST", { token: prev!.token, confirmation: `استعادة ${sel!.id}` })), onSuccess: r => { setOk(`تمت الاستعادة. رقم النسخة التلقائية قبل الاستعادة: ${r.preRestoreBackupId}`); setPrev(null); setSel(null); void qc.invalidateQueries(); }, onError: setErr });
  function onFile(f?: File) { if (!f) return; if (f.size > 12 * 1024 * 1024) { setErr(new Error("الملف أكبر من 12 ميغابايت")); return; } setErr(undefined); void f.text().then(t => imp.mutate(t)); }
  return <>
    <div className="adm-warn" style={{ marginBottom: 14 }}>النسخ المحفوظة داخل قاعدة البيانات وحدها ليست حماية من الكوارث. نزّل النسخ المشفرة (AES-256-GCM) واحتفظ بها خارج النظام، واحفظ مفتاح SESSION_SECRET في مكان آمن؛ لا تُدخله هنا أبدًا.</div>
    <Msg err={err} ok={ok} />
    <div className="panel form-panel"><h2>نسخة جديدة</h2><div className="adm-row" style={{ marginTop: 12 }}><input placeholder="وصف اختياري" value={label} onChange={e => setLabel(e.target.value)} /><button className="button primary" disabled={create.isPending} onClick={() => { setErr(undefined); setOk(""); create.mutate(); }}>{create.isPending ? "جارٍ الإنشاء…" : "إنشاء نسخة مشفرة"}</button>
      <label className="button ghost">استيراد ملف نسخة<input type="file" accept=".json,application/json" hidden disabled={imp.isPending} onChange={e => { onFile(e.target.files?.[0]); e.target.value = ""; }} /></label></div></div>
    <div className="panel"><h2>النسخ المتوفرة</h2><Load q={q}>{bs => bs.length === 0 ? <div className="empty-state">لا توجد نسخ بعد.</div> : <>{bs.map(b => <div className="adm-card" key={b.id}><div className="adm-row" style={{ justifyContent: "space-between" }}><div><h3>#{b.id} {b.label}</h3><small>{fmt(b.createdAt)} · {b.createdBy} · {(b.bytes / 1024).toFixed(1)} ك.ب</small><br /><small>{Object.entries(b.counts).map(([k, v]) => `${k}: ${v}`).join(" · ")}</small></div>
      <div className="adm-row"><button className="button ghost" onClick={() => { setErr(undefined); download(`/backups/${b.id}/file`, `backup-${b.id}.json`).catch(setErr); }}>تنزيل</button><button className="button ghost" disabled={preview.isPending} onClick={() => { setErr(undefined); setOk(""); preview.mutate(b); }}>معاينة الاستعادة</button></div></div></div>)}</>}</Load></div>
    {sel && prev && <div className="panel form-panel" style={{ borderColor: "#b9382f" }}><h2>استعادة النسخة #{sel.id}</h2><p className="adm-warn">{prev.warning}</p>
      <div className="table-scroll"><table><thead><tr><th>الجدول</th><th>الحالي</th><th>في النسخة</th></tr></thead><tbody>{Object.entries(prev.changes).map(([k, v]) => <tr key={k}><td>{k}</td><td>{v.current}</td><td>{v.backup}</td></tr>)}</tbody></table></div>
      <p>سيتم إنشاء نسخة تلقائية قبل الاستعادة. اكتب العبارة التالية للتأكيد: <strong>استعادة {sel.id}</strong></p>
      <input value={typed} onChange={e => setTyped(e.target.value)} aria-label="عبارة التأكيد" />
      <label className="adm-chk" style={{ display: "flex", marginTop: 10 }}><input type="checkbox" checked={sure} onChange={e => setSure(e.target.checked)} />أفهم أن البيانات الحالية للأعمال ستُستبدل</label>
      <div className="adm-row"><button className="button adm-danger" disabled={restore.isPending || typed.trim() !== `استعادة ${sel.id}` || !sure} onClick={() => { setErr(undefined); restore.mutate(); }}>{restore.isPending ? "جارٍ الاستعادة…" : "استعادة الآن"}</button><button className="button ghost" onClick={() => { setPrev(null); setSel(null); }}>إلغاء</button></div></div>}
  </>;
}

function Security() {
  const q = useQuery({ queryKey: ["admin", "security"], queryFn: () => req<{ authProvider: string; requiresApproval: boolean; financialDefault: string; ownerProtected: boolean; backupEncryption: string; backupAvailable: boolean; sessionPolicySource: string }>("/security") });
  return <div className="panel"><h2>الأمان</h2><Load q={q}>{s => <>
    {[["مزود تسجيل الدخول", s.authProvider], ["الموافقة على الحسابات الجديدة", s.requiresApproval ? "مطلوبة" : "غير مطلوبة"], ["الصلاحيات المالية الافتراضية", s.financialDefault === "deny" ? "ممنوعة" : s.financialDefault], ["حماية حساب المالك", s.ownerProtected ? "مفعّلة" : "غير مفعّلة"], ["تشفير النسخ الاحتياطية", s.backupEncryption], ["النسخ الاحتياطي", s.backupAvailable ? "متاح" : "غير متاح"], ["سياسة الجلسات", `تُدار عبر ${s.sessionPolicySource}`]].map(([k, v]) => <div className="compact-row" key={k}><div><strong>{k}</strong></div><span className="status-pill muted">{v}</span></div>)}
    <p className="muted">هذه القيم للقراءة فقط وتعكس إعدادات الخادم الفعلية. تغيير كلمة المرور وإدارة الحساب تتم من صفحة حسابك.</p><Link href="/account" className="button primary">إدارة الحساب وكلمة المرور</Link></>}</Load></div>;
}

const tabs = [["general", "عام"], ["users", "المستخدمون"], ["roles", "الأدوار"], ["financial", "الإعدادات المالية"], ["audit", "التدقيق"], ["backups", "النسخ الاحتياطي"], ["security", "الأمان"]] as const;
export function AdminPage() {
  const [tab, setTab] = useState<(typeof tabs)[number][0]>("general");
  return <><div className="page-heading"><div><p className="eyebrow">المالك</p><h1>إدارة النظام</h1></div></div>
    <div className="adm-tabs" role="tablist">{tabs.map(([k, l]) => <button key={k} role="tab" aria-selected={tab === k} className={`button ${tab === k ? "primary" : "ghost"}`} onClick={() => setTab(k)}>{l}</button>)}</div>
    {tab === "general" && <General />}{tab === "users" && <Users />}{tab === "roles" && <Roles />}{tab === "financial" && <Financial />}{tab === "audit" && <Audit />}{tab === "backups" && <Backups />}{tab === "security" && <Security />}</>;
}
export default AdminPage;
