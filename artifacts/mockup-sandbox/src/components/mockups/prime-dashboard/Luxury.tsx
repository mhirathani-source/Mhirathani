import "./_group.css";
import "./Luxury.css";

import {
  ArrowUpLeft,
  BadgeCheck,
  Banknote,
  Bell,
  CalendarDays,
  ChartNoAxesCombined,
  ChevronLeft,
  ClipboardList,
  Clock3,
  CreditCard,
  LayoutDashboard,
  LogOut,
  MessageCircle,
  Plus,
  Settings,
  TrendingUp,
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
  allMembers: 156,
  activeMembers: 128,
  endingSoon: 9,
  expiredSubscriptions: 14,
  newThisMonth: 12,
  monthlyCollectedFils: 1_260_000,
  outstandingFils: 735_000,
  paymentOperations: 86,
  recentMembers: [
    { id: 1042, name: "ليان الحسن", phone: "079 123 4567", joined: "١٠ آذار" },
    { id: 1041, name: "عمر الخطيب", phone: "078 234 5678", joined: "٩ آذار" },
    { id: 1040, name: "سارة محمود", phone: "077 345 6789", joined: "٨ آذار" },
  ],
};

const recentActivity = [
  { id: "m-1042", name: "ليان الحسن", detail: "تسجيل مشترك جديد", time: "قبل ٣ ساعات", type: "new", href: "/members" },
  { id: "s-811", name: "خالد النجار", detail: "تجديد اشتراك — ٣ أشهر", time: "قبل ٥ ساعات", type: "renewal", href: "/subscriptions" },
  { id: "p-2091", name: "دفعة اشتراك", detail: "من أحمد شريف", time: "أمس، ٤:٢٠ م", type: "payment", href: "/finance" },
];

const mockFinance = {
  incomeFils: 1_480_000,
  expensesFils: 620_000,
  netFils: 860_000,
  previousIncomeFils: 1_325_000,
  debtFils: 735_000,
};

const revenueValues = [760, 910, 830, 1_050, 1_260];
const revenueSeries = revenueValues.map((value, index) => {
  const monthDate = new Date();
  monthDate.setMonth(monthDate.getMonth() - (revenueValues.length - 1 - index));
  return {
    value,
    month: new Intl.DateTimeFormat("ar-JO", { month: "short", timeZone: "Asia/Amman" }).format(monthDate),
  };
});

const planMix = [
  { name: "شهري", count: 58, percent: 45, color: "green" },
  { name: "ثلاثة أشهر", count: 43, percent: 34, color: "gold" },
  { name: "سنوي", count: 27, percent: 21, color: "charcoal" },
];

const alerts = [
  { icon: Clock3, tone: "gold", title: "اشتراكات قاربت على الانتهاء", detail: "٩ اشتراكات خلال ٧ أيام", amount: "٩", href: "/subscriptions" },
  { icon: BadgeCheck, tone: "rose", title: "اشتراكات منتهية", detail: "تحتاج إلى متابعة التجديد", amount: "١٤", href: "/subscriptions" },
  { icon: Wallet, tone: "gold", title: "أرصدة مستحقة", detail: "على ١١ مشتركاً", amount: "٧٣٥ د.أ", href: "/finance" },
];

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

function Money({ fils, compact = false }: { fils: number; compact?: boolean }) {
  return <>{(fils / 1000).toLocaleString("ar-JO", { minimumFractionDigits: compact ? 0 : 3, maximumFractionDigits: compact ? 0 : 3 })} <small>د.أ</small></>;
}

function Dashboard() {
  const today = new Intl.DateTimeFormat("ar-JO", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "Asia/Amman",
  }).format(new Date());
  const currentMonth = new Intl.DateTimeFormat("ar-JO", {
    month: "long",
    year: "numeric",
    timeZone: "Asia/Amman",
  }).format(new Date());
  const delta = Math.round(((mockFinance.incomeFils - mockFinance.previousIncomeFils) / mockFinance.previousIncomeFils) * 100);

  return (
    <div className="luxury-dashboard">
      <div className="luxury-heading">
        <div>
          <div className="heading-kicker"><span className="kicker-dot" /> مركز العمليات <span className="kicker-divider">/</span> {today}</div>
          <h1>صباح القوة، <em>محمد</em></h1>
          <p>ملخص Prime Boxing Academy — كل ما تحتاجه لبدء يومك بثقة.</p>
        </div>
        <div className="admin-chip">
          <span className="admin-monogram">م</span>
          <span><strong>محمد العبدالله</strong><small>مدير الأكاديمية</small></span>
          <span className="online-dot" />
        </div>
      </div>

      <section className="luxury-hero">
        <div className="hero-copy">
          <div className="academy-lockup">
            <div className="academy-emblem"><span>P</span><i /></div>
            <div><strong>PRIME</strong><small>BOXING ACADEMY</small></div>
          </div>
          <div className="hero-caption">أداء الأكاديمية <span>•</span> {currentMonth}</div>
          <h2>نادي أقوى.<br /><span>مجتمع أكبر.</span></h2>
          <p>١٢٨ عضواً نشطاً يصنعون تقدّم الأكاديمية هذا الشهر.</p>
          <Link href="/reports" className="hero-report">عرض التقرير الكامل <ChevronLeft size={16} /></Link>
        </div>
        <div className="hero-visual" aria-hidden="true">
          <div className="hero-orbit orbit-one" />
          <div className="hero-orbit orbit-two" />
          <div className="hero-disc"><span>PRIME</span><strong>128</strong><small>عضو نشط</small></div>
          <div className="hero-float hero-float-top"><TrendingUp size={15} /><span>نمو شهري</span><strong>+١١٫٧٪</strong></div>
          <div className="hero-float hero-float-bottom"><span className="pulse-mark" /> انتظام قوي <strong>٨٧٪</strong></div>
        </div>
        <div className="hero-side-note"><span>01</span> PRIME · AMMAN</div>
      </section>

      <section className="metrics-section">
        <div className="section-heading">
          <div><span className="section-index">01 / المؤشرات</span><h2>صورة النادي اليوم</h2></div>
          <span className="updated-note"><span className="online-dot" /> آخر تحديث الآن</span>
        </div>
        <div className="metrics-grid">
          <Metric label="إجمالي المشتركين" value="١٥٦" note="منذ انطلاق الأكاديمية" icon={<Users />} tone="neutral" />
          <Metric label="المشتركون النشطون" value="١٢٨" note="٨٢٪ من إجمالي الأعضاء" icon={<BadgeCheck />} tone="green" />
          <Metric label="اشتراكات منتهية" value="١٤" note="تحتاج إلى متابعة" icon={<ClipboardList />} tone="rose" />
          <Metric label="تنتهي خلال ٧ أيام" value="٩" note="ابدأ التواصل مبكراً" icon={<Clock3 />} tone="gold" />
          <Metric label="تحصيل هذا الشهر" value={<Money fils={mockDashboard.monthlyCollectedFils} compact />} note="مقابل ١٬٣٢٥ الشهر الماضي" icon={<Banknote />} tone="green" />
          <Metric label="المبالغ المستحقة" value={<Money fils={mockDashboard.outstandingFils} compact />} note="على ١١ مشتركاً" icon={<Wallet />} tone="gold" />
          <Metric label="عمليات الدفع" value="٨٦" note="دفعة مسجلة هذا الشهر" icon={<CreditCard />} tone="neutral" />
        </div>
      </section>

      <section className="analytics-grid">
        <article className="lux-panel revenue-analytics">
          <div className="panel-heading">
            <div><span className="section-index">02 / المالية</span><h2>الإيرادات الشهرية</h2></div>
            <span className="trend-badge"><ArrowUpLeft size={14} /> {delta}٪ <small>عن الشهر السابق</small></span>
          </div>
          <div className="revenue-highlight">
            <strong><Money fils={mockFinance.incomeFils} /></strong>
            <span>إجمالي الدخل لهذا الشهر</span>
          </div>
          <div className="chart-legend"><span><i className="legend-income" /> الإيرادات <b>١٬٤٨٠ د.أ</b></span><span><i className="legend-expense" /> المصروفات <b>٦٢٠ د.أ</b></span></div>
          <RevenueChart />
          <div className="finance-strip">
            <FinanceValue label="الدخل" amount={mockFinance.incomeFils} tone="income" />
            <FinanceValue label="المصروفات" amount={mockFinance.expensesFils} tone="expense" />
            <FinanceValue label="صافي الدخل" amount={mockFinance.netFils} tone="net" />
          </div>
          <div className="month-comparison">
            <span>الشهر الحالي <strong><Money fils={mockFinance.incomeFils} compact /></strong></span>
            <span className="compare-track"><i /></span>
            <span>الشهر السابق <strong><Money fils={mockFinance.previousIncomeFils} compact /></strong></span>
          </div>
        </article>

        <article className="lux-panel membership-analytics">
          <div className="panel-heading">
            <div><span className="section-index">03 / العضويات</span><h2>نبض الاشتراكات</h2></div>
            <Link href="/subscriptions" className="panel-action">كل الاشتراكات <ChevronLeft size={14} /></Link>
          </div>
          <div className="membership-summary">
            <div className="membership-ring"><div><strong>٨٢٪</strong><small>معدل التجديد</small></div></div>
            <div className="membership-counts">
              <CountLine label="نشط" value="١٢٨" color="green" />
              <CountLine label="منتهي" value="١٤" color="rose" />
              <CountLine label="جديد هذا الشهر" value="١٢" color="gold" />
            </div>
          </div>
          <div className="plan-title"><span>توزيع الباقات</span><small>١٢٨ اشتراكاً نشطاً</small></div>
          <div className="plan-stack">{planMix.map((plan) => <i key={plan.name} className={`plan-segment ${plan.color}`} style={{ width: `${plan.percent}%` }} />)}</div>
          <div className="plan-list">{planMix.map((plan) => <div className="plan-row" key={plan.name}><span className={`plan-dot ${plan.color}`} />{plan.name}<strong>{plan.count}</strong><small>{plan.percent}٪</small></div>)}</div>
        </article>
      </section>

      <section className="operations-grid">
        <article className="lux-panel alerts-panel">
          <div className="panel-heading">
            <div><span className="section-index">04 / يحتاج انتباهك</span><h2>متابعة اليوم <span className="alert-count">٣</span></h2></div>
            <Bell size={18} className="heading-bell" />
          </div>
          <div className="alert-list">{alerts.map((alert) => {
            const Icon = alert.icon;
            return <Link href={alert.href} className="alert-row" key={alert.title}>
              <span className={`alert-icon ${alert.tone}`}><Icon size={17} /></span>
              <span className="alert-copy"><strong>{alert.title}</strong><small>{alert.detail}</small></span>
              <b>{alert.amount}</b><ChevronLeft size={15} className="alert-chevron" />
            </Link>;
          })}</div>
          <Link href="/subscriptions" className="all-alerts">عرض جميع التنبيهات <ChevronLeft size={15} /></Link>
        </article>

        <article className="lux-panel recent-panel">
          <div className="panel-heading">
            <div><span className="section-index">05 / نشاط الأكاديمية</span><h2>أحدث النشاطات</h2></div>
            <Link href="/members" className="panel-action">كل المشتركين <ChevronLeft size={14} /></Link>
          </div>
          <div className="recent-list">{recentActivity.map((item, index) => <Link href={item.href} className="recent-row" key={item.id}>
            <div className={`member-initial initial-${index % 3}`}>{item.type === "payment" ? <CreditCard size={14} /> : item.type === "renewal" ? <BadgeCheck size={15} /> : item.name.slice(0, 1)}</div>
            <div className="member-details"><strong>{item.name}</strong><small>{item.detail}</small></div>
            <span className="member-date">{item.time}</span><span className={`member-state state-${item.type}`}>{item.type === "new" ? "جديد" : item.type === "renewal" ? "تجديد" : "دفعة"}</span>
          </Link>)}</div>
          <div className="activity-foot"><span><span className="online-dot" /> تحديث مباشر</span><strong>١٢ عضواً انضموا هذا الشهر</strong></div>
        </article>
      </section>

      <section className="quick-section">
        <div className="section-heading quick-heading">
          <div><span className="section-index">06 / وصول سريع</span><h2>اختصر الطريق</h2></div>
          <span className="quick-hint">إجراءاتك اليومية، في متناول اليد</span>
        </div>
        <div className="quick-links">
          <QuickLink href="/members" icon={<Plus />} label="مشترك جديد" number="01" />
          <QuickLink href="/subscriptions" icon={<BadgeCheck />} label="اشتراك جديد" number="02" />
          <QuickLink href="/finance" icon={<CreditCard />} label="دفعة جديدة" number="03" />
          <QuickLink href="/members" icon={<Users />} label="جميع المشتركين" number="04" />
          <QuickLink href="/reports" icon={<ChartNoAxesCombined />} label="التقارير المالية" number="05" />
        </div>
      </section>
      <footer className="lux-footer"><span>PRIME BOXING ACADEMY</span><span>بيانات توضيحية للمعاينة فقط <i /> عمّان، الأردن</span><CalendarDays size={15} /></footer>
    </div>
  );
}

function Metric({ label, value, note, icon, tone }: { label: string; value: ReactNode; note: string; icon: ReactNode; tone: string }) {
  return <article className={`metric-card metric-${tone}`}><div className="metric-top"><span>{label}</span><span className="metric-icon">{icon}</span></div><strong className="metric-value">{value}</strong><small className="metric-note">{note}</small></article>;
}

function RevenueChart() {
  const max = 1400;
  const points = revenueSeries.map((point, index) => ({
    x: 22 + index * 82,
    y: 126 - (point.value / max) * 100,
  }));
  const line = points.map((point, index) => `${index === 0 ? "M" : "L"} ${point.x} ${point.y}`).join(" ");
  const fill = `${line} L ${points[points.length - 1].x} 138 L ${points[0].x} 138 Z`;
  return <div className="revenue-chart" dir="ltr">
    <div className="chart-y-labels"><span>١٬٤٠٠</span><span>١٬٠٠٠</span><span>٦٠٠</span><span>٢٠٠</span></div>
    <svg viewBox="0 0 372 150" role="img" aria-label="منحنى الإيرادات الشهرية من تشرين الثاني إلى آذار">
      <defs><linearGradient id="primeChartFill" x1="0" x2="0" y1="0" y2="1"><stop offset="0%" stopColor="#c6a45a" stopOpacity=".26" /><stop offset="100%" stopColor="#c6a45a" stopOpacity="0" /></linearGradient></defs>
      {[25, 61, 97, 133].map((y) => <line key={y} x1="18" x2="350" y1={y} y2={y} className="chart-grid-line" />)}
      <path d={fill} fill="url(#primeChartFill)" />
      <path d={line} className="chart-line" />
      {points.map((point, i) => <g key={point.x}><circle cx={point.x} cy={point.y} r={i === points.length - 1 ? 5 : 3.4} className={i === points.length - 1 ? "chart-point-current" : "chart-point"} /><text x={point.x} y="148" className="chart-x-label">{revenueSeries[i].month}</text></g>)}
    </svg>
  </div>;
}

function FinanceValue({ label, amount, tone }: { label: string; amount: number; tone: string }) {
  return <div className={`finance-value finance-${tone}`}><span>{label}</span><strong><Money fils={amount} compact /></strong></div>;
}

function CountLine({ label, value, color }: { label: string; value: string; color: string }) {
  return <div className="count-line"><span className={`count-marker ${color}`} /><span>{label}</span><strong>{value}</strong></div>;
}

function QuickLink({ href, icon, label, number }: { href: string; icon: ReactNode; label: string; number: string }) {
  return <Link href={href} className="quick-link"><span className="quick-number">{number}</span><span className="quick-icon">{icon}</span><strong>{label}</strong><ChevronLeft size={15} className="quick-arrow" /></Link>;
}

export function Luxury() {
  return <AppShell><Dashboard /></AppShell>;
}
