import "./_group.css";

import {
  ArrowDownLeft,
  BadgeCheck,
  Banknote,
  ChartNoAxesCombined,
  ClipboardList,
  LayoutDashboard,
  LogOut,
  MessageCircle,
  Plus,
  Settings,
  Users,
  Wallet,
} from "lucide-react";
import type { ReactNode } from "react";

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

// Static examples retain the shape returned by the dashboard and finance APIs.
const mockSession = {
  status: "active",
  isOwner: true,
  pendingCount: 2,
  permissions: [
    "dashboard.view",
    "members.view",
    "subscriptions.view",
    "plans.view",
    "finance.view",
    "employees.view",
    "payroll.view",
    "whatsapp.view",
    "reports.view",
  ],
};

const mockUser = {
  firstName: "محمد",
  fullName: "محمد العبدالله",
  email: "manager@primeboxing.example",
};

const mockDashboard = {
  activeMembers: 128,
  endingSoon: 9,
  expiredSubscriptions: 14,
  collectedFils: 4_825_000,
  outstandingFils: 735_000,
  monthlyCollectedFils: 1_260_000,
  recentMembers: [
    { id: 1042, name: "ليان الحسن", phone: "079 123 4567", email: null, birthDate: null, notes: null, joinedAt: "2025-03-10T09:00:00.000Z", active: true },
    { id: 1041, name: "عمر الخطيب", phone: "078 234 5678", email: null, birthDate: null, notes: null, joinedAt: "2025-03-09T12:30:00.000Z", active: true },
    { id: 1040, name: "سارة محمود", phone: "077 345 6789", email: null, birthDate: null, notes: null, joinedAt: "2025-03-08T15:15:00.000Z", active: true },
  ],
};

const mockFinance = {
  from: "2025-03-01T00:00:00.000Z",
  to: "2025-03-10T00:00:00.000Z",
  incomeFils: 1_480_000,
  expensesFils: 620_000,
  netFils: 860_000,
  debtFils: 735_000,
  payrollDueFils: 410_000,
  cashBalanceFils: 2_190_000,
};

function Link({ href, className, children }: { href: string; className?: string; children: ReactNode }) {
  return <a href={href} className={className}>{children}</a>;
}

function AppShell({ children }: { children: ReactNode }) {
  const location = "/dashboard";
  const clubName = "Prime Boxing Academy";
  const can = (...permissions: string[]) =>
    mockSession.status === "active" &&
    (mockSession.isOwner || permissions.every((permission) => mockSession.permissions.includes(permission)));
  const navItems = allNavItems
    .filter((item) =>
      mockSession.status === "active" &&
      (item.href === "/admin"
        ? mockSession.isOwner
        : item.href === "/finance"
          ? item.permissions.some((permission) => can(permission))
          : can(...item.permissions)),
    )
    .map((item) =>
      item.href === "/admin" && mockSession.pendingCount
        ? { ...item, title: `${item.title} (${mockSession.pendingCount} طلب)` }
        : item,
    );

  return (
    <div className="app-shell" dir="rtl">
      <aside className="sidebar">
        <Link href="/dashboard" className="brand">
          <span className="brand-mark-placeholder">P</span>
          <span style={{ overflowWrap: "anywhere" }}>{clubName}<small>إدارة الأكاديمية</small></span>
        </Link>
        <p className="nav-label">القائمة الرئيسية</p>
        <nav>
          {navItems.map(({ href, title, icon: Icon }) => (
            <Link key={href} href={href} className={`nav-link ${location === href ? "active" : ""}`}>
              <Icon size={18} />{title}
            </Link>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="profile">
            <div className="avatar">{mockUser.firstName.slice(0, 1)}</div>
            <div><strong>{mockUser.fullName}</strong><small>{mockUser.email}</small></div>
          </div>
          <Link className="nav-link" href="/account">إعدادات حسابي</Link>
          <button className="nav-link logout" type="button"><LogOut size={18} />تسجيل الخروج</button>
        </div>
      </aside>
      <main className="main-area">
        <header className="topbar">
          <div>
            <span className="topbar-date">
              {new Intl.DateTimeFormat("ar-JO", { dateStyle: "full", timeZone: "Asia/Amman" }).format(new Date())}
            </span>
            <span className="mobile-brand">{clubName}</span>
          </div>
          <div className="topbar-user">بوابة إدارة الأكاديمية</div>
        </header>
        <section className="page-content">{children}</section>
      </main>
      <nav className="mobile-nav">
        {navItems.map(({ href, title, icon: Icon }) => (
          <Link key={href} href={href} className={location === href ? "active" : ""}>
            <Icon size={19} /><small>{title}</small>
          </Link>
        ))}
      </nav>
    </div>
  );
}

function PageHeading({ eyebrow, title, children }: { eyebrow: string; title: string; children?: ReactNode }) {
  return <div className="page-heading"><div><p className="eyebrow">{eyebrow}</p><h1>{title}</h1></div>{children}</div>;
}

function Money({ fils }: { fils: number }) {
  return <>{(fils / 1000).toLocaleString("ar-JO", { minimumFractionDigits: 3, maximumFractionDigits: 3 })} <small>د.أ</small></>;
}

function Dashboard() {
  const query = { data: mockDashboard, isLoading: false, error: null };
  const summary = query.data;
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Amman" }).format(new Date());
  const finance = { data: mockFinance };
  const income = finance.data?.incomeFils ?? 0;
  const expenses = finance.data?.expensesFils ?? 0;
  const chartMax = Math.max(income, expenses, 1);

  return <>
    <PageHeading eyebrow="نظرة عامة" title="لوحة التحكم">
      <div className="quick-actions">
        <Link href="/members" className="button primary"><Plus size={16} />مشترك جديد</Link>
        <Link href="/subscriptions" className="button ghost">اشتراك جديد</Link>
        <Link href="/finance" className="button ghost">تسجيل حركة مالية</Link>
      </div>
    </PageHeading>
    {query.isLoading ? <div className="loading-panel">جارٍ تحميل بيانات النادي…</div> : query.error ? <div className="error-panel">تعذر تحميل لوحة التحكم. تحقق من الاتصال والصلاحيات.</div> : <>
      <div className="stats-grid">
        <Stat title="المشتركون النشطون" value={summary?.activeMembers ?? 0} icon={<Users />} tone="green" />
        <Stat title="تنتهي خلال يومين" value={summary?.endingSoon ?? 0} icon={<BadgeCheck />} tone="amber" />
        <Stat title="اشتراكات منتهية" value={summary?.expiredSubscriptions ?? 0} icon={<ClipboardList />} tone="rose" />
        <Stat title="الرصيد المستحق" value={<Money fils={summary?.outstandingFils ?? 0} />} icon={<Wallet />} tone="blue" />
        <Stat title="مصروفات هذا الشهر" value={<Money fils={finance.data?.expensesFils ?? 0} />} icon={<Banknote />} tone="rose" />
        <Stat title="رواتب مستحقة" value={<Money fils={finance.data?.payrollDueFils ?? 0} />} icon={<Users />} tone="amber" />
        <Stat title="رصيد الصندوق" value={<Money fils={finance.data?.cashBalanceFils ?? 0} />} icon={<Wallet />} tone="blue" />
      </div>
      <div className="panel chart-panel">
        <div className="panel-head"><div><p className="eyebrow">ملخص الشهر</p><h2>الإيرادات والمصروفات</h2></div><span className="period-pill">{today.slice(0, 7)}</span></div>
        <div className="chart-row"><span>الإيرادات</span><div className="chart-track"><i className="chart-income" style={{ width: `${Math.max(2, income / chartMax * 100)}%` }} /></div><strong><Money fils={income} /></strong></div>
        <div className="chart-row"><span>المصروفات</span><div className="chart-track"><i className="chart-expense" style={{ width: `${expenses ? Math.max(2, expenses / chartMax * 100) : 0}%` }} /></div><strong><Money fils={expenses} /></strong></div>
      </div>
      <div className="overview-grid">
        <div className="panel revenue-panel">
          <div className="panel-head"><div><p className="eyebrow">التحصيل</p><h2>الإيرادات المحصلة</h2></div><span className="period-pill">هذا الشهر</span></div>
          <div className="revenue-total"><Money fils={summary?.monthlyCollectedFils ?? 0} /></div>
          <div className="revenue-note"><ArrowDownLeft size={16} /> مجموع الدفعات المسجلة هذا الشهر</div>
          <div className="revenue-foot"><span>إجمالي التحصيل المسجل</span><strong><Money fils={summary?.collectedFils ?? 0} /></strong></div>
        </div>
        <div className="panel">
          <div className="panel-head"><div><p className="eyebrow">آخر الإضافات</p><h2>المشتركون الجدد</h2></div><Link href="/members" className="text-link">عرض الكل</Link></div>
          {summary?.recentMembers?.length
            ? <div className="compact-list">{summary.recentMembers.map((member) => <div className="compact-row" key={member.id}><span className="avatar soft">{member.name.slice(0, 1)}</span><div><strong>{member.name}</strong><small>{member.phone}</small></div><span className="status-pill success">مشترك</span></div>)}</div>
            : <Empty text="لا يوجد مشتركون بعد. أضف أول مشترك للبدء." />}
        </div>
      </div>
    </>}
  </>;
}

function Stat({ title, value, icon, tone }: { title: string; value: ReactNode; icon: ReactNode; tone: string }) {
  return <div className="stat-card"><span className={`stat-icon ${tone}`}>{icon}</span><span className="stat-title">{title}</span><strong>{value}</strong></div>;
}

function Empty({ text }: { text: string }) {
  return <div className="empty-state"><span className="empty-icon"><ClipboardList /></span><p>{text}</p></div>;
}

export function Current() {
  return <AppShell><Dashboard /></AppShell>;
}
