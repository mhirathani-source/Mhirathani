import { useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from "react";
import { ClerkProvider, SignIn, SignUp, UserProfile, useClerk, useUser } from "@clerk/react";
import { publishableKeyFromHost } from "@clerk/react/internal";
import { shadcn } from "@clerk/themes";
import { arSA } from "@clerk/localizations";
import { QueryClient, QueryClientProvider, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  getGetClubDashboardQueryKey, getGetClubSessionQueryKey, getGetMemberQueryKey, getGetPaymentReceiptQueryKey, getListPlansQueryKey, getListFinanceCategoriesQueryKey, getListFinanceTransactionsQueryKey, getListEmployeesQueryKey, getListPayrollQueryKey, getGetFinanceReportQueryKey,
  getListCashMovementsQueryKey,
  useListFinanceCategories, useCreateFinanceCategory, useListFinanceTransactions, useCreateFinanceTransaction,
  useGetFinanceReport, useListEmployees, useCreateEmployee, useListPayroll, useCreatePayroll, usePayPayroll,
  useListCashMovements,
  useCreatePlan, useGetClubDashboard, useGetClubSession, useGetMember,
  useGetPaymentReceipt, useListPlans, } from "@workspace/api-client-react";
import { ArrowDownLeft, BadgeCheck, Banknote, ChartNoAxesCombined, ClipboardList, Dumbbell, LayoutDashboard, LogOut, Plus, Users, Wallet, Printer, MessageCircle, Settings, PanelLeftClose, PanelLeftOpen, UserRound } from "lucide-react";
import { Link, Redirect, Route, Switch, Router as WouterRouter, useLocation, useParams } from "wouter";
import { MembersPage, SubscriptionsPage, SubscriptionManager, MemberProfileTools } from "./MembershipPages";
import { FinancePage as FinanceManagementPage, ReportsPage } from "./FinancePages";
import { StaffDashboard, StaffMemberDetail } from "./StaffPages";
import { useAccess } from "./authz";
import { AdminPage } from "./admin/AdminPage";
import { OperationalSubscriptions } from "./OperationalSubscriptions";
import { PlansPage } from "./PlansPage";
import { MemberFinancePage } from "./MemberFinancePage";
import { ThemeToggle } from "./components/theme-toggle";

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");
const clerkPubKey = publishableKeyFromHost(window.location.hostname, import.meta.env.VITE_CLERK_PUBLISHABLE_KEY);
const clerkProxyUrl = import.meta.env.VITE_CLERK_PROXY_URL;
function stripBase(path: string) { return basePath && path.startsWith(basePath) ? path.slice(basePath.length) || "/" : path; }
async function clubApi<T>(path:string,init:RequestInit={}):Promise<T>{const response=await fetch(`${basePath}/api${path}`,{...init,credentials:"same-origin",headers:{"Content-Type":"application/json",...(init.headers||{})}});const body=await response.json().catch(()=>({}));if(!response.ok)throw new Error(body.error||"تعذر تنفيذ الطلب");return body as T;}
type AppTheme = "light" | "dark";
function storedTheme(): AppTheme {
  try { return localStorage.getItem("prime-theme") === "dark" ? "dark" : "light"; } catch { return "light"; }
}
function getClerkAppearance(theme: AppTheme) {
  const dark = theme === "dark";
  return {
    theme: shadcn,
    cssLayerName: "clerk",
    options: { logoPlacement: "inside" as const, logoLinkUrl: basePath || "/", logoImageUrl: `${window.location.origin}${basePath}/logo.svg` },
    variables: {
      colorPrimary: dark ? "#c9a64f" : "#b9953b",
      colorForeground: dark ? "#f2eee1" : "#17352a",
      colorMutedForeground: dark ? "#bac4bb" : "#65756d",
      colorDanger: dark ? "#e07f73" : "#ad4940",
      colorBackground: dark ? "#17281f" : "#fbfaf5",
      colorInput: dark ? "#22382d" : "#f7f5ed",
      colorInputForeground: dark ? "#f2eee1" : "#17352a",
      colorNeutral: dark ? "#dae4dc" : "#17352a",
      fontFamily: '"IBM Plex Sans Arabic", sans-serif',
      borderRadius: "0.85rem",
    },
    elements: {
      rootBox: "w-full flex justify-center",
      cardBox: `${dark ? "bg-[#17281f]" : "bg-[#fbfaf5]"} rounded-2xl w-[440px] max-w-full overflow-hidden`,
      card: "!shadow-none !border-0 !bg-transparent !rounded-none",
      footer: "!shadow-none !border-0 !bg-transparent !rounded-none",
      headerTitle: dark ? "text-[#f2eee1]" : "text-slate-900",
      headerSubtitle: dark ? "text-[#bac4bb]" : "text-slate-600",
      socialButtonsBlockButtonText: dark ? "text-[#f2eee1]" : "text-slate-800",
      formFieldLabel: dark ? "text-[#f2eee1]" : "text-slate-800",
      footerActionLink: dark ? "text-[#e2c36c]" : "text-emerald-800",
      footerActionText: dark ? "text-[#bac4bb]" : "text-slate-600",
      dividerText: dark ? "text-[#bac4bb]" : "text-slate-500",
      identityPreviewEditButton: dark ? "text-[#f2eee1]" : "text-slate-800",
      formFieldSuccessText: dark ? "text-[#9ed4ad]" : "text-emerald-800",
      alertText: dark ? "text-[#f2aaa2]" : "text-red-800",
      logoBox: "", logoImage: "", socialButtonsBlockButton: "", formButtonPrimary: "",
      formFieldInput: "", footerAction: "", dividerLine: "", alert: "", otpCodeFieldInput: "", formFieldRow: "", main: "",
    },
  };
}

function Home() {
  return <main className="landing" dir="rtl"><div className="landing-topline"><div className="landing-brand"><img className="brand-mark-image" src={`${basePath}/logo.svg`} alt="شعار Prime Boxing Academy"/><span>Prime Boxing Academy<small>أكاديمية برايم للملاكمة</small></span></div><ThemeToggle/></div><div className="landing-copy"><p className="eyebrow">نظام إدارة الأكاديمية</p><h1>إدارة أكاديميتك،<br/><em>بثقة ووضوح.</em></h1><p>منصة عربية موحدة لتنظيم المشتركين والاشتراكات والعمليات اليومية.</p><Link href="/sign-in" className="button primary">تسجيل الدخول</Link><a href={`${basePath}/download`} className="button ghost" style={{ marginInlineStart: 12 }}>تحميل التطبيق</a></div><div className="landing-mark">Prime Boxing Academy <span>إدارة أكثر تنظيمًا.</span></div></main>;
}

function HomeRedirect() {
  const { isLoaded, isSignedIn } = useUser();
  if (!isLoaded) return <div className="center"><span className="spinner"/> جارٍ التحميل…</div>;
  return isSignedIn ? <Redirect to="/dashboard"/> : <Home/>;
}

function AuthPages() {
  return <div className="auth-page" dir="rtl"><div className="auth-topline"><div className="auth-brand"><img className="brand-mark-image" src={`${basePath}/logo.svg`} alt="شعار Prime Boxing Academy"/><span>Prime Boxing Academy</span></div><ThemeToggle/></div><Switch><Route path="/sign-in/*?"><SignIn routing="path" path={`${basePath}/sign-in`} signUpUrl={`${basePath}/sign-up`} /></Route><Route path="/sign-up/*?"><SignUp routing="path" path={`${basePath}/sign-up`} signInUrl={`${basePath}/sign-in`} /></Route></Switch></div>;
}

const allNavItems = [
  { href: "/admin", title: "لوحة التحكم والإعدادات", icon: Settings, permissions: [] },
  { href: "/dashboard", title: "لوحة التحكم", icon: LayoutDashboard, permissions: ["dashboard.view"] },
  { href: "/members", title: "المشتركون", icon: Users, permissions: ["members.view"] },
  { href: "/subscriptions", title: "الاشتراكات", icon: BadgeCheck, permissions: ["subscriptions.view"] },
  { href: "/plans", title: "الباقات", icon: ClipboardList, permissions: ["plans.view"] },
  { href: "/finance", title: "المالية والرواتب", icon: Wallet, permissions: ["finance.view", "employees.view", "payroll.view"] },
  { href: "/settings/whatsapp", title: "واتساب", icon: MessageCircle, permissions: ["whatsapp.view"] },
  { href: "/reports", title: "التقارير", icon: ChartNoAxesCombined, permissions: ["reports.view"] },
];

function AppShell({ children }: { children: ReactNode }) {
  const { user } = useUser();
  const { signOut } = useClerk();
  const [location] = useLocation();
  const session = useGetClubSession();
  const { can, isOwner } = useAccess();
  const [collapsed, setCollapsed] = useState(() => {
    try { return localStorage.getItem("prime-sidebar-collapsed") === "true"; } catch { return false; }
  });
  useEffect(() => {
    try { localStorage.setItem("prime-sidebar-collapsed", String(collapsed)); } catch { /* storage may be unavailable */ }
  }, [collapsed]);
  const clubSettings=useQuery({queryKey:["clubSettings","operational"],queryFn:()=>clubApi<{clubName:string}>("/club/operations/settings"),enabled:session.data?.status==="active"});
  const clubName=clubSettings.data?.clubName||"Prime Boxing Academy";
  const navItems = allNavItems.filter(item => !session.isError && session.data?.status === "active" && (item.href === "/admin" ? isOwner : item.href === "/finance" ? item.permissions.some(p => can(p)) : can(...item.permissions)))
    .map(item => item.href === "/admin" && session.data?.pendingCount ? { ...item, title: `${item.title} (${session.data.pendingCount} طلب)` } : item);
  return <div className={`app-shell ${collapsed ? "sidebar-collapsed" : ""}`} dir="rtl">
    <aside className="sidebar">
      <Link href="/dashboard" className="brand"><img className="brand-mark-image" src={`${basePath}/logo.svg`} alt="شعار Prime Boxing Academy"/><span className="brand-copy" style={{overflowWrap:"anywhere"}}>{clubName}<small>إدارة الأكاديمية</small></span></Link>
      <p className="nav-label">القائمة الرئيسية</p>
      <nav>{navItems.map(({href,title,icon:Icon})=>{const active=location===href||(href==="/members"&&location.startsWith("/members/"));return <Link key={href} href={href} title={title} aria-label={title} aria-current={active?"page":undefined} className={`nav-link ${active?"active":""}`}><Icon size={18}/><span>{title}</span></Link>;})}</nav>
      <div className="sidebar-bottom">
        <div className="profile"><div className="avatar">{user?.firstName?.slice(0,1)||"م"}</div><div><strong>{user?.fullName||"حساب الأكاديمية"}</strong><small>{user?.primaryEmailAddress?.emailAddress}</small></div></div>
        <Link className="nav-link" href="/account" title="إعدادات حسابي" aria-label="إعدادات حسابي"><UserRound size={18}/><span>إعدادات حسابي</span></Link>
        <button className="nav-link sidebar-toggle" type="button" data-testid="toggle-sidebar" aria-label={collapsed ? "توسيع القائمة الجانبية" : "طي القائمة الجانبية"} aria-expanded={!collapsed} onClick={() => setCollapsed(v => !v)}>{collapsed ? <PanelLeftOpen size={18}/> : <PanelLeftClose size={18}/>}<span>طي القائمة</span></button>
        <button className="nav-link logout" aria-label="تسجيل الخروج" title="تسجيل الخروج" onClick={()=>signOut({redirectUrl:basePath||"/"})}><LogOut size={18}/><span>تسجيل الخروج</span></button>
      </div>
    </aside>
    <main className="main-area"><header className="topbar"><div><span className="topbar-date">{new Intl.DateTimeFormat("ar-JO",{dateStyle:"full",timeZone:"Asia/Amman"}).format(new Date())}</span><span className="mobile-brand">{clubName}</span></div><div className="topbar-tools"><span className="topbar-user">بوابة إدارة الأكاديمية</span><ThemeToggle/></div></header><section className="page-content">{children}</section></main>
    <nav className="mobile-nav">{navItems.map(({href,title,icon:Icon})=><Link key={href} href={href} className={location===href?"active":""}><Icon size={19}/><small>{title}</small></Link>)}</nav>
  </div>;
}

function Protected({ children, ownerOnly = false, permissions = [], anyPermissions = [] }: { children: ReactNode; ownerOnly?: boolean; permissions?: string[]; anyPermissions?: string[] }) {
  const { isLoaded, isSignedIn } = useUser();
  const session = useGetClubSession({ query: { enabled: !!isSignedIn, queryKey: getGetClubSessionQueryKey(), staleTime: 0, refetchOnMount: "always", refetchOnWindowFocus: true, refetchInterval: 10000, retry: false } });
  const cache = useQueryClient();
  const previousRole = useRef<string | undefined>(undefined);
  const { can, isOwner } = useAccess();
  const accessSignature = JSON.stringify([session.data?.userId, session.data?.role, session.data?.status, session.data?.isOwner, session.data?.permissions]);
  useEffect(() => {
    const role = accessSignature;
    if (previousRole.current !== undefined && previousRole.current !== role) {
      const filters = { predicate: (query: { queryKey: readonly unknown[] }) => {
        const path = String(query.queryKey[0]).replace(/^\/api/, "");
        return path !== "/club/session";
      } };
      void cache.cancelQueries(filters).then(() => cache.removeQueries(filters));
      cache.getMutationCache().clear();
    }
    previousRole.current = role;
  }, [accessSignature, cache]);
  if (!isLoaded || (isSignedIn && session.isLoading)) return <div className="center"><span className="spinner"/> جارٍ التحقق من صلاحية الحساب…</div>;
  if (!isSignedIn) return <Redirect to="/"/>;
  if (session.isError) return <AppShell><div className="error-panel">تعذر التحقق من صلاحيات الحساب. أعد تحميل الصفحة.</div></AppShell>;
  if (!session.data?.role || session.data.status !== "active") {
    const state = session.data?.status ?? "pending";
    return <AppShell><div className="setup-card" data-testid="account-status"><div className="setup-icon"><Users/></div>
      <h1>{state === "rejected" ? "طلب الانضمام مرفوض" : state === "suspended" ? "الحساب موقوف" : "بانتظار موافقة المدير"}</h1>
      <p>{state === "pending" ? "حُفظ طلب انضمامك. يستطيع المدير الرئيسي مراجعته من «طلبات انضمام الموظفين». ستتحدث حالة الحساب تلقائيًا بعد الموافقة." : "تواصل مع المدير الرئيسي لمراجعة حالة حسابك وإعادة تفعيله."}</p>
      {session.data?.setupRequired && <p>يلزم تهيئة البريد المعتمد للمدير الأول في أسرار الخادم؛ لا يُمنح أي حساب صلاحية مدير بالتسجيل الذاتي.</p>}
      <button className="button ghost" onClick={() => void session.refetch()}>تحديث حالة الحساب</button></div></AppShell>;
  }
  if ((ownerOnly && !isOwner) || !can(...permissions) || (anyPermissions.length > 0 && !anyPermissions.some(p => can(p)))) return <AppShell><div className="error-panel" role="alert"><h1>ليس لديك صلاحية - Access Denied</h1><p>لم يمنحك المدير صلاحية هذه الصفحة.</p><Link href="/dashboard" className="button primary">العودة للوحة التحكم</Link></div></AppShell>;
  return <AppShell>{children}</AppShell>;
}

function RoleDashboard() { return useAccess().can("payments.view", "reports.view", "members.view") ? <Dashboard/> : <StaffDashboard/>; }
function RoleMemberDetail() { return useAccess().can("members.view", "subscriptions.view", "payments.view") ? <MemberFinancePage/> : <StaffMemberDetail/>; }
function RoleSubscriptions() { return useAccess().can("payments.view", "plans.view", "members.view") ? <Subscriptions/> : <OperationalSubscriptions/>; }

function PageHeading({ eyebrow, title, children }: { eyebrow: string; title: string; children?: ReactNode }) {
  return <div className="page-heading"><div><p className="eyebrow">{eyebrow}</p><h1>{title}</h1></div>{children}</div>;
}
function Money({ fils }: { fils: number }) {
  return <>{(fils/1000).toLocaleString("ar-JO",{minimumFractionDigits:3,maximumFractionDigits:3})} <small>د.أ</small></>;
}
function Dashboard() {
  const query = useGetClubDashboard();
  const summary = query.data;
  const today = new Intl.DateTimeFormat("en-CA",{timeZone:"Asia/Amman"}).format(new Date());
  const finance = useGetFinanceReport({from:`${today.slice(0,7)}-01`,to:today});
  const income=finance.data?.incomeFils??0, expenses=finance.data?.expensesFils??0, chartMax=Math.max(income,expenses,1);
  return <><PageHeading eyebrow="نظرة عامة" title="لوحة التحكم"><div className="quick-actions"><Link href="/members" className="button primary"><Plus size={16}/>مشترك جديد</Link><Link href="/subscriptions" className="button ghost">اشتراك جديد</Link><Link href="/finance" className="button ghost">تسجيل حركة مالية</Link></div></PageHeading>
    {query.isLoading ? <div className="loading-panel">جارٍ تحميل بيانات النادي…</div> : query.error ? <div className="error-panel">تعذر تحميل لوحة التحكم. تحقق من الاتصال والصلاحيات.</div> : <>
      <div className="stats-grid">
        <Stat title="المشتركون النشطون" value={summary?.activeMembers??0} icon={<Users/>} tone="green"/>
        <Stat title="تنتهي خلال يومين" value={summary?.endingSoon??0} icon={<BadgeCheck/>} tone="amber"/>
        <Stat title="اشتراكات منتهية" value={summary?.expiredSubscriptions??0} icon={<ClipboardList/>} tone="rose"/>
        <Stat title="الرصيد المستحق" value={<Money fils={summary?.outstandingFils??0}/>} icon={<Wallet/>} tone="blue"/>
        <Stat title="مصروفات هذا الشهر" value={<Money fils={finance.data?.expensesFils??0}/>} icon={<Banknote/>} tone="rose"/>
        <Stat title="رواتب مستحقة" value={<Money fils={finance.data?.payrollDueFils??0}/>} icon={<Users/>} tone="amber"/>
        <Stat title="رصيد الصندوق" value={<Money fils={finance.data?.cashBalanceFils??0}/>} icon={<Wallet/>} tone="blue"/>
      </div>
      <div className="panel chart-panel"><div className="panel-head"><div><p className="eyebrow">ملخص الشهر</p><h2>الإيرادات والمصروفات</h2></div><span className="period-pill">{today.slice(0,7)}</span></div><div className="chart-row"><span>الإيرادات</span><div className="chart-track"><i className="chart-income" style={{width:`${Math.max(2,income/chartMax*100)}%`}}/></div><strong><Money fils={income}/></strong></div><div className="chart-row"><span>المصروفات</span><div className="chart-track"><i className="chart-expense" style={{width:`${expenses?Math.max(2,expenses/chartMax*100):0}%`}}/></div><strong><Money fils={expenses}/></strong></div></div>
      <div className="overview-grid"><div className="panel revenue-panel"><div className="panel-head"><div><p className="eyebrow">التحصيل</p><h2>الإيرادات المحصلة</h2></div><span className="period-pill">هذا الشهر</span></div><div className="revenue-total"><Money fils={summary?.monthlyCollectedFils??0}/></div><div className="revenue-note"><ArrowDownLeft size={16}/> مجموع الدفعات المسجلة هذا الشهر</div><div className="revenue-foot"><span>إجمالي التحصيل المسجل</span><strong><Money fils={summary?.collectedFils??0}/></strong></div></div>
      <div className="panel"><div className="panel-head"><div><p className="eyebrow">آخر الإضافات</p><h2>المشتركون الجدد</h2></div><Link href="/members" className="text-link">عرض الكل</Link></div>{summary?.recentMembers?.length ? <div className="compact-list">{summary.recentMembers.map(m=><div className="compact-row" key={m.id}><span className="avatar soft">{m.name.slice(0,1)}</span><div><strong>{m.name}</strong><small>{m.phone}</small></div><span className="status-pill success">مشترك</span></div>)}</div>:<Empty text="لا يوجد مشتركون بعد. أضف أول مشترك للبدء."/>}</div></div>
    </>}
  </>;
}
function Stat({title,value,icon,tone}:{title:string;value:React.ReactNode;icon:React.ReactNode;tone:string}) { return <div className="stat-card"><span className={`stat-icon ${tone}`}>{icon}</span><span className="stat-title">{title}</span><strong>{value}</strong></div>; }
function Empty({text}:{text:string}) { return <div className="empty-state"><span className="empty-icon"><ClipboardList/></span><p>{text}</p></div>; }

function Members() { return <MembersPage/>; }

function Plans() {
  const plans=useListPlans(); const qc=useQueryClient(); const create=useCreatePlan(); const [open,setOpen]=useState(false);
  function submit(e:FormEvent<HTMLFormElement>){e.preventDefault();const f=new FormData(e.currentTarget);create.mutate({data:{name:String(f.get("name")),durationDays:Number(f.get("durationDays")),priceFils:Math.round(Number(f.get("price")||0)*1000)}},{onSuccess:()=>{void qc.invalidateQueries({queryKey:getListPlansQueryKey()});setOpen(false);}});}
  return <><PageHeading eyebrow="إعداد العضويات" title="الباقات"><button className="button primary" onClick={()=>setOpen(!open)}><Plus size={16}/>إضافة باقة</button></PageHeading>{open&&<form className="panel form-panel" onSubmit={submit}><h2>باقة جديدة</h2><div className="form-grid"><label>اسم الباقة<input required name="name" placeholder="شهري، ١٠ حصص…"/></label><label>المدة بالأيام<input required type="number" min="1" name="durationDays" placeholder="30"/></label><label>السعر بالدينار الأردني<input required type="number" min="0" step="0.001" name="price" placeholder="25.000"/></label></div><div className="form-actions"><button className="button primary" disabled={create.isPending}>حفظ الباقة</button><button type="button" className="button ghost" onClick={()=>setOpen(false)}>إلغاء</button></div></form>}<div className="plan-grid">{plans.data?.map(p=><div className="panel plan-card" key={p.id}><span className="plan-symbol"><Dumbbell/></span><span className={`status-pill ${p.active?"success":"muted"}`}>{p.active?"مفعّلة":"موقوفة"}</span><h2>{p.name}</h2><p>مدة الاشتراك: {p.durationDays} يوم</p><strong><Money fils={p.priceFils}/></strong></div>)}</div>{!plans.isLoading&&!plans.data?.length&&<div className="panel"><Empty text="لم تُضف أي باقات بعد."/></div>}</>;
}

function Subscriptions() { return <SubscriptionsPage/>; }

function FinancePage() {
  const [tab,setTab]=useState<"transactions"|"cash"|"payroll"|"reports">("transactions");
  const today=new Intl.DateTimeFormat("en-CA",{timeZone:"Asia/Amman"}).format(new Date());
  const [from,setFrom]=useState(`${today.slice(0,7)}-01`);
  const [to,setTo]=useState(today);
  const qc=useQueryClient();
  const categories=useListFinanceCategories();
  const transactions=useListFinanceTransactions({from,to});
  const cashMovements=useListCashMovements({from,to});
  const employees=useListEmployees();
  const payroll=useListPayroll();
  const report=useGetFinanceReport({from,to},{query:{enabled:tab==="reports",queryKey:getGetFinanceReportQueryKey({from,to})}});
  const createCategory=useCreateFinanceCategory();
  const createTransaction=useCreateFinanceTransaction();
  const createEmployee=useCreateEmployee();
  const createPayroll=useCreatePayroll();
  const payPayroll=usePayPayroll();
  const refreshFinance=()=>{void qc.invalidateQueries({queryKey:getListFinanceTransactionsQueryKey({from,to})});void qc.invalidateQueries({queryKey:getListCashMovementsQueryKey({from,to})});void qc.invalidateQueries({queryKey:getGetFinanceReportQueryKey({from,to})});void qc.invalidateQueries({queryKey:getListPayrollQueryKey()});void qc.invalidateQueries({queryKey:getGetClubDashboardQueryKey()});};
  function transactionSubmit(e:FormEvent<HTMLFormElement>){e.preventDefault();const form=e.currentTarget;const f=new FormData(form);createTransaction.mutate({data:{kind:String(f.get("kind")) as "income"|"expense",categoryId:f.get("categoryId")?Number(f.get("categoryId")):null,amountFils:Math.round(Number(f.get("amount"))*1000),method:String(f.get("method")) as "cash"|"card"|"bank_transfer"|"wallet",description:String(f.get("description")),transactionDate:String(f.get("date"))}},{onSuccess:()=>{refreshFinance();form.reset();}});}
  function categorySubmit(e:FormEvent<HTMLFormElement>){e.preventDefault();const form=e.currentTarget;const f=new FormData(form);createCategory.mutate({data:{name:String(f.get("name")),kind:String(f.get("kind")) as "income"|"expense"}},{onSuccess:()=>{void qc.invalidateQueries({queryKey:getListFinanceCategoriesQueryKey()});form.reset();}});}
  function employeeSubmit(e:FormEvent<HTMLFormElement>){e.preventDefault();const f=new FormData(e.currentTarget);createEmployee.mutate({data:{name:String(f.get("name")),position:String(f.get("position")),phone:String(f.get("phone"))||null,baseSalaryFils:Math.round(Number(f.get("salary"))*1000),hiredAt:String(f.get("hiredAt"))||null}},{onSuccess:()=>{void qc.invalidateQueries({queryKey:getListEmployeesQueryKey()});}});}
  function payrollSubmit(e:FormEvent<HTMLFormElement>){e.preventDefault();const f=new FormData(e.currentTarget);createPayroll.mutate({data:{employeeId:Number(f.get("employeeId")),period:String(f.get("period")),amountFils:Math.round(Number(f.get("amount"))*1000),dueDate:String(f.get("dueDate"))}},{onSuccess:()=>{void qc.invalidateQueries({queryKey:getListPayrollQueryKey()});void qc.invalidateQueries({queryKey:getGetFinanceReportQueryKey({from,to})});}});}
  function payEntry(id:number,balanceFils:number){const raw=window.prompt(`المبلغ المراد صرفه (المتبقي ${(balanceFils/1000).toFixed(3)} د.أ)`);if(!raw)return;const amountFils=Math.round(Number(raw)*1000);if(!Number.isSafeInteger(amountFils)||amountFils<1){window.alert("أدخل مبلغًا صحيحًا");return;}payPayroll.mutate({id,data:{amountFils,method:"cash"}},{onSuccess:refreshFinance});}
  function exportTransactions(){const rows=transactions.data??[];const quote=(value:unknown)=>`"${String(value??"").replaceAll('"','""')}"`;const csv=["التاريخ,النوع,التصنيف,الوصف,طريقة الدفع,المبلغ بالفلس",...rows.map(t=>[t.transactionDate,t.kind==="income"?"إيراد":"مصروف",t.categoryName,t.description,t.method,t.amountFils].map(quote).join(","))].join("\r\n");const url=URL.createObjectURL(new Blob(["\uFEFF",csv],{type:"text/csv;charset=utf-8"}));const a=document.createElement("a");a.href=url;a.download=`club-finance-${from}-${to}.csv`;a.click();URL.revokeObjectURL(url);}
  return <><PageHeading eyebrow="الإدارة المالية" title="المصاريف والرواتب"><span className="period-pill">الدينار الأردني · فلس</span></PageHeading>
    <div className="form-actions finance-tabs"><button className={`button ${tab==="transactions"?"primary":"ghost"}`} onClick={()=>setTab("transactions")}>الإيرادات والمصاريف</button><button className={`button ${tab==="cash"?"primary":"ghost"}`} onClick={()=>setTab("cash")}>الصندوق</button><button className={`button ${tab==="payroll"?"primary":"ghost"}`} onClick={()=>setTab("payroll")}>الموظفون والرواتب</button><button className={`button ${tab==="reports"?"primary":"ghost"}`} onClick={()=>setTab("reports")}>التقارير</button></div>
    <div className="form-grid finance-date-range"><label>من تاريخ<input type="date" value={from} onChange={e=>setFrom(e.target.value)}/></label><label>إلى تاريخ<input type="date" value={to} onChange={e=>setTo(e.target.value)}/></label></div>
    {tab==="transactions"&&<><div className="finance-forms"><form className="panel form-panel" onSubmit={transactionSubmit}><h2>تسجيل إيراد أو مصروف</h2><div className="form-grid"><label>النوع<select name="kind"><option value="expense">مصروف</option><option value="income">إيراد إضافي</option></select></label><label>التصنيف<select name="categoryId" defaultValue=""><option value="">بدون تصنيف</option>{categories.data?.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select></label><label>المبلغ (د.أ)<input name="amount" type="number" min=".001" step=".001" required/></label><label>طريقة الدفع<select name="method"><option value="cash">نقدًا</option><option value="card">بطاقة</option><option value="bank_transfer">تحويل بنكي</option><option value="wallet">محفظة</option></select></label><label>التاريخ<input name="date" type="date" defaultValue={today} required/></label><label>الوصف<input name="description" minLength={2} maxLength={500} required/></label></div>{createTransaction.isError&&<p className="error-text">تعذر حفظ الحركة المالية.</p>}<button className="button primary" disabled={createTransaction.isPending}>حفظ الحركة</button></form>
    <form className="panel form-panel" onSubmit={categorySubmit}><h2>تصنيف جديد</h2><div className="form-grid"><label>اسم التصنيف<input name="name" required minLength={2}/></label><label>نوع التصنيف<select name="kind"><option value="expense">مصروف</option><option value="income">إيراد</option></select></label></div><button className="button ghost" disabled={createCategory.isPending}>إضافة تصنيف</button></form></div>
    <div className="panel table-panel"><div className="table-toolbar"><h2>الحركات المالية</h2><button className="button ghost" onClick={exportTransactions} disabled={!transactions.data?.length}>تصدير Excel-compatible (CSV)</button></div>{transactions.isLoading?<div className="loading-panel">جارٍ تحميل الحركات…</div>:transactions.data?.length?<div className="table-scroll"><table><thead><tr><th>التاريخ</th><th>النوع</th><th>التصنيف</th><th>الوصف</th><th>طريقة الدفع</th><th>المبلغ</th></tr></thead><tbody>{transactions.data.map(t=><tr key={t.id}><td>{String(t.transactionDate).slice(0,10)}</td><td>{t.kind==="income"?"إيراد":"مصروف"}</td><td>{t.categoryName||"—"}</td><td>{t.description}</td><td>{t.method}</td><td><Money fils={t.amountFils}/></td></tr>)}</tbody></table></div>:<Empty text="لا توجد حركات مالية خلال الفترة المحددة."/>}</div></>}
    {tab==="cash"&&<div className="panel table-panel"><div className="table-toolbar"><div><h2>سجل الصندوق النقدي</h2><small>الحركات النقدية فقط · مرتبة من الأحدث</small></div><strong>الرصيد الحالي: <Money fils={report.data?.cashBalanceFils??0}/></strong></div>{cashMovements.isLoading?<div className="loading-panel">جارٍ تحميل حركات الصندوق…</div>:cashMovements.data?.length?<div className="table-scroll"><table><thead><tr><th>التاريخ والوقت</th><th>الحركة</th><th>الوصف</th><th>المبلغ</th></tr></thead><tbody>{cashMovements.data.map(m=><tr key={m.id}><td>{new Intl.DateTimeFormat("ar-JO",{dateStyle:"medium",timeStyle:"short",timeZone:"Asia/Amman"}).format(new Date(m.createdAt))}</td><td><span className={`status-pill ${m.direction==="in"?"success":"warn"}`}>{m.direction==="in"?"قبض":"صرف"}</span></td><td>{m.description}</td><td><Money fils={m.amountFils}/></td></tr>)}</tbody></table></div>:<Empty text="لا توجد حركات نقدية خلال الفترة المحددة."/>}</div>}
    {tab==="payroll"&&<><div className="finance-forms"><form className="panel form-panel" onSubmit={employeeSubmit}><h2>إضافة موظف</h2><div className="form-grid"><label>الاسم<input name="name" required minLength={2}/></label><label>المسمى الوظيفي<input name="position" required/></label><label>الهاتف<input name="phone" inputMode="tel"/></label><label>الراتب الأساسي (د.أ)<input name="salary" type="number" min="0" step=".001" required/></label><label>تاريخ التعيين<input name="hiredAt" type="date"/></label></div>{createEmployee.isError&&<p className="error-text">تعذر حفظ الموظف.</p>}<button className="button primary" disabled={createEmployee.isPending}>حفظ الموظف</button></form>
    <form className="panel form-panel" onSubmit={payrollSubmit}><h2>استحقاق راتب</h2><div className="form-grid"><label>الموظف<select name="employeeId" required>{employees.data?.filter(e=>e.active).map(e=><option key={e.id} value={e.id}>{e.name}</option>)}</select></label><label>الشهر<input name="period" type="month" required defaultValue={today.slice(0,7)}/></label><label>المبلغ (د.أ)<input name="amount" type="number" min="0" step=".001" required/></label><label>موعد الاستحقاق<input name="dueDate" type="date" required defaultValue={today}/></label></div>{createPayroll.isError&&<p className="error-text">تعذر إضافة الراتب؛ قد يوجد استحقاق مسجل للشهر نفسه.</p>}<button className="button primary" disabled={createPayroll.isPending}>إنشاء الاستحقاق</button></form></div>
    <div className="panel table-panel"><h2>سجل الرواتب</h2>{payroll.data?.length?<div className="table-scroll"><table><thead><tr><th>الموظف</th><th>الفترة</th><th>المستحق</th><th>المدفوع</th><th>المتبقي</th><th>الحالة</th><th>إجراء</th></tr></thead><tbody>{payroll.data.map(p=>{const balance=p.amountFils-p.paidFils;return <tr key={p.id}><td>{p.employeeName}</td><td>{p.period}</td><td><Money fils={p.amountFils}/></td><td><Money fils={p.paidFils}/></td><td><Money fils={balance}/></td><td>{p.status==="paid"?"مدفوع":p.status==="partial"?"مدفوع جزئيًا":"مستحق"}</td><td>{balance>0&&<button className="mini-button" onClick={()=>payEntry(p.id,balance)}>تسجيل صرف</button>}</td></tr>})}</tbody></table></div>:<Empty text="لا توجد سجلات رواتب."/>}</div></>}
    {tab==="reports"&&<>{report.isLoading?<div className="loading-panel">جارٍ إعداد التقرير…</div>:report.data?<div className="stats-grid"><Stat title="الإيرادات المحصلة" value={<Money fils={report.data.incomeFils}/>} icon={<ArrowDownLeft/>} tone="green"/><Stat title="المصاريف المسجلة" value={<Money fils={report.data.expensesFils}/>} icon={<Banknote/>} tone="rose"/><Stat title="صافي الفترة" value={<Money fils={report.data.netFils}/>} icon={<ChartNoAxesCombined/>} tone="blue"/><Stat title="ديون المشتركين" value={<Money fils={report.data.debtFils}/>} icon={<Wallet/>} tone="amber"/><Stat title="رواتب مستحقة" value={<Money fils={report.data.payrollDueFils}/>} icon={<Users/>} tone="amber"/><Stat title="رصيد الصندوق الحالي" value={<Money fils={report.data.cashBalanceFils}/>} icon={<Wallet/>} tone="blue"/></div>:<div className="error-panel">تعذر إعداد التقرير. تحقق من نطاق التاريخ.</div>}<div className="panel"><p>يشمل الإيرادات دفعات الاشتراكات والإيرادات الإضافية المسجلة، وتشمل المصاريف الحركات المسجلة وصرف الرواتب. رصيد الصندوق محسوب من الحركات النقدية المسجلة. لا يتضمن هذا التقرير قيود محاسبة مزدوجة.</p><button className="button ghost" onClick={()=>window.print()}>طباعة التقرير / PDF</button></div></>}
  </>;
}

type WhatsAppSettingsView={wabaId:string;phoneNumberId:string;enabled:boolean;configured:boolean;templates:{id:number;name:string;body:string;status:string;providerTemplateName:string|null}[]};
function WhatsAppSettingsPage() {
  const {can}=useAccess();
  const [settings,setSettings]=useState<WhatsAppSettingsView|null>(null);
  const [loading,setLoading]=useState(true);
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState("");
  const load=()=>clubApi<WhatsAppSettingsView>("/club/whatsapp/settings").then(setSettings).catch(e=>setError(e.message)).finally(()=>setLoading(false));
  useEffect(()=>{void load();},[]);
  async function save(e:FormEvent<HTMLFormElement>){e.preventDefault();const f=new FormData(e.currentTarget);setBusy(true);setError("");try{const result=await clubApi<WhatsAppSettingsView>("/club/whatsapp/settings",{method:"PUT",body:JSON.stringify({wabaId:String(f.get("wabaId")),phoneNumberId:String(f.get("phoneNumberId")),enabled:f.get("enabled")==="on"})});setSettings(current=>current?{...current,...result}:current);}catch(e){setError(e instanceof Error?e.message:"تعذر الحفظ");}finally{setBusy(false);}}
  async function createTemplate(key:string,body:string){setBusy(true);setError("");try{await clubApi("/club/whatsapp/templates/create",{method:"POST",body:JSON.stringify({key,body})});await load();}catch(e){setError(e instanceof Error?e.message:"تعذر إرسال القالب للمراجعة");}finally{setBusy(false);}}
  async function syncTemplates(){setBusy(true);setError("");try{await clubApi("/club/whatsapp/templates/sync",{method:"POST"});await load();}catch(e){setError(e instanceof Error?e.message:"تعذر تحديث حالة القوالب");}finally{setBusy(false);}}
  const templateInfo=[["expiry_2_days","قبل الانتهاء بيومين"],["expiry_today","يوم الانتهاء"],["manual","تذكير يدوي"],["expiry_custom","مواعيد التذكير المخصصة"],["expiry_expired","اشتراك منتهٍ لم يُجدّد"]] as const;
  if(!can("whatsapp.edit"))return <><PageHeading eyebrow="عرض فقط" title="حالة WhatsApp Business"/>{error&&<div className="error-panel">{error}</div>}{loading?<p>جارٍ التحميل…</p>:<div className="panel form-panel"><h2>إعدادات الربط</h2><p>{settings?.enabled?"التذكيرات مفعّلة في الإعدادات؛ يلزم اتصال وقوالب معتمدة":"التذكيرات معطلة"}</p><p>حالة القوالب: {settings?.templates.map(t=>`${t.providerTemplateName}: ${t.status}`).join("، ")||"لا توجد قوالب"}</p><p>تعديل الربط والقوالب يحتاج صلاحية تعديل واتساب.</p></div>}</>;
  return <><PageHeading eyebrow="ربط Meta الرسمي" title="إعدادات WhatsApp Business"/><div className="panel notice-panel"><strong>حالة التذكيرات: {settings?.enabled?"مطلوب التفعيل بعد التحقق من Meta":"الإرسال معطّل"}</strong><p>يتطلب رقم حساب WhatsApp Business، ومعرّف رقم الهاتف، وقوالب عربية معتمدة من Meta واتصالًا صالحًا. قبول الرسالة من Meta لا يعني تسليمها للهاتف.</p></div>
    {loading?<div className="loading-panel">جارٍ تحميل الإعدادات…</div>:<><form className="panel form-panel" onSubmit={save}><h2>بيانات الحساب</h2><div className="form-grid"><label>معرّف حساب WhatsApp Business (اختياري عند استخدام Secrets)<input name="wabaId" defaultValue={settings?.wabaId||""}/></label><label>معرّف رقم الهاتف (يمكن ضبطه في Secrets)<input name="phoneNumberId" defaultValue={settings?.phoneNumberId||""}/></label><label className="checkbox-label"><input type="checkbox" name="enabled" defaultChecked={settings?.enabled}/> تفعيل التذكيرات التلقائية</label></div><p className="muted">تعمل التذكيرات قبل الانتهاء بيومين ويوم الانتهاء، وللاشتراك المنتهي غير المجدد. تعمل المهمة كل دقيقة أثناء تشغيل API دون حاجة لتسجيل دخول المدير؛ Autoscale قد يتوقف عند الخمول. الإرسال معطل افتراضيًا ولا تُطلب بيانات Meta لبناء التطبيق.</p><button className="button primary" disabled={busy}>حفظ الإعدادات</button></form>
    <div className="panel table-panel"><div className="table-toolbar"><div><h2>قوالب الرسائل العربية</h2><small>تُرسل القوالب إلى Meta للمراجعة؛ يلزم اعتمادها قبل الإرسال</small></div><button className="button ghost" onClick={syncTemplates} disabled={busy||!settings?.wabaId}>تحديث الحالات</button></div>{templateInfo.map(([key,title])=>{const t=settings?.templates.find(x=>x.name===key);return <TemplateForm key={key} templateKey={key} title={title} body={t?.body||""} status={t?.status||"draft"} busy={busy} onSubmit={body=>createTemplate(key,body)}/>})}</div></>}
    {error&&<div className="error-panel">{error}</div>}</>;
}

function TemplateForm({templateKey,title,body,status,busy,onSubmit}:{templateKey:string;title:string;body:string;status:string;busy:boolean;onSubmit:(body:string)=>void}) {
  const [value,setValue]=useState(body);
  useEffect(()=>setValue(body),[body]);
  const statusLabel:Record<string,string>={approved:"معتمد",pending:"بانتظار مراجعة Meta",draft:"مسودة",rejected:"مرفوض",paused:"موقوف مؤقتًا",disabled:"معطّل"};
  return <form className="whatsapp-template-row" onSubmit={e=>{e.preventDefault();onSubmit(value);}}><label>{title}<textarea required minLength={10} maxLength={1024} value={value} onChange={e=>setValue(e.target.value)} placeholder="مرحبًا {{1}}، ... {{2}} ... {{3}}"/></label><div className="template-meta"><span className={`status-pill ${status==="approved"?"success":"warn"}`}>{statusLabel[status]||"حالة غير معروفة"}</span><button className="mini-button" disabled={busy||status==="approved"||status==="pending"}>إرسال القالب لمراجعة Meta</button></div></form>;
}

function MemberDetail() {
  const {id:rawId}=useParams();const id=Number(rawId);const detailQuery=useGetMember(id,{query:{enabled:Number.isInteger(id)&&id>0,queryKey:getGetMemberQueryKey(id)}});
  const info=detailQuery.data;const [waLogs,setWaLogs]=useState<any[]>([]);const [waMessage,setWaMessage]=useState("");const [waBusy,setWaBusy]=useState(false);
  const loadWaLogs=()=>clubApi<any[]>(`/members/${id}/whatsapp-reminders`).then(setWaLogs).catch(()=>setWaLogs([]));
  useEffect(()=>{if(Number.isInteger(id)&&id>0)void loadWaLogs();},[id]);
  async function sendManualReminder(){setWaBusy(true);setWaMessage("");try{const result=await clubApi<{message:string}>(`/members/${id}/whatsapp-reminder`,{method:"POST"});setWaMessage(result.message);await loadWaLogs();}catch(e){setWaMessage(e instanceof Error?e.message:"تعذر إرسال التذكير");}finally{setWaBusy(false);}}
  if(detailQuery.isLoading)return <div className="loading-panel">جارٍ تحميل الملف…</div>;
  if(!info)return <div className="panel"><Empty text="تعذر العثور على ملف المشترك."/></div>;
  return <><PageHeading eyebrow="ملف المشترك" title={info.member.name}><div className="quick-actions"><button className="button primary" onClick={sendManualReminder} disabled={waBusy}>إرسال تذكير واتساب</button><Link href="/members" className="button ghost">العودة للمشتركين</Link></div></PageHeading>{waMessage&&<div className="notice-panel">{waMessage}</div>}<div className="panel member-summary"><div className="avatar large">{info.member.name.slice(0,1)}</div><div><h2>{info.member.name}</h2><p dir="ltr">{info.member.phone}</p><small>تاريخ التسجيل: {info.member.joinedAt.slice(0,10)}</small>{info.member.birthDate&&<small> · تاريخ الميلاد: {info.member.birthDate}</small>}{info.member.notes&&<p>{info.member.notes}</p>}</div></div><MemberProfileTools member={info.member}/><SubscriptionManager memberId={info.member.id}/><div className="panel table-panel history-panel"><div className="table-toolbar"><div><h2>سجل الدفعات</h2><small>الإيصالات قابلة للطباعة</small></div></div>{info.payments.length?<div className="table-scroll"><table><thead><tr><th>رقم الإيصال</th><th>التاريخ</th><th>النوع</th><th>المبلغ</th><th>طريقة الدفع</th><th>الإيصال</th></tr></thead><tbody>{info.payments.map(p=><tr key={p.id}><td>{p.receiptNumber}</td><td>{p.createdAt.slice(0,10)}</td><td>{p.kind==="payment"?"دفعة":p.kind==="discount"?"خصم":"استرداد"}</td><td><Money fils={p.amountFils}/></td><td>{p.method}</td><td>{p.kind==="payment"&&<Link href={`/receipt/${p.id}`} className="text-link">عرض وطباعة</Link>}</td></tr>)}</tbody></table></div>:<Empty text="لا توجد دفعات مسجلة لهذا المشترك."/>}</div><div className="panel table-panel"><h2>سجل تذكيرات واتساب</h2>{waLogs.length?<div className="table-scroll"><table><thead><tr><th>التاريخ</th><th>النوع</th><th>الحالة</th><th>التفاصيل</th></tr></thead><tbody>{waLogs.map(log=><tr key={log.id}><td>{new Date(log.createdAt).toLocaleString("ar-JO",{timeZone:"Asia/Amman"})}</td><td>{log.triggerDays==="2"?"قبل الانتهاء بيومين":log.triggerDays==="0"?"يوم الانتهاء":"يدوي"}</td><td>{log.status==="accepted"?"قبلتها Meta":log.status==="failed"?"فشل":log.status}</td><td>{log.error||"القبول لا يؤكد التسليم"}</td></tr>)}</tbody></table></div>:<Empty text="لا توجد تذكيرات مسجلة."/ >}</div></>;
}

function ReceiptPage() {
  const {can}=useAccess();
  const {id:rawId}=useParams(); const id=Number(rawId); const query=useGetPaymentReceipt(id,{query:{enabled:Number.isInteger(id)&&id>0,queryKey:getGetPaymentReceiptQueryKey(id)}});
  const r=query.data;
  return <div className="receipt-page" dir="rtl"><div className="receipt-actions"><Link href="/subscriptions" className="button ghost">رجوع</Link>{can("payments.export")&&<button className="button primary" onClick={()=>window.print()}><Printer size={16}/>طباعة الإيصال / PDF</button>}</div>{query.isLoading?<div className="loading-panel">جارٍ تحميل الإيصال…</div>:r?<article className="receipt"><div className="receipt-head"><div className="brand-icon"><Dumbbell/></div><div><h1>إيصال دفع</h1><p>إدارة النادي الرياضي</p></div></div><div className="receipt-number">رقم الإيصال <strong>{r.receiptNumber}</strong></div><dl><dt>اسم المشترك</dt><dd>{r.memberName}</dd><dt>رقم الهاتف</dt><dd dir="ltr">{r.memberPhone}</dd><dt>الباقة</dt><dd>{r.planName}</dd><dt>طريقة الدفع</dt><dd>{r.method}</dd><dt>التاريخ</dt><dd>{r.createdAt.slice(0,10)}</dd></dl><div className="receipt-total"><span>المبلغ المدفوع</span><strong><Money fils={r.amountFils}/></strong></div><p className="receipt-thanks">شكرًا لاشتراككم</p></article>:<div className="error-panel">الإيصال غير موجود.</div>}</div>;
}

function MainRouter() {
  const [,setLocation]=useLocation();
  return <Switch><Route path="/" component={HomeRedirect}/><Route path="/sign-in/*?" component={AuthPages}/><Route path="/sign-up/*?" component={AuthPages}/>
    <Route path="/admin"><Protected ownerOnly><AdminPage/></Protected></Route>
    <Route path="/account"><Protected><UserProfile routing="hash"/></Protected></Route>
    <Route path="/dashboard"><Protected permissions={["dashboard.view"]}><RoleDashboard/></Protected></Route>
    <Route path="/members"><Protected permissions={["members.view"]}><Members/></Protected></Route>
    <Route path="/members/:id"><Protected permissions={["members.view"]}><RoleMemberDetail/></Protected></Route>
    <Route path="/plans"><Protected permissions={["plans.view"]}><PlansPage/></Protected></Route>
    <Route path="/subscriptions"><Protected permissions={["subscriptions.view"]}><RoleSubscriptions/></Protected></Route>
    <Route path="/finance"><Protected anyPermissions={["finance.view", "employees.view", "payroll.view"]}><FinanceManagementPage/></Protected></Route>
    <Route path="/settings/whatsapp"><Protected permissions={["whatsapp.view"]}><WhatsAppSettingsPage/></Protected></Route>
    <Route path="/reports"><Protected permissions={["reports.view"]}><ReportsPage/></Protected></Route>
    <Route path="/receipt/:id"><Protected permissions={["payments.view"]}><ReceiptPage/></Protected></Route>
    <Route><div className="panel"><Empty text="الصفحة غير موجودة."/><button className="button primary" onClick={()=>setLocation("/dashboard")}>العودة للوحة التحكم</button></div></Route>
  </Switch>;
}

function IdentityQueries() {
  const { user } = useUser();
  return <ScopedQueries key={user?.id ?? "signed-out"}/>;
}
function ScopedQueries() {
  const [client] = useState(() => new QueryClient({ defaultOptions: { queries: { retry: false } } }));
  useEffect(() => () => { void client.cancelQueries(); client.clear(); }, [client]);
  return <QueryClientProvider client={client}><MainRouter/></QueryClientProvider>;
}

function ClerkApp() {
  const [,setLocation]=useLocation();
  const [theme,setTheme]=useState<AppTheme>(storedTheme);
  useEffect(()=>{
    const onThemeChange=(event:Event)=>{
      const next=(event as CustomEvent<AppTheme>).detail;
      if(next==="light"||next==="dark")setTheme(next);
    };
    window.addEventListener("prime-theme-change",onThemeChange);
    return()=>window.removeEventListener("prime-theme-change",onThemeChange);
  },[]);
  const appearance=useMemo(()=>getClerkAppearance(theme),[theme]);
  return <ClerkProvider publishableKey={clerkPubKey} proxyUrl={clerkProxyUrl} appearance={appearance} signInUrl={`${basePath}/sign-in`} signUpUrl={`${basePath}/sign-up`}
    localization={{ ...arSA, formFieldInputPlaceholder__emailAddress: "أدخل بريدك الإلكتروني", formFieldInputPlaceholder__emailAddress_username: "أدخل بريدك الإلكتروني" }}
    routerPush={(to)=>setLocation(stripBase(to))} routerReplace={(to)=>setLocation(stripBase(to),{replace:true})}>
    <IdentityQueries/>
  </ClerkProvider>;
}

function App() {
  if(!clerkPubKey) throw new Error("Missing VITE_CLERK_PUBLISHABLE_KEY");
  return <WouterRouter base={basePath}><ClerkApp/></WouterRouter>;
}
export default App;
