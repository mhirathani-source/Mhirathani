import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { QueryClient, QueryClientProvider, useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ClerkProvider, SignIn, SignUp, UserProfile, useClerk, useUser } from "@clerk/react";
import { publishableKeyFromHost } from "@clerk/react/internal";
import { arSA } from "@clerk/localizations";
import QRCode from "qrcode";
import {
  getGetClubSessionQueryKey, getGetFinancePeriodReportQueryKey,
  getGetFinanceReportQueryKey, getGetMemberQueryKey, getGetPaymentReceiptQueryKey, getGetCashRegisterQueryKey,
  getListMembersQueryKey, getListPlansQueryKey, getListFinanceCategoriesV2QueryKey,
  getListFinanceTransactionsV2QueryKey, getListEmployeesV2QueryKey, getListPayrollV2QueryKey,
  setBaseUrl, useActOnSubscription, useCreateEmployeeV2, useCreateFinanceCategoryV2, useCreateFinanceTransactionV2,
  useCreateMember, useCreatePlan, useCreateSubscription, useCreateSubscriptionPayment, useCreatePayrollV2,
  useGetClubDashboard, useGetClubOverview, useGetClubSession, useGetFinancePeriodReport, useGetFinanceReport,
  useGetMember, useGetMemberProfile, useGetPaymentReceipt, useGetCashRegister, useListEmployeesV2,
  useListFinanceCategoriesV2, useListFinanceTransactionsV2, useListMembers, useListPlans, useListPayrollV2,
  useListSubscriptions, useRecordCashMovement, useRecordPayrollPayment, useUpdateEmployee, useUpdateFinanceCategory,
  useUpdateFinanceTransaction, useUpdateMember, useUpdatePlan, useUpdateSubscription,
  useDeleteMember,
} from "@workspace/api-client-react";
import type { Member, Plan, Subscription, ManagedEmployee, ManagedFinanceTransaction } from "@workspace/api-client-react";
import {
  Activity, ArrowDownLeft, ArrowUpLeft, BadgeCheck, Banknote, Bell, ChartNoAxesCombined,
  Check, ChevronDown, ClipboardList, Clock3, CreditCard, Download, LayoutDashboard,
  LogOut, Menu, MessageCircle, Plus, Printer, RefreshCw, Search, Settings, ShieldCheck, Users,
  Wallet, Tags, BriefcaseBusiness, UserRound, CircleHelp, ClipboardCheck, QrCode,
} from "lucide-react";
import { Link, Redirect, Route, Router, Switch, useLocation, useParams } from "wouter";

const base = import.meta.env.BASE_URL.replace(/\/$/, "");
setBaseUrl(base);
const clerkKey = publishableKeyFromHost(window.location.hostname, import.meta.env.VITE_CLERK_PUBLISHABLE_KEY);
const clerkProxyUrl = import.meta.env.PROD
  ? `${window.location.origin}${base}/api/__clerk`
  : undefined;
const queryClient = new QueryClient({ defaultOptions: { queries: { retry: 1, refetchOnWindowFocus: true } } });
const logo = `${base}/iraq-alameer-logo.png`;
const today = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Amman" }).format(new Date());
const jod = (fils: number, compact = false) => (fils / 1000).toLocaleString("ar-JO", { minimumFractionDigits: compact ? 0 : 3, maximumFractionDigits: compact ? 0 : 3 });
function Money({ fils, compact = false }: { fils: number; compact?: boolean }) { return <>{jod(fils, compact)} <small>د.أ</small></>; }
function errorText(error: unknown) {
  const e = error as { message?: string; data?: { error?: string }; status?: number };
  if (e?.data?.error) return e.data.error;
  if (e?.status === 403) return "ليست لديك صلاحية لتنفيذ هذا الإجراء";
  return e?.message || "تعذر إتمام العملية. تحقق من البيانات ثم أعد المحاولة.";
}
function toFils(raw: string) {
  const text = raw.trim().replace(",", ".");
  if (!/^\d+(\.\d{1,3})?$/.test(text)) return null;
  const value = Math.round(Number(text) * 1000);
  return Number.isSafeInteger(value) && value <= 2_000_000_000 ? value : null;
}
async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(`${base}/api${path}`, { credentials: "same-origin", ...init, headers: { ...(init.body ? { "Content-Type": "application/json" } : {}), ...init.headers } });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error((body as { error?: string }).error || "تعذر تنفيذ الطلب");
  return body as T;
}
function csvDownload(name: string, headers: string[], rows: Array<Array<string | number>>) {
  const quote = (v: string | number) => `"${String(v).replaceAll('"', '""')}"`;
  const content = [headers.map(quote).join(","), ...rows.map(row => row.map(quote).join(","))].join("\r\n");
  const url = URL.createObjectURL(new Blob(["\uFEFF", content], { type: "text/csv;charset=utf-8" }));
  const anchor = document.createElement("a"); anchor.href = url; anchor.download = name; anchor.click(); window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
function downloadApi(path: string, name: string) {
  return fetch(`${base}/api${path}`, { credentials: "same-origin" }).then(async response => {
    if (!response.ok) throw new Error(((await response.json().catch(() => ({}))) as { error?: string }).error || "تعذر تنزيل الملف");
    const url = URL.createObjectURL(await response.blob()); const a = document.createElement("a"); a.href = url; a.download = name; a.click(); window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  });
}

const nav: {href:string;label:string;icon:typeof Users;permission:string;alternatePermission?:string}[] = [
  { href: "/dashboard", label: "لوحة التحكم", icon: LayoutDashboard, permission: "dashboard.view" },
  { href: "/members", label: "المشتركون", icon: Users, permission: "members.view" },
  { href: "/subscriptions", label: "الاشتراكات", icon: BadgeCheck, permission: "subscriptions.view" },
  { href: "/plans", label: "الباقات", icon: ClipboardList, permission: "plans.view" },
  { href: "/attendance", label: "الحضور", icon: ClipboardCheck, permission: "members.view", alternatePermission: "members.edit" },
  { href: "/finance", label: "المالية والرواتب", icon: Wallet, permission: "finance.view" },
  { href: "/reports", label: "التقارير", icon: ChartNoAxesCombined, permission: "reports.view" },
  { href: "/settings/whatsapp", label: "واتساب", icon: MessageCircle, permission: "whatsapp.view" },
  { href: "/admin", label: "إدارة النظام", icon: Settings, permission: "owner" },
];
function Shell({ children }: { children: ReactNode }) {
  const { signOut } = useClerk();
  const session = useGetClubSession({ query: { queryKey: getGetClubSessionQueryKey(), retry: false, refetchInterval: 30000 } });
  const [where] = useLocation();
  const [mobile, setMobile] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const can = (...perms: string[]) => !!session.data && session.data.status === "active" && (!!session.data.isOwner || perms.every(p => session.data?.permissions.includes(p)));
  useEffect(() => { setMobile(false); }, [where]);
  useEffect(() => {
    const close = (e: KeyboardEvent) => { if (e.key === "Escape") setMobile(false); };
    window.addEventListener("keydown", close); return () => window.removeEventListener("keydown", close);
  }, []);
  const visible = nav.filter(item => item.permission === "owner" ? !!session.data?.isOwner : can(item.permission) || (!!item.alternatePermission && can(item.alternatePermission)));
  const label = session.data?.email?.split("@")[0] || "حساب النادي";
  return <div className={`app-frame ${mobile ? "menu-open" : ""} ${collapsed ? "rail-collapsed" : ""}`} dir="rtl">
    {mobile && <button className="mobile-scrim" aria-label="إغلاق القائمة" onClick={() => setMobile(false)} />}
    <aside className="side-rail" aria-label="التنقل الرئيسي">
      <Link href="/dashboard" className="brand-lockup"><img src={logo} alt="شعار نادي عراق الأمير"/><span><strong>IRAQ ALAMEER</strong><small>نظام إدارة النادي</small></span></Link>
      <span className="nav-caption">مساحة العمل</span>
      <nav className="rail-nav">{visible.map((item, index) => {
        const Icon = item.icon; const active = where === item.href || (item.href === "/members" && where.startsWith("/members/"));
        return <Link key={item.href} href={item.href} className={`rail-link ${active ? "active" : ""}`} aria-current={active ? "page" : undefined}><Icon/><span>{item.label}</span><small className="nav-number">{String(index + 1).padStart(2, "0")}</small></Link>;
      })}</nav>
      <div className="rail-foot">
        <div className="rail-user"><span className="avatar-mark">{label.slice(0, 1).toUpperCase()}</span><span><strong>{label}</strong><small>{session.data?.isOwner ? "مدير النادي" : session.data?.role || "عضو الفريق"}</small></span><i className="online-indicator"/></div>
        <Link href="/account" className="rail-link"><UserRound/><span>حسابي</span></Link>
        <button className="rail-link rail-collapse" type="button" aria-label={collapsed?"توسيع القائمة":"طي القائمة"} aria-expanded={!collapsed} onClick={()=>setCollapsed(v=>!v)}><ChevronDown/><span>{collapsed?"توسيع القائمة":"طي القائمة"}</span></button>
        <button className="rail-link rail-signout" type="button" onClick={() => void signOut({ redirectUrl: base || "/" })}><LogOut/><span>إنهاء الجلسة</span></button>
      </div>
    </aside>
    <main className="app-main">
      <header className="topbar"><div className="topbar-leading"><button className="icon-button mobile-menu" aria-label="فتح القائمة" onClick={() => setMobile(true)}><Menu size={17}/></button><span className="topbar-date">{new Intl.DateTimeFormat("ar-IQ", { weekday: "long", day: "numeric", month: "long", timeZone: "Asia/Amman" }).format(new Date())}</span><span className="connection-state"><i/> مساحة النادي</span></div><div className="topbar-actions"><span className="topbar-user">{session.data?.role || "بوابة الإدارة"}</span><button type="button" className="icon-button" title="إعادة تحميل الجلسة" aria-label="تحديث الجلسة" onClick={() => void session.refetch()}><RefreshCw size={15}/></button></div></header>
      <section className="page-wrap">{children}</section>
    </main>
  </div>;
}

function PageTitle({ overline, title, subtitle, children }: { overline: string; title: string; subtitle?: string; children?: ReactNode }) {
  return <div className="page-title"><div><p className="eyebrow">{overline}</p><h1>{title}</h1>{subtitle && <p className="page-subtitle">{subtitle}</p>}</div>{children && <div className="title-tools">{children}</div>}</div>;
}
function Empty({ title, detail }: { title: string; detail?: string }) { return <div className="empty-block"><ClipboardList/><strong>{title}</strong>{detail && <p>{detail}</p>}</div>; }
function Loading({ label = "جارٍ تحميل بيانات النادي" }: { label?: string }) { return <div className="loading-wrap" role="status" aria-label={label}><div className="loading-skeleton"/><div className="loading-skeleton"/><div className="loading-skeleton"/></div>; }
function ErrorBox({ message, retry }: { message: string; retry?: () => unknown }) { return <div className="notice error" role="alert">{message}{retry && <button type="button" className="mini-action" onClick={() => void retry()}>إعادة المحاولة</button>}</div>; }
function Status({ value }: { value: string }) {
  const names: Record<string, [string, string]> = { active:["نشط","good"],paused:["موقوف مؤقتًا","warn"],expired:["منتهي",""],cancelled:["ملغي",""],paid:["مدفوع","good"],due:["مستحق","warn"],partial:["مدفوع جزئيًا","warn"],pending:["بانتظار الموافقة","warn"],suspended:["موقوف","bad"],rejected:["مرفوض","bad"] };
  const [label, tone] = names[value] || [value, ""];
  return <span className={`pill ${tone}`}>{label}</span>;
}
function StatCard({ icon: Icon, title, value, note }: { icon: typeof Users; title: string; value: ReactNode; note?: string }) { return <article className="metric"><div className="metric-top"><span>{title}</span><span className="metric-icon"><Icon size={16}/></span></div><strong>{value}</strong><small>{note}</small></article>; }

function Landing() {
  const {isLoaded,isSignedIn}=useUser();
  if(isLoaded&&isSignedIn)return <Redirect to="/dashboard"/>;
  return <main className="auth-stage" dir="rtl"><div className="auth-brand-side"><div className="auth-brand-copy"><img src={logo} alt="شعار نادي عراق الأمير"/><h1>نادي عراق الأمير</h1><p>إدارة النادي. تدريب أفضل. يوم أوضح.</p></div></div><div className="auth-form-side"><section className="auth-card"><Link href="/" className="brand-lockup"><img src={logo} alt=""/><span><strong>IRAQ ALAMEER CLUB</strong><small>مساحة العمل الرسمية للنادي</small></span></Link><p className="eyebrow">بوابة الفريق</p><h2>إدارة النادي من مكان واحد.</h2><p>منظومة موحدة للمشتركين والاشتراكات والحضور والمالية والموظفين. الدخول متاح لحسابات الفريق المعتمدة فقط.</p><div className="auth-cta"><Link className="primary-button" href="/sign-in">تسجيل الدخول</Link><Link className="outline-button" href="/sign-up">طلب حساب فريق</Link></div><div className="auth-footnote"><ShieldCheck size={15}/> لا يتم عرض بيانات النادي قبل التحقق من صلاحية الحساب.</div></section></div></main>;
}
function AuthPage({ signup = false }: { signup?: boolean }) {
  return <main className="auth-stage" dir="rtl"><div className="auth-brand-side"><div className="auth-brand-copy"><img src={logo} alt="شعار نادي عراق الأمير"/><h1>نادي عراق الأمير</h1><p>أمان الوصول يبدأ من حساب النادي المعتمد.</p></div></div><div className="auth-form-side"><section className="auth-card"><Link href="/" className="back-link">العودة إلى صفحة الدخول</Link><p className="eyebrow">{signup ? "انضم إلى فريق النادي" : "وصول آمن"}</p><h2>{signup ? "طلب إنشاء حساب" : "تسجيل الدخول"}</h2><p>{signup ? "حسابات الموظفين الجديدة تخضع لمراجعة المدير." : "استخدم بيانات حساب الفريق المعتمد."}</p>
    <div className="clerk-card">{signup ? <SignUp routing="path" path={`${base}/sign-up`} signInUrl={`${base}/sign-in`} forceRedirectUrl={`${base}/dashboard`} appearance={{variables:{colorPrimary:"#17863f",colorBackground:"#ffffff",colorForeground:"#15243b",fontFamily:'"IBM Plex Sans Arabic", sans-serif',borderRadius:"0.8rem"}}}/> : <SignIn routing="path" path={`${base}/sign-in`} signUpUrl={`${base}/sign-up`} forceRedirectUrl={`${base}/dashboard`} appearance={{variables:{colorPrimary:"#17863f",colorBackground:"#ffffff",colorForeground:"#15243b",fontFamily:'"IBM Plex Sans Arabic", sans-serif',borderRadius:"0.8rem"}}}/>}</div>
  </section></div></main>;
}

function Dashboard() {
  const q = useGetClubDashboard();
  const basic = useGetClubOverview();
  const session = useGetClubSession();
  const can = (...p: string[]) => !!session.data?.isOwner || p.every(x => session.data?.permissions.includes(x));
  const d = q.data;
  if (q.isLoading && !d) return <><PageTitle overline="نظرة عامة" title="لوحة النادي"/><Loading/></>;
  if (q.isError && !d) return <><PageTitle overline="نظرة عامة" title="لوحة النادي"/><ErrorBox message={errorText(q.error)} retry={() => q.refetch()}/></>;
  return <div className="dashboard-page">
    <PageTitle overline="مساحة عراق الأمير · الإدارة اليومية" title="صباح النادي يبدأ من هنا" subtitle="ملخص مباشر من سجلات النادي المحفوظة."><button className="outline-button" onClick={() => { void q.refetch(); void basic.refetch(); }}><RefreshCw size={14}/> تحديث</button><button className="outline-button" onClick={() => window.print()}><Printer size={14}/> طباعة</button></PageTitle>
    <section className="hero-panel"><div className="hero-copy"><p className="eyebrow">IRAQ ALAMEER CLUB</p><h2>كل تفاصيل التشغيل،<br/>بصورة واحدة.</h2><p>تابع العضويات والتحصيلات والتنبيهات اليومية من مصدر واحد موثوق.</p><div className="hero-actions">{can("members.create") && <Link className="primary-button" href="/members"><Plus size={15}/> تسجيل مشترك</Link>}{can("subscriptions.create") && <Link className="outline-button hero-outline" href="/subscriptions"><BadgeCheck size={15}/> اشتراك جديد</Link>}</div></div><div className="hero-medal"><img src={logo} alt="شعار نادي عراق الأمير"/></div></section>
    {d ? <>
      <div className="metric-grid">
        <StatCard icon={Users} title="إجمالي المشتركين" value={d.totalMembers.toLocaleString("ar-IQ")} note="كل السجلات المسجلة"/>
        <StatCard icon={BadgeCheck} title="عضويات نشطة" value={d.activeMembers.toLocaleString("ar-IQ")} note="لديهم اشتراك ساري"/>
        <StatCard icon={Clock3} title="تنتهي خلال أسبوع" value={d.endingWithin7Days.toLocaleString("ar-IQ")} note={`${d.endingSoon.toLocaleString("ar-IQ")} تنتهي خلال يومين`}/>
        <StatCard icon={Wallet} title="المستحقات" value={<Money fils={d.outstandingFils} compact/>} note={`${d.outstandingMembers.length} حسابًا برصيد مستحق`}/>
        <StatCard icon={Banknote} title="تحصيل هذا الشهر" value={<Money fils={d.monthlyCollectedFils} compact/>} note="من الدفعات المسجلة"/>
        <StatCard icon={Activity} title="اشتراكات منتهية" value={d.expiredSubscriptions.toLocaleString("ar-IQ")} note="تحتاج مراجعة"/>
        <StatCard icon={CreditCard} title="عمليات الدفع" value={d.totalPaymentOperations.toLocaleString("ar-IQ")} note="سجل الدفعات بالكامل"/>
        <StatCard icon={ChartNoAxesCombined} title="اشتراكات جديدة" value={d.newSubscriptionsThisMonth.toLocaleString("ar-IQ")} note="منذ بداية الشهر"/>
      </div>
      <div className="grid-two">
        <section className="surface"><div className="surface-head"><div><h2>الاشتراكات التي تحتاج متابعة</h2><p>انتهاء قريب أو رصيد مستحق</p></div><Bell size={17}/></div><div className="surface-body">
          {d.expiringSubscriptions.length ? d.expiringSubscriptions.slice(0,5).map(row=><Link className="list-row" href={`/members/${row.memberId}`} key={row.subscriptionId}><span className="avatar-mark soft-mark">{row.memberName.slice(0,1)}</span><span className="list-row-main"><strong>{row.memberName}</strong><small>{row.planName} · {row.endDate}</small></span><Status value="active"/><ChevronDown size={14}/></Link>) : <Empty title="لا توجد عضويات قاربت على الانتهاء" detail="ستظهر التنبيهات هنا عند توفر سجلات منتهية قريبًا."/>}
        </div></section>
        <section className="surface"><div className="surface-head"><div><h2>أحدث التحصيلات</h2><p>آخر دفعات من سجل النادي</p></div><Link href="/subscriptions" className="panel-link">كل الاشتراكات</Link></div><div className="surface-body">
          {d.recentPayments.length ? d.recentPayments.slice(0,5).map(p=><div className="list-row" key={p.paymentId}><span className="activity-dot"><Banknote size={15}/></span><span className="list-row-main"><strong>{p.memberName}</strong><small>{p.method} · {new Date(p.createdAt).toLocaleDateString("ar-IQ",{timeZone:"Asia/Amman"})}</small></span><strong><Money fils={p.amountFils}/></strong></div>) : <Empty title="لا توجد دفعات بعد" detail="لن تظهر أرقام افتراضية هنا."/>}
        </div></section>
      </div>
      <div className="grid-two">
        <section className="surface"><div className="surface-head"><div><h2>أحدث المشتركين</h2><p>من قاعدة بيانات النادي</p></div><Link href="/members" className="panel-link">سجل المشتركين</Link></div><div className="surface-body">{d.recentMembers.length ? d.recentMembers.slice(0,5).map(m=><Link className="list-row" href={`/members/${m.id}`} key={m.id}><span className="avatar-mark soft-mark">{m.name.slice(0,1)}</span><span className="list-row-main"><strong>{m.name}</strong><small dir="ltr">{m.phone}</small></span><Status value={m.active ? "active" : "suspended"}/></Link>) : <Empty title="لم يُسجل مشتركون بعد" detail="أضف أول ملف مشترك من صفحة المشتركين."/>}</div></section>
        <section className="surface"><div className="surface-head"><div><h2>المبالغ المستحقة</h2><p>الأرصدة الأعلى حسب السجل</p></div><Wallet size={16}/></div><div className="surface-body">{d.outstandingMembers.length ? d.outstandingMembers.slice(0,5).map(m=><Link className="list-row" href={`/members/${m.memberId}`} key={m.memberId}><span className="list-row-main"><strong>{m.memberName}</strong><small dir="ltr">{m.phone}</small></span><strong className="money-alert"><Money fils={m.outstandingFils}/></strong></Link>) : <Empty title="لا توجد أرصدة مستحقة" detail="الرصيد يعتمد على الاشتراكات والدفعات المسجلة."/>}</div></section>
      </div>
      <footer className="data-footer"><span className="live-dot"/> بيانات تشغيلية ومالية مباشرة من قاعدة النادي <span>القيم المالية بالدينار الأردني</span></footer>
    </> : basic.data ? <div className="metric-grid"><StatCard icon={Users} title="مشتركون نشطون" value={basic.data.activeMembers}/><StatCard icon={Clock3} title="تنتهي قريبًا" value={basic.data.endingSoon}/><StatCard icon={BadgeCheck} title="اشتراكات منتهية" value={basic.data.expiredSubscriptions}/></div> : <ErrorBox message="لا توجد بيانات للعرض." retry={() => q.refetch()}/>}
  </div>;
}

function MemberForm({ member, onDone, onCancel }: { member?: Member; onDone: () => void; onCancel: () => void }) {
  const qc=useQueryClient(),create=useCreateMember(),update=useUpdateMember();
  const settings=useQuery({queryKey:["operational-settings"],queryFn:()=>api<{memberRequiredFields:string[]}>("/club/operations/settings")});
  const [error,setError]=useState("");
  function submit(e:FormEvent<HTMLFormElement>){e.preventDefault();setError("");const form=new FormData(e.currentTarget);const birthDate=String(form.get("birthDate")||"");const email=String(form.get("email")||"").trim();if(birthDate&&birthDate>today()){setError("تاريخ الميلاد لا يمكن أن يكون في المستقبل");return;}if(settings.data?.memberRequiredFields.includes("email")&&!email){setError("البريد الإلكتروني مطلوب حسب إعدادات النادي");return;}if(settings.data?.memberRequiredFields.includes("birthDate")&&!birthDate){setError("تاريخ الميلاد مطلوب حسب إعدادات النادي");return;}
    const data={name:String(form.get("name")).trim(),phone:String(form.get("phone")).trim(),email:email||null,birthDate:birthDate||null,notes:String(form.get("notes")||"").trim()||null};
    const done=()=>{void qc.invalidateQueries();onDone();};const fail=(err:unknown)=>setError(errorText(err));
    if(member)update.mutate({id:member.id,data:{...data,active:form.get("active")==="on"}},{onSuccess:done,onError:fail});else create.mutate({data},{onSuccess:done,onError:fail});
  }
  return <form className="form-panel" onSubmit={submit}><h2>{member?"تعديل بيانات المشترك":"مشترك جديد"}</h2><div className="form-grid">
    <label className="field">الاسم الكامل<input name="name" required minLength={2} maxLength={120} defaultValue={member?.name}/></label>
    <label className="field">رقم الهاتف<input name="phone" required minLength={7} maxLength={24} dir="ltr" inputMode="tel" defaultValue={member?.phone}/></label>
    <label className="field">البريد الإلكتروني<input name="email" type="email" dir="ltr" required={settings.data?.memberRequiredFields.includes("email")} defaultValue={member?.email||""}/></label>
    <label className="field">تاريخ الميلاد<input name="birthDate" type="date" max={today()} required={settings.data?.memberRequiredFields.includes("birthDate")} defaultValue={member?.birthDate||""}/></label>
    <label className="field wide">ملاحظات<textarea name="notes" maxLength={1000} defaultValue={member?.notes||""}/></label>
    {member&&<label className="check-field wide"><input type="checkbox" name="active" defaultChecked={member.active}/> حساب المشترك مفعّل</label>}
  </div>{error&&<ErrorBox message={error}/>}<div className="form-actions"><button className="primary-button" disabled={create.isPending||update.isPending||settings.isLoading}>{create.isPending||update.isPending?"جارٍ الحفظ…":"حفظ البيانات"}</button><button type="button" className="outline-button" onClick={onCancel}>إلغاء</button></div></form>;
}

function MembersPage() {
  const session=useGetClubSession(),can=(p:string)=>!!session.data?.isOwner||!!session.data?.permissions.includes(p),[search,setSearch]=useState(""),[editing,setEditing]=useState<Member|"new"|null>(null),[message,setMessage]=useState("");
  const q=useListMembers({search:search.trim()||undefined,limit:100}),del=useDeleteMember(),update=useUpdateMember(),qc=useQueryClient();
  const canCreate=can("members.create"),canEdit=can("members.edit"),canDelete=can("members.delete");
  function remove(member:Member){if(!window.confirm(`حذف ${member.name} نهائيًا؟ إذا كان مرتبطًا بسجل مالي سيُرفض الحذف.`))return;del.mutate({id:member.id},{onSuccess:()=>{setMessage("تم حذف ملف المشترك.");void qc.invalidateQueries();},onError:e=>setMessage(errorText(e))});}
  function toggle(m:Member){update.mutate({id:m.id,data:{active:!m.active}},{onSuccess:()=>{setMessage(m.active?"تمت أرشفة المشترك.":"تمت إعادة تفعيل المشترك.");void qc.invalidateQueries();},onError:e=>setMessage(errorText(e))});}
  return <><PageTitle overline="الأعضاء والملفات" title="المشتركون" subtitle="إدارة بيانات المشتركين والحالة التشغيلية.">
    {can("members.export")&&<button className="outline-button" onClick={()=>void downloadApi("/club/exports/members","iraq-alameer-members.csv")}>تصدير CSV</button>}
    {canCreate&&<button className="primary-button" onClick={()=>{setEditing("new");setMessage("");}}><Plus size={15}/> مشترك جديد</button>}
  </PageTitle>
  {message&&<div className="notice">{message}</div>}
  {editing&&<section className="surface surface-pad"><MemberForm key={editing==="new"?"new":editing.id} member={editing==="new"?undefined:editing} onDone={()=>{setEditing(null);setMessage("تم حفظ بيانات المشترك.");}} onCancel={()=>setEditing(null)}/></section>}
  <section className="surface"><div className="table-toolbar"><div><h2>دليل المشتركين</h2><small>{q.data?`${q.data.length} ملفًا في النتائج`:"بيانات حية من النادي"}</small></div><label className="search-field"><Search size={15}/><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="بحث بالاسم أو الهاتف"/></label></div>
    {q.isLoading?<Loading label="تحميل المشتركين"/>:q.isError?<div className="surface-body"><ErrorBox message={errorText(q.error)} retry={()=>q.refetch()}/></div>:q.data?.length?<div className="table-scroll"><table className="data-table"><thead><tr><th>الاسم</th><th>الهاتف</th><th>تاريخ التسجيل</th><th>الحساب</th>{(canEdit||canDelete||can("subscriptions.create"))&&<th>الإجراءات</th>}</tr></thead><tbody>{q.data.map(m=><tr key={m.id}><td><Link className="member-link" href={`/members/${m.id}`}><span className="avatar-mark soft-mark">{m.name.slice(0,1)}</span><strong>{m.name}</strong></Link></td><td dir="ltr">{m.phone}</td><td>{new Date(m.joinedAt).toLocaleDateString("ar-IQ",{timeZone:"Asia/Amman"})}</td><td><Status value={m.active?"active":"suspended"}/></td>{(canEdit||canDelete||can("subscriptions.create"))&&<td><div className="row-tools">{canEdit&&<button className="mini-action" onClick={()=>setEditing(m)}>تعديل</button>}{canEdit&&<button className="mini-action" onClick={()=>toggle(m)}>{m.active?"أرشفة":"تفعيل"}</button>}{can("subscriptions.create")&&<Link href={`/subscriptions?memberId=${m.id}`} className="mini-action">اشتراك</Link>}{canDelete&&<button className="mini-action danger-text" onClick={()=>remove(m)}>حذف</button>}</div></td>}</tr>)}</tbody></table></div>:<Empty title={search?"لا توجد نتائج مطابقة":"لا يوجد مشتركون مسجلون"} detail={search?"جرّب اسمًا أو رقم هاتف مختلفًا.":"ابدأ بتسجيل أول مشترك؛ لا تُعرض سجلات تجريبية."}/>}</section></>;
}

function MemberDetail() {
  const {id:raw}=useParams<{id:string}>(),id=Number(raw),q=useGetMember(id,{query:{queryKey:getGetMemberQueryKey(id),enabled:id>0}}),profile=useGetMemberProfile(id,{query:{queryKey:["member-profile",id],enabled:id>0}}),session=useGetClubSession();
  const qc=useQueryClient();
  if(q.isLoading&&profile.isLoading)return <Loading/>;
  if(q.isError&&profile.isError)return <ErrorBox message="تعذر تحميل ملف المشترك." retry={()=>{void q.refetch();void profile.refetch();}}/>;
  const detail=q.data,member=detail?.member||profile.data;
  if(!member)return <Empty title="ملف المشترك غير متاح"/>;
  const canFinancial=!!session.data?.isOwner||session.data?.permissions.some(p=>["payments.view","subscriptions.view"].includes(p));
  return <><PageTitle overline="ملف المشترك" title={member.name} subtitle="البيانات الأساسية والحالة المسجلة."><Link className="outline-button" href="/members">العودة إلى الدليل</Link></PageTitle>
    <div className="grid-two">
      <section className="surface surface-pad member-profile"><div className="profile-avatar">{member.name.slice(0,1)}</div><div><h2>{member.name}</h2><p dir="ltr">{member.phone}</p>{member.email&&<p dir="ltr">{member.email}</p>}<Status value={member.active?"active":"suspended"}/></div><div className="profile-facts"><span><small>تاريخ الانضمام</small><strong>{member.joinedAt.slice(0,10)}</strong></span><span><small>تاريخ الميلاد</small><strong>{member.birthDate||"غير مسجل"}</strong></span>{member.notes&&<span className="fact-wide"><small>ملاحظات</small><strong>{member.notes}</strong></span>}</div></section>
      {canFinancial?<section className="surface"><div className="surface-head"><h2>الاشتراكات الحالية</h2><Link className="panel-link" href={`/subscriptions?memberId=${member.id}`}>إدارة الاشتراكات</Link></div><div className="surface-body">{detail?.subscriptions.length?detail.subscriptions.map(s=><div key={s.id} className="list-row"><span className="list-row-main"><strong>{s.planName}</strong><small>{s.startDate} — {s.endDate}</small></span><Status value={s.status}/><strong><Money fils={s.balanceFils}/></strong></div>):<Empty title="لا توجد اشتراكات محفوظة"/>}</div></section>:<section className="surface surface-pad"><h2>الوصول المالي محدود</h2><p className="muted">صلاحية الاشتراكات أو الدفعات غير ممنوحة لهذا الحساب.</p></section>}
    </div>
    <MemberProfileActions member={member} onRefresh={()=>{void q.refetch();void profile.refetch();}}/>
    {canFinancial&&<section className="surface member-payments"><div className="surface-head"><div><h2>سجل الدفعات والإيصالات</h2><p>قيمة العملة بالدينار الأردني، بالدقة المسجلة في النظام.</p></div></div>{detail?.payments.length?<div className="table-scroll"><table className="data-table"><thead><tr><th>رقم الإيصال</th><th>التاريخ</th><th>النوع</th><th>المبلغ</th><th>الطريقة</th><th>الحالة</th>{(!!session.data?.isOwner||session.data?.permissions.includes("payments.edit"))&&<th>الإجراء</th>}</tr></thead><tbody>{detail.payments.map(p=><tr key={p.id}><td>{p.kind==="payment"?<Link href={`/receipt/${p.id}`} className="panel-link">{p.receiptNumber}</Link>:p.receiptNumber}</td><td>{p.createdAt.slice(0,10)}</td><td>{p.kind==="payment"?"تحصيل":p.kind==="refund"?"استرداد":"خصم"}</td><td><Money fils={p.amountFils}/></td><td>{p.method}</td><td>{p.reversed?"معكوسة":"محفوظة"}</td>{(!!session.data?.isOwner||session.data?.permissions.includes("payments.edit"))&&<td>{p.kind==="payment"&&!p.reversed&&<button className="mini-action danger-text" onClick={async()=>{const reason=window.prompt(`سبب عكس الإيصال ${p.receiptNumber}`)?.trim();if(!reason)return;if(reason.length<3){window.alert("اكتب سببًا من ثلاثة أحرف على الأقل.");return;}if(!window.confirm(`تأكيد عكس الدفعة ${p.receiptNumber}؟ سيبقى الإيصال الأصلي محفوظًا.`))return;try{await api(`/payments/${p.id}/reverse`,{method:"POST",body:JSON.stringify({reason})});void q.refetch();void qc.invalidateQueries();}catch(e){window.alert(errorText(e));}}}>عكس الدفعة</button>}</td>}</tr>)}</tbody></table></div>:<Empty title="لا توجد دفعات محفوظة"/>}</section>}
    <MemberReminderTools memberId={member.id}/>
  </>;
}
function MemberProfileActions({member,onRefresh}:{member:Member;onRefresh:()=>void}) {
  const session=useGetClubSession(),qc=useQueryClient(),update=useUpdateMember(),remove=useDeleteMember();
  const can=(p:string)=>!!session.data?.isOwner||!!session.data?.permissions.includes(p);
  const [edit,setEdit]=useState(false),[error,setError]=useState(""),[message,setMessage]=useState(""),[archiveFallback,setArchiveFallback]=useState(false);
  function archive(){update.mutate({id:member.id,data:{active:false}},{onSuccess:()=>{setMessage("تمت أرشفة المشترك مع الحفاظ على سجلاته.");setError("");setArchiveFallback(false);onRefresh();void qc.invalidateQueries();},onError:e=>setError(errorText(e))});}
  function deleteMember(){if(!window.confirm(`حذف المشترك ${member.name} نهائيًا؟ لن تُحذف سجلات مرتبطة تلقائيًا.`))return;setError("");remove.mutate({id:member.id},{onSuccess:()=>{setMessage("تم حذف ملف المشترك.");void qc.invalidateQueries();},onError:e=>{const conflict=e as {status?:number;data?:{canArchive?:boolean}};setArchiveFallback(conflict.status===409&&!!conflict.data?.canArchive);setError(errorText(e));}});}
  return <section className="surface surface-pad profile-actions"><div className="row-tools"><Status value={member.active?"active":"suspended"}/>{can("members.edit")&&<button className="outline-button" onClick={()=>setEdit(!edit)}>تعديل البيانات</button>}{can("members.edit")&&<button className="outline-button" disabled={update.isPending} onClick={()=>member.active?archive():update.mutate({id:member.id,data:{active:true}},{onSuccess:()=>{setMessage("تمت إعادة تفعيل المشترك.");onRefresh();void qc.invalidateQueries();},onError:e=>setError(errorText(e))})}>{member.active?"أرشفة":"إعادة تفعيل"}</button>}{can("members.delete")&&<button className="danger-button" disabled={remove.isPending} onClick={deleteMember}>حذف</button>}</div>
    {message&&<div className="notice">{message}</div>}{error&&<ErrorBox message={error}/ >}{archiveFallback&&<div className="notice">لا يمكن حذف ملف مرتبط. يمكنك أرشفته بدلًا من ذلك.<button className="mini-action" onClick={archive}>أرشفة المشترك</button></div>}
    {edit&&can("members.edit")&&<div className="profile-edit"><MemberForm member={member} onDone={()=>{setEdit(false);setMessage("تم تحديث بيانات المشترك.");onRefresh();}} onCancel={()=>setEdit(false)}/></div>}
  </section>;
}

function MemberReminderTools({memberId}:{memberId:number}) {
  type Reminder={id:number;createdAt:string;triggerDays:string;status:string;error:string|null};
  const session=useGetClubSession(),qc=useQueryClient();
  const canView=!!session.data?.isOwner||!!session.data?.permissions.includes("whatsapp.view");
  const canSend=!!session.data?.isOwner||!!session.data?.permissions.includes("whatsapp.create");
  const global=useQuery({queryKey:["admin","whatsapp-reminders"],queryFn:()=>api<{enabled:boolean;configured:boolean}>("/club/admin/whatsapp-reminders"),enabled:canView||canSend});
  const logs=useQuery({queryKey:["member-reminders",memberId],queryFn:()=>api<Reminder[]>(`/members/${memberId}/whatsapp-reminders`),enabled:canView});
  const send=useMutation({mutationFn:()=>api<{message:string}>(`/members/${memberId}/whatsapp-reminder`,{method:"POST"}),onSuccess:()=>{void qc.invalidateQueries({queryKey:["member-reminders",memberId]});}});
  if(!canView&&!canSend)return null;
  return <section className="surface member-payments"><div className="surface-head"><div><h2>تذكيرات واتساب</h2><p>الإرسال يخضع لإعداد النادي وحالة الربط الفعلية.</p></div>{canSend&&<button className="primary-button" disabled={send.isPending||global.isLoading||!global.data?.enabled||!global.data?.configured} onClick={()=>send.mutate()}><MessageCircle size={14}/>{send.isPending?"جارٍ التحقق والإرسال…":"إرسال تذكير"}</button>}</div>
    {send.isError&&<div className="surface-body"><ErrorBox message={errorText(send.error)}/></div>}{send.isSuccess&&<div className="surface-body"><div className="notice">تم إرسال الطلب. تحقق من سجل التذكيرات؛ قبول الطلب لا يؤكد التسليم.</div></div>}
    {canView&&(logs.isLoading?<Loading/>:logs.isError?<div className="surface-body"><ErrorBox message={errorText(logs.error)} retry={()=>logs.refetch()}/></div>:logs.data?.length?<div className="table-scroll"><table className="data-table"><thead><tr><th>التاريخ</th><th>الموعد</th><th>الحالة</th><th>التفاصيل</th></tr></thead><tbody>{logs.data.map(log=><tr key={log.id}><td>{new Date(log.createdAt).toLocaleString("ar-IQ",{timeZone:"Asia/Amman"})}</td><td>{log.triggerDays.startsWith("manual:")?"يدوي":log.triggerDays==="0"?"يوم الانتهاء":`قبل الانتهاء بـ${log.triggerDays} يوم`}</td><td>{log.status==="accepted"?"قبلتها Meta":log.status==="failed"?"فشل":log.status==="queued"?"قيد المعالجة":log.status}</td><td>{log.error||"قبول الطلب لا يؤكد تسليم الرسالة"}</td></tr>)}</tbody></table></div>:<Empty title="لا توجد تذكيرات مسجلة"/>)}
    {canSend&&global.data&&!global.data.enabled&&<div className="surface-body"><p className="muted">إرسال التذكيرات متوقف حسب إعداد النادي.</p></div>}
  </section>;
}

function PlansPage() {
  const q=useListPlans(),create=useCreatePlan(),update=useUpdatePlan(),qc=useQueryClient(),session=useGetClubSession(),can=(p:string)=>!!session.data?.isOwner||!!session.data?.permissions.includes(p);
  const [form,setForm]=useState<Plan|"new"|null>(null),[error,setError]=useState(""),[message,setMessage]=useState("");
  const selected=form&&form!=="new"?form:null;
  function submit(e:FormEvent<HTMLFormElement>){e.preventDefault();setError("");const f=new FormData(e.currentTarget),data={name:String(f.get("name")).trim(),durationDays:Number(f.get("days")),priceFils:Math.round(Number(f.get("price"))*1000),active:f.get("active")==="on"};
    const success=()=>{setForm(null);setMessage("تم حفظ الباقة في النظام.");void qc.invalidateQueries({queryKey:getListPlansQueryKey()});};
    if(form==="new")create.mutate({data},{onSuccess:success,onError:e=>setError(errorText(e))});else if(selected)update.mutate({id:selected.id,data},{onSuccess:success,onError:e=>setError(errorText(e))});
  }
  async function remove(p:Plan){if(!window.confirm(`حذف الباقة «${p.name}»؟ الباقات المرتبطة قد تُؤرشف بدل الحذف.`))return;try{const result=await api<{archived?:boolean}>(`/plans/${p.id}`,{method:"DELETE"});setMessage(result.archived?"تمت أرشفة الباقة للحفاظ على السجلات.":"تم حذف الباقة.");void qc.invalidateQueries({queryKey:getListPlansQueryKey()});}catch(e){setError(errorText(e));}}
  return <><PageTitle overline="العضويات" title="الباقات والأسعار" subtitle="المدة والسعر للحزم المعروضة على الاشتراكات.">{can("plans.create")&&<button className="primary-button" onClick={()=>{setForm("new");setError("");}}><Plus size={15}/> إضافة باقة</button>}</PageTitle>
    {message&&<div className="notice">{message}</div>}{error&&<ErrorBox message={error}/>}
    {form&&<section className="surface surface-pad"><form className="form-panel" onSubmit={submit}><h2>{selected?"تعديل الباقة":"إضافة باقة"}</h2><div className="form-grid">
      <label className="field">اسم الباقة<input name="name" minLength={2} maxLength={100} required defaultValue={selected?.name}/></label>
      <label className="field">المدة بالأيام<input name="days" type="number" min="1" max="3650" required defaultValue={selected?.durationDays||30}/></label>
      <label className="field">السعر بالدينار الأردني<input name="price" type="number" min="0" max="2000000" step=".001" required defaultValue={selected?selected.priceFils/1000:""}/></label>
      <label className="check-field"><input type="checkbox" name="active" defaultChecked={selected?.active??true}/> متاحة للاشتراكات الجديدة</label>
    </div><p className="muted">تعديل سعر الباقة لا يغير أسعار الاشتراكات المحفوظة سابقًا.</p><div className="form-actions"><button className="primary-button" disabled={create.isPending||update.isPending}>حفظ الباقة</button><button type="button" className="outline-button" onClick={()=>setForm(null)}>إلغاء</button></div></form></section>}
    <section className="surface"><div className="surface-head"><div><h2>الباقات المسجلة</h2><p>لا يتم إدراج باقات افتراضية.</p></div></div>
      {q.isLoading?<Loading/>:q.isError?<div className="surface-body"><ErrorBox message={errorText(q.error)} retry={()=>q.refetch()}/></div>:q.data?.length?<div className="table-scroll"><table className="data-table"><thead><tr><th>الباقة</th><th>المدة</th><th>السعر</th><th>الحالة</th><th>العمليات</th></tr></thead><tbody>{q.data.map(p=><tr key={p.id}><td><strong>{p.name}</strong></td><td>{p.durationDays} يومًا</td><td><Money fils={p.priceFils}/></td><td><Status value={p.active?"active":"suspended"}/></td><td><div className="row-tools">{can("plans.edit")&&<button className="mini-action" onClick={()=>{setForm(p);setError("");}}>تعديل</button>}{can("plans.delete")&&<button className="mini-action danger-text" onClick={()=>void remove(p)}>حذف / أرشفة</button>}</div></td></tr>)}</tbody></table></div>:<Empty title="لا توجد باقات حتى الآن" detail="أضف باقات النادي المعتمدة لبدء تسجيل الاشتراكات."/>}
    </section>
  </>;
}

type OperationalSub={id:number;memberId:number;memberName:string;planId:number;planName:string;startDate:string;endDate:string;status:string};
type OperationalPlan={id:number;name:string;durationDays:number};
function OperationalSubscriptionsPage() {
  const qc=useQueryClient(),session=useGetClubSession(),can=(p:string)=>!!session.data?.isOwner||!!session.data?.permissions.includes(p);
  const rows=useQuery({queryKey:["operations","subscriptions"],queryFn:()=>api<OperationalSub[]>("/club/operations/subscriptions")});
  const plans=useQuery({queryKey:["operations","plans"],queryFn:()=>api<OperationalPlan[]>("/club/operations/plans")});
  const members=useListMembers({limit:100},{query:{enabled:can("members.view")&&can("subscriptions.create"),queryKey:["operations","members",100]}});
  const [search,setSearch]=useState(""),[show,setShow]=useState(false),[editing,setEditing]=useState<OperationalSub|null>(null),[error,setError]=useState(""),[message,setMessage]=useState("");
  const operation=useMutation({mutationFn:(v:{path:string;body?:unknown;method?:string})=>api(v.path,{method:v.method||"POST",...(v.body===undefined?{}:{body:JSON.stringify(v.body)})}),onSuccess:()=>{setError("");setMessage("تم حفظ العملية في سجلات النادي.");setShow(false);setEditing(null);void qc.invalidateQueries();},onError:e=>{setMessage("");setError(errorText(e));}});
  const params=new URLSearchParams(window.location.search),preset=Number(params.get("memberId"))||undefined;
  function submit(e:FormEvent<HTMLFormElement>){e.preventDefault();setError("");const f=new FormData(e.currentTarget);if(editing)operation.mutate({path:`/club/operations/subscriptions/${editing.id}`,method:"PATCH",body:{planId:Number(f.get("planId")),startDate:String(f.get("startDate")),endDate:String(f.get("endDate"))}});else operation.mutate({path:"/club/operations/subscriptions",body:{memberId:Number(f.get("memberId")),planId:Number(f.get("planId")),startDate:String(f.get("startDate"))}});}
  function doAction(row:OperationalSub,action:string){if(action==="cancel"&&!window.confirm(`إلغاء اشتراك ${row.memberName}؟ ستبقى السجلات محفوظة.`))return;operation.mutate({path:`/club/operations/subscriptions/${row.id}/action`,body:{action}});}
  const list=(rows.data||[]).filter(s=>`${s.memberName} ${s.planName}`.toLowerCase().includes(search.trim().toLowerCase()));
  return <><PageTitle overline="العمليات اليومية" title="الاشتراكات والتجديدات" subtitle="عرض تشغيلي بلا أسعار أو أرصدة أو بيانات مدفوعات.">{can("subscriptions.create")&&can("members.view")&&<button className="primary-button" onClick={()=>{setShow(true);setEditing(null);}}><Plus size={15}/> اشتراك جديد</button>}</PageTitle>
    <div className="notice">البيانات المالية محجوبة لهذه الواجهة. تظهر فقط حالة العضوية والمدد المسجلة في النظام.</div>{message&&<div className="notice">{message}</div>}{error&&<ErrorBox message={error}/>}
    {(show||editing)&&<section className="surface surface-pad"><form className="form-panel" onSubmit={submit}><h2>{editing?"تعديل الاشتراك":"اشتراك جديد"}</h2><div className="form-grid">
      {!editing&&<label className="field">المشترك<select name="memberId" required defaultValue={preset||""}><option value="">اختر مشتركًا</option>{members.data?.filter(m=>m.active).map(m=><option key={m.id} value={m.id}>{m.name} · {m.phone}</option>)}</select></label>}
      <label className="field">الباقة<select name="planId" required defaultValue={editing?.planId||""}><option value="">اختر الباقة</option>{plans.data?.map(p=><option key={p.id} value={p.id}>{p.name} · {p.durationDays} يومًا</option>)}</select></label>
      <label className="field">تاريخ البداية<input name="startDate" type="date" required defaultValue={editing?.startDate||today()}/></label>
      {editing&&<label className="field">تاريخ الانتهاء<input name="endDate" type="date" required defaultValue={editing.endDate}/></label>}
    </div>{(rows.isError||plans.isError||members.isError)&&<ErrorBox message="تعذر تحميل قوائم النادي المطلوبة."/>}<div className="form-actions"><button className="primary-button" disabled={operation.isPending}>{operation.isPending?"جارٍ الحفظ…":"حفظ الاشتراك"}</button><button className="outline-button" type="button" onClick={()=>{setShow(false);setEditing(null);}}>إلغاء</button></div></form></section>}
    <section className="surface"><div className="table-toolbar"><div><h2>الاشتراكات</h2><small>مدد وحالات تشغيلية</small></div><label className="search-field"><Search size={14}/><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="المشترك أو الباقة"/></label></div>
      {rows.isLoading||plans.isLoading?<Loading/>:rows.isError||plans.isError?<div className="surface-body"><ErrorBox message={errorText(rows.error||plans.error)} retry={()=>{void rows.refetch();void plans.refetch();}}/></div>:list.length?<div className="table-scroll"><table className="data-table"><thead><tr><th>المشترك</th><th>الباقة</th><th>البداية</th><th>الانتهاء</th><th>الحالة</th><th>الإجراء</th></tr></thead><tbody>{list.map(row=><tr key={row.id}><td>{row.memberName}</td><td>{row.planName}</td><td>{row.startDate}</td><td>{row.endDate}</td><td><Status value={row.status}/></td><td><div className="row-tools">{can("subscriptions.edit")&&<>{["active","paused"].includes(row.status)&&<button className="mini-action" onClick={()=>{setEditing(row);setShow(false);}}>تعديل</button>}{row.status==="active"&&<button className="mini-action" onClick={()=>doAction(row,"pause")}>إيقاف</button>}{row.status==="paused"&&<button className="mini-action" onClick={()=>doAction(row,"resume")}>استئناف</button>}{can("subscriptions.create")&&["active","expired"].includes(row.status)&&<button className="mini-action" onClick={()=>doAction(row,"renew")}>تجديد</button>}{can("subscriptions.delete")&&["active","paused"].includes(row.status)&&<button className="mini-action danger-text" onClick={()=>doAction(row,"cancel")}>إلغاء</button>}</>}</div></td></tr>)}</tbody></table></div>:<Empty title="لا توجد اشتراكات مسجلة"/>}
    </section>
  </>;
}
function RoleSubscriptions() {
  const session=useGetClubSession(),perms=session.data?.permissions||[];
  const financial=!!session.data?.isOwner||["payments.view","plans.view","members.view"].every(p=>perms.includes(p));
  return financial?<SubscriptionPage/>:<OperationalSubscriptionsPage/>;
}
function SubscriptionCreate({ onClose, preset }: { onClose:()=>void; preset?:number }) {
  const members=useListMembers({limit:100}),plans=useListPlans(),create=useCreateSubscription(),qc=useQueryClient();
  const settings=useQuery({queryKey:["operational-settings"],queryFn:()=>api<{paymentMethods:string[];maxDiscountPercent:number}>("/club/operations/settings")});
  const [error,setError]=useState("");
  function submit(e:FormEvent<HTMLFormElement>){e.preventDefault();setError("");const f=new FormData(e.currentTarget),discount=toFils(String(f.get("discount")||"0")),paid=toFils(String(f.get("paid")||"0"));if(discount===null||paid===null){setError("اكتب مبالغ صحيحة حتى ثلاث خانات عشرية.");return;}
    const methods=["cash","card","bank_transfer","wallet"].filter(x=>settings.data?.paymentMethods.includes(x));if(!methods.length){setError("لا توجد طريقة دفع مفعّلة من إعدادات النادي.");return;}
    create.mutate({data:{memberId:Number(f.get("memberId")),planId:Number(f.get("planId")),startDate:String(f.get("startDate")),discountFils:discount,initialPaymentFils:paid,paymentMethod:String(f.get("method")||methods[0]) as "cash"|"card"|"bank_transfer"|"wallet"}},{onSuccess:()=>{void qc.invalidateQueries();onClose();},onError:e=>setError(errorText(e))});
  }
  const methods=["cash","card","bank_transfer","wallet"].filter(x=>settings.data?.paymentMethods.includes(x));
  return <div className="surface surface-pad"><form className="form-panel" onSubmit={submit}><h2>إنشاء اشتراك جديد</h2><div className="form-grid">
    <label className="field">المشترك<select name="memberId" defaultValue={preset||""} required><option value="" disabled>اختر مشتركًا</option>{members.data?.filter(m=>m.active).map(m=><option key={m.id} value={m.id}>{m.name} · {m.phone}</option>)}</select></label>
    <label className="field">الباقة<select name="planId" required defaultValue=""><option value="" disabled>اختر باقة</option>{plans.data?.filter(p=>p.active).map(p=><option key={p.id} value={p.id}>{p.name} · {jod(p.priceFils)} د.أ</option>)}</select></label>
    <label className="field">تاريخ البداية<input name="startDate" type="date" required defaultValue={today()}/></label>
    <label className="field">الخصم (د.أ)<input name="discount" inputMode="decimal" dir="ltr" defaultValue="0"/></label>
    <label className="field">الدفعة الأولى (د.أ)<input name="paid" inputMode="decimal" dir="ltr" defaultValue="0"/></label>
    <label className="field">طريقة الدفع<select name="method" required><option value="">اختر طريقة مفعلة</option>{methods.map(m=><option key={m} value={m}>{({cash:"نقدًا",card:"بطاقة",bank_transfer:"تحويل بنكي",wallet:"محفظة"} as Record<string,string>)[m]}</option>)}</select></label>
  </div>{settings.data&&<p className="muted">حد الخصم من إعدادات النادي: {settings.data.maxDiscountPercent}٪.</p>}{error&&<ErrorBox message={error}/>}<div className="form-actions"><button className="primary-button" disabled={create.isPending||members.isLoading||plans.isLoading||settings.isLoading}>{create.isPending?"جارٍ الحفظ…":"حفظ الاشتراك"}</button><button type="button" className="outline-button" onClick={onClose}>إلغاء</button></div></form></div>;
}
function SubscriptionPage() {
  const params=new URLSearchParams(window.location.search),preset=Number(params.get("memberId"))||undefined,session=useGetClubSession();
  const can=(p:string)=>!!session.data?.isOwner||!!session.data?.permissions.includes(p);
  const [filter,setFilter]=useState("all"),[search,setSearch]=useState(""),[open,setOpen]=useState(false),[message,setMessage]=useState("");
  const q=useListSubscriptions({status:filter as "active"|"paused"|"expired"|"cancelled"|"all",search:search.trim()||undefined}),act=useActOnSubscription(),update=useUpdateSubscription(),pay=useCreateSubscriptionPayment(),qc=useQueryClient();
  const [selected,setSelected]=useState<{type:"pay"|"edit";sub:Subscription}|null>(null),[error,setError]=useState("");
  const all=q.data||[],renewed=new Set(all.map(s=>s.renewedFromId).filter((x):x is number=>typeof x==="number"));
  function action(s:Subscription,action:"pause"|"resume"|"renew"|"cancel"){if(action==="cancel"&&!window.confirm(`إلغاء اشتراك ${s.memberName}؟ ستبقى الدفعات والسجلات محفوظة.`))return;act.mutate({id:s.id,data:{action}},{onSuccess:()=>{setMessage("تم تنفيذ الإجراء على الاشتراك.");void qc.invalidateQueries();},onError:e=>setError(errorText(e))});}
  function submitDialog(e:FormEvent<HTMLFormElement>){e.preventDefault();if(!selected)return;const f=new FormData(e.currentTarget);setError("");if(selected.type==="pay"){const amount=toFils(String(f.get("amount")));if(!amount||amount>selected.sub.balanceFils){setError("المبلغ غير صالح أو يتجاوز الرصيد المتبقي.");return;}pay.mutate({id:selected.sub.id,data:{amountFils:amount,method:String(f.get("method")) as "cash"|"card"|"bank_transfer"|"wallet",note:String(f.get("note")||"")}}, {onSuccess:()=>{setSelected(null);setMessage("تم تسجيل الدفعة.");void qc.invalidateQueries();},onError:e=>setError(errorText(e))});}
    else {const price=toFils(String(f.get("price")));if(price===null||price<selected.sub.paidFils+selected.sub.discountFils){setError("السعر أقل من إجمالي المدفوع والخصم.");return;}update.mutate({id:selected.sub.id,data:{planId:Number(f.get("planId")),startDate:String(f.get("startDate")),endDate:String(f.get("endDate")),priceFils:price}},{onSuccess:()=>{setSelected(null);setMessage("تم تعديل الاشتراك.");void qc.invalidateQueries();},onError:e=>setError(errorText(e))});}
  }
  return <><PageTitle overline="العضويات" title="الاشتراكات والتجديدات" subtitle="حالة المدة والرصيد وسجل الإجراءات.">{can("subscriptions.export")&&<button className="outline-button" onClick={()=>void downloadApi("/club/exports/subscriptions","iraq-alameer-subscriptions.csv")}>تصدير CSV</button>}{can("subscriptions.create")&&<button className="primary-button" onClick={()=>setOpen(!open)}><Plus size={15}/> اشتراك جديد</button>}</PageTitle>
    {message&&<div className="notice">{message}</div>}{error&&<ErrorBox message={error}/>}
    {open&&can("subscriptions.create")&&<SubscriptionCreate preset={preset} onClose={()=>{setOpen(false);void qc.invalidateQueries();}}/>}
    {selected&&<section className="surface surface-pad"><form className="form-panel" onSubmit={submitDialog}><h2>{selected.type==="pay"?`تحصيل من ${selected.sub.memberName}`:`تعديل اشتراك ${selected.sub.memberName}`}</h2>{selected.type==="pay"?<div className="form-grid">
      <label className="field">الرصيد المتبقي<input readOnly value={`${jod(selected.sub.balanceFils)} د.أ`}/></label>
      <label className="field">المبلغ (د.أ)<input name="amount" required type="number" min=".001" max={selected.sub.balanceFils/1000} step=".001"/></label>
      <label className="field">طريقة الدفع<select name="method"><option value="cash">نقدًا</option><option value="card">بطاقة</option><option value="bank_transfer">تحويل بنكي</option><option value="wallet">محفظة</option></select></label>
      <label className="field">ملاحظة<input name="note" maxLength={500}/></label>
    </div>:<div className="form-grid">
      <label className="field">الباقة<select name="planId" defaultValue={selected.sub.planId}>{q.data?.map(s=><option key={`${s.id}-${s.planId}`} value={s.planId}>{s.planName}</option>)}</select></label>
      <label className="field">السعر (د.أ)<input name="price" type="number" min={jod(selected.sub.paidFils+selected.sub.discountFils)} step=".001" defaultValue={jod(selected.sub.priceFils)} required/></label>
      <label className="field">تاريخ البداية<input name="startDate" type="date" defaultValue={selected.sub.startDate} required/></label>
      <label className="field">تاريخ النهاية<input name="endDate" type="date" defaultValue={selected.sub.endDate} required/></label>
    </div>}{error&&<ErrorBox message={error}/>}<div className="form-actions"><button className="primary-button" disabled={pay.isPending||update.isPending}>حفظ</button><button className="outline-button" type="button" onClick={()=>setSelected(null)}>إلغاء</button></div></form></section>}
    <section className="surface"><div className="table-toolbar"><div><h2>سجل الاشتراكات</h2><small>المبالغ بالعملة المسجلة في واجهة النظام</small></div><label className="search-field"><Search size={15}/><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="اسم المشترك أو الباقة"/></label></div>
      <div className="section-tabs">{["all","active","paused","expired","cancelled"].map(x=><button key={x} className={filter===x?"primary-button":"outline-button"} onClick={()=>setFilter(x)}>{({all:"الكل",active:"نشط",paused:"موقوف",expired:"منتهي",cancelled:"ملغي"} as Record<string,string>)[x]}</button>)}</div>
      {q.isLoading?<Loading/>:q.isError?<div className="surface-body"><ErrorBox message={errorText(q.error)} retry={()=>q.refetch()}/></div>:q.data?.length?<div className="table-scroll"><table className="data-table"><thead><tr><th>المشترك</th><th>الباقة</th><th>الفترة</th><th>الصافي</th><th>المدفوع</th><th>المتبقي</th><th>الحالة</th><th>الإجراء</th></tr></thead><tbody>{q.data.map(s=><tr key={s.id}><td><Link href={`/members/${s.memberId}`} className="panel-link">{s.memberName}</Link></td><td>{s.planName}{s.renewedFromId&&<small> · تجديد</small>}</td><td>{s.startDate}<br/><small>{s.endDate}</small></td><td><Money fils={s.priceFils-s.discountFils}/></td><td><Money fils={s.paidFils}/></td><td><Money fils={s.balanceFils}/></td><td><Status value={s.status}/></td><td><div className="row-tools">{can("payments.create")&&s.balanceFils>0&&<button className="mini-action" onClick={()=>{setSelected({type:"pay",sub:s});setError("");}}>تحصيل</button>}{can("subscriptions.edit")&&s.status==="active"&&<button className="mini-action" onClick={()=>action(s,"pause")}>إيقاف</button>}{can("subscriptions.edit")&&s.status==="paused"&&<button className="mini-action" onClick={()=>action(s,"resume")}>استئناف</button>}{can("subscriptions.edit")&&["active","paused"].includes(s.status)&&<button className="mini-action" onClick={()=>setSelected({type:"edit",sub:s})}>تعديل</button>}{can("subscriptions.create")&&["active","expired"].includes(s.status)&&!renewed.has(s.id)&&<button className="mini-action" onClick={()=>action(s,"renew")}>تجديد</button>}{can("subscriptions.delete")&&["active","paused"].includes(s.status)&&<button className="mini-action danger-text" onClick={()=>action(s,"cancel")}>إلغاء</button>}</div></td></tr>)}</tbody></table></div>:<Empty title="لا توجد اشتراكات محفوظة" detail="الاشتراكات تظهر بعد إنشائها من سجلات النادي."/>}
    </section>
  </>;
}

type FinanceTab = "transactions"|"categories"|"employees"|"payroll"|"cash";
const methods:[string,string][]=[["cash","نقدًا"],["card","بطاقة"],["bank_transfer","تحويل بنكي"],["wallet","محفظة"]];
function FinancePage() {
  const session=useGetClubSession();
  const allowed=(p:string)=>!!session.data?.isOwner||!!session.data?.permissions.includes(p);
  const financeView=allowed("finance.view"), employeeView=allowed("employees.view"), payrollView=allowed("payroll.view");
  const tabs: [FinanceTab,string,typeof Wallet,boolean][]=[
    ["transactions","الحركات المالية",Banknote,financeView],["categories","التصنيفات",Tags,financeView],
    ["employees","الموظفون",Users,employeeView],["payroll","الرواتب",Wallet,payrollView],["cash","الصندوق",BriefcaseBusiness,financeView],
  ];
  const [tab,setTab]=useState<FinanceTab>("transactions"),[formOpen,setFormOpen]=useState(false),[error,setError]=useState(""),[message,setMessage]=useState(""),[kind,setKind]=useState("");
  const [editTxn,setEditTxn]=useState<ManagedFinanceTransaction|null>(null),[editEmployee,setEditEmployee]=useState<ManagedEmployee|null>(null),[reverse,setReverse]=useState<ManagedFinanceTransaction|null>(null);
  const qc=useQueryClient();
  const txnParams=kind?{kind:kind as "income"|"expense"}:undefined;
  const categories=useListFinanceCategoriesV2({query:{enabled:financeView,queryKey:getListFinanceCategoriesV2QueryKey()}});
  const transactions=useListFinanceTransactionsV2(txnParams,{query:{enabled:financeView,queryKey:getListFinanceTransactionsV2QueryKey(txnParams)}});
  const employees=useListEmployeesV2({query:{enabled:employeeView||payrollView,queryKey:getListEmployeesV2QueryKey()}});
  const payroll=useListPayrollV2({query:{enabled:payrollView,queryKey:getListPayrollV2QueryKey()}});
  const cash=useGetCashRegister({query:{enabled:financeView,queryKey:getGetCashRegisterQueryKey()}});
  const createTxn=useCreateFinanceTransactionV2(),updateTxn=useUpdateFinanceTransaction(),createCat=useCreateFinanceCategoryV2(),updateCat=useUpdateFinanceCategory();
  const createEmployee=useCreateEmployeeV2(),updateEmployee=useUpdateEmployee(),createPayroll=useCreatePayrollV2(),recordPayrollPayment=useRecordPayrollPayment(),recordCash=useRecordCashMovement();
  const busy=createTxn.isPending||updateTxn.isPending||createCat.isPending||updateCat.isPending||createEmployee.isPending||updateEmployee.isPending||createPayroll.isPending||recordPayrollPayment.isPending||recordCash.isPending;
  function refresh(){void qc.invalidateQueries({queryKey:getListFinanceTransactionsV2QueryKey()});void qc.invalidateQueries({queryKey:getListFinanceCategoriesV2QueryKey()});void qc.invalidateQueries({queryKey:getListEmployeesV2QueryKey()});void qc.invalidateQueries({queryKey:getListPayrollV2QueryKey()});void qc.invalidateQueries({queryKey:getGetCashRegisterQueryKey()});void qc.invalidateQueries({queryKey:getGetFinancePeriodReportQueryKey()});}
  function done(text:string){setMessage(text);setError("");refresh();setFormOpen(false);setEditTxn(null);setEditEmployee(null);}
  function fail(e:unknown){setError(errorText(e));setMessage("");}
  function submitForm(e:FormEvent<HTMLFormElement>){e.preventDefault();setError("");const f=new FormData(e.currentTarget);const amount=toFils(String(f.get("amount")||""));
    if(tab==="transactions"){if(amount===null||amount<1){setError("أدخل مبلغًا صحيحًا بالدينار، حتى ثلاث خانات عشرية.");return;}const data={kind:String(f.get("kind")) as "income"|"expense",categoryId:f.get("categoryId")?Number(f.get("categoryId")):null,amountFils:amount,method:String(f.get("method")) as "cash"|"card"|"bank_transfer"|"wallet",description:String(f.get("description")).trim(),transactionDate:String(f.get("date"))};if(editTxn)updateTxn.mutate({id:editTxn.id,data},{onSuccess:()=>done("تم تعديل الحركة المالية."),onError:fail});else createTxn.mutate({data},{onSuccess:()=>done("تم تسجيل الحركة المالية."),onError:fail});}
    if(tab==="categories")createCat.mutate({data:{name:String(f.get("name")).trim(),kind:String(f.get("kind")) as "income"|"expense"}},{onSuccess:()=>done("تمت إضافة التصنيف."),onError:fail});
    if(tab==="employees"){if(amount===null){setError("الراتب الأساسي غير صحيح.");return;}const data={name:String(f.get("name")).trim(),phone:String(f.get("phone")||"").trim()||null,position:String(f.get("position")).trim(),baseSalaryFils:amount,hiredAt:String(f.get("hiredAt")||"")||null};if(editEmployee)updateEmployee.mutate({id:editEmployee.id,data},{onSuccess:()=>done("تم تحديث بيانات الموظف."),onError:fail});else createEmployee.mutate({data},{onSuccess:()=>done("تم تسجيل الموظف."),onError:fail});}
    if(tab==="payroll"){if(amount===null||amount<1){setError("أدخل قيمة استحقاق صحيحة.");return;}createPayroll.mutate({data:{employeeId:Number(f.get("employeeId")),period:String(f.get("period")),amountFils:amount,dueDate:String(f.get("dueDate"))}},{onSuccess:()=>done("تم إنشاء استحقاق الراتب."),onError:fail});}
    if(tab==="cash"){if(amount===null||amount<1){setError("أدخل مبلغًا صحيحًا.");return;}recordCash.mutate({data:{direction:String(f.get("direction")) as "in"|"out",amountFils:amount,description:String(f.get("description")).trim()}},{onSuccess:()=>done("تم تسجيل حركة الصندوق."),onError:fail});}
  }
  function payEntry(id:number,remaining:number){const raw=window.prompt(`المبلغ المراد صرفه (المتبقي ${jod(remaining)} د.أ)`);if(!raw)return;const amount=toFils(raw);if(!amount||amount>remaining){setError("المبلغ غير صحيح أو يتجاوز المتبقي.");return;}recordPayrollPayment.mutate({id,data:{amountFils:amount,method:"cash"}},{onSuccess:()=>{setError("");setMessage("تم تسجيل دفعة الراتب.");refresh();},onError:fail});}
  async function reverseTransaction(tx:ManagedFinanceTransaction,reason:string){try{await api(`/finance/transactions/${tx.id}/reverse`,{method:"POST",body:JSON.stringify({reason})});setReverse(null);done("تم عكس الحركة بقيد تصحيحي.");}catch(e){fail(e);}}
  const currentTabs=tabs.filter(t=>t[3]); const activeTab=currentTabs.find(t=>t[0]===tab)?.[0]||currentTabs[0]?.[0]; useEffect(()=>{if(activeTab&&activeTab!==tab)setTab(activeTab);},[activeTab,tab]);
  const income=transactions.data?.filter(t=>t.kind==="income").reduce((a,x)=>a+x.amountFils,0)||0,expense=transactions.data?.filter(t=>t.kind==="expense").reduce((a,x)=>a+x.amountFils,0)||0;
  return <><PageTitle overline="إدارة المال والتشغيل" title="المالية والصندوق" subtitle="سجل لكل حركة، مع فصل صلاحيات المالية والموظفين والرواتب."><span className="currency-tag">الدينار الأردني · فلس</span></PageTitle>
    <div className="finance-hero-strip"><div><small>الرصيد النقدي الحالي</small><strong>{cash.data?<Money fils={cash.data.balanceFils}/>:cash.isError?"غير متاح":<span className="skeleton-inline"/>}</strong></div><div><small>إيرادات في السجلات المعروضة</small><strong><Money fils={income}/></strong></div><div><small>مصروفات في السجلات المعروضة</small><strong><Money fils={expense}/></strong></div></div>
    <div className="section-tabs finance-section-tabs">{currentTabs.map(([id,label,Icon])=><button key={id} role="tab" aria-selected={activeTab===id} className={activeTab===id?"primary-button":"outline-button"} onClick={()=>{setTab(id);setFormOpen(false);setError("");}}><Icon size={14}/>{label}</button>)}</div>
    {message&&<div className="notice">{message}</div>}{error&&<ErrorBox message={error}/>}
    {activeTab&&["transactions","categories","employees","payroll","cash"].includes(activeTab)&&<section className="surface">
      <div className="table-toolbar"><div><h2>{({transactions:"الحركات المالية",categories:"تصنيفات المالية",employees:"الموظفون",payroll:"استحقاقات الرواتب",cash:"الصندوق النقدي"} as Record<string,string>)[activeTab]}</h2><small>السجلات من واجهة النادي الرسمية.</small></div>
        {((activeTab==="transactions"&&allowed("finance.create"))||(activeTab==="categories"&&allowed("finance.create"))||(activeTab==="employees"&&allowed("employees.create"))||(activeTab==="payroll"&&allowed("payroll.create"))||(activeTab==="cash"&&allowed("finance.create")))&&<button className="primary-button" onClick={()=>{setFormOpen(!formOpen);setEditTxn(null);setEditEmployee(null);setError("");}}><Plus size={14}/> إضافة سجل</button>}
        {activeTab==="transactions"&&allowed("finance.export")&&<button className="outline-button" onClick={()=>void downloadApi("/club/exports/finance","iraq-alameer-finance.csv")}>تصدير CSV</button>}
        {activeTab==="payroll"&&allowed("payroll.export")&&<button className="outline-button" onClick={()=>void downloadApi("/club/exports/payroll","iraq-alameer-payroll.csv")}>تصدير الرواتب CSV</button>}
      </div>
      {formOpen&&<div className="surface-body"><form className="form-panel" onSubmit={submitForm}>
        {activeTab==="transactions"&&<><h2>{editTxn?"تعديل حركة مالية":"تسجيل حركة مالية"}</h2><div className="form-grid">
          <label className="field">نوع الحركة<select name="kind" defaultValue={editTxn?.kind||"income"}><option value="income">إيراد</option><option value="expense">مصروف</option></select></label>
          <label className="field">التصنيف<select name="categoryId" defaultValue={editTxn?.categoryId||""}><option value="">بدون تصنيف</option>{categories.data?.filter(c=>c.active).map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
          <label className="field">المبلغ بالدينار<input type="number" name="amount" min=".001" step=".001" required defaultValue={editTxn?editTxn.amountFils/1000:""}/></label>
          <label className="field">طريقة الدفع<select name="method" defaultValue={editTxn?.method||"cash"}>{methods.map(([v,l])=><option key={v} value={v}>{l}</option>)}</select></label>
          <label className="field">التاريخ<input type="date" name="date" defaultValue={editTxn?.transactionDate.slice(0,10)||today()} required/></label>
          <label className="field">البيان<input name="description" maxLength={500} minLength={1} required defaultValue={editTxn?.description||""}/></label>
        </div></>}
        {activeTab==="categories"&&<><h2>إضافة تصنيف مالي</h2><div className="form-grid"><label className="field">اسم التصنيف<input name="name" minLength={2} maxLength={100} required/></label><label className="field">نوع التصنيف<select name="kind"><option value="income">إيراد</option><option value="expense">مصروف</option></select></label></div></>}
        {activeTab==="employees"&&<><h2>{editEmployee?"تعديل الموظف":"موظف جديد"}</h2><div className="form-grid"><label className="field">الاسم<input name="name" required minLength={2} defaultValue={editEmployee?.name||""}/></label><label className="field">المسمى الوظيفي<input name="position" required minLength={2} defaultValue={editEmployee?.position||""}/></label><label className="field">الهاتف<input name="phone" dir="ltr" defaultValue={editEmployee?.phone||""}/></label><label className="field">الراتب الأساسي بالدينار<input name="amount" type="number" min="0" step=".001" required defaultValue={editEmployee?editEmployee.baseSalaryFils/1000:""}/></label><label className="field">تاريخ المباشرة<input name="hiredAt" type="date" defaultValue={editEmployee?.hiredAt?.slice(0,10)||""}/></label></div></>}
        {activeTab==="payroll"&&<><h2>استحقاق راتب جديد</h2>{!employeeView&&<div className="notice error">عرض الموظفين غير ممنوح. يلزم employees.view لاختيار الموظف.</div>}<div className="form-grid"><label className="field">الموظف<select name="employeeId" required disabled={!employeeView}><option value="">اختر موظفًا</option>{employees.data?.filter(x=>x.active).map(x=><option key={x.id} value={x.id}>{x.name}</option>)}</select></label><label className="field">الفترة<input name="period" type="month" required defaultValue={today().slice(0,7)}/></label><label className="field">المبلغ بالدينار<input name="amount" type="number" min=".001" step=".001" required/></label><label className="field">تاريخ الاستحقاق<input name="dueDate" type="date" required defaultValue={today()}/></label></div></>}
        {activeTab==="cash"&&<><h2>تسجيل حركة صندوق</h2><div className="form-grid"><label className="field">الاتجاه<select name="direction"><option value="in">إيداع / قبض</option><option value="out">سحب / صرف</option></select></label><label className="field">المبلغ بالدينار<input name="amount" type="number" min=".001" step=".001" required/></label><label className="field wide">الوصف<input name="description" minLength={2} maxLength={500} required/></label></div></>}
        <div className="form-actions"><button className="primary-button" disabled={busy}>{busy?"جارٍ الحفظ…":"حفظ السجل"}</button><button type="button" className="outline-button" onClick={()=>setFormOpen(false)}>إلغاء</button></div>
      </form></div>}
      {activeTab==="transactions"&&(transactions.isLoading?<Loading/>:transactions.isError?<div className="surface-body"><ErrorBox message={errorText(transactions.error)} retry={()=>transactions.refetch()}/></div>:transactions.data?.length?<><div className="surface-body finance-filter"><label>تصفية النوع<select value={kind} onChange={e=>setKind(e.target.value)}><option value="">كل الحركات</option><option value="income">الإيرادات</option><option value="expense">المصروفات</option></select></label></div><div className="table-scroll"><table className="data-table"><thead><tr><th>البيان</th><th>التصنيف</th><th>التاريخ</th><th>الطريقة</th><th>المبلغ</th>{(allowed("finance.edit")||allowed("finance.delete"))&&<th>العملية</th>}</tr></thead><tbody>{transactions.data.map(tx=><tr key={tx.id}><td>{tx.description}<small className="subline">{tx.kind==="income"?"إيراد":"مصروف"}{tx.reversed?" · معكوسة":""}</small></td><td>{tx.categoryName||"—"}</td><td>{tx.transactionDate.slice(0,10)}</td><td>{tx.method}</td><td><Money fils={tx.amountFils}/></td>{(allowed("finance.edit")||allowed("finance.delete"))&&<td><div className="row-tools">{allowed("finance.edit")&&!tx.reversed&&!tx.reversalOfId&&<button className="mini-action" onClick={()=>{setEditTxn(tx);setFormOpen(true);}}>تعديل</button>}{allowed("finance.delete")&&!tx.reversed&&!tx.reversalOfId&&<button className="mini-action danger-text" onClick={()=>setReverse(tx)}>عكس</button>}</div></td>}</tr>)}</tbody></table></div></>:<Empty title="لا توجد حركات مالية مسجلة" detail="لا نعرض قيودًا تجريبية أو بيانات محلية."/>)}
      {activeTab==="categories"&&(categories.isLoading?<Loading/>:categories.isError?<div className="surface-body"><ErrorBox message={errorText(categories.error)} retry={()=>categories.refetch()}/></div>:categories.data?.length?<div className="table-scroll"><table className="data-table"><thead><tr><th>التصنيف</th><th>النوع</th><th>الحالة</th><th>إجراء</th></tr></thead><tbody>{categories.data.map(c=><tr key={c.id}><td>{c.name}</td><td>{c.kind==="income"?"إيراد":"مصروف"}</td><td><Status value={c.active?"active":"suspended"}/></td><td className="row-tools">{allowed("finance.edit")&&<><button className="mini-action" onClick={()=>{const name=window.prompt("اسم التصنيف",c.name)?.trim();if(name&&name!==c.name)updateCat.mutate({id:c.id,data:{name}},{onSuccess:()=>done("تم تحديث اسم التصنيف."),onError:fail});}}>تعديل الاسم</button><button className="mini-action" onClick={()=>updateCat.mutate({id:c.id,data:{active:!c.active}},{onSuccess:()=>done("تم تحديث حالة التصنيف."),onError:fail})}>{c.active?"إيقاف":"تفعيل"}</button></>}{allowed("finance.delete")&&<button className="mini-action danger-text" onClick={async()=>{if(!window.confirm(`حذف التصنيف «${c.name}»؟ إذا ارتبط بحركة فسيُؤرشف بدل الحذف.`))return;try{const result=await api<{archived:boolean}>(`/finance/categories/${c.id}`,{method:"DELETE"});done(result.archived?"تمت أرشفة التصنيف المرتبط بسجلات.":"تم حذف التصنيف.");}catch(e){fail(e);}}}>حذف</button>}</td></tr>)}</tbody></table></div>:<Empty title="لا توجد تصنيفات مالية"/> )}
      {activeTab==="employees"&&(employees.isLoading?<Loading/>:employees.isError?<div className="surface-body"><ErrorBox message={errorText(employees.error)} retry={()=>employees.refetch()}/></div>:employees.data?.length?<div className="table-scroll"><table className="data-table"><thead><tr><th>الموظف</th><th>الوظيفة</th><th>الراتب الأساسي</th><th>مستحقات غير مدفوعة</th><th>الحالة</th><th>إجراء</th></tr></thead><tbody>{employees.data.map(emp=><tr key={emp.id}><td>{emp.name}<small className="subline">{emp.phone||"لا يوجد هاتف"}</small></td><td>{emp.position}</td><td><Money fils={emp.baseSalaryFils}/></td><td><Money fils={emp.outstandingFils}/></td><td><Status value={emp.active?"active":"suspended"}/></td><td className="row-tools">{allowed("employees.edit")&&<><button className="mini-action" onClick={()=>{setEditEmployee(emp);setFormOpen(true);}}>تعديل</button><button className="mini-action" onClick={()=>updateEmployee.mutate({id:emp.id,data:{active:!emp.active}},{onSuccess:()=>done("تم تحديث حالة الموظف."),onError:fail})}>{emp.active?"إيقاف":"تفعيل"}</button></>}{allowed("employees.delete")&&<button className="mini-action danger-text" onClick={async()=>{if(!window.confirm(`حذف الموظف «${emp.name}»؟ قد يؤرشفه النظام إذا كان مرتبطًا برواتب.`))return;try{const result=await api<{archived:boolean}>(`/finance/employees/${emp.id}`,{method:"DELETE"});done(result.archived?"تمت أرشفة الموظف المرتبط بسجلات.":"تم حذف الموظف.");}catch(e){fail(e);}}}>حذف / أرشفة</button>}</td></tr>)}</tbody></table></div>:<Empty title="لا يوجد موظفون مسجلون"/> )}
      {activeTab==="payroll"&&(payroll.isLoading?<Loading/>:payroll.isError?<div className="surface-body"><ErrorBox message={errorText(payroll.error)} retry={()=>payroll.refetch()}/></div>:payroll.data?.length?<div className="table-scroll"><table className="data-table"><thead><tr><th>الموظف</th><th>الفترة</th><th>المبلغ</th><th>المدفوع</th><th>المتبقي</th><th>الاستحقاق</th><th>الحالة</th><th>إجراء</th></tr></thead><tbody>{payroll.data.map(entry=><tr key={entry.id}><td>{entry.employeeName}</td><td>{entry.period}</td><td><Money fils={entry.amountFils}/></td><td><Money fils={entry.paidFils}/></td><td><Money fils={entry.outstandingFils}/></td><td>{entry.dueDate.slice(0,10)}</td><td><Status value={entry.status}/></td><td className="row-tools">{allowed("payroll.approve")&&entry.outstandingFils>0&&<button className="mini-action" onClick={()=>payEntry(entry.id,entry.outstandingFils)}>تسجيل صرف</button>}</td></tr>)}</tbody></table></div>:<Empty title="لا توجد استحقاقات رواتب"/> )}
      {activeTab==="cash"&&(cash.isLoading?<Loading/>:cash.isError?<div className="surface-body"><ErrorBox message={errorText(cash.error)} retry={()=>cash.refetch()}/></div>:cash.data?.movements.length?<div className="table-scroll"><table className="data-table"><thead><tr><th>التاريخ</th><th>الاتجاه</th><th>الوصف</th><th>المبلغ</th><th>المرجع</th></tr></thead><tbody>{cash.data.movements.map(m=><tr key={m.id}><td>{new Date(m.createdAt).toLocaleString("ar-IQ",{timeZone:"Asia/Amman"})}</td><td><Status value={m.direction==="in"?"active":"due"}/></td><td>{m.description}</td><td><Money fils={m.amountFils}/></td><td>{m.referenceType||"—"}</td></tr>)}</tbody></table></div>:<Empty title="لا توجد حركات في الصندوق"/> )}
    </section>}
    {reverse&&<div className="confirm-overlay"><form className="confirm-card" onSubmit={e=>{e.preventDefault();const reason=String(new FormData(e.currentTarget).get("reason")||"").trim();if(reason.length<3){setError("اكتب سببًا من ثلاثة أحرف على الأقل.");return;}void reverseTransaction(reverse,reason);}}><h2>عكس حركة مالية</h2><p>سيُسجل قيد عكسي محفوظ، ولن تُحذف الحركة الأصلية. المبلغ: <Money fils={reverse.amountFils}/></p><label className="field">سبب العكس<input name="reason" required minLength={3} maxLength={500}/></label><div className="form-actions"><button className="danger-button">تأكيد العكس</button><button className="outline-button" type="button" onClick={()=>setReverse(null)}>إلغاء</button></div></form></div>}
  </>;
}

function ReportsPage() {
  const [period,setPeriod]=useState<"day"|"month"|"year">("month"),[date,setDate]=useState(today());
  const params={period,date};
  const report=useGetFinancePeriodReport(params,{query:{queryKey:getGetFinancePeriodReportQueryKey(params)}});
  const from=`${date.slice(0,7)}-01`,to=date;
  const summary=useGetFinanceReport({from,to},{query:{queryKey:getGetFinanceReportQueryKey({from,to})}});
  const session=useGetClubSession(),canExport=!!session.data?.isOwner||!!session.data?.permissions.includes("finance.export");
  const data=report.data;
  function exportReport(){if(!data)return;csvDownload(`iraq-alameer-report-${date}.csv`,["التاريخ","النوع","التصنيف","الوصف","طريقة الدفع","المبلغ بالفلس"],data.transactions.map(t=>[t.transactionDate,t.kind,t.categoryName||"",t.description,t.method,t.amountFils]));}
  return <><PageTitle overline="المؤشرات والتقارير" title="تقارير النادي" subtitle="الفترة المختارة تُقرأ من تقارير الخادم المحاسبية.">{canExport&&<button className="outline-button" onClick={exportReport} disabled={!data?.transactions.length}><Download size={14}/> تصدير الفترة CSV</button>}<button className="outline-button" onClick={()=>window.print()}><Printer size={14}/> طباعة</button></PageTitle>
    <section className="surface surface-pad report-controls"><label className="field">نوع الفترة<select value={period} onChange={e=>setPeriod(e.target.value as "day"|"month"|"year")}><option value="day">يومي</option><option value="month">شهري</option><option value="year">سنوي</option></select></label><label className="field">التاريخ<input type={period==="day"?"date":period==="month"?"month":"number"} min={period==="year"?"2000":undefined} max={period==="year"?String(new Date().getFullYear()):undefined} value={period==="year"?date.slice(0,4):period==="month"?date.slice(0,7):date} onChange={e=>{const v=e.target.value;setDate(period==="year"?`${v}-01-01`:period==="month"?`${v}-01`:v);}}/></label><button className="outline-button" onClick={()=>{void report.refetch();void summary.refetch();}}><RefreshCw size={14}/> تحديث التقرير</button></section>
    {report.isLoading&&!data?<Loading/>:report.isError&&!data?<ErrorBox message={errorText(report.error)} retry={()=>report.refetch()}/>:data&&<>
      <div className="metric-grid report-metrics"><StatCard icon={ArrowDownLeft} title="إيرادات الفترة" value={<Money fils={data.incomeFils}/>} note={`${data.fromDate} — ${data.toDate}`}/><StatCard icon={ArrowUpLeft} title="مصروفات الفترة" value={<Money fils={data.expenseFils}/>} note="حسب تصنيف الحركات"/><StatCard icon={Activity} title="صافي الفترة" value={<Money fils={data.netFils}/>} note="الإيرادات مطروحًا منها المصروفات"/><StatCard icon={Wallet} title="رواتب مستحقة" value={<Money fils={data.payrollOutstandingFils}/>} note="الرصيد الحالي المسجل"/><StatCard icon={BriefcaseBusiness} title="رصيد الصندوق" value={<Money fils={data.cashBalanceFils}/>} note="من سجل حركات الصندوق"/><StatCard icon={CircleHelp} title="ديون المشتركين" value={<Money fils={summary.data?.debtFils||0}/>} note={summary.isError?"تعذر تحميل ملخص الأرصدة":"من التقرير المالي للفترة"}/></div>
      <div className="grid-two"><section className="surface"><div className="surface-head"><h2>الإيرادات حسب التصنيف</h2></div>{data.incomeByCategory.length?<div className="surface-body">{data.incomeByCategory.map((c,i)=><div className="report-line" key={`${c.categoryId}-${i}`}><span>{c.categoryName}</span><b><Money fils={c.amountFils}/></b><div className="report-bar"><i style={{width:`${Math.max(3,Math.min(100,data.incomeFils?c.amountFils/data.incomeFils*100:0))}%`}}/></div></div>)}</div>:<Empty title="لا توجد إيرادات مصنفة للفترة"/>}</section>
      <section className="surface"><div className="surface-head"><h2>المصروفات حسب التصنيف</h2></div>{data.expenseByCategory.length?<div className="surface-body">{data.expenseByCategory.map((c,i)=><div className="report-line expense-line" key={`${c.categoryId}-${i}`}><span>{c.categoryName}</span><b><Money fils={c.amountFils}/></b><div className="report-bar"><i style={{width:`${Math.max(3,Math.min(100,data.expenseFils?c.amountFils/data.expenseFils*100:0))}%`}}/></div></div>)}</div>:<Empty title="لا توجد مصروفات مصنفة للفترة"/>}</section></div>
      <section className="surface report-transactions"><div className="surface-head"><div><h2>حركات التقرير</h2><p>{data.transactions.length} حركة محفوظة للفترة</p></div></div>{data.transactions.length?<div className="table-scroll"><table className="data-table"><thead><tr><th>التاريخ</th><th>النوع</th><th>التصنيف</th><th>البيان</th><th>الطريقة</th><th>القيمة</th></tr></thead><tbody>{data.transactions.map(t=><tr key={t.id}><td>{t.transactionDate.slice(0,10)}</td><td>{t.kind==="income"?"إيراد":"مصروف"}</td><td>{t.categoryName||"—"}</td><td>{t.description}</td><td>{t.method}</td><td><Money fils={t.amountFils}/></td></tr>)}</tbody></table></div>:<Empty title="لا توجد حركات مالية في هذه الفترة"/>}</section>
    </>}
  </>;
}

function ReceiptPage() {
  const {id:raw}=useParams<{id:string}>(),id=Number(raw);
  const q=useGetPaymentReceipt(id,{query:{queryKey:getGetPaymentReceiptQueryKey(id),enabled:id>0}});
  if(q.isLoading)return <><PageTitle overline="المعاملات" title="الإيصال"/><Loading/></>;
  if(q.isError||!q.data)return <><PageTitle overline="المعاملات" title="الإيصال"/><ErrorBox message={errorText(q.error)} retry={()=>q.refetch()}/></>;
  const r=q.data;
  return <><PageTitle overline="إيصال دفع محفوظ" title={`إيصال ${r.receiptNumber}`}><button className="primary-button no-print" onClick={()=>window.print()}><Printer size={15}/> طباعة الإيصال</button></PageTitle><article className="receipt-sheet">
    <div className="receipt-brand"><img src={logo} alt="شعار نادي عراق الأمير"/><div><h2>نادي عراق الأمير</h2><p>إيصال دفع · سجل مالي معتمد</p></div></div>
    <div className="receipt-amount">المبلغ المستلم<strong>{jod(r.amountFils)} <small>{r.currency}</small></strong></div>
    <div className="receipt-lines"><div className="receipt-line"><span>رقم الإيصال</span><strong>{r.receiptNumber}</strong></div><div className="receipt-line"><span>اسم المشترك</span><strong>{r.memberName}</strong></div><div className="receipt-line"><span>رقم الهاتف</span><strong dir="ltr">{r.memberPhone}</strong></div><div className="receipt-line"><span>الباقة</span><strong>{r.planName}</strong></div><div className="receipt-line"><span>طريقة الدفع</span><strong>{r.method}</strong></div><div className="receipt-line"><span>التاريخ</span><strong>{new Intl.DateTimeFormat("ar-IQ",{dateStyle:"long",timeStyle:"short",timeZone:"Asia/Amman"}).format(new Date(r.createdAt))}</strong></div></div>
    <p className="receipt-footnote">هذا الإيصال يعرض تفاصيل المعاملة المحفوظة في نظام النادي. العملة والقيمة كما وردتا من النظام المالي.</p>
  </article></>;
}

function AttendancePage() {
  type AttendanceStatus="present"|"absent"|"late";
  type AttendanceRecord={id:number;memberId:number;memberName?:string;phone?:string|null;date:string;status:AttendanceStatus;note?:string|null;createdAt?:string};
  const session=useGetClubSession(),qc=useQueryClient();
  const [date,setDate]=useState(today()),[search,setSearch]=useState(""),[memberSearch,setMemberSearch]=useState(""),[memberId,setMemberId]=useState(""),[status,setStatus]=useState<AttendanceStatus>("present"),[note,setNote]=useState(""),[error,setError]=useState(""),[message,setMessage]=useState("");
  const canView=!!session.data?.isOwner||!!session.data?.permissions.includes("members.view");
  const canWrite=!!session.data?.isOwner||!!session.data?.permissions.includes("members.edit");
  const params=new URLSearchParams({date,...(search.trim()?{search:search.trim()}:{})});
  const queryKey=["iraq-attendance",date,search.trim()] as const;
  const attendance=useQuery({queryKey,queryFn:async()=>{const response=await api<AttendanceRecord[]|{items?:AttendanceRecord[];records?:AttendanceRecord[]}>(`/iraq/attendance?${params.toString()}`);return Array.isArray(response)?response:response.items||response.records||[];},enabled:canView});
  const members=useListMembers({search:memberSearch.trim()||undefined,limit:100},{query:{enabled:canWrite&&canView,queryKey:getListMembersQueryKey({search:memberSearch.trim()||undefined,limit:100})}});
  const save=useMutation({mutationFn:(body:{memberId:number;date:string;status:AttendanceStatus;note?:string})=>api<AttendanceRecord>("/iraq/attendance",{method:"POST",body:JSON.stringify(body)}),onSuccess:()=>{setError("");setMessage("تم حفظ الحضور في سجل النادي.");setMemberId("");setNote("");void qc.invalidateQueries({queryKey:["iraq-attendance"]});},onError:e=>{setMessage("");setError(errorText(e));}});
  const remove=useMutation({mutationFn:(id:number)=>api<void>(`/iraq/attendance/${id}`,{method:"DELETE"}),onSuccess:()=>{setError("");setMessage("تم حذف سجل الحضور.");void qc.invalidateQueries({queryKey:["iraq-attendance"]});},onError:e=>{setMessage("");setError(errorText(e));}});
  function submit(e:FormEvent<HTMLFormElement>){e.preventDefault();setError("");const id=Number(memberId);if(!Number.isSafeInteger(id)||id<1){setError("اختر مشتركًا صالحًا.");return;}if(!date){setError("اختر تاريخ الحضور.");return;}save.mutate({memberId:id,date,status,note:note.trim()||undefined});}
  const statusLabel:Record<AttendanceStatus,string>={present:"حاضر",absent:"غائب",late:"متأخر"};
  if(!canView&&!canWrite)return <><PageTitle overline="التشغيل اليومي" title="الحضور"/><div className="notice error">تحتاج صلاحية members.view لعرض الحضور أو members.edit لتسجيله.</div></>;
  return <><PageTitle overline="التشغيل اليومي" title="الحضور اليومي" subtitle="تسجيل ومراجعة الحضور المحفوظ عبر واجهة النادي."/>
    {message&&<div className="notice" role="status">{message}</div>}{error&&<ErrorBox message={error}/>}
    {canWrite&&<section className="surface surface-pad attendance-entry"><form onSubmit={submit}><h2>تسجيل حضور مشترك</h2><div className="form-grid">
      {canView?<><label className="field wide">بحث في المشتركين<input value={memberSearch} onChange={e=>setMemberSearch(e.target.value)} placeholder="اكتب الاسم أو الهاتف"/></label><label className="field">المشترك<select required value={memberId} onChange={e=>setMemberId(e.target.value)}><option value="">اختر مشتركًا</option>{members.data?.map(m=><option key={m.id} value={m.id}>{m.name} · {m.phone}</option>)}</select></label></>:<label className="field">رقم المشترك<input type="number" min="1" value={memberId} onChange={e=>setMemberId(e.target.value)} required/></label>}
      <label className="field">التاريخ<input type="date" value={date} onChange={e=>setDate(e.target.value)} required/></label>
      <label className="field">الحالة<select value={status} onChange={e=>setStatus(e.target.value as AttendanceStatus)}><option value="present">حاضر</option><option value="absent">غائب</option><option value="late">متأخر</option></select></label>
      <label className="field wide">ملاحظة اختيارية<input maxLength={500} value={note} onChange={e=>setNote(e.target.value)} placeholder="معلومة مختصرة عن الحضور"/></label>
    </div><div className="form-actions"><button className="primary-button" disabled={save.isPending||!memberId}><Check size={15}/>{save.isPending?"جارٍ الحفظ…":"حفظ سجل الحضور"}</button></div></form></section>}
    {canView&&<section className="surface attendance-workspace"><div className="table-toolbar"><div><h2>سجل الحضور</h2><small>{attendance.data?`${attendance.data.length} سجلًا في النتائج`:"تصفية حسب التاريخ والاسم أو الهاتف"}</small></div><div className="attendance-filters"><label className="field">التاريخ<input type="date" value={date} onChange={e=>setDate(e.target.value)}/></label><label className="search-field"><Search size={14}/><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="بحث بالمشترك أو الهاتف"/></label><button className="outline-button" type="button" disabled={attendance.isFetching} onClick={()=>void attendance.refetch()}><RefreshCw size={14}/> تحديث</button></div></div>
      {attendance.isLoading?<Loading label="تحميل سجل الحضور"/>:attendance.isError?<div className="surface-body"><ErrorBox message={errorText(attendance.error)} retry={()=>attendance.refetch()}/></div>:attendance.data?.length?<div className="table-scroll"><table className="data-table"><thead><tr><th>المشترك</th><th>الهاتف</th><th>التاريخ</th><th>الحالة</th><th>ملاحظة</th>{canWrite&&<th>إجراء</th>}</tr></thead><tbody>{attendance.data.map(row=><tr key={row.id}><td>{row.memberName||`#${row.memberId}`}</td><td dir="ltr">{row.phone||"—"}</td><td>{row.date}</td><td><Status value={row.status==="present"?"active":row.status==="late"?"partial":"suspended"}/><span className="attendance-status-label">{statusLabel[row.status]}</span></td><td>{row.note||"—"}</td>{canWrite&&<td><button className="mini-action danger-text" disabled={remove.isPending} onClick={()=>{if(window.confirm(`حذف سجل حضور ${row.memberName||row.memberId} بتاريخ ${row.date}؟`))remove.mutate(row.id);}}>حذف السجل</button></td>}</tr>)}</tbody></table></div>:<Empty title="لا توجد سجلات حضور لهذا الاختيار" detail="اختر تاريخًا أو أضف أول سجل حضور للنادي."/>}
    </section>}
  </>;
}

function WhatsAppPage() {
  type WhatsAppStatus={enabled:boolean;configured:boolean};
  const qc=useQueryClient(),status=useQuery({queryKey:["admin","whatsapp-reminders"],queryFn:()=>api<WhatsAppStatus>("/club/admin/whatsapp-reminders")});
  const update=useMutation({mutationFn:(enabled:boolean)=>api<WhatsAppStatus>("/club/admin/whatsapp-reminders",{method:"PUT",body:JSON.stringify({enabled})}),onSuccess:d=>qc.setQueryData(["admin","whatsapp-reminders"],d)});
  const session=useGetClubSession(),can=!!session.data?.isOwner||!!session.data?.permissions.includes("whatsapp.create");
  return <><PageTitle overline="إعدادات التواصل" title="تذكيرات واتساب" subtitle="حالة الربط والتشغيل تعكس إعدادات الخادم الفعلية."/>
    <section className="surface surface-pad whatsapp-panel"><div className="whatsapp-symbol"><MessageCircle size={24}/></div><h2>تذكيرات الاشتراكات</h2><p>يُرسل التذكير من خدمة الخادم فقط عند تفعيل الإعدادات ووجود إعداد Meta Business مكتمل. قبول مزود الرسائل لا يثبت التسليم.</p>
      {status.isLoading?<Loading/>:status.isError?<ErrorBox message={errorText(status.error)} retry={()=>status.refetch()}/>:status.data?<><div className="whatsapp-state"><span>حالة التفعيل</span><Status value={status.data.enabled?"active":"suspended"}/><strong dir="ltr">{status.data.enabled?"ON":"OFF"}</strong></div><div className="whatsapp-state"><span>إعداد API / Meta</span><Status value={status.data.configured?"active":"due"}/><strong>{status.data.configured?"مكتمل حسب الخادم":"غير مكتمل"}</strong></div>
      <label className="toggle-row"><span><strong>تشغيل التذكيرات</strong><small>الحالة الافتراضية مغلقة ما لم يخزن النظام أنها مفعّلة.</small></span><input type="checkbox" role="switch" checked={status.data.enabled} disabled={!can||update.isPending||!status.data.configured} onChange={e=>update.mutate(e.target.checked)}/></label>
      {!can&&<p className="muted">تحتاج whatsapp.create لتعديل إعداد التفعيل.</p>}{!status.data.configured&&<div className="notice error">الإرسال غير جاهز؛ بيانات الربط غير مكتملة. لا يمكن تفعيل الإرسال من الواجهة قبل إكمال إعداد الخادم.</div>}
      </>:<Empty title="حالة واتساب غير متاحة"/>}
      {update.isError&&<ErrorBox message={errorText(update.error)}/>}
    </section>
  </>;
}

function AccountPage() {
  return <><PageTitle overline="الحساب والوصول" title="إعدادات حسابي" subtitle="تتم إدارة بيانات الهوية والأمان من موفر تسجيل الدخول للنادي."/><section className="surface account-profile"><UserProfile routing="path" path={`${base}/account`} appearance={{variables:{colorPrimary:"#17863f",colorBackground:"#ffffff",colorForeground:"#15243b",fontFamily:'"IBM Plex Sans Arabic", sans-serif',borderRadius:"0.8rem"}}}/></section></>;
}

type ClubSettings={clubName:string;currency:string;timezone:string;memberRequiredFields:string[];paymentMethods:string[];maxDiscountPercent:number;financialYearStartMonth:number;reminderDays:number[];renewalPolicy:string};
type AdminUser={id:number;email:string;displayName:string|null;role:string;status:"pending"|"active"|"rejected"|"suspended";isOwner:boolean;permissions:string[];permissionOverrides:Record<string,boolean>;createdAt:string};
type AdminRole={name:string;label:string;builtIn:boolean;permissions:string[];assignedCount:number};
type PermissionEntry={name:string;label:string;section:string;sectionLabel:string;actionLabel:string};
type Backup={id:number;label:string;createdAt:string;createdBy:string;bytes:number;counts:Record<string,number>};
const methodNames:Record<string,string>={cash:"نقدًا",card:"بطاقة",bank_transfer:"تحويل بنكي",wallet:"محفظة"};
const userStatusNames:Record<string,string>={pending:"بانتظار الموافقة",active:"فعّال",rejected:"مرفوض",suspended:"موقوف"};
function AdminPage() {
  const session=useGetClubSession();
  const [tab,setTab]=useState("general");
  if(!session.data?.isOwner)return <><PageTitle overline="إدارة النظام" title="إعدادات النادي"/><div className="notice error">هذه الصفحة محصورة بالمالك الرئيسي.</div></>;
  const tabs=[["general","عام"],["users","المستخدمون"],["roles","الأدوار والصلاحيات"],["backups","النسخ الاحتياطي"],["audit","سجل التدقيق"],["security","الأمان"]];
  return <><PageTitle overline="المالك · الحوكمة" title="إدارة النظام" subtitle="إعدادات النادي، الوصول، التدقيق والنسخ الاحتياطية."/>
    <div className="admin-tabs" role="tablist">{tabs.map(([id,label])=><button key={id} role="tab" aria-selected={tab===id} className={tab===id?"primary-button":"outline-button"} onClick={()=>setTab(id)}>{label}</button>)}</div>
    {tab==="general"&&<AdminGeneral/>}{tab==="users"&&<AdminUsers/>}{tab==="roles"&&<AdminRoles/>}{tab==="backups"&&<AdminBackups/>}{tab==="audit"&&<AdminAudit/>}{tab==="security"&&<AdminSecurity/>}
  </>;
}
function AdminGeneral() {
  const qc=useQueryClient(),q=useQuery({queryKey:["admin","settings"],queryFn:()=>api<ClubSettings>("/club/admin/settings")});
  const [draft,setDraft]=useState<ClubSettings|null>(null),[days,setDays]=useState("");
  const save=useMutation({mutationFn:(settings:ClubSettings)=>api<ClubSettings>("/club/admin/settings",{method:"PUT",body:JSON.stringify(settings)}),onSuccess:s=>{qc.setQueryData(["admin","settings"],s);void qc.invalidateQueries({queryKey:["operational-settings"]});setDraft(null);}});
  const s=draft||q.data;
  if(q.isLoading)return <Loading/>;if(q.isError||!s)return <ErrorBox message={errorText(q.error)} retry={()=>q.refetch()}/>;
  const set=(patch:Partial<ClubSettings>)=>setDraft({...s,...patch});
  return <div className="admin-layout">
    <section className="surface surface-pad"><h2>الإعدادات العامة</h2><p className="muted">تنعكس بعض هذه القيم على إنشاء المشتركين والاشتراكات.</p><form onSubmit={e=>{e.preventDefault();save.mutate(s);}}>
      <div className="form-grid"><label className="field">اسم النادي<input required value={s.clubName} onChange={e=>set({clubName:e.target.value})}/></label><label className="field">العملة<input readOnly value={s.currency}/></label><label className="field">المنطقة الزمنية<input readOnly value={s.timezone}/></label><label className="field">سياسة التجديد<select value={s.renewalPolicy} onChange={e=>set({renewalPolicy:e.target.value})}><option value="after_end">السماح بالتجديد المبكر دون تداخل</option><option value="after_expiry_only">التجديد بعد انتهاء الاشتراك فقط</option></select></label><label className="field">الحد الأعلى للخصم (%)<input type="number" min="0" max="100" value={s.maxDiscountPercent} onChange={e=>set({maxDiscountPercent:Number(e.target.value)})}/></label><label className="field">بداية السنة المالية<input type="number" min="1" max="12" value={s.financialYearStartMonth} onChange={e=>set({financialYearStartMonth:Number(e.target.value)})}/></label></div>
      <p><strong>الحقول الإلزامية للمشترك</strong></p>{["email","birthDate"].map(k=><label className="admin-check" key={k}><input type="checkbox" checked={s.memberRequiredFields.includes(k)} onChange={e=>set({memberRequiredFields:e.target.checked?[...s.memberRequiredFields,k]:s.memberRequiredFields.filter(x=>x!==k)})}/>{k==="email"?"البريد الإلكتروني":"تاريخ الميلاد"}</label>)}
      <p><strong>طرق الدفع المفعّلة</strong></p>{Object.entries(methodNames).map(([key,label])=><label className="admin-check" key={key}><input type="checkbox" checked={s.paymentMethods.includes(key)} onChange={e=>set({paymentMethods:e.target.checked?[...s.paymentMethods,key]:s.paymentMethods.filter(m=>m!==key)})}/>{label}</label>)}
      <p><strong>أيام التذكير قبل الانتهاء</strong></p><label className="field"><span>أرقام مفصولة بفواصل (٠ إلى ٣٠)</span><input value={days||s.reminderDays.join(",")} onChange={e=>{setDays(e.target.value);const next=e.target.value.split(",").map(x=>x.trim()).filter(Boolean).map(Number);if(next.every(x=>Number.isInteger(x)&&x>=0&&x<=30))set({reminderDays:next});}}/></label>
      <p className="notice">تغيير الأيام لا يعني أن خدمة واتساب جاهزة. تحقق من إعدادات Meta في قسم واتساب.</p>{save.isError&&<ErrorBox message={errorText(save.error)}/>}<div className="form-actions"><button className="primary-button" disabled={save.isPending||!s.paymentMethods.length}>{save.isPending?"جارٍ الحفظ…":"حفظ الإعدادات"}</button>{draft&&<button className="outline-button" type="button" onClick={()=>{setDraft(null);setDays("");}}>إلغاء التغييرات</button>}</div>
    </form></section>
    <div><section className="surface surface-pad"><h2>الإعدادات التشغيلية</h2><p className="muted">حالة الخدمة الفعلية تعرضها واجهة واتساب.</p><Link href="/settings/whatsapp" className="outline-button"><MessageCircle size={15}/> فتح حالة واتساب</Link></section><AdminOverview/></div>
  </div>;
}
function AdminOverview() {
  const q=useQuery({queryKey:["admin","overview"],queryFn:()=>api<{pendingCount:number;userCount:number}>("/club/admin/overview"),refetchInterval:15000});
  return <section className="surface surface-pad admin-overview"><h2>حالة الوصول</h2>{q.isLoading?<Loading/>:q.isError?<ErrorBox message={errorText(q.error)} retry={()=>q.refetch()}/>:q.data?<div className="admin-summary"><div><small>طلبات بانتظار الموافقة</small><strong>{q.data.pendingCount}</strong></div><div><small>حسابات الفريق</small><strong>{q.data.userCount}</strong></div></div>:<Empty title="لا تتوفر بيانات الوصول"/>}</section>;
}
function AdminUsers() {
  const qc=useQueryClient(),[status,setStatus]=useState(""),[search,setSearch]=useState("");
  const catalog=useQuery({queryKey:["admin","roles"],queryFn:()=>api<{roles:AdminRole[];catalog:PermissionEntry[]}>("/club/admin/roles")});
  const q=useQuery({queryKey:["admin","users",status,search],queryFn:()=>api<AdminUser[]>(`/club/admin/users?status=${encodeURIComponent(status)}&search=${encodeURIComponent(search)}`),refetchInterval:15000});
  const patch=useMutation({mutationFn:(v:{id:number;body:object})=>api<AdminUser>(`/club/admin/users/${v.id}`,{method:"PATCH",body:JSON.stringify(v.body)}),onSuccess:()=>{void qc.invalidateQueries({queryKey:["admin","users"]});void qc.invalidateQueries({queryKey:["admin","roles"]});void qc.invalidateQueries({queryKey:["admin","overview"]});void qc.invalidateQueries({queryKey:getGetClubSessionQueryKey()});}});
  const [err,setErr]=useState("");
  return <section className="surface"><div className="table-toolbar"><div><h2>طلبات الانضمام وإدارة الحسابات</h2><small>الحالة والصلاحيات من خدمة الإدارة.</small></div><select value={status} onChange={e=>setStatus(e.target.value)}><option value="">كل الحالات</option>{Object.entries(userStatusNames).map(([key,label])=><option key={key} value={key}>{label}</option>)}</select><label className="search-field"><Search size={15}/><input placeholder="بحث بالاسم أو البريد" value={search} onChange={e=>setSearch(e.target.value)}/></label></div>
    {err&&<ErrorBox message={err}/>}
    {q.isLoading?<Loading/>:q.isError?<div className="surface-body"><ErrorBox message={errorText(q.error)} retry={()=>q.refetch()}/></div>:q.data?.length?q.data.map(user=><AdminUserCard key={user.id} user={user} roles={catalog.data?.roles||[]} catalog={catalog.data?.catalog||[]} busy={patch.isPending} onSave={body=>patch.mutate({id:user.id,body},{onError:e=>setErr(errorText(e))})}/>):<Empty title="لا توجد حسابات مطابقة"/>}
  </section>;
}
function AdminUserCard({user,roles,catalog,busy,onSave}:{user:AdminUser;roles:AdminRole[];catalog:PermissionEntry[];busy:boolean;onSave:(body:object)=>void}) {
  const [role,setRole]=useState(user.role||"staff"),[overrides,setOverrides]=useState<Record<string,boolean>>(user.permissionOverrides||{}),[expanded,setExpanded]=useState(false);
  const sections=[...new Set(catalog.filter(c=>!["settings","users","roles","backups","audit","security"].includes(c.section)).map(c=>c.section))];
  return <article className="admin-card"><div className="admin-user-head"><div><h3>{user.displayName||user.email}{user.isOwner?" · المالك":""}</h3><small>{user.email} · {new Date(user.createdAt).toLocaleDateString("ar-IQ",{timeZone:"Asia/Amman"})}</small></div><Status value={user.status}/></div>
    {!user.isOwner&&<><div className="row-tools admin-user-actions"><select value={role} onChange={e=>setRole(e.target.value)}>{roles.map(r=><option key={r.name} value={r.name}>{r.label}</option>)}</select>
      {user.status==="pending"&&<><button className="primary-button" disabled={busy} onClick={()=>onSave({status:"active",role,permissionOverrides:overrides})}>موافقة</button><button className="outline-button" disabled={busy} onClick={()=>window.confirm("رفض طلب هذا الحساب؟")&&onSave({status:"rejected"})}>رفض</button></>}
      {user.status==="active"&&<><button className="outline-button" disabled={busy} onClick={()=>onSave({role,permissionOverrides:overrides})}>حفظ الصلاحيات</button><button className="outline-button" disabled={busy} onClick={()=>window.confirm("إيقاف هذا الحساب؟")&&onSave({status:"suspended"})}>إيقاف</button></>}
      {["suspended","rejected"].includes(user.status)&&<button className="primary-button" disabled={busy} onClick={()=>onSave({status:"active",role,permissionOverrides:overrides})}>إعادة التفعيل</button>}
      <button className="mini-action" onClick={()=>setExpanded(!expanded)}>{expanded?"إخفاء الاستثناءات":"استثناءات الصلاحيات"}</button>
    </div>{expanded&&<div className="admin-matrix">{sections.map(section=><fieldset key={section}><legend>{catalog.find(c=>c.section===section)?.sectionLabel||section}</legend>{catalog.filter(c=>c.section===section).map(item=><div className="permission-row" key={item.name}><span>{item.actionLabel}</span><select value={item.name in overrides?(overrides[item.name]?"allow":"deny"):"inherit"} onChange={e=>{const v=e.target.value;setOverrides(prev=>{const next={...prev};if(v==="inherit")delete next[item.name];else next[item.name]=v==="allow";return next;});}}><option value="inherit">وراثة من الدور</option><option value="allow">سماح</option><option value="deny">منع</option></select></div>)}</fieldset>)}</div>}</>}
  </article>;
}
function AdminRoles() {
  const qc=useQueryClient(),q=useQuery({queryKey:["admin","roles"],queryFn:()=>api<{roles:AdminRole[];catalog:PermissionEntry[]}>("/club/admin/roles")});
  const update=useMutation({mutationFn:(input:{name:string;label:string;permissions:string[];create?:boolean})=>input.create?api("/club/admin/roles",{method:"POST",body:JSON.stringify({name:input.name,label:input.label,permissions:input.permissions})}):api(`/club/admin/roles/${encodeURIComponent(input.name)}`,{method:"PATCH",body:JSON.stringify({label:input.label,permissions:input.permissions})}),onSuccess:()=>{void qc.invalidateQueries({queryKey:["admin","roles"]});void qc.invalidateQueries({queryKey:["admin","users"]});void qc.invalidateQueries({queryKey:getGetClubSessionQueryKey()});}});
  const remove=useMutation({mutationFn:(name:string)=>api(`/club/admin/roles/${encodeURIComponent(name)}`,{method:"DELETE"}),onSuccess:()=>{void qc.invalidateQueries({queryKey:["admin","roles"]});void qc.invalidateQueries({queryKey:["admin","users"]});}});
  const [name,setName]=useState(""),[label,setLabel]=useState(""),[err,setErr]=useState("");
  if(q.isLoading)return <Loading/>;if(q.isError||!q.data)return <ErrorBox message={errorText(q.error)} retry={()=>q.refetch()}/>;
  return <><p className="muted">الإدارة الحساسة وإعدادات الهوية والنسخ لا تُمنح للأدوار العادية من هذه الشاشة.</p>{err&&<ErrorBox message={err}/>}
    {q.data.roles.map(role=><RoleEditor key={role.name} role={role} catalog={q.data.catalog} busy={update.isPending||remove.isPending} onSave={(name2,label2,permissions)=>update.mutate({name:name2,label:label2,permissions},{onError:e=>setErr(errorText(e))})} onDelete={()=>{if(window.confirm(`حذف الدور ${role.label}؟`))remove.mutate(role.name,{onError:e=>setErr(errorText(e))});}}/>)}
    <form className="surface surface-pad" onSubmit={e=>{e.preventDefault();if(!/^[a-z][a-z0-9_]*$/.test(name)){setErr("المعرّف يجب أن يكون أحرفًا إنجليزية صغيرة وأرقامًا وشرطة سفلية.");return;}update.mutate({name,label,permissions:[],create:true},{onSuccess:()=>{setName("");setLabel("");setErr("");},onError:e=>setErr(errorText(e))});}}><h2>إنشاء دور مخصص</h2><div className="form-grid"><label className="field">المعرّف<input value={name} onChange={e=>setName(e.target.value)} dir="ltr" required/></label><label className="field">الاسم الظاهر<input value={label} onChange={e=>setLabel(e.target.value)} required/></label></div><div className="form-actions"><button className="primary-button" disabled={update.isPending}>إنشاء الدور</button></div></form>
  </>;
}
function RoleEditor({role,catalog,busy,onSave,onDelete}:{role:AdminRole;catalog:PermissionEntry[];busy:boolean;onSave:(name:string,label:string,permissions:string[])=>void;onDelete:()=>void}) {
  const [label,setLabel]=useState(role.label),[permissions,setPermissions]=useState(role.permissions);
  const groups=[...new Set(catalog.filter(c=>!["settings","users","roles","backups","audit","security"].includes(c.section)).map(c=>c.section))];
  return <section className="surface surface-pad role-card"><div className="role-header"><div><h2>{role.label}</h2><small>{role.builtIn?"دور أساسي":"دور مخصص"} · {role.assignedCount} حساب</small></div>{!role.builtIn&&<><label className="field role-name">الاسم الظاهر<input value={label} onChange={e=>setLabel(e.target.value)}/></label><button className="danger-button" disabled={role.assignedCount>0||busy} onClick={onDelete}>حذف الدور</button></>}</div>
    <div className="admin-matrix">{groups.map(group=><fieldset key={group}><legend>{catalog.find(c=>c.section===group)?.sectionLabel||group}</legend>{catalog.filter(c=>c.section===group).map(item=><label className="admin-check permission-check" key={item.name}><input type="checkbox" checked={permissions.includes(item.name)} onChange={e=>setPermissions(e.target.checked?[...permissions,item.name]:permissions.filter(p=>p!==item.name))}/>{item.actionLabel}</label>)}</fieldset>)}</div>
    <button className="primary-button" disabled={busy} onClick={()=>onSave(role.name,label,permissions)}>حفظ صلاحيات الدور</button>
  </section>;
}
function AdminBackups() {
  type Preview={counts:Record<string,number>;changes:Record<string,{current:number;backup:number}>;token:string;warning:string};
  const qc=useQueryClient(),q=useQuery({queryKey:["admin","backups"],queryFn:()=>api<Backup[]>("/club/admin/backups")});
  const [label,setLabel]=useState(""),[err,setErr]=useState(""),[ok,setOk]=useState(""),[selected,setSelected]=useState<Backup|null>(null),[preview,setPreview]=useState<Preview|null>(null),[typed,setTyped]=useState(""),[sure,setSure]=useState(false);
  const create=useMutation({mutationFn:()=>api("/club/admin/backups",{method:"POST",body:JSON.stringify({label:label||undefined})}),onSuccess:()=>{setOk("تم إنشاء نسخة احتياطية مشفرة.");setLabel("");void qc.invalidateQueries({queryKey:["admin","backups"]});},onError:e=>setErr(errorText(e))});
  const restore=useMutation({mutationFn:()=>api<{preRestoreBackupId:number}>(`/club/admin/backups/${selected!.id}/restore`,{method:"POST",body:JSON.stringify({token:preview!.token,confirmation:`استعادة ${selected!.id}`})}),onSuccess:r=>{setOk(`تمت الاستعادة. النسخة السابقة للاستعادة رقم ${r.preRestoreBackupId}.`);setPreview(null);setSelected(null);void qc.invalidateQueries();},onError:e=>setErr(errorText(e))});
  const previewMutation=useMutation({mutationFn:(item:Backup)=>api<Preview>(`/club/admin/backups/${item.id}/preview`,{method:"POST",body:JSON.stringify({})}),onSuccess:(data,item)=>{setPreview(data);setSelected(item);setTyped("");setSure(false);},onError:e=>setErr(errorText(e))});
  const importBackup=useMutation({mutationFn:(text:string)=>api("/club/admin/backups/import",{method:"POST",body:JSON.stringify({file:text})}),onSuccess:()=>{setOk("تم استيراد ملف النسخة؛ لم يتم استعادة بياناته.");void qc.invalidateQueries({queryKey:["admin","backups"]});},onError:e=>setErr(errorText(e))});
  async function readFile(file?:File){if(!file)return;if(file.size>12*1024*1024){setErr("الملف أكبر من 12 ميغابايت.");return;}try{importBackup.mutate(await file.text());}catch(e){setErr(errorText(e));}}
  return <><div className="notice warning">النسخ المشفرة داخل النظام لا تغني عن الاحتفاظ بنسخة خارجية آمنة. لا تُدخل أسرار الخادم أو مفاتيح التشفير في الواجهة.</div>{err&&<ErrorBox message={err}/ >}{ok&&<div className="notice">{ok}</div>}
    <section className="surface surface-pad backup-create"><h2>نسخة جديدة</h2><div className="backup-actions"><input className="admin-inline-input" placeholder="وصف اختياري" value={label} onChange={e=>setLabel(e.target.value)}/><button className="primary-button" disabled={create.isPending} onClick={()=>create.mutate()}>{create.isPending?"جارٍ الإنشاء…":"إنشاء نسخة مشفرة"}</button><label className="outline-button">استيراد نسخة<input type="file" accept=".json,application/json" hidden onChange={e=>{void readFile(e.target.files?.[0]);e.target.value="";}}/></label></div></section>
    <section className="surface"><div className="surface-head"><h2>النسخ المتاحة</h2></div>{q.isLoading?<Loading/>:q.isError?<div className="surface-body"><ErrorBox message={errorText(q.error)} retry={()=>q.refetch()}/></div>:q.data?.length?q.data.map(b=><article className="admin-card backup-card" key={b.id}><div><h3>نسخة #{b.id} · {b.label}</h3><small>{new Date(b.createdAt).toLocaleString("ar-IQ",{timeZone:"Asia/Amman"})} · {b.createdBy} · {(b.bytes/1024).toFixed(1)} ك.ب</small><p className="muted">{Object.entries(b.counts).map(([k,v])=>`${k}: ${v}`).join(" · ")}</p></div><div className="row-tools"><button className="outline-button" onClick={()=>void downloadApi(`/club/admin/backups/${b.id}/file`,`iraq-alameer-backup-${b.id}.json`).catch(e=>setErr(errorText(e)))}>تنزيل</button><button className="outline-button" disabled={previewMutation.isPending} onClick={()=>previewMutation.mutate(b)}>معاينة الاستعادة</button></div></article>):<Empty title="لا توجد نسخ محفوظة"/>}</section>
    {selected&&preview&&<section className="surface surface-pad restore-panel"><h2>معاينة الاستعادة · النسخة #{selected.id}</h2><div className="notice warning">{preview.warning}</div><div className="table-scroll"><table className="data-table"><thead><tr><th>السجل</th><th>الحالي</th><th>في النسخة</th></tr></thead><tbody>{Object.entries(preview.changes).map(([key,value])=><tr key={key}><td>{key}</td><td>{value.current}</td><td>{value.backup}</td></tr>)}</tbody></table></div><p>اكتب <strong>استعادة {selected.id}</strong> للتأكيد. سيُنشئ النظام نسخة تلقائية قبل الاستعادة.</p><input className="admin-inline-input" value={typed} onChange={e=>setTyped(e.target.value)} aria-label="عبارة التأكيد"/><label className="admin-check"><input type="checkbox" checked={sure} onChange={e=>setSure(e.target.checked)}/>أفهم أن البيانات الحالية ستُستبدل</label><div className="form-actions"><button className="danger-button" disabled={restore.isPending||typed.trim()!==`استعادة ${selected.id}`||!sure} onClick={()=>restore.mutate()}>{restore.isPending?"جارٍ الاستعادة…":"استعادة الآن"}</button><button className="outline-button" onClick={()=>{setSelected(null);setPreview(null);}}>إلغاء</button></div></section>}
  </>;
}
function AdminAudit() {
  type AuditResponse={items:Array<{id:number;actorName:string|null;action:string;entityType:string;entityId:number|null;details:object;createdAt:string}>;total:number;page:number};
  const [page,setPage]=useState(1),[search,setSearch]=useState(""),[expanded,setExpanded]=useState<number|null>(null);
  const q=useQuery({queryKey:["admin","audit",page,search],queryFn:()=>api<AuditResponse>(`/club/admin/audit?page=${page}&search=${encodeURIComponent(search)}`)});
  return <section className="surface"><div className="table-toolbar"><div><h2>سجل التدقيق</h2><small>سجل العمليات الإدارية المحفوظ</small></div><label className="search-field"><Search size={14}/><input value={search} onChange={e=>{setSearch(e.target.value);setPage(1);}} placeholder="بحث في السجل"/></label><button className="outline-button" onClick={()=>void downloadApi("/club/admin/audit?format=csv","iraq-alameer-audit.csv")}>تصدير CSV</button></div>
    {q.isLoading?<Loading/>:q.isError?<div className="surface-body"><ErrorBox message={errorText(q.error)} retry={()=>q.refetch()}/></div>:q.data?.items.length?q.data.items.map(item=><article className="admin-card audit-row" key={item.id}><div><h3>{item.action}</h3><small>{item.actorName||"النظام"} · {item.entityType}{item.entityId?` #${item.entityId}`:""} · {new Date(item.createdAt).toLocaleString("ar-IQ",{timeZone:"Asia/Amman"})}</small></div><button className="mini-action" onClick={()=>setExpanded(expanded===item.id?null:item.id)}>{expanded===item.id?"إخفاء":"التفاصيل"}</button>{expanded===item.id&&<pre className="audit-json">{JSON.stringify(item.details,null,2)}</pre>}</article>):<Empty title="لا توجد سجلات تدقيق"/>}
    {q.data&&<div className="pagination"><button className="outline-button" disabled={page<=1} onClick={()=>setPage(page-1)}>السابق</button><span>صفحة {q.data.page} من {Math.max(1,Math.ceil(q.data.total/20))}</span><button className="outline-button" disabled={page*20>=q.data.total} onClick={()=>setPage(page+1)}>التالي</button></div>}
  </section>;
}
function AdminSecurity() {
  const q=useQuery({queryKey:["admin","security"],queryFn:()=>api<{authProvider:string;requiresApproval:boolean;financialDefault:string;ownerProtected:boolean;backupEncryption:string;backupAvailable:boolean;sessionPolicySource:string}>("/club/admin/security")});
  if(q.isLoading)return <Loading/>;if(q.isError||!q.data)return <ErrorBox message={errorText(q.error)} retry={()=>q.refetch()}/>;
  const values:[string,string][]=[["مزود تسجيل الدخول",q.data.authProvider],["موافقة الحسابات الجديدة",q.data.requiresApproval?"مطلوبة":"غير مطلوبة"],["الصلاحيات المالية الافتراضية",q.data.financialDefault==="deny"?"ممنوعة":q.data.financialDefault],["حماية المالك",q.data.ownerProtected?"مفعّلة":"غير مفعّلة"],["تشفير النسخ الاحتياطية",q.data.backupEncryption],["النسخ الاحتياطي",q.data.backupAvailable?"متاح":"غير متاح"],["سياسة الجلسات",`تدار عبر ${q.data.sessionPolicySource}`]];
  return <section className="surface surface-pad"><h2>حالة الأمان الفعلية</h2><p className="muted">قراءة فقط من خادم النادي؛ لا تعرض الواجهة أسرارًا أو مفاتيح تشغيل.</p>{values.map(([key,value])=><div className="security-row" key={key}><strong>{key}</strong><Status value={value}/></div>)}<Link href="/account" className="outline-button">إدارة حسابي</Link></section>;
}

function Protected({children,permissions=[],anyPermissions=[],ownerOnly=false}:{children:ReactNode;permissions?:string[];anyPermissions?:string[];ownerOnly?:boolean}) {
  const {isLoaded,isSignedIn}=useUser();
  const session=useGetClubSession({query:{queryKey:getGetClubSessionQueryKey(),enabled:isSignedIn,refetchOnMount:"always",retry:false}});
  if(!isLoaded||isSignedIn&&session.isLoading)return <div className="auth-wait"><img src={logo} alt=""/><div className="loading-skeleton"/></div>;
  if(!isSignedIn)return <Redirect to="/sign-in"/>;
  if(session.isError)return <Shell><ErrorBox message="تعذر التحقق من صلاحيات الجلسة." retry={()=>session.refetch()}/></Shell>;
  if(!session.data||session.data.status!=="active"||!session.data.role)return <Shell><section className="surface surface-pad access-state"><ShieldCheck size={27}/><h1>{session.data?.status==="rejected"?"طلب الحساب مرفوض":session.data?.status==="suspended"?"الحساب موقوف":"بانتظار موافقة المدير"}</h1><p>حُفظ حسابك لدى النادي. يستطيع المالك مراجعة طلب الانضمام وتحديث الحالة.</p><button className="outline-button" onClick={()=>void session.refetch()}>تحديث حالة الحساب</button></section></Shell>;
  const isOwner=!!session.data.isOwner,has=permissions.every(p=>session.data?.permissions.includes(p)),hasAny=!anyPermissions.length||anyPermissions.some(p=>session.data?.permissions.includes(p));
  if((ownerOnly&&!isOwner)||(!isOwner&&!has)||(!isOwner&&!hasAny))return <Shell><section className="surface surface-pad access-state"><ShieldCheck size={26}/><h1>الوصول غير مصرح</h1><p>لم يمنحك مالك النادي صلاحية هذه الشاشة.</p><Link href="/dashboard" className="primary-button">العودة إلى لوحة النادي</Link></section></Shell>;
  return <Shell>{children}</Shell>;
}
function RoleDashboard() {
  const session=useGetClubSession(),canFinancial=!!session.data?.isOwner||["payments.view","reports.view","members.view"].every(p=>session.data?.permissions.includes(p));
  return canFinancial?<Dashboard/>:<StaffDashboard/>;
}
function StaffDashboard() {
  const q=useGetClubOverview();
  return <><PageTitle overline="تشغيل النادي" title="لوحة التشغيل" subtitle="عرض مبسط للمؤشرات التشغيلية المسموح بها."/><div className="notice">البيانات المالية غير معروضة؛ يلزم منح صلاحية مالية مستقلة.</div>{q.isLoading?<Loading/>:q.isError?<ErrorBox message={errorText(q.error)} retry={()=>q.refetch()}/>:<div className="metric-grid"><StatCard icon={Users} title="مشتركون نشطون" value={q.data?.activeMembers||0}/><StatCard icon={Clock3} title="تنتهي قريبًا" value={q.data?.endingSoon||0}/><StatCard icon={BadgeCheck} title="اشتراكات منتهية" value={q.data?.expiredSubscriptions||0}/></div>}</>;
}
function StaffMemberDetail() {
  const {id:raw}=useParams<{id:string}>(),id=Number(raw),q=useGetMemberProfile(id,{query:{queryKey:["member-profile",id],enabled:id>0}});
  if(q.isLoading)return <Loading/>;if(q.isError||!q.data)return <ErrorBox message="تعذر تحميل الملف التشغيلي." retry={()=>q.refetch()}/>;
  const m=q.data;
  return <><PageTitle overline="ملف مشترك" title={m.name}><Link href="/members" className="outline-button">عودة</Link></PageTitle><section className="surface surface-pad"><div className="profile-avatar">{m.name.slice(0,1)}</div><h2>{m.name}</h2><p dir="ltr">{m.phone}</p>{m.email&&<p dir="ltr">{m.email}</p>}<p>تاريخ التسجيل: {m.joinedAt.slice(0,10)}</p>{m.birthDate&&<p>تاريخ الميلاد: {m.birthDate}</p>}{m.notes&&<p>{m.notes}</p>}<Status value={m.active?"active":"suspended"}/></section><div className="notice">تفاصيل المدفوعات والإيصالات غير متاحة دون صلاحية مالية.</div><MemberReminderTools memberId={m.id}/></>;
}
function NotFound() { return <main className="not-found" dir="rtl"><img src={logo} alt="شعار النادي"/><p className="eyebrow">404 · صفحة غير موجودة</p><h1>هذه الصفحة خارج مساحة العمل.</h1><Link className="primary-button" href="/">العودة للرئيسية</Link></main>; }
function Routes() {
  return <Switch>
    <Route path="/" component={Landing}/>
    <Route path="/sign-in/*?"><AuthPage/></Route>
    <Route path="/sign-up/*?"><AuthPage signup/></Route>
    <Route path="/dashboard"><Protected permissions={["dashboard.view"]}><RoleDashboard/></Protected></Route>
    <Route path="/members/:id"><MemberRoute/></Route>
    <Route path="/members"><Protected permissions={["members.view"]}><MembersPage/></Protected></Route>
    <Route path="/plans"><Protected permissions={["plans.view"]}><PlansPage/></Protected></Route>
    <Route path="/subscriptions"><Protected permissions={["subscriptions.view"]}><RoleSubscriptions/></Protected></Route>
    <Route path="/attendance"><Protected anyPermissions={["members.view","members.edit"]}><AttendancePage/></Protected></Route>
    <Route path="/finance"><Protected anyPermissions={["finance.view","employees.view","payroll.view"]}><FinancePage/></Protected></Route>
    <Route path="/reports"><Protected permissions={["reports.view"]}><ReportsPage/></Protected></Route>
    <Route path="/receipt/:id"><ReceiptRoute/></Route>
    <Route path="/settings/whatsapp"><Protected anyPermissions={["whatsapp.view","whatsapp.create"]}><WhatsAppPage/></Protected></Route>
    <Route path="/admin"><Protected ownerOnly><AdminPage/></Protected></Route>
    <Route path="/account"><Protected><AccountPage/></Protected></Route>
    <Route path="/download"><DownloadPage/></Route>
    <Route component={NotFound}/>
  </Switch>;
}
function MemberRoute() {
  const session=useGetClubSession(),permissions=session.data?.permissions||[];
  const full=!!session.data?.isOwner||["members.view","subscriptions.view","payments.view"].every(p=>permissions.includes(p));
  return <Protected anyPermissions={["members.view","payments.view","subscriptions.view"]}>{full?<MemberDetail/>:<StaffMemberDetail/>}</Protected>;
}
function ReceiptRoute() {
  const {isSignedIn}=useUser();
  return isSignedIn?<Protected permissions={["payments.view"]}><ReceiptPage/></Protected>:<Redirect to="/sign-in"/>;
}
function DownloadPage() {
  type InstallPrompt = Event & {
    prompt: () => Promise<void>;
    userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
  };
  const [installPrompt, setInstallPrompt] = useState<InstallPrompt | null>(null);
  const [ios, setIos] = useState(false);
  const [installed, setInstalled] = useState(false);
  const [qr, setQr] = useState("");
  const [message, setMessage] = useState("");
  const installUrl = `${window.location.origin}${base}/download`;

  useEffect(() => {
    const nav = navigator as Navigator & { standalone?: boolean };
    setIos(/iPhone|iPad|iPod/i.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1));
    setInstalled(window.matchMedia("(display-mode: standalone)").matches || nav.standalone === true);
    const onPrompt = (event: Event) => {
      event.preventDefault();
      setInstallPrompt(event as InstallPrompt);
    };
    const onInstalled = () => {
      setInstalled(true);
      setInstallPrompt(null);
      setMessage("تم تثبيت التطبيق على هذا الجهاز.");
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    void QRCode.toDataURL(installUrl, {
      width: 176,
      margin: 1,
      color: { dark: "#071A2F", light: "#FFFFFF" },
    }).then(setQr).catch(() => setQr(""));
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, [installUrl]);

  async function install() {
    if (!installPrompt) return;
    await installPrompt.prompt();
    const choice = await installPrompt.userChoice;
    setMessage(choice.outcome === "accepted" ? "بدأ تثبيت التطبيق." : "يمكنك التثبيت لاحقًا من قائمة المتصفح.");
    setInstallPrompt(null);
  }

  return <main className="download-shell" dir="rtl">
    <header className="download-header"><Link href="/" className="brand-lockup"><img src={logo} alt="شعار النادي"/><span><strong>IRAQ ALAMEER CLUB</strong><small>بوابة إدارة النادي</small></span></Link><Link className="outline-button" href="/sign-in">تسجيل الدخول</Link></header>
    <section className="surface download-card">
      <div className="download-layout">
        <div className="download-copy">
          <p className="eyebrow">تطبيق النادي</p><h1>وصول سريع من الشاشة الرئيسية</h1>
          <p>أضف بوابة النادي إلى هاتفك أو جهازك اللوحي أو الكمبيوتر. يتطلب تسجيل الدخول والاطلاع على السجلات اتصالًا بالإنترنت.</p>
          <div className="download-actions">
            <button className="primary-button" disabled={installed || !installPrompt} onClick={() => void install()}>
              <Download size={16}/>{installed ? "التطبيق مثبت بالفعل" : installPrompt ? "تثبيت التطبيق" : "التثبيت من قائمة المتصفح"}
            </button>
            <Link className="outline-button" href="/sign-in">فتح بوابة النادي</Link>
          </div>
          {message && <div className="notice">{message}</div>}
          {ios && <div className="notice">على iPhone وiPad: افتح الصفحة في Safari، ثم اضغط مشاركة واختر «إضافة إلى الشاشة الرئيسية».</div>}
          {!ios && !installPrompt && !installed && <div className="notice">إذا لم يظهر زر التثبيت، افتح قائمة Chrome أو المتصفح واختر «تثبيت التطبيق» أو «إضافة إلى الشاشة الرئيسية».</div>}
          <details className="install-steps" open={ios}>
            <summary>خطوات التثبيت حسب الجهاز</summary>
            <ul>
              <li><strong>Android:</strong> استخدم زر التثبيت عند ظهوره، أو قائمة Chrome ثم «تثبيت التطبيق».</li>
              <li><strong>iPhone وiPad:</strong> في Safari اختر مشاركة ثم «إضافة إلى الشاشة الرئيسية».</li>
              <li><strong>الكمبيوتر:</strong> استخدم رمز التثبيت في شريط عنوان المتصفح أو خيار التثبيت في القائمة.</li>
            </ul>
          </details>
        </div>
        <aside className="download-qr">
          <div className="download-qr-image">{qr ? <img src={qr} alt="رمز QR لفتح صفحة تثبيت نادي عراق الأمير"/> : <QrCode size={70}/>}</div>
          <strong>امسح الرمز لفتح صفحة التثبيت</strong>
          <small>سيحتاج تسجيل الدخول والبيانات إلى اتصال بالإنترنت.</small>
        </aside>
      </div>
    </section>
    <footer className="download-footer">إدارة نادي عراق الأمير · سجلات النادي لا تُخزّن دون اتصال</footer>
  </main>;
}
function App() {
  return <QueryClientProvider client={queryClient}><ClerkProvider publishableKey={clerkKey} proxyUrl={clerkProxyUrl} signInUrl={`${base}/sign-in`} signUpUrl={`${base}/sign-up`} localization={arSA}><Router base={base}><Routes/></Router></ClerkProvider></QueryClientProvider>;
}
export default App;
