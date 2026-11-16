import { useMemo, type CSSProperties, type ReactNode } from "react";
import { useUser } from "@clerk/react";
import {
  useGetClubDashboard,
  useGetFinanceReport,
} from "@workspace/api-client-react";
import {
  Activity,
  ArrowDownLeft,
  ArrowUpLeft,
  BadgeCheck,
  Banknote,
  Bell,
  CalendarDays,
  ChartNoAxesCombined,
  Check,
  ChevronLeft,
  Clock3,
  CreditCard,
  Download,
  Printer,
  Plus,
  RefreshCw,
  ShieldCheck,
  TrendingUp,
  Users,
  Wallet,
} from "lucide-react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Link } from "wouter";
import { useAccess } from "./authz";
import "./DashboardPage.css";

const CHART_COLORS = {
  emerald: "#176247",
  gold: "#BE9B4D",
  expense: "#A45F57",
  muted: "#8C9A91",
  slice: ["#176247", "#BE9B4D", "#6E9C84", "#7A6543", "#B77A70", "#677E70"],
};

function moneyValue(fils: number, compact = false) {
  return (fils / 1000).toLocaleString("ar-JO", {
    minimumFractionDigits: compact ? 0 : 3,
    maximumFractionDigits: compact ? 0 : 3,
  });
}

function Money({ fils, compact = false }: { fils: number; compact?: boolean }) {
  return <>{moneyValue(fils, compact)} <small>د.أ</small></>;
}

function monthLabel(month: string) {
  const date = new Date(`${month}-01T12:00:00.000Z`);
  return new Intl.DateTimeFormat("ar-JO", {
    month: "short",
    timeZone: "Asia/Amman",
  }).format(date);
}

function dayLabel(days: number) {
  if (days === 0) return "ينتهي اليوم";
  if (days === 1) return "ينتهي غدًا";
  if (days === 2) return "ينتهي بعد يومين";
  if (days > 2) return `ينتهي بعد ${days} أيام`;
  const elapsed = Math.abs(days);
  if (elapsed === 1) return "منتهٍ منذ يوم";
  if (elapsed === 2) return "منتهٍ منذ يومين";
  return `منتهٍ منذ ${elapsed} أيام`;
}

function formatDateTime(iso: string) {
  return new Intl.DateTimeFormat("ar-JO", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Amman",
  }).format(new Date(iso));
}

function formatJodAxis(fils: number) {
  const jod = fils / 1000;
  if (Math.abs(jod) >= 1000) return `${(jod / 1000).toLocaleString("ar-JO", { maximumFractionDigits: 1 })} ألف`;
  return jod.toLocaleString("ar-JO", { maximumFractionDigits: 0 });
}

function escapeCsvCell(value: string | number) {
  const raw = String(value);
  const safe = /^[=+\-@]/.test(raw) ? `'${raw}` : raw;
  return `"${safe.replaceAll('"', '""')}"`;
}

function downloadCsv(filename: string, columns: Array<{ key: string; label: string }>, rows: Array<Record<string, string | number>>) {
  if (!rows.length) return;
  const content = [
    columns.map((column) => escapeCsvCell(column.label)).join(","),
    ...rows.map((row) => columns.map((column) => escapeCsvCell(row[column.key] ?? "")).join(",")),
  ].join("\r\n");
  const blob = new Blob([`\uFEFF${content}`], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

type TooltipItem = { name?: string; value?: number | string; color?: string };

function FinanceTooltip({ active, payload, label }: { active?: boolean; payload?: TooltipItem[]; label?: string | number }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="prime-dashboard-tooltip" dir="rtl">
      <strong>{typeof label === "string" && /^\d{4}-\d{2}$/.test(label) ? monthLabel(label) : label}</strong>
      {payload.map((entry, index) => (
        <div className="tooltip-row" key={`${entry.name}-${index}`}>
          <i style={{ backgroundColor: entry.color ?? CHART_COLORS.emerald }} />
          <span>{entry.name}</span>
          <b><Money fils={Number(entry.value ?? 0)} /></b>
        </div>
      ))}
    </div>
  );
}

function CountTooltip({ active, payload, label }: { active?: boolean; payload?: TooltipItem[]; label?: string | number }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="prime-dashboard-tooltip" dir="rtl">
      <strong>{typeof label === "string" && /^\d{4}-\d{2}$/.test(label) ? monthLabel(label) : label}</strong>
      <div className="tooltip-row"><i style={{ backgroundColor: CHART_COLORS.gold }} /><span>اشتراكات جديدة</span><b>{Number(payload[0]?.value ?? 0).toLocaleString("ar-JO")}</b></div>
    </div>
  );
}

function SkeletonDashboard() {
  return (
    <div className="prime-dashboard-skeleton" aria-label="جارٍ تحميل لوحة التحكم" aria-busy="true">
      <div className="skeleton-heading"><i /><i /></div>
      <div className="skeleton-hero" />
      <div className="skeleton-kpis">{Array.from({ length: 7 }, (_, index) => <i key={index} />)}</div>
      <div className="skeleton-panels"><i /><i /></div>
    </div>
  );
}

function MetricCard({
  label,
  value,
  note,
  icon,
  href,
  tone,
  testId,
}: {
  label: string;
  value: ReactNode;
  note: string;
  icon: ReactNode;
  href: string;
  tone: string;
  testId: string;
}) {
  return (
    <Link href={href} className={`prime-metric-card metric-${tone}`} data-testid={testId}>
      <span className="metric-top"><span>{label}</span><span className="metric-icon">{icon}</span></span>
      <strong className="metric-value">{value}</strong>
      <span className="metric-note">{note}</span>
      <ChevronLeft className="metric-arrow" size={14} aria-hidden="true" />
    </Link>
  );
}

function ChartExportButton({
  onClick,
  label,
  testId,
}: {
  onClick: () => void;
  label: string;
  testId: string;
}) {
  return (
    <button type="button" className="prime-chart-export" onClick={onClick} aria-label={label} title={label} data-testid={testId}>
      <Download size={14} />
    </button>
  );
}

export function DashboardPage() {
  const dashboard = useGetClubDashboard();
  const { user } = useUser();
  const { can, isOwner } = useAccess();
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Amman" }).format(new Date());
  const from = `${today.slice(0, 7)}-01`;
  const finance = useGetFinanceReport({ from, to: today });
  const summary = dashboard.data;
  const financeReport = finance.data;
  const initialLoading = dashboard.isLoading || dashboard.isFetching || finance.isLoading || finance.isFetching;
  const updatedAt = Math.max(dashboard.dataUpdatedAt || 0, finance.dataUpdatedAt || 0);
  const lastUpdated = updatedAt
    ? new Intl.DateTimeFormat("ar-JO", { hour: "numeric", minute: "2-digit", timeZone: "Asia/Amman" }).format(new Date(updatedAt))
    : null;

  const months = summary?.monthlySeries ?? [];
  const planChartData = useMemo(() => {
    const plans = summary?.planDistribution ?? [];
    const top = plans.slice(0, 5).map((plan) => ({ name: plan.planName, value: plan.activeSubscriptions }));
    const remainder = plans.slice(5).reduce((total, plan) => total + plan.activeSubscriptions, 0);
    if (remainder > 0) top.push({ name: "باقات أخرى", value: remainder });
    return top;
  }, [summary?.planDistribution]);

  const currentMonth = months[months.length - 1];
  const previousMonth = months[months.length - 2];
  const previousIncome = previousMonth?.incomeFils ?? 0;
  const incomeChange = previousIncome
    ? Math.round(((summary?.monthlyCollectedFils ?? 0) - previousIncome) / Math.abs(previousIncome) * 100)
    : null;
  const renewalPercent = summary?.renewalRate.ratePercent;
  const activities = useMemo(() => {
    if (!summary) return [];
    return [
      ...summary.recentMembers.map((member) => ({
        id: `member-${member.id}`,
        memberId: member.id,
        name: member.name,
        detail: "تسجيل مشترك جديد",
        date: member.joinedAt,
        kind: "member" as const,
      })),
      ...summary.recentRenewals.map((renewal) => ({
        id: `renewal-${renewal.subscriptionId}`,
        memberId: renewal.memberId,
        name: renewal.memberName,
        detail: `تجديد اشتراك — ${renewal.planName}`,
        date: renewal.createdAt,
        kind: "renewal" as const,
      })),
      ...summary.recentPayments.map((payment) => ({
        id: `payment-${payment.paymentId}`,
        memberId: payment.memberId,
        name: payment.memberName,
        detail: `${payment.kind === "refund" ? "استرداد" : payment.kind === "discount" ? "خصم" : "دفعة"} — ${moneyValue(payment.amountFils, true)} د.أ`,
        date: payment.createdAt,
        kind: "payment" as const,
      })),
    ].sort((a, b) => Date.parse(b.date) - Date.parse(a.date)).slice(0, 6);
  }, [summary]);

  const refresh = async () => {
    await Promise.all([dashboard.refetch(), finance.refetch()]);
  };

  if (initialLoading && !summary) return <SkeletonDashboard />;
  if (dashboard.isError && !summary) {
    return (
      <div className="prime-dashboard-error" role="alert">
        <Activity size={24} />
        <h1>تعذر تحميل لوحة التحكم</h1>
        <p>تحقق من الاتصال والصلاحيات، ثم أعد المحاولة.</p>
        <button type="button" className="prime-action-button primary" onClick={() => void refresh()} data-testid="button-dashboard-retry">
          <RefreshCw size={15} /> إعادة المحاولة
        </button>
      </div>
    );
  }
  if (!summary) return <SkeletonDashboard />;

  const dateLabel = new Intl.DateTimeFormat("ar-JO", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "Asia/Amman",
  }).format(new Date());
  const currentMonthLabel = new Intl.DateTimeFormat("ar-JO", {
    month: "long",
    year: "numeric",
    timeZone: "Asia/Amman",
  }).format(new Date());
  const topPlanTotal = summary.planDistribution.reduce((total, plan) => total + plan.activeSubscriptions, 0);
  const reportPath = can("reports.view") ? "/reports" : "/finance";
  const subscriptionPath = can("subscriptions.view") ? "/subscriptions" : "/members";
  const subscriptionLink = (memberId: number) => can("members.view") ? `/members/${memberId}` : subscriptionPath;

  const financialRows = months.map((row) => ({
    month: row.month,
    الإيرادات: row.incomeFils,
    المصروفات: row.expensesFils,
    الصافي: row.netFils,
  }));
  const newSubscriptionRows = months.map((row) => ({ month: row.month, الاشتراكات_الجديدة: row.newSubscriptions }));
  const planRows = planChartData.map((row) => ({ الباقة: row.name, الاشتراكات_النشطة: row.value }));
  const monthlyIncome = summary.monthlyCollectedFils;
  const monthlyExpenses = financeReport?.expensesFils ?? currentMonth?.expensesFils ?? 0;
  const monthlyNet = financeReport?.netFils ?? currentMonth?.netFils ?? (monthlyIncome - monthlyExpenses);
  const reportError = finance.isError && !financeReport;

  return (
    <div className="prime-dashboard" dir="rtl">
      <div className="prime-dashboard-heading">
        <div>
          <div className="dashboard-kicker"><span className="dashboard-live-dot" /> مركز إدارة الأكاديمية <span className="kicker-slash">/</span> {dateLabel}</div>
          <h1>أهلاً بك في <em>Prime Boxing Academy</em></h1>
          <p>ملخص موثّق من بيانات الأكاديمية لمساعدتك على متابعة الأداء اليومي.</p>
          <div className="dashboard-source-row"><span>قاعدة بيانات الأكاديمية</span>{lastUpdated && <span>آخر تحديث {lastUpdated}</span>}</div>
        </div>
        <div className="dashboard-admin-chip" data-testid="dashboard-admin">
          <span className="admin-mark">{user?.firstName?.slice(0, 1) || "م"}</span>
          <span className="admin-copy"><strong>{user?.fullName || "إدارة الأكاديمية"}</strong><small><ShieldCheck size={12} />{isOwner ? "مالك الأكاديمية" : "حساب مخوّل"}</small></span>
          <span className="dashboard-live-dot" />
        </div>
        <div className="dashboard-tools">
          <button type="button" className="prime-icon-button" onClick={() => window.print()} aria-label="طباعة لوحة التحكم" title="طباعة / PDF" data-testid="button-dashboard-print"><Printer size={16} /></button>
          <button type="button" className="prime-action-button ghost" onClick={() => void refresh()} disabled={dashboard.isFetching || finance.isFetching} data-testid="button-dashboard-refresh">
            <RefreshCw size={15} className={dashboard.isFetching || finance.isFetching ? "is-spinning" : ""} /> تحديث
          </button>
        </div>
      </div>

      <section className="prime-dashboard-hero" aria-label="ترحيب وملخص الأكاديمية">
        <div className="hero-text">
          <div className="hero-lockup"><img src={`${import.meta.env.BASE_URL.replace(/\/$/, "")}/logo.svg`} alt="" /><span><strong>PRIME BOXING ACADEMY</strong><small>إدارة الأكاديمية</small></span></div>
          <span className="hero-period"><CalendarDays size={13} />{currentMonthLabel}</span>
          <h2>تقدّم الأكاديمية<br /><em>يبدأ من هنا.</em></h2>
          <p>{summary.activeMembers.toLocaleString("ar-JO")} مشتركًا نشطًا، مع متابعة مباشرة للإيرادات والعضويات.</p>
          <div className="hero-actions">
            {can("members.create") && <Link href="/members" className="prime-action-button hero-primary" data-testid="link-hero-new-member"><Plus size={15} />إضافة مشترك</Link>}
            {can("reports.view") && <Link href="/reports" className="hero-report-link" data-testid="link-hero-reports">عرض التقارير <ChevronLeft size={14} /></Link>}
          </div>
        </div>
        <div className="hero-orbit-art" aria-hidden="true">
          <span className="orbit orbit-a" /><span className="orbit orbit-b" /><span className="orbit orbit-c" />
          <div className="hero-medallion"><span>PRIME</span><strong>{summary.activeMembers.toLocaleString("ar-JO")}</strong><small>مشترك نشط</small></div>
          <div className="hero-float-card"><TrendingUp size={14} /><span>تحصيل هذا الشهر</span><strong><Money fils={summary.monthlyCollectedFils} compact /></strong></div>
          <div className="hero-side-label"><span>01</span> AMMAN · JORDAN</div>
        </div>
      </section>

      <section className="dashboard-section" aria-label="المؤشرات الرئيسية">
        <div className="dashboard-section-heading">
          <div><span className="section-overline">01 / مؤشرات الأكاديمية</span><h2>صورة النادي اليوم</h2></div>
          <span className="dashboard-update-state"><span className="dashboard-live-dot" /> بيانات مباشرة من النظام</span>
        </div>
        <div className="prime-metrics-grid">
          <MetricCard label="إجمالي المشتركين" value={summary.totalMembers.toLocaleString("ar-JO")} note="كل السجلات المحفوظة" icon={<Users />} href="/members" tone="neutral" testId="card-total-members" />
          <MetricCard label="المشتركون النشطون" value={summary.activeMembers.toLocaleString("ar-JO")} note="لديهم اشتراك سارٍ" icon={<BadgeCheck />} href="/members" tone="green" testId="card-active-members" />
          <MetricCard label="اشتراكات منتهية" value={summary.expiredSubscriptions.toLocaleString("ar-JO")} note="محفوظة في سجل الأكاديمية" icon={<Clock3 />} href={subscriptionPath} tone="rose" testId="card-expired-subscriptions" />
          <MetricCard label="تنتهي خلال ٧ أيام" value={summary.endingWithin7Days.toLocaleString("ar-JO")} note={`${summary.endingSoon.toLocaleString("ar-JO")} خلال يومين`} icon={<CalendarDays />} href={subscriptionPath} tone="gold" testId="card-ending-seven-days" />
          <MetricCard label="تحصيل هذا الشهر" value={<Money fils={summary.monthlyCollectedFils} compact />} note="الدفعات والإيرادات المسجلة" icon={<Banknote />} href={reportPath} tone="green" testId="card-monthly-revenue" />
          <MetricCard label="المبالغ المستحقة" value={<Money fils={summary.outstandingFils} compact />} note={`${summary.outstandingMembers.length ? "أعلى ٥ أرصدة معروضة أدناه" : "لا توجد أرصدة في السجل"}`} icon={<Wallet />} href={reportPath} tone="gold" testId="card-outstanding" />
          <MetricCard label="عمليات الدفع" value={summary.totalPaymentOperations.toLocaleString("ar-JO")} note="سجل العمليات بالكامل" icon={<CreditCard />} href={subscriptionPath} tone="neutral" testId="card-payment-operations" />
        </div>
      </section>

      <section className="dashboard-section" aria-label="التحليلات المالية وتحليلات العضويات">
        <div className="dashboard-section-heading">
          <div><span className="section-overline">02 / التحليلات</span><h2>المالية ونمو العضويات</h2></div>
          <span className="section-period">آخر ٦ أشهر · الشهر الحالي حتى اليوم</span>
        </div>
        <div className="dashboard-analytics-grid">
          <article className="prime-dashboard-panel finance-analytics-panel">
            <div className="dashboard-panel-heading">
              <div><span className="panel-overline">Financial Analytics</span><h3>الإيرادات والمصروفات الشهرية</h3></div>
              <ChartExportButton
                onClick={() => downloadCsv("prime-monthly-finance.csv", [
                  { key: "month", label: "الشهر" },
                  { key: "الإيرادات", label: "الإيرادات بالفلس" },
                  { key: "المصروفات", label: "المصروفات بالفلس" },
                  { key: "الصافي", label: "صافي الدخل بالفلس" },
                ], financialRows)}
                label="تصدير بيانات الرسم المالي CSV"
                testId="button-export-finance-chart"
              />
            </div>
            {reportError && <p className="dashboard-inline-error" role="alert">تعذر تحميل تقرير الفترة؛ يعرض الرسم ملخص السجلات المتاح.</p>}
            <div className="finance-chart-summary">
              <div><strong><Money fils={monthlyIncome} /></strong><small>الإيرادات المحصلة</small></div>
              <span className={`month-change ${incomeChange === null ? "neutral" : incomeChange >= 0 ? "positive" : "negative"}`}>
                {incomeChange === null ? <Activity size={13} /> : incomeChange >= 0 ? <ArrowUpLeft size={13} /> : <ArrowDownLeft size={13} />}
                {incomeChange === null ? "لا توجد مقارنة سابقة" : `${Math.abs(incomeChange).toLocaleString("ar-JO")}٪ عن الشهر السابق`}
              </span>
            </div>
            <div className="dashboard-chart finance-chart" role="img" aria-label="رسم الإيرادات والمصروفات خلال آخر ستة أشهر">
              <ResponsiveContainer width="100%" height={250} debounce={0}>
                <AreaChart data={months} margin={{ top: 10, right: 8, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="primeIncomeFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={CHART_COLORS.emerald} stopOpacity={0.28} /><stop offset="100%" stopColor={CHART_COLORS.emerald} stopOpacity={0.02} /></linearGradient>
                    <linearGradient id="primeExpenseFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={CHART_COLORS.expense} stopOpacity={0.16} /><stop offset="100%" stopColor={CHART_COLORS.expense} stopOpacity={0.015} /></linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 5" stroke="hsl(var(--border) / .7)" vertical={false} />
                  <XAxis dataKey="month" tickFormatter={monthLabel} tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} tickLine={false} axisLine={false} />
                  <YAxis tickFormatter={formatJodAxis} tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} tickLine={false} axisLine={false} width={44} />
                  <Tooltip content={<FinanceTooltip />} isAnimationActive={false} cursor={{ fill: "hsl(var(--muted) / .45)", stroke: "none" }} />
                  <Area type="monotone" dataKey="incomeFils" name="الإيرادات" stroke={CHART_COLORS.emerald} fill="url(#primeIncomeFill)" strokeWidth={2.5} activeDot={{ r: 4, fill: CHART_COLORS.emerald, stroke: "#fff", strokeWidth: 2 }} isAnimationActive={false} />
                  <Area type="monotone" dataKey="expensesFils" name="المصروفات" stroke={CHART_COLORS.expense} fill="url(#primeExpenseFill)" strokeWidth={2} activeDot={{ r: 4, fill: CHART_COLORS.expense, stroke: "#fff", strokeWidth: 2 }} isAnimationActive={false} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
            <div className="finance-chart-legend"><span><i className="legend-emerald" />الإيرادات</span><span><i className="legend-expense" />المصروفات</span></div>
            <div className="finance-summary-strip">
              <FinanceValue label="صافي الدخل" fils={monthlyNet} tone="net" />
              <FinanceValue label="المصروفات" fils={monthlyExpenses} tone="expense" />
              <FinanceValue label="رواتب مستحقة" fils={financeReport?.payrollDueFils} tone="gold" />
              <FinanceValue label="رصيد الصندوق" fils={financeReport?.cashBalanceFils} tone="neutral" />
            </div>
            <p className="dashboard-footnote">إجمالي التحصيل منذ بدء السجل: <strong><Money fils={summary.collectedFils} compact /></strong></p>
            {previousMonth && currentMonth && <div className="comparison-note"><span>الحالي حتى اليوم <b><Money fils={currentMonth.incomeFils} compact /></b></span><i /><span>الشهر السابق <b><Money fils={previousIncome} compact /></b></span></div>}
          </article>

          <article className="prime-dashboard-panel membership-analytics-panel">
            <div className="dashboard-panel-heading">
              <div><span className="panel-overline">Member Analytics</span><h3>توزيع الباقات ومعدل التجديد</h3></div>
              <Link href={subscriptionPath} className="panel-action" data-testid="link-dashboard-subscriptions">الاشتراكات <ChevronLeft size={14} /></Link>
            </div>
            <div className="membership-overview">
              <div className="renewal-ring" style={{ "--renewal-degree": `${renewalPercent ?? 0}%` } as CSSProperties}>
                <div><strong>{renewalPercent === null || renewalPercent === undefined ? "—" : `${Math.round(renewalPercent).toLocaleString("ar-JO")}٪`}</strong><small>معدل التجديد</small></div>
              </div>
              <div className="member-counts">
                <CountLine label="نشط" value={summary.activeMembers} tone="green" />
                <CountLine label="منتهي" value={summary.expiredSubscriptions} tone="rose" />
                <CountLine label="جديد هذا الشهر" value={summary.newSubscriptionsThisMonth} tone="gold" />
                <small className="renewal-definition">{summary.renewalRate.eligibleSubscriptions ? `من ${summary.renewalRate.eligibleSubscriptions.toLocaleString("ar-JO")} اشتراكًا انتهى خلال آخر ٦ أشهر` : "لا توجد اشتراكات مؤهلة للحساب خلال آخر ٦ أشهر"}</small>
              </div>
            </div>
            <div className="plan-chart-heading"><strong>الاشتراكات النشطة حسب الباقة</strong><span>{topPlanTotal.toLocaleString("ar-JO")} اشتراك</span></div>
            {planChartData.length ? (
              <>
                <div className="plan-donut" role="img" aria-label="توزيع الاشتراكات النشطة حسب الباقة">
                  <ResponsiveContainer width="100%" height={166} debounce={0}>
                    <PieChart>
                      <Pie data={planChartData} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={48} outerRadius={71} cornerRadius={3} paddingAngle={2} stroke="none" isAnimationActive={false}>
                        {planChartData.map((entry, index) => <Cell key={entry.name} fill={CHART_COLORS.slice[index % CHART_COLORS.slice.length]} />)}
                      </Pie>
                      <Tooltip isAnimationActive={false} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="plan-legend">
                  {planChartData.map((plan, index) => <div className="plan-legend-row" key={plan.name}><i style={{ background: CHART_COLORS.slice[index % CHART_COLORS.slice.length] }} /><span>{plan.name}</span><strong>{plan.value.toLocaleString("ar-JO")}</strong></div>)}
                </div>
              </>
            ) : <div className="dashboard-empty">لا توجد اشتراكات نشطة موزعة على باقات حتى الآن.</div>}
            <div className="new-subscriptions-chart-heading">
              <strong>الاشتراكات الجديدة</strong>
              <ChartExportButton
                onClick={() => downloadCsv("prime-new-subscriptions.csv", [{ key: "month", label: "الشهر" }, { key: "الاشتراكات_الجديدة", label: "الاشتراكات الجديدة" }], newSubscriptionRows)}
                label="تصدير بيانات الاشتراكات الجديدة CSV"
                testId="button-export-members-chart"
              />
            </div>
            <div className="mini-member-chart" role="img" aria-label="عدد الاشتراكات الجديدة حسب الشهر">
              <ResponsiveContainer width="100%" height={105} debounce={0}>
                <AreaChart data={months} margin={{ top: 8, right: 3, left: -24, bottom: 0 }}>
                  <defs><linearGradient id="primeNewSubsFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={CHART_COLORS.gold} stopOpacity={0.28} /><stop offset="100%" stopColor={CHART_COLORS.gold} stopOpacity={0.015} /></linearGradient></defs>
                  <CartesianGrid strokeDasharray="3 5" stroke="hsl(var(--border) / .65)" vertical={false} />
                  <XAxis dataKey="month" tickFormatter={monthLabel} tick={{ fontSize: 9, fill: "hsl(var(--muted-foreground))" }} tickLine={false} axisLine={false} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 9, fill: "hsl(var(--muted-foreground))" }} tickLine={false} axisLine={false} width={30} />
                  <Tooltip content={<CountTooltip />} isAnimationActive={false} cursor={{ fill: "hsl(var(--muted) / .45)", stroke: "none" }} />
                  <Area type="monotone" dataKey="newSubscriptions" name="اشتراكات جديدة" stroke={CHART_COLORS.gold} fill="url(#primeNewSubsFill)" strokeWidth={2} activeDot={{ r: 3, fill: CHART_COLORS.gold, stroke: "#fff", strokeWidth: 2 }} isAnimationActive={false} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </article>
        </div>
      </section>

      <section className="dashboard-section" aria-label="تنبيهات الأكاديمية ونشاطها">
        <div className="dashboard-section-heading">
          <div><span className="section-overline">03 / المتابعة اليومية</span><h2>تنبيهات ونشاط الأكاديمية</h2></div>
          <Bell size={17} className="dashboard-bell" />
        </div>
        <div className="dashboard-operations-grid">
          <article className="prime-dashboard-panel alert-panel">
            <div className="dashboard-panel-heading"><div><span className="panel-overline">Academy Alerts</span><h3>ما يحتاج انتباهك</h3></div><span className="alert-summary-count">{(summary.endingWithin7Days + summary.expiredSubscriptions).toLocaleString("ar-JO")}</span></div>
            <div className="alert-group">
              <div className="alert-group-title"><Clock3 size={15} /><span>تنتهي خلال ٧ أيام</span><b>{summary.endingWithin7Days.toLocaleString("ar-JO")}</b></div>
              {summary.expiringSubscriptions.length ? summary.expiringSubscriptions.map((item) => <Link key={item.subscriptionId} href={subscriptionLink(item.memberId)} className="dashboard-list-row" data-testid={`alert-expiring-${item.subscriptionId}`}>
                <span className="list-avatar gold">{item.memberName.slice(0, 1)}</span><span className="list-main"><strong>{item.memberName}</strong><small>{item.planName} · {dayLabel(item.daysRemaining)}</small></span><span className="list-end-date">{item.endDate}</span><ChevronLeft size={14} />
              </Link>) : <p className="dashboard-empty compact">لا توجد اشتراكات تنتهي خلال الأسبوع.</p>}
            </div>
            <div className="alert-group">
              <div className="alert-group-title expired"><BadgeCheck size={15} /><span>اشتراكات منتهية</span><b>{summary.expiredSubscriptions.toLocaleString("ar-JO")}</b></div>
              {summary.expiredSubscriptionAlerts.length ? summary.expiredSubscriptionAlerts.map((item) => <Link key={item.subscriptionId} href={subscriptionLink(item.memberId)} className="dashboard-list-row" data-testid={`alert-expired-${item.subscriptionId}`}>
                <span className="list-avatar rose">{item.memberName.slice(0, 1)}</span><span className="list-main"><strong>{item.memberName}</strong><small>{item.planName} · {dayLabel(item.daysRemaining)}</small></span><span className="list-end-date">{item.endDate}</span><ChevronLeft size={14} />
              </Link>) : <p className="dashboard-empty compact">لا توجد اشتراكات منتهية.</p>}
            </div>
            <div className="alert-group debt-group">
              <div className="alert-group-title debt"><Wallet size={15} /><span>أعلى المبالغ المستحقة</span><b><Money fils={summary.outstandingFils} compact /></b></div>
              {summary.outstandingMembers.length ? summary.outstandingMembers.map((member) => <Link key={member.memberId} href={subscriptionLink(member.memberId)} className="dashboard-list-row" data-testid={`alert-debt-${member.memberId}`}>
                <span className="list-avatar green">{member.memberName.slice(0, 1)}</span><span className="list-main"><strong>{member.memberName}</strong><small dir="ltr">{member.phone}</small></span><strong className="debt-value"><Money fils={member.outstandingFils} compact /></strong><ChevronLeft size={14} />
              </Link>) : <p className="dashboard-empty compact">لا توجد مبالغ مستحقة.</p>}
            </div>
            <Link href={subscriptionPath} className="dashboard-see-all" data-testid="link-dashboard-all-alerts">عرض سجل الاشتراكات <ChevronLeft size={14} /></Link>
          </article>

          <article className="prime-dashboard-panel activity-panel">
            <div className="dashboard-panel-heading"><div><span className="panel-overline">Academy Activity</span><h3>آخر التسجيلات والتجديدات والمدفوعات</h3></div><Activity size={17} className="activity-heading-icon" /></div>
            {activities.length ? <div className="dashboard-activity-list">{activities.map((item) => (
              <Link href={subscriptionLink(item.memberId)} className="activity-row" key={item.id} data-testid={`activity-${item.id}`}>
                <span className={`activity-icon activity-${item.kind}`}>{item.kind === "member" ? <Users size={15} /> : item.kind === "renewal" ? <BadgeCheck size={15} /> : <CreditCard size={15} />}</span>
                <span className="activity-copy"><strong>{item.name}</strong><small>{item.detail}</small></span>
                <time dateTime={item.date}>{formatDateTime(item.date)}</time>
              </Link>
            ))}</div> : <div className="dashboard-empty">لا توجد تسجيلات أو عمليات حديثة لعرضها.</div>}
            <div className="activity-foot"><span><span className="dashboard-live-dot" /> آخر السجلات المحفوظة</span><Link href="/members" data-testid="link-dashboard-all-members">جميع المشتركين <ChevronLeft size={13} /></Link></div>
          </article>
        </div>
      </section>

      <section className="dashboard-section quick-actions-section">
        <div className="dashboard-section-heading">
          <div><span className="section-overline">04 / العمليات اليومية</span><h2>اختصارات الوصول</h2></div>
          <span className="section-period">روابط متاحة وفق صلاحيات حسابك</span>
        </div>
        <div className="dashboard-quick-actions">
          {can("members.create") && <QuickAction href="/members" icon={<Plus size={17} />} label="إضافة مشترك" index="01" testId="quick-add-member" />}
          {can("subscriptions.create", "members.view") && <QuickAction href="/subscriptions" icon={<BadgeCheck size={17} />} label="اشتراك جديد" index="02" testId="quick-new-subscription" />}
          {can("payments.create", "subscriptions.view") && <QuickAction href="/subscriptions" icon={<CreditCard size={17} />} label="تسجيل دفعة" index="03" testId="quick-new-payment" />}
          {can("members.view") && <QuickAction href="/members" icon={<Users size={17} />} label="عرض المشتركين" index="04" testId="quick-all-members" />}
          {can("reports.view") && <QuickAction href="/reports" icon={<ChartNoAxesCombined size={17} />} label="التقارير المالية" index="05" testId="quick-finance-reports" />}
        </div>
      </section>

      <footer className="prime-dashboard-footer"><span>PRIME BOXING ACADEMY</span><span>جميع القيم بالدينار الأردني · التوقيت المحلي: عمّان</span><Check size={14} /></footer>
    </div>
  );
}

function FinanceValue({ label, fils, tone }: { label: string; fils?: number; tone: string }) {
  return <div className={`finance-mini finance-${tone}`}><span>{label}</span><strong>{fils === undefined ? "—" : <Money fils={fils} compact />}</strong></div>;
}

function CountLine({ label, value, tone }: { label: string; value: number; tone: string }) {
  return <div className="member-count-line"><i className={`count-dot ${tone}`} /><span>{label}</span><strong>{value.toLocaleString("ar-JO")}</strong></div>;
}

function QuickAction({ href, icon, label, index, testId }: { href: string; icon: ReactNode; label: string; index: string; testId: string }) {
  return <Link href={href} className="dashboard-quick-action" data-testid={testId}><small>{index}</small><span>{icon}</span><strong>{label}</strong><ChevronLeft size={14} /></Link>;
}
