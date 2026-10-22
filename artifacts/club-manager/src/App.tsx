import { useState, type FormEvent, type ReactNode } from "react";
import { ClerkProvider, Show, SignIn, SignUp, useClerk, useUser } from "@clerk/react";
import { publishableKeyFromHost } from "@clerk/react/internal";
import { shadcn } from "@clerk/themes";
import { arSA } from "@clerk/localizations";
import { QueryClient, QueryClientProvider, useQueryClient } from "@tanstack/react-query";
import {
  getGetClubDashboardQueryKey, getGetClubSessionQueryKey, getListMembersQueryKey,
  getGetMemberQueryKey, getGetPaymentReceiptQueryKey, getListPlansQueryKey, getListSubscriptionsQueryKey,
  getListFinanceCategoriesQueryKey, getListFinanceTransactionsQueryKey, getListEmployeesQueryKey, getListPayrollQueryKey, getGetFinanceReportQueryKey,
  getListCashMovementsQueryKey,
  useActOnSubscription,
  useListFinanceCategories, useCreateFinanceCategory, useListFinanceTransactions, useCreateFinanceTransaction,
  useGetFinanceReport, useListEmployees, useCreateEmployee, useListPayroll, useCreatePayroll, usePayPayroll,
  useListCashMovements,
  useCreateMember, useCreatePlan, useCreateSubscription,
  useCreateSubscriptionPayment, useGetClubDashboard, useGetClubSession, useGetMember,
  useGetPaymentReceipt, useListMembers, useListPlans, useListSubscriptions,
} from "@workspace/api-client-react";
import { ArrowDownLeft, BadgeCheck, Banknote, ChartNoAxesCombined, ClipboardList, Dumbbell, LayoutDashboard, LogOut, Plus, Search, Users, Wallet, Printer, MessageCircle, Settings } from "lucide-react";
import { Link, Redirect, Route, Switch, Router as WouterRouter, useLocation, useParams } from "wouter";

const queryClient = new QueryClient();
const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");
const clerkPubKey = publishableKeyFromHost(window.location.hostname, import.meta.env.VITE_CLERK_PUBLISHABLE_KEY);
const clerkProxyUrl = import.meta.env.VITE_CLERK_PROXY_URL;
function stripBase(path: string) { return basePath && path.startsWith(basePath) ? path.slice(basePath.length) || "/" : path; }
const appearance = {
  theme: shadcn,
  cssLayerName: "clerk",
  options: { logoPlacement: "inside" as const, logoLinkUrl: basePath || "/", logoImageUrl: `${window.location.origin}${basePath}/logo.svg` },
  variables: { colorPrimary: "#f4c400", colorForeground: "#171717", colorMutedForeground: "#666666", colorDanger: "#bd4a45", colorBackground: "#ffffff", colorInput: "#fafafa", colorInputForeground: "#171717", colorNeutral: "#dddddd", fontFamily: "Arial, sans-serif", borderRadius: "0.75rem" },
  elements: {
    rootBox: "w-full flex justify-center", cardBox: "bg-white rounded-2xl w-[440px] max-w-full overflow-hidden",
    card: "!shadow-none !border-0 !bg-transparent !rounded-none", footer: "!shadow-none !border-0 !bg-transparent !rounded-none",
    headerTitle: "text-slate-900", headerSubtitle: "text-slate-600", socialButtonsBlockButtonText: "text-slate-800",
    formFieldLabel: "text-slate-800", footerActionLink: "text-emerald-800", footerActionText: "text-slate-600",
    dividerText: "text-slate-500", identityPreviewEditButton: "text-slate-800", formFieldSuccessText: "text-emerald-800",
    alertText: "text-red-800", logoBox: "", logoImage: "", socialButtonsBlockButton: "", formButtonPrimary: "",
    formFieldInput: "", footerAction: "", dividerLine: "", alert: "", otpCodeFieldInput: "", formFieldRow: "", main: "",
  },
};

function Home() {
  return <main className="landing" dir="rtl"><div className="landing-brand"><span className="brand-mark-placeholder" aria-label="مكان شعار الأكاديمية">P</span><span>Prime Boxing Academy<small>أكاديمية برايم للملاكمة</small></span></div><div className="landing-copy"><p className="eyebrow">نظام إدارة الأكاديمية</p><h1>إدارة أكاديميتك،<br/><em>بثقة ووضوح.</em></h1><p>منصة عربية موحدة لتنظيم المشتركين والاشتراكات والعمليات اليومية.</p><Link href="/sign-in" className="button primary">تسجيل الدخول</Link></div><div className="landing-mark">Prime Boxing Academy <span>إدارة أكثر تنظيمًا.</span></div></main>;
}

function HomeRedirect() {
  const { isLoaded, isSignedIn } = useUser();
  if (!isLoaded) return <div className="center"><span className="spinner"/> جارٍ التحميل…</div>;
  return isSignedIn ? <Redirect to="/dashboard"/> : <Home/>;
}

function AuthPages() {
  return <div className="auth-page" dir="rtl"><div className="auth-brand"><span className="brand-mark-placeholder" aria-label="مكان شعار الأكاديمية">P</span><span>Prime Boxing Academy</span></div><Switch><Route path="/sign-in/*?"><SignIn routing="path" path={`${basePath}/sign-in`} signUpUrl={`${basePath}/sign-up`} /></Route><Route path="/sign-up/*?"><SignUp routing="path" path={`${basePath}/sign-up`} signInUrl={`${basePath}/sign-in`} /></Route></Switch></div>;
}

const navItems = [
  { href: "/dashboard", title: "لوحة التحكم", icon: LayoutDashboard },
  { href: "/members", title: "المشتركون", icon: Users },
  { href: "/subscriptions", title: "الاشتراكات", icon: BadgeCheck },
  { href: "/plans", title: "الباقات", icon: ClipboardList },
  { href: "/finance", title: "المالية والرواتب", icon: Wallet },
];

function AppShell({ children }: { children: ReactNode }) {
  const { user } = useUser();
  const { signOut } = useClerk();
  const [location] = useLocation();
  return <div className="app-shell" dir="rtl"><aside className="sidebar"><Link href="/dashboard" className="brand"><span className="brand-mark-placeholder">P</span><span>Prime Boxing Academy<small>إدارة الأكاديمية</small></span></Link><p className="nav-label">القائمة الرئيسية</p><nav>{navItems.map(({href,title,icon:Icon})=><Link key={href} href={href} className={`nav-link ${location===href?"active":""}`}><Icon size={18}/>{title}</Link>)}<p className="nav-label future-label">أقسام أخرى</p><div className="nav-link disabled"><MessageCircle size={18}/>تذكيرات واتساب<small>قيد التطوير</small></div><div className="nav-link disabled"><Settings size={18}/>الإعدادات<small>قيد التطوير</small></div></nav><div className="sidebar-bottom"><div className="profile"><div className="avatar">{user?.firstName?.slice(0,1)||"م"}</div><div><strong>{user?.fullName||"مدير الأكاديمية"}</strong><small>{user?.primaryEmailAddress?.emailAddress}</small></div></div><button className="nav-link logout" onClick={()=>signOut({redirectUrl:basePath||"/"})}><LogOut size={18}/>تسجيل الخروج</button></div></aside><main className="main-area"><header className="topbar"><div><span className="topbar-date">{new Intl.DateTimeFormat("ar-JO",{dateStyle:"full",timeZone:"Asia/Amman"}).format(new Date())}</span><span className="mobile-brand">Prime Boxing Academy</span></div><div className="topbar-user">بوابة إدارة الأكاديمية</div></header><section className="page-content">{children}</section></main><nav className="mobile-nav">{navItems.map(({href,title,icon:Icon})=><Link key={href} href={href} className={location===href?"active":""}><Icon size={19}/><small>{title}</small></Link>)}</nav></div>;
}

function Protected({ children }: { children: ReactNode }) {
  const { isLoaded, isSignedIn } = useUser();
  const session = useGetClubSession({ query: { enabled: !!isSignedIn, queryKey: getGetClubSessionQueryKey() } });
  if (!isLoaded || (isSignedIn && session.isLoading)) return <div className="center"><span className="spinner"/> جارٍ التحقق من صلاحية الحساب…</div>;
  if (!isSignedIn) return <Redirect to="/"/>;
  if (session.data?.setupRequired || !session.data?.role) return <AppShell><div className="setup-card"><div className="setup-icon"><Wallet/></div><h1>إعداد مدير النادي</h1><p>تم تسجيل الدخول، لكن لم يُعيّن مدير للنادي بعد. حماية البيانات مفعّلة ولن يتمكن أي حساب آخر من عرضها قبل إتمام إعداد المدير الأول.</p><p className="muted">يرجى إكمال إعداد المدير من مالك التطبيق ثم إعادة تحميل الصفحة.</p></div></AppShell>;
  return <AppShell>{children}</AppShell>;
}

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
  return <><PageHeading eyebrow="نظرة عامة" title="لوحة التحكم"><Link href="/members" className="button primary"><Plus size={16}/>إضافة مشترك</Link></PageHeading>
    {query.isLoading ? <div className="loading-panel">جارٍ تحميل بيانات النادي…</div> : query.error ? <div className="error-panel">تعذر تحميل لوحة التحكم. تحقق من الاتصال والصلاحيات.</div> : <>
      <div className="stats-grid">
        <Stat title="المشتركون النشطون" value={summary?.activeMembers??0} icon={<Users/>} tone="green"/>
        <Stat title="تنتهي خلال ٧ أيام" value={summary?.endingSoon??0} icon={<BadgeCheck/>} tone="amber"/>
        <Stat title="اشتراكات منتهية" value={summary?.expiredSubscriptions??0} icon={<ClipboardList/>} tone="rose"/>
        <Stat title="الرصيد المستحق" value={<Money fils={summary?.outstandingFils??0}/>} icon={<Wallet/>} tone="blue"/>
        <Stat title="مصروفات هذا الشهر" value={<Money fils={finance.data?.expensesFils??0}/>} icon={<Banknote/>} tone="rose"/>
        <Stat title="رواتب مستحقة" value={<Money fils={finance.data?.payrollDueFils??0}/>} icon={<Users/>} tone="amber"/>
        <Stat title="رصيد الصندوق" value={<Money fils={finance.data?.cashBalanceFils??0}/>} icon={<Wallet/>} tone="blue"/>
      </div>
      <div className="overview-grid"><div className="panel revenue-panel"><div className="panel-head"><div><p className="eyebrow">التحصيل</p><h2>الإيرادات المحصلة</h2></div><span className="period-pill">هذا الشهر</span></div><div className="revenue-total"><Money fils={summary?.monthlyCollectedFils??0}/></div><div className="revenue-note"><ArrowDownLeft size={16}/> مجموع الدفعات المسجلة هذا الشهر</div><div className="revenue-foot"><span>إجمالي التحصيل المسجل</span><strong><Money fils={summary?.collectedFils??0}/></strong></div></div>
      <div className="panel"><div className="panel-head"><div><p className="eyebrow">آخر الإضافات</p><h2>المشتركون الجدد</h2></div><Link href="/members" className="text-link">عرض الكل</Link></div>{summary?.recentMembers?.length ? <div className="compact-list">{summary.recentMembers.map(m=><div className="compact-row" key={m.id}><span className="avatar soft">{m.name.slice(0,1)}</span><div><strong>{m.name}</strong><small>{m.phone}</small></div><span className="status-pill success">مشترك</span></div>)}</div>:<Empty text="لا يوجد مشتركون بعد. أضف أول مشترك للبدء."/>}</div></div>
    </>}
  </>;
}
function Stat({title,value,icon,tone}:{title:string;value:React.ReactNode;icon:React.ReactNode;tone:string}) { return <div className="stat-card"><span className={`stat-icon ${tone}`}>{icon}</span><span className="stat-title">{title}</span><strong>{value}</strong></div>; }
function Empty({text}:{text:string}) { return <div className="empty-state"><span className="empty-icon"><ClipboardList/></span><p>{text}</p></div>; }

function Members() {
  const [search,setSearch]=useState("");
  const [open,setOpen]=useState(false);
  const query=useListMembers({search:search||undefined,limit:50});
  const qc=useQueryClient();
  const create=useCreateMember();
  function submit(event:FormEvent<HTMLFormElement>) {
    event.preventDefault(); const form=new FormData(event.currentTarget);
    create.mutate({data:{name:String(form.get("name")||"").trim(),phone:String(form.get("phone")||"").trim(),email:String(form.get("email")||"").trim()||null,notes:String(form.get("notes")||"").trim()||null}},{onSuccess:()=>{void qc.invalidateQueries({queryKey:getListMembersQueryKey()});void qc.invalidateQueries({queryKey:getGetClubDashboardQueryKey()});setOpen(false);}});
  }
  return <><PageHeading eyebrow="إدارة الأعضاء" title="المشتركون"><button className="button primary" onClick={()=>setOpen(!open)}><Plus size={16}/>مشترك جديد</button></PageHeading>
  {open&&<form className="panel form-panel" onSubmit={submit}><h2>إضافة مشترك</h2><div className="form-grid"><label>الاسم الكامل<input required minLength={2} name="name" placeholder="الاسم كما يظهر في السجل"/></label><label>رقم الهاتف<input required name="phone" inputMode="tel" placeholder="+962 7X XXX XXXX"/></label><label>البريد الإلكتروني<input name="email" type="email" placeholder="اختياري"/></label><label>ملاحظات<input name="notes" placeholder="معلومات إضافية، إن وجدت"/></label></div>{create.isError&&<p className="error-text">تعذر حفظ المشترك. تحقق من أن رقم الهاتف غير مسجل مسبقًا.</p>}<div className="form-actions"><button className="button primary" disabled={create.isPending}>{create.isPending?"جارٍ الحفظ…":"حفظ المشترك"}</button><button type="button" className="button ghost" onClick={()=>setOpen(false)}>إلغاء</button></div></form>}
  <div className="panel table-panel"><div className="table-toolbar"><div><h2>قائمة المشتركين</h2><small>{query.data?.length??0} مشترك</small></div><label className="searchbox"><Search size={16}/><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="ابحث بالاسم أو الهاتف"/></label></div>
  {query.isLoading?<div className="loading-panel">جارٍ تحميل المشتركين…</div>:query.data?.length?<div className="table-scroll"><table><thead><tr><th>المشترك</th><th>رقم الهاتف</th><th>تاريخ التسجيل</th><th>الحالة</th></tr></thead><tbody>{query.data.map(m=><tr key={m.id}><td><Link href={`/members/${m.id}`} className="member-name"><span className="avatar soft">{m.name.slice(0,1)}</span><strong>{m.name}</strong></Link></td><td dir="ltr" className="ltr">{m.phone}</td><td>{new Intl.DateTimeFormat("ar-JO",{dateStyle:"medium",timeZone:"Asia/Amman"}).format(new Date(m.joinedAt))}</td><td><span className={`status-pill ${m.active?"success":"muted"}`}>{m.active?"نشط":"غير نشط"}</span></td></tr>)}</tbody></table></div>:<Empty text={search?"لا توجد نتائج مطابقة.":"لا يوجد مشتركون بعد. سجّل أول مشترك للنادي."}/>}</div></>;
}

function Plans() {
  const plans=useListPlans(); const qc=useQueryClient(); const create=useCreatePlan(); const [open,setOpen]=useState(false);
  function submit(e:FormEvent<HTMLFormElement>){e.preventDefault();const f=new FormData(e.currentTarget);create.mutate({data:{name:String(f.get("name")),durationDays:Number(f.get("durationDays")),priceFils:Math.round(Number(f.get("price")||0)*1000)}},{onSuccess:()=>{void qc.invalidateQueries({queryKey:getListPlansQueryKey()});setOpen(false);}});}
  return <><PageHeading eyebrow="إعداد العضويات" title="الباقات"><button className="button primary" onClick={()=>setOpen(!open)}><Plus size={16}/>إضافة باقة</button></PageHeading>{open&&<form className="panel form-panel" onSubmit={submit}><h2>باقة جديدة</h2><div className="form-grid"><label>اسم الباقة<input required name="name" placeholder="شهري، ١٠ حصص…"/></label><label>المدة بالأيام<input required type="number" min="1" name="durationDays" placeholder="30"/></label><label>السعر بالدينار الأردني<input required type="number" min="0" step="0.001" name="price" placeholder="25.000"/></label></div><div className="form-actions"><button className="button primary" disabled={create.isPending}>حفظ الباقة</button><button type="button" className="button ghost" onClick={()=>setOpen(false)}>إلغاء</button></div></form>}<div className="plan-grid">{plans.data?.map(p=><div className="panel plan-card" key={p.id}><span className="plan-symbol"><Dumbbell/></span><span className={`status-pill ${p.active?"success":"muted"}`}>{p.active?"مفعّلة":"موقوفة"}</span><h2>{p.name}</h2><p>مدة الاشتراك: {p.durationDays} يوم</p><strong><Money fils={p.priceFils}/></strong></div>)}</div>{!plans.isLoading&&!plans.data?.length&&<div className="panel"><Empty text="لم تُضف أي باقات بعد."/></div>}</>;
}

function Subscriptions() {
  const query=useListSubscriptions({status:"all"});
  const members=useListMembers({limit:100});
  const plans=useListPlans();
  const qc=useQueryClient(); const create=useCreateSubscription(); const action=useActOnSubscription(); const payment=useCreateSubscriptionPayment();
  const [open,setOpen]=useState(false);
  function submit(e:FormEvent<HTMLFormElement>){e.preventDefault();const f=new FormData(e.currentTarget);create.mutate({data:{memberId:Number(f.get("memberId")),planId:Number(f.get("planId")),startDate:String(f.get("startDate")),discountFils:Math.round(Number(f.get("discount")||0)*1000),initialPaymentFils:Math.round(Number(f.get("paid")||0)*1000),paymentMethod:"cash"}},{onSuccess:()=>{void qc.invalidateQueries({queryKey:getListSubscriptionsQueryKey()});void qc.invalidateQueries({queryKey:getGetClubDashboardQueryKey()});setOpen(false);}});}
  function handleAction(id:number,act:"pause"|"resume"|"renew"){action.mutate({id,data:{action:act}},{onSuccess:()=>{void qc.invalidateQueries({queryKey:getListSubscriptionsQueryKey()});void qc.invalidateQueries({queryKey:getGetClubDashboardQueryKey()});}});}
  function recordPayment(id:number){const raw=window.prompt("أدخل مبلغ الدفعة بالدينار الأردني");if(!raw)return;const amount=Number(raw);if(!Number.isFinite(amount)||amount<=0){window.alert("أدخل مبلغًا صحيحًا");return;}payment.mutate({id,data:{amountFils:Math.round(amount*1000),method:"cash",note:null}},{onSuccess:()=>{void qc.invalidateQueries({queryKey:getListSubscriptionsQueryKey()});void qc.invalidateQueries({queryKey:getGetClubDashboardQueryKey()});}});}
  return <><PageHeading eyebrow="العضويات" title="الاشتراكات"><button className="button primary" onClick={()=>setOpen(!open)}><Plus size={16}/>اشتراك جديد</button></PageHeading>{open&&<form className="panel form-panel" onSubmit={submit}><h2>إنشاء اشتراك</h2><div className="form-grid"><label>المشترك<select required name="memberId" defaultValue=""><option value="" disabled>اختر مشتركًا</option>{members.data?.map(m=><option value={m.id} key={m.id}>{m.name} — {m.phone}</option>)}</select></label><label>الباقة<select required name="planId" defaultValue=""><option value="" disabled>اختر باقة</option>{plans.data?.filter(p=>p.active).map(p=><option value={p.id} key={p.id}>{p.name} — {(p.priceFils/1000).toFixed(3)} د.أ</option>)}</select></label><label>تاريخ البداية<input required type="date" name="startDate" defaultValue={new Date().toLocaleDateString("en-CA",{timeZone:"Asia/Amman"})}/></label><label>الخصم (د.أ)<input type="number" name="discount" min="0" step=".001" defaultValue="0"/></label><label>دفعة أولى (د.أ)<input type="number" name="paid" min="0" step=".001" defaultValue="0"/></label></div>{create.isError&&<p className="error-text">تعذر إنشاء الاشتراك؛ تحقق من المبلغ والبيانات.</p>}<div className="form-actions"><button className="button primary" disabled={create.isPending}>حفظ الاشتراك</button><button type="button" className="button ghost" onClick={()=>setOpen(false)}>إلغاء</button></div></form>}
  <div className="panel table-panel"><div className="table-toolbar"><div><h2>سجل الاشتراكات</h2><small>الباقات والرصيد الحالي</small></div></div>{query.isLoading?<div className="loading-panel">جارٍ تحميل الاشتراكات…</div>:query.data?.length?<div className="table-scroll"><table><thead><tr><th>المشترك</th><th>الباقة</th><th>الفترة</th><th>المستحق</th><th>الحالة</th><th>إجراء</th></tr></thead><tbody>{query.data.map(s=><tr key={s.id}><td><Link href={`/members/${s.memberId}`} className="text-link">{s.memberName}</Link></td><td>{s.planName}</td><td>{s.startDate} — {s.endDate}</td><td><Money fils={s.balanceFils}/></td><td><span className={`status-pill ${s.status==="active"?"success":s.status==="paused"?"warn":"muted"}`}>{s.status==="active"?"نشط":s.status==="paused"?"موقوف مؤقتًا":s.status==="expired"?"منتهي":"ملغي"}</span></td><td className="row-actions">{s.status==="active"&&<button className="mini-button" onClick={()=>handleAction(s.id,"pause")}>إيقاف</button>}{s.status==="paused"&&<button className="mini-button" onClick={()=>handleAction(s.id,"resume")}>استئناف</button>}{s.status==="expired"&&<button className="mini-button" onClick={()=>handleAction(s.id,"renew")}>تجديد</button>}{s.balanceFils>0&&<button className="mini-button" onClick={()=>recordPayment(s.id)}>تحصيل</button>}</td></tr>)}</tbody></table></div>:<Empty text="لا توجد اشتراكات مسجلة بعد."/>}</div></>;
}

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

function MemberDetail() {
  const {id:rawId}=useParams();const id=Number(rawId);const detailQuery=useGetMember(id,{query:{enabled:Number.isInteger(id)&&id>0,queryKey:getGetMemberQueryKey(id)}});
  const info=detailQuery.data;
  if(detailQuery.isLoading)return <div className="loading-panel">جارٍ تحميل الملف…</div>;
  if(!info)return <div className="panel"><Empty text="تعذر العثور على ملف المشترك."/></div>;
  return <><PageHeading eyebrow="ملف المشترك" title={info.member.name}><Link href="/members" className="button ghost">العودة للمشتركين</Link></PageHeading><div className="panel member-summary"><div className="avatar large">{info.member.name.slice(0,1)}</div><div><h2>{info.member.name}</h2><p dir="ltr">{info.member.phone}</p><small>تاريخ التسجيل: {info.member.joinedAt.slice(0,10)}</small></div></div><div className="panel table-panel"><div className="table-toolbar"><h2>الاشتراكات</h2></div>{info.subscriptions.length?<div className="table-scroll"><table><thead><tr><th>الباقة</th><th>الفترة</th><th>المدفوع</th><th>المتبقي</th><th>الحالة</th></tr></thead><tbody>{info.subscriptions.map(s=><tr key={s.id}><td>{s.planName}</td><td>{s.startDate} — {s.endDate}</td><td><Money fils={s.paidFils}/></td><td><Money fils={s.balanceFils}/></td><td>{s.status}</td></tr>)}</tbody></table></div>:<Empty text="لا يوجد سجل اشتراكات لهذا المشترك."/>}</div><div className="panel table-panel history-panel"><div className="table-toolbar"><div><h2>سجل الدفعات</h2><small>الإيصالات قابلة للطباعة</small></div></div>{info.payments.length?<div className="table-scroll"><table><thead><tr><th>رقم الإيصال</th><th>التاريخ</th><th>النوع</th><th>المبلغ</th><th>طريقة الدفع</th><th>الإيصال</th></tr></thead><tbody>{info.payments.map(p=><tr key={p.id}><td>{p.receiptNumber}</td><td>{p.createdAt.slice(0,10)}</td><td>{p.kind==="payment"?"دفعة":p.kind==="discount"?"خصم":"استرداد"}</td><td><Money fils={p.amountFils}/></td><td>{p.method}</td><td>{p.kind==="payment"&&<Link href={`/receipt/${p.id}`} className="text-link">عرض وطباعة</Link>}</td></tr>)}</tbody></table></div>:<Empty text="لا توجد دفعات مسجلة لهذا المشترك."/>}</div></>;
}

function ReceiptPage() {
  const {id:rawId}=useParams(); const id=Number(rawId); const query=useGetPaymentReceipt(id,{query:{enabled:Number.isInteger(id)&&id>0,queryKey:getGetPaymentReceiptQueryKey(id)}});
  const r=query.data;
  return <div className="receipt-page" dir="rtl"><div className="receipt-actions"><Link href="/subscriptions" className="button ghost">رجوع</Link><button className="button primary" onClick={()=>window.print()}><Printer size={16}/>طباعة الإيصال</button></div>{query.isLoading?<div className="loading-panel">جارٍ تحميل الإيصال…</div>:r?<article className="receipt"><div className="receipt-head"><div className="brand-icon"><Dumbbell/></div><div><h1>إيصال دفع</h1><p>إدارة النادي الرياضي</p></div></div><div className="receipt-number">رقم الإيصال <strong>{r.receiptNumber}</strong></div><dl><dt>اسم المشترك</dt><dd>{r.memberName}</dd><dt>رقم الهاتف</dt><dd dir="ltr">{r.memberPhone}</dd><dt>الباقة</dt><dd>{r.planName}</dd><dt>طريقة الدفع</dt><dd>{r.method}</dd><dt>التاريخ</dt><dd>{r.createdAt.slice(0,10)}</dd></dl><div className="receipt-total"><span>المبلغ المدفوع</span><strong><Money fils={r.amountFils}/></strong></div><p className="receipt-thanks">شكرًا لاشتراككم</p></article>:<div className="error-panel">الإيصال غير موجود.</div>}</div>;
}

function MainRouter() {
  const [,setLocation]=useLocation();
  return <Switch><Route path="/" component={HomeRedirect}/><Route path="/sign-in/*?" component={AuthPages}/><Route path="/sign-up/*?" component={AuthPages}/>
    <Route path="/dashboard"><Protected><Dashboard/></Protected></Route>
    <Route path="/members"><Protected><Members/></Protected></Route>
    <Route path="/members/:id"><Protected><MemberDetail/></Protected></Route>
    <Route path="/plans"><Protected><Plans/></Protected></Route>
    <Route path="/subscriptions"><Protected><Subscriptions/></Protected></Route>
    <Route path="/finance"><Protected><FinancePage/></Protected></Route>
    <Route path="/receipt/:id"><Protected><ReceiptPage/></Protected></Route>
    <Route><div className="panel"><Empty text="الصفحة غير موجودة."/><button className="button primary" onClick={()=>setLocation("/dashboard")}>العودة للوحة التحكم</button></div></Route>
  </Switch>;
}

function ClerkApp() {
  const [,setLocation]=useLocation();
  return <ClerkProvider publishableKey={clerkPubKey} proxyUrl={clerkProxyUrl} appearance={appearance} signInUrl={`${basePath}/sign-in`} signUpUrl={`${basePath}/sign-up`}
    localization={{ ...arSA, formFieldInputPlaceholder__emailAddress: "أدخل بريدك الإلكتروني", formFieldInputPlaceholder__emailAddress_username: "أدخل بريدك الإلكتروني" }}
    routerPush={(to)=>setLocation(stripBase(to))} routerReplace={(to)=>setLocation(stripBase(to),{replace:true})}>
    <QueryClientProvider client={queryClient}><Show when="signed-out"><MainRouter/></Show><Show when="signed-in"><MainRouter/></Show></QueryClientProvider>
  </ClerkProvider>;
}

function App() {
  if(!clerkPubKey) throw new Error("Missing VITE_CLERK_PUBLISHABLE_KEY");
  return <WouterRouter base={basePath}><ClerkApp/></WouterRouter>;
}
export default App;
