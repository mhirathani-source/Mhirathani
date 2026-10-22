import { useState, type FormEvent, type ReactNode } from "react";
import { ClerkProvider, Show, SignIn, SignUp, useClerk, useUser } from "@clerk/react";
import { publishableKeyFromHost } from "@clerk/react/internal";
import { shadcn } from "@clerk/themes";
import { QueryClient, QueryClientProvider, useQueryClient } from "@tanstack/react-query";
import {
  getGetClubDashboardQueryKey, getGetClubSessionQueryKey, getListMembersQueryKey,
  getGetMemberQueryKey, getGetPaymentReceiptQueryKey, getListPlansQueryKey, getListSubscriptionsQueryKey,
  useActOnSubscription,
  useCreateMember, useCreatePlan, useCreateSubscription,
  useCreateSubscriptionPayment, useGetClubDashboard, useGetClubSession, useGetMember,
  useGetPaymentReceipt, useListMembers, useListPlans, useListSubscriptions,
} from "@workspace/api-client-react";
import { ArrowDownLeft, BadgeCheck, Banknote, ClipboardList, Dumbbell, LayoutDashboard, LogOut, Plus, Search, Users, Wallet, Printer, MessageCircle, ChartNoAxesCombined, Settings } from "lucide-react";
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
];

function AppShell({ children }: { children: ReactNode }) {
  const { user } = useUser();
  const { signOut } = useClerk();
  const [location] = useLocation();
  return <div className="app-shell" dir="rtl"><aside className="sidebar"><Link href="/dashboard" className="brand"><span className="brand-mark-placeholder">P</span><span>Prime Boxing Academy<small>إدارة الأكاديمية</small></span></Link><p className="nav-label">القائمة الرئيسية</p><nav>{navItems.map(({href,title,icon:Icon})=><Link key={href} href={href} className={`nav-link ${location===href?"active":""}`}><Icon size={18}/>{title}</Link>)}<p className="nav-label future-label">أقسام أخرى</p><div className="nav-link disabled"><Banknote size={18}/>المصاريف والرواتب<small>قيد التطوير</small></div><div className="nav-link disabled"><ChartNoAxesCombined size={18}/>التقارير<small>قيد التطوير</small></div><div className="nav-link disabled"><MessageCircle size={18}/>تذكيرات واتساب<small>قيد التطوير</small></div><div className="nav-link disabled"><Settings size={18}/>الإعدادات<small>قيد التطوير</small></div></nav><div className="sidebar-bottom"><div className="profile"><div className="avatar">{user?.firstName?.slice(0,1)||"م"}</div><div><strong>{user?.fullName||"مدير الأكاديمية"}</strong><small>{user?.primaryEmailAddress?.emailAddress}</small></div></div><button className="nav-link logout" onClick={()=>signOut({redirectUrl:basePath||"/"})}><LogOut size={18}/>تسجيل الخروج</button></div></aside><main className="main-area"><header className="topbar"><div><span className="topbar-date">{new Intl.DateTimeFormat("ar-JO",{dateStyle:"full",timeZone:"Asia/Amman"}).format(new Date())}</span><span className="mobile-brand">Prime Boxing Academy</span></div><div className="topbar-user">بوابة إدارة الأكاديمية</div></header><section className="page-content">{children}</section></main><nav className="mobile-nav">{navItems.map(({href,title,icon:Icon})=><Link key={href} href={href} className={location===href?"active":""}><Icon size={19}/><small>{title}</small></Link>)}</nav></div>;
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
  return <><PageHeading eyebrow="نظرة عامة" title="لوحة التحكم"><Link href="/members" className="button primary"><Plus size={16}/>إضافة مشترك</Link></PageHeading>
    {query.isLoading ? <div className="loading-panel">جارٍ تحميل بيانات النادي…</div> : query.error ? <div className="error-panel">تعذر تحميل لوحة التحكم. تحقق من الاتصال والصلاحيات.</div> : <>
      <div className="stats-grid">
        <Stat title="المشتركون النشطون" value={summary?.activeMembers??0} icon={<Users/>} tone="green"/>
        <Stat title="تنتهي خلال ٧ أيام" value={summary?.endingSoon??0} icon={<BadgeCheck/>} tone="amber"/>
        <Stat title="اشتراكات منتهية" value={summary?.expiredSubscriptions??0} icon={<ClipboardList/>} tone="rose"/>
        <Stat title="الرصيد المستحق" value={<Money fils={summary?.outstandingFils??0}/>} icon={<Wallet/>} tone="blue"/>
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
    <Route path="/receipt/:id"><Protected><ReceiptPage/></Protected></Route>
    <Route><div className="panel"><Empty text="الصفحة غير موجودة."/><button className="button primary" onClick={()=>setLocation("/dashboard")}>العودة للوحة التحكم</button></div></Route>
  </Switch>;
}

function ClerkApp() {
  const [,setLocation]=useLocation();
  return <ClerkProvider publishableKey={clerkPubKey} proxyUrl={clerkProxyUrl} appearance={appearance} signInUrl={`${basePath}/sign-in`} signUpUrl={`${basePath}/sign-up`}
    localization={{signIn:{start:{title:"مرحبًا بعودتك",subtitle:"سجّل الدخول لإدارة النادي"}},signUp:{start:{title:"إنشاء حساب",subtitle:"ابدأ بإعداد حساب إدارة النادي"}}}}
    routerPush={(to)=>setLocation(stripBase(to))} routerReplace={(to)=>setLocation(stripBase(to),{replace:true})}>
    <QueryClientProvider client={queryClient}><Show when="signed-out"><MainRouter/></Show><Show when="signed-in"><MainRouter/></Show></QueryClientProvider>
  </ClerkProvider>;
}

function App() {
  if(!clerkPubKey) throw new Error("Missing VITE_CLERK_PUBLISHABLE_KEY");
  return <WouterRouter base={basePath}><ClerkApp/></WouterRouter>;
}
export default App;
