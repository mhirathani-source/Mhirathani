import { signedPayment } from "./cashLedger";

type DashboardMember = {
  id: number;
  name: string;
  phone: string;
  email: string | null;
  birthDate: string | null;
  notes: string | null;
  joinedAt: Date;
  active: boolean;
};

type DashboardSubscription = {
  id: number;
  memberId: number;
  planId: number;
  priceFils: number;
  discountFils: number;
  startDate: string;
  endDate: string;
  status: string;
  renewedFromId: number | null;
  createdAt: Date;
};

type DashboardPayment = {
  id: number;
  subscriptionId: number;
  amountFils: number;
  kind: string;
  method: string;
  createdAt: Date;
};

type DashboardTransaction = {
  kind: string;
  amountFils: number;
  transactionDate: string;
};

type DashboardPlan = { id: number; name: string };

type SubscriptionAlert = {
  subscriptionId: number;
  memberId: number;
  memberName: string;
  phone: string;
  planName: string;
  endDate: string;
  daysRemaining: number;
};

function jordanDate(date: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Amman",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

function addDays(date: string, days: number): string {
  const value = new Date(`${date}T12:00:00.000Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}

function monthKey(date: string, offset = 0): string {
  const [year, month] = date.slice(0, 7).split("-").map(Number);
  const value = new Date(Date.UTC(year, month - 1, 1));
  value.setUTCMonth(value.getUTCMonth() + offset);
  return value.toISOString().slice(0, 7);
}

function daysBetween(from: string, to: string): number {
  return Math.round((Date.parse(`${to}T12:00:00.000Z`) - Date.parse(`${from}T12:00:00.000Z`)) / 86_400_000);
}

function effectiveStatus(subscription: DashboardSubscription, today: string): string {
  if (subscription.status === "paused" || subscription.status === "cancelled") return subscription.status;
  return subscription.endDate < today ? "expired" : "active";
}

export function buildClubDashboard(input: {
  today: string;
  members: DashboardMember[];
  subscriptions: DashboardSubscription[];
  payments: DashboardPayment[];
  transactions: DashboardTransaction[];
  plans: DashboardPlan[];
}) {
  const { today, members, subscriptions, payments, transactions, plans } = input;
  const membersById = new Map(members.map((member) => [member.id, member]));
  const plansById = new Map(plans.map((plan) => [plan.id, plan.name]));
  const subscriptionsById = new Map(subscriptions.map((subscription) => [subscription.id, subscription]));
  const paymentsBySubscription = new Map<number, number>();
  for (const payment of payments) {
    paymentsBySubscription.set(
      payment.subscriptionId,
      (paymentsBySubscription.get(payment.subscriptionId) ?? 0) + signedPayment(payment),
    );
  }

  const activeSubscriptions = subscriptions.filter((subscription) => effectiveStatus(subscription, today) === "active");
  const activeMembers = new Set(
    activeSubscriptions
      .filter((subscription) => membersById.get(subscription.memberId)?.active)
      .map((subscription) => subscription.memberId),
  ).size;
  const soon = addDays(today, 2);
  const withinSevenDays = addDays(today, 7);
  const endingSoon = activeSubscriptions.filter((subscription) => subscription.endDate >= today && subscription.endDate <= soon).length;
  const endingWithin7Days = activeSubscriptions.filter((subscription) => subscription.endDate >= today && subscription.endDate <= withinSevenDays).length;
  const expiredSubscriptions = subscriptions.filter((subscription) => effectiveStatus(subscription, today) === "expired").length;

  let outstandingFils = 0;
  const outstandingByMember = new Map<number, number>();
  for (const subscription of subscriptions) {
    const balance = Math.max(
      0,
      subscription.priceFils - subscription.discountFils - (paymentsBySubscription.get(subscription.id) ?? 0),
    );
    outstandingFils += balance;
    if (balance > 0) outstandingByMember.set(subscription.memberId, (outstandingByMember.get(subscription.memberId) ?? 0) + balance);
  }

  const monthPrefix = today.slice(0, 7);
  const collectedFils = payments.reduce((total, payment) => total + signedPayment(payment), 0)
    + transactions.filter((transaction) => transaction.kind === "income").reduce((total, transaction) => total + transaction.amountFils, 0);
  const monthlyCollectedFils = payments
    .filter((payment) => jordanDate(payment.createdAt).slice(0, 7) === monthPrefix)
    .reduce((total, payment) => total + signedPayment(payment), 0)
    + transactions
      .filter((transaction) => transaction.kind === "income" && transaction.transactionDate.startsWith(monthPrefix))
      .reduce((total, transaction) => total + transaction.amountFils, 0);

  const months = Array.from({ length: 6 }, (_, index) => monthKey(today, index - 5));
  const monthRows = new Map(months.map((month) => [month, {
    month,
    incomeFils: 0,
    expensesFils: 0,
    netFils: 0,
    newSubscriptions: 0,
  }]));
  for (const payment of payments) {
    const month = jordanDate(payment.createdAt).slice(0, 7);
    const row = monthRows.get(month);
    if (row) row.incomeFils += signedPayment(payment);
  }
  for (const transaction of transactions) {
    const row = monthRows.get(transaction.transactionDate.slice(0, 7));
    if (!row) continue;
    if (transaction.kind === "income") row.incomeFils += transaction.amountFils;
    if (transaction.kind === "expense") row.expensesFils += transaction.amountFils;
  }
  for (const subscription of subscriptions) {
    const month = jordanDate(subscription.createdAt).slice(0, 7);
    const row = monthRows.get(month);
    if (row) row.newSubscriptions++;
  }
  const monthlySeries = months.map((month) => {
    const row = monthRows.get(month)!;
    return { ...row, netFils: row.incomeFils - row.expensesFils };
  });
  const newSubscriptionsThisMonth = monthRows.get(monthPrefix)?.newSubscriptions ?? 0;

  const planCounts = new Map<number, number>();
  for (const subscription of activeSubscriptions) {
    if (!membersById.get(subscription.memberId)?.active) continue;
    planCounts.set(subscription.planId, (planCounts.get(subscription.planId) ?? 0) + 1);
  }
  const planDistribution = [...planCounts.entries()]
    .map(([planId, activeSubscriptions]) => ({ planId, planName: plansById.get(planId) ?? "باقة غير معروفة", activeSubscriptions }))
    .sort((a, b) => b.activeSubscriptions - a.activeSubscriptions || a.planName.localeCompare(b.planName, "ar"));

  const renewalCutoff = `${months[0]}-01`;
  const renewalEligible = subscriptions.filter((subscription) =>
    subscription.endDate >= renewalCutoff
      && subscription.endDate < today
      && subscription.status !== "paused"
      && subscription.status !== "cancelled",
  );
  const renewedFromIds = new Set(subscriptions.flatMap((subscription) => subscription.renewedFromId == null ? [] : [subscription.renewedFromId]));
  const renewedSubscriptions = renewalEligible.filter((subscription) => renewedFromIds.has(subscription.id)).length;
  const renewalRate = {
    periodMonths: 6,
    eligibleSubscriptions: renewalEligible.length,
    renewedSubscriptions,
    ratePercent: renewalEligible.length ? Number((renewedSubscriptions / renewalEligible.length * 100).toFixed(1)) : null,
  };

  const toAlert = (subscription: DashboardSubscription): SubscriptionAlert | null => {
    const member = membersById.get(subscription.memberId);
    if (!member) return null;
    return {
      subscriptionId: subscription.id,
      memberId: member.id,
      memberName: member.name,
      phone: member.phone,
      planName: plansById.get(subscription.planId) ?? "باقة غير معروفة",
      endDate: subscription.endDate,
      daysRemaining: daysBetween(today, subscription.endDate),
    };
  };
  const expiringSubscriptions = activeSubscriptions
    .filter((subscription) => subscription.endDate >= today && subscription.endDate <= withinSevenDays && membersById.get(subscription.memberId)?.active)
    .sort((a, b) => a.endDate.localeCompare(b.endDate))
    .slice(0, 5)
    .map(toAlert)
    .filter((alert): alert is SubscriptionAlert => alert !== null);
  const expiredSubscriptionAlerts = subscriptions
    .filter((subscription) => effectiveStatus(subscription, today) === "expired")
    .sort((a, b) => b.endDate.localeCompare(a.endDate))
    .slice(0, 5)
    .map(toAlert)
    .filter((alert): alert is SubscriptionAlert => alert !== null);

  const outstandingMembers = [...outstandingByMember.entries()]
    .map(([memberId, balanceFils]) => {
      const member = membersById.get(memberId);
      return member ? { memberId, memberName: member.name, phone: member.phone, outstandingFils: balanceFils } : null;
    })
    .filter((row): row is NonNullable<typeof row> => row !== null)
    .sort((a, b) => b.outstandingFils - a.outstandingFils)
    .slice(0, 5);

  const recentMembers = [...members]
    .sort((a, b) => b.joinedAt.getTime() - a.joinedAt.getTime())
    .slice(0, 5)
    .map((member) => ({ ...member, joinedAt: member.joinedAt.toISOString() }));
  const recentRenewals = subscriptions
    .filter((subscription) => subscription.renewedFromId !== null)
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
    .slice(0, 5)
    .flatMap((subscription) => {
      const member = membersById.get(subscription.memberId);
      return member ? [{
        subscriptionId: subscription.id,
        memberId: member.id,
        memberName: member.name,
        planName: plansById.get(subscription.planId) ?? "باقة غير معروفة",
        createdAt: subscription.createdAt.toISOString(),
        startDate: subscription.startDate,
      }] : [];
    });
  const recentPayments = [...payments]
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
    .slice(0, 5)
    .flatMap((payment) => {
      const subscription = subscriptionsById.get(payment.subscriptionId);
      const member = subscription ? membersById.get(subscription.memberId) : undefined;
      return member ? [{
        paymentId: payment.id,
        memberId: member.id,
        memberName: member.name,
        amountFils: payment.amountFils,
        kind: payment.kind,
        method: payment.method,
        createdAt: payment.createdAt.toISOString(),
      }] : [];
    });

  return {
    totalMembers: members.length,
    activeMembers,
    endingSoon,
    endingWithin7Days,
    expiredSubscriptions,
    collectedFils,
    outstandingFils,
    monthlyCollectedFils,
    totalPaymentOperations: payments.length,
    newSubscriptionsThisMonth,
    monthlySeries,
    planDistribution,
    renewalRate,
    expiringSubscriptions,
    expiredSubscriptionAlerts,
    outstandingMembers,
    recentMembers,
    recentRenewals,
    recentPayments,
  };
}
