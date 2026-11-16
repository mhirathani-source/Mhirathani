import "./_group.css";
import "./Reference.css";

import {
  ArrowDownLeft,
  ArrowUpLeft,
  Banknote,
  Bell,
  CalendarDays,
  Check,
  ChevronLeft,
  CircleAlert,
  Clock3,
  CreditCard,
  LayoutDashboard,
  LogOut,
  MessageCircle,
  Plus,
  ReceiptText,
  Settings,
  ShieldCheck,
  TrendingUp,
  Users,
  Wallet,
  Dumbbell,
  BadgeCheck,
  ClipboardList,
} from "lucide-react";
import type { ReactNode } from "react";

const navItems = [
  { href: "/admin", title: "لوحة التحكم والإعدادات", icon: Settings },
  { href: "/dashboard", title: "لوحة التحكم", icon: LayoutDashboard },
  { href: "/members", title: "المشتركون", icon: Users },
  { href: "/subscriptions", title: "الاشتراكات", icon: BadgeCheck },
  { href: "/plans", title: "الباقات", icon: ClipboardList },
  { href: "/finance", title: "المالية والرواتب", icon: Wallet },
  { href: "/settings/whatsapp", title: "واتساب", icon: MessageCircle },
  { href: "/reports", title: "التقارير", icon: TrendingUp },
];

function Link({ href, className, children }: { href: string; className?: string; children: ReactNode }) {
  return <a href={href} className={className}>{children}</a>;
}

function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="app-shell ref-shell" dir="rtl">
      <aside className="sidebar">
        <Link href="/dashboard" className="brand">
          <span className="brand-mark-placeholder">P</span>
          <span>Prime Boxing Academy<small>إدارة الأكاديمية</small></span>
        </Link>
        <p className="nav-label">القائمة الرئيسية</p>
        <nav>{navItems.map(({ href, title, icon: Icon }) => (
          <Link key={href} href={href} className={`nav-link ${href === "/dashboard" ? "active" : ""}`}>
            <Icon size={18} />{title}
          </Link>
        ))}</nav>
        <div className="sidebar-bottom">
          <div className="profile">
            <div className="avatar">م</div>
            <div><strong>محمد العبدالله</strong><small>مدير الأكاديمية</small></div>
          </div>
          <button className="nav-link logout" type="button"><LogOut size={18} />تسجيل الخروج</button>
        </div>
      </aside>
      <main className="main-area">
        <header className="topbar ref-topbar">
          <span className="topbar-date">
            {new Intl.DateTimeFormat("ar-JO", { dateStyle: "full", timeZone: "Asia/Amman" }).format(new Date())}
          </span>
          <div className="ref-user"><span className="ref-online" />محمد العبدالله <ChevronLeft size={14} /></div>
        </header>
        <section className="page-content ref-content">{children}</section>
      </main>
      <nav className="mobile-nav">
        {navItems.slice(1, 6).map(({ href, title, icon: Icon }) => (
          <Link key={href} href={href} className={href === "/dashboard" ? "active" : ""}>
            <Icon size={19} /><small>{title}</small>
          </Link>
        ))}
      </nav>
    </div>
  );
}

const stats = [
  { label: "إجمالي المشتركين", value: "٢٢", icon: Users, color: "gold" },
  { label: "المشتركون النشطون", value: "١٤", icon: ShieldCheck, color: "green" },
  { label: "اشتراكات منتهية", value: "٨", icon: CalendarDays, color: "red" },
  { label: "تنتهي خلال ٧ أيام", value: "٥", icon: Clock3, color: "gold" },
  { label: "الإيرادات الشهرية", value: "٣٬٥٤٠", suffix: "د.أ", icon: TrendingUp, color: "green" },
  { label: "مبالغ مستحقة", value: "١٬٢٨٠", suffix: "د.أ", icon: Wallet, color: "gold" },
  { label: "عمليات الدفع", value: "٤٨", icon: CreditCard, color: "green" },
];

const revenue = [
  { month: "أيار", height: 37, value: "٢٬٤٠٠" },
  { month: "حزيران", height: 52, value: "٢٬٨٠٠" },
  { month: "تموز", height: 47, value: "٢٬٦٠٠" },
  { month: "آب", height: 67, value: "٣٬١٠٠" },
  { month: "أيلول", height: 82, value: "٣٬٤٠٠" },
  { month: "تشرين الأول", height: 91, value: "٣٬٥٤٠" },
];

function Money({ children }: { children: ReactNode }) {
  return <>{children}<small className="ref-currency"> د.أ</small></>;
}

function QuickAction({ icon: Icon, title, href }: { icon: typeof Plus; title: string; href: string }) {
  return <Link href={href} className="ref-quick-action"><span><Icon size={19} /></span><strong>{title}</strong><ChevronLeft size={13} /></Link>;
}

function Dashboard() {
  const currentMonth = new Intl.DateTimeFormat("ar-JO", { month: "long", timeZone: "Asia/Amman" }).format(new Date());
  return (
    <div className="refdash">
      <section className="ref-hero">
        <div className="ref-hero-content">
          <div className="ref-eyebrow"><span /> لوحة الإدارة التنفيذية <i /> عمّان</div>
          <h1>أهلاً بك في<br /><strong>Prime Boxing Academy</strong></h1>
          <p>نظرة سريعة على أداء الأكاديمية وعمليات اليوم.</p>
          <Link href="/reports" className="ref-hero-link">عرض التقارير <ChevronLeft size={15} /></Link>
        </div>
        <div className="ref-brand-seal">
          <div className="ref-seal-icon"><span>P</span><i>★</i></div>
          <strong>PRIME</strong><b>BOXING ACADEMY</b>
          <small>إدارة الأكاديمية</small>
        </div>
        <div className="ref-gloves" aria-hidden="true">
          <div className="ref-ring-light" />
          <div className="ref-glove ref-glove-one"><i /></div>
          <div className="ref-glove ref-glove-two"><i /></div>
          <div className="ref-floor-lines" />
          <Dumbbell className="ref-ghost-dumbbell" />
        </div>
      </section>

      <section className="ref-quick-wrap">
        <div className="ref-quick-heading"><span className="ref-live-dot" /> العمليات السريعة</div>
        <div className="ref-quick-grid">
          <QuickAction icon={Plus} title="إضافة مشترك" href="/members" />
          <QuickAction icon={BadgeCheck} title="اشتراك جديد" href="/subscriptions" />
          <QuickAction icon={Banknote} title="تسجيل دفعة" href="/finance" />
          <QuickAction icon={Users} title="جميع المشتركين" href="/members" />
          <QuickAction icon={TrendingUp} title="التقارير" href="/reports" />
        </div>
      </section>

      <div className="ref-section-title"><div><span>ملخص الأكاديمية</span><h2>مؤشرات الأداء</h2></div><span className="ref-date-chip"><CalendarDays size={14} /> {currentMonth}</span></div>
      <section className="ref-stats">
        {stats.map(({ label, value, suffix, icon: Icon, color }) => (
          <article className={`ref-stat ${color}`} key={label}>
            <div className="ref-stat-top"><span className="ref-stat-icon"><Icon size={18} /></span><span className="ref-stat-mark">↗</span></div>
            <div className="ref-stat-label">{label}</div>
            <strong>{suffix ? <Money>{value}</Money> : value}</strong>
            <small className="ref-stat-note">{color === "red" ? "تحتاج متابعة" : "محدّث اليوم"}</small>
          </article>
        ))}
      </section>

      <section className="ref-analytics">
        <article className="ref-card ref-finance">
          <div className="ref-card-heading"><div><span>الأداء المالي</span><h3>التحليلات المالية</h3></div><span className="ref-card-icon"><Banknote size={17} /></span></div>
          <div className="ref-finance-rows">
            <div><span className="ref-finance-icon income"><ArrowDownLeft size={15} /></span><span>إجمالي الإيرادات</span><strong><Money>٣٬٥٤٠</Money></strong></div>
            <div><span className="ref-finance-icon expense"><ArrowUpLeft size={15} /></span><span>إجمالي المصروفات</span><strong><Money>١٬٢٦٠</Money></strong></div>
          </div>
          <div className="ref-net"><span>صافي الدخل</span><strong><Money>٢٬٢٨٠</Money></strong><TrendingUp size={17} /></div>
          <div className="ref-finance-foot"><span>مقارنة بالشهر السابق</span><b><ArrowUpLeft size={13} /> +١٨٪</b></div>
        </article>

        <article className="ref-card ref-chart-card">
          <div className="ref-card-heading"><div><span>الأداء الشهري</span><h3>الإيرادات المحصلة</h3></div><span className="ref-select">{currentMonth}<ChevronLeft size={13} /></span></div>
          <div className="ref-chart-summary"><strong><Money>٣٬٥٤٠</Money></strong><span><TrendingUp size={13} /> +١٨٪</span></div>
          <div className="ref-chart">
            <div className="ref-chart-y"><span>٤٬٠٠٠</span><span>٣٬٠٠٠</span><span>٢٬٠٠٠</span><span>١٬٠٠٠</span><span>٠</span></div>
            <div className="ref-chart-plot">
              <div className="ref-chart-gridlines"><i /><i /><i /><i /><i /></div>
              {revenue.map((item, index) => <div className="ref-bar-wrap" key={item.month}>
                {index === revenue.length - 1 && <span className="ref-bar-value">{item.value}</span>}
                <div className={`ref-bar ${index === revenue.length - 1 ? "highlight" : ""}`} style={{ height: `${item.height}%` }} />
                <small>{item.month}</small>
              </div>)}
              <svg className="ref-chart-line" viewBox="0 0 600 180" preserveAspectRatio="none" aria-hidden="true">
                <polyline points="35,125 145,98 245,107 345,72 445,50 555,25" />
                <circle cx="35" cy="125" r="4" /><circle cx="145" cy="98" r="4" /><circle cx="245" cy="107" r="4" /><circle cx="345" cy="72" r="4" /><circle cx="445" cy="50" r="4" /><circle cx="555" cy="25" r="4" />
              </svg>
            </div>
          </div>
          <div className="ref-chart-legend"><span><i /> الإيرادات المحصلة</span><small>القيم بالدينار الأردني</small></div>
        </article>

        <article className="ref-card ref-plans">
          <div className="ref-card-heading"><div><span>العضويات الحالية</span><h3>توزيع المشتركين</h3></div><span className="ref-card-icon"><Users size={17} /></span></div>
          <div className="ref-donut-area">
            <div className="ref-donut"><div><strong>٢٢</strong><small>مشترك</small></div></div>
            <div className="ref-plan-legend">
              <div><i className="monthly" /><span>الباقة الشهرية</span><b>٤٥٪</b></div>
              <div><i className="quarter" /><span>باقة ٣ أشهر</span><b>٣٢٪</b></div>
              <div><i className="annual" /><span>الباقة السنوية</span><b>١٨٪</b></div>
              <div><i className="other" /><span>أخرى</span><b>٥٪</b></div>
            </div>
          </div>
          <div className="ref-plan-footer"><span>الأكثر انتشاراً</span><strong>الباقة الشهرية</strong><span className="ref-live-dot" /></div>
        </article>
      </section>

      <section className="ref-lower">
        <article className="ref-card ref-alerts">
          <div className="ref-card-heading"><div><span>تحتاج إلى إجراء</span><h3>التنبيهات الذكية</h3></div><Bell size={18} className="ref-gold-icon" /></div>
          <Link href="/subscriptions" className="ref-alert-row"><span className="ref-alert-icon gold"><CalendarDays size={16} /></span><span><strong>اشتراكات تنتهي خلال ٧ أيام</strong><small>تواصل مع المشتركين للتجديد</small></span><b>٥</b><ChevronLeft size={14} /></Link>
          <Link href="/subscriptions" className="ref-alert-row"><span className="ref-alert-icon red"><CircleAlert size={16} /></span><span><strong>اشتراكات منتهية</strong><small>تحتاج إلى متابعة التجديد</small></span><b>٨</b><ChevronLeft size={14} /></Link>
          <Link href="/finance" className="ref-alert-row"><span className="ref-alert-icon green"><Wallet size={16} /></span><span><strong>مبالغ مستحقة</strong><small>أرصدة بانتظار التحصيل</small></span><b><Money>١٬٢٨٠</Money></b><ChevronLeft size={14} /></Link>
        </article>

        <article className="ref-card ref-renewal">
          <div className="ref-card-heading"><div><span>مؤشر الولاء</span><h3>أداء الاشتراكات</h3></div><span className="ref-card-icon"><ReceiptText size={17} /></span></div>
          <div className="ref-renewal-body">
            <div className="ref-renewal-ring"><div><strong>٦٤٪</strong><small>معدل التجديد</small></div></div>
            <div className="ref-renewal-stats">
              <div><span><i className="green-dot" />اشتراكات نشطة</span><b>١٤</b></div>
              <div><span><i className="red-dot" />اشتراكات منتهية</span><b>٨</b></div>
              <div><span><i className="gold-dot" />اشتراكات جديدة</span><b>٦</b></div>
              <div><span><TrendingUp size={13} />معدل التجديد</span><b>٦٤٪</b></div>
            </div>
          </div>
          <div className="ref-renewal-foot"><span>معدل التجديد</span><strong>تحسّن <ArrowUpLeft size={13} /> ٨٪</strong></div>
        </article>

        <article className="ref-card ref-activity">
          <div className="ref-card-heading"><div><span>آخر التحديثات</span><h3>آخر العمليات</h3></div><Link href="/reports">عرض الكل <ChevronLeft size={13} /></Link></div>
          <div className="ref-activity-row"><span className="ref-activity-avatar">أ</span><span><strong>أحمد الزعبي</strong><small>تسجيل اشتراك جديد</small></span><time>منذ ١٠ دقائق</time><span className="ref-activity-tag green-tag">مشترك</span></div>
          <div className="ref-activity-row"><span className="ref-activity-avatar">خ</span><span><strong>خالد العلي</strong><small>تجديد اشتراك</small></span><time>منذ ٣٥ دقيقة</time><span className="ref-activity-tag blue-tag">تجديد</span></div>
          <div className="ref-activity-row"><span className="ref-activity-avatar"><Banknote size={15} /></span><span><strong>يوسف النابلسي</strong><small>تسجيل دفعة مالية</small></span><time>منذ ساعة</time><span className="ref-activity-tag gold-tag">دفعة مالية</span></div>
        </article>
      </section>
      <footer className="ref-footer"><span>PRIME BOXING ACADEMY</span><span><Check size={12} /> لوحة آمنة للمديرين والموظفين المخولين</span></footer>
    </div>
  );
}

export function Reference() {
  return <AppShell><Dashboard /></AppShell>;
}
