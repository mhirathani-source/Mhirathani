import assert from "node:assert/strict";
import test from "node:test";
import { buildClubDashboard } from "./dashboardMetrics";

const date = (value: string) => new Date(value);

test("dashboard metrics keep Jordan dates and existing payment balance semantics", () => {
  const dashboard = buildClubDashboard({
    today: "2026-11-16",
    members: [
      { id: 1, name: "هبة الحسن", phone: "0791111111", email: null, birthDate: null, notes: null, joinedAt: date("2026-11-15T10:00:00Z"), active: true },
      { id: 2, name: "خالد العجارمة", phone: "0782222222", email: null, birthDate: null, notes: null, joinedAt: date("2026-11-02T10:00:00Z"), active: true },
      { id: 3, name: "سلمى محمود", phone: "0773333333", email: null, birthDate: null, notes: null, joinedAt: date("2026-10-20T10:00:00Z"), active: true },
    ],
    subscriptions: [
      { id: 1, memberId: 1, planId: 1, priceFils: 100_000, discountFils: 0, startDate: "2026-10-20", endDate: "2026-11-18", status: "active", renewedFromId: null, createdAt: date("2026-10-20T10:00:00Z") },
      { id: 2, memberId: 2, planId: 2, priceFils: 200_000, discountFils: 10_000, startDate: "2026-11-01", endDate: "2026-11-23", status: "active", renewedFromId: null, createdAt: date("2026-11-01T10:00:00Z") },
      { id: 3, memberId: 3, planId: 1, priceFils: 50_000, discountFils: 0, startDate: "2026-10-01", endDate: "2026-11-15", status: "active", renewedFromId: null, createdAt: date("2026-10-01T10:00:00Z") },
      { id: 4, memberId: 3, planId: 1, priceFils: 150_000, discountFils: 0, startDate: "2026-11-16", endDate: "2026-12-15", status: "active", renewedFromId: 3, createdAt: date("2026-11-16T08:00:00Z") },
    ],
    payments: [
      { id: 1, subscriptionId: 1, amountFils: 25_000, kind: "payment", method: "cash", createdAt: date("2026-11-15T22:30:00Z") },
      { id: 2, subscriptionId: 3, amountFils: 20_000, kind: "payment", method: "cash", createdAt: date("2026-11-10T10:00:00Z") },
      { id: 3, subscriptionId: 1, amountFils: 5_000, kind: "refund", method: "cash", createdAt: date("2026-11-12T10:00:00Z") },
    ],
    transactions: [
      { kind: "income", amountFils: 5_000, transactionDate: "2026-11-15" },
      { kind: "expense", amountFils: 10_000, transactionDate: "2026-11-14" },
    ],
    plans: [
      { id: 1, name: "شهري" },
      { id: 2, name: "ثلاثة أشهر" },
    ],
  });

  assert.equal(dashboard.totalMembers, 3);
  assert.equal(dashboard.activeMembers, 3);
  assert.equal(dashboard.endingSoon, 1);
  assert.equal(dashboard.endingWithin7Days, 2);
  assert.equal(dashboard.expiredSubscriptions, 1);
  assert.equal(dashboard.totalPaymentOperations, 3);
  assert.equal(dashboard.monthlyCollectedFils, 45_000);
  assert.equal(dashboard.outstandingFils, 450_000);
  assert.equal(dashboard.monthlySeries.length, 6);
  assert.deepEqual(dashboard.monthlySeries.at(-1), {
    month: "2026-11",
    incomeFils: 45_000,
    expensesFils: 10_000,
    netFils: 35_000,
    newSubscriptions: 2,
  });
  assert.equal(dashboard.planDistribution[0]?.activeSubscriptions, 2);
  assert.equal(dashboard.renewalRate.eligibleSubscriptions, 1);
  assert.equal(dashboard.renewalRate.renewedSubscriptions, 1);
  assert.equal(dashboard.renewalRate.ratePercent, 100);
  assert.deepEqual(dashboard.expiringSubscriptions.map((row) => row.daysRemaining), [2, 7]);
  assert.equal(dashboard.expiredSubscriptionAlerts[0]?.memberName, "سلمى محمود");
  assert.equal(dashboard.outstandingMembers[0]?.memberId, 2);
  assert.equal(dashboard.recentRenewals[0]?.subscriptionId, 4);
  assert.equal(dashboard.recentPayments.length, 3);
});

test("renewal rate is unknown when no eligible subscriptions ended in the window", () => {
  const dashboard = buildClubDashboard({
    today: "2026-11-16",
    members: [],
    subscriptions: [],
    payments: [],
    transactions: [],
    plans: [],
  });

  assert.equal(dashboard.renewalRate.eligibleSubscriptions, 0);
  assert.equal(dashboard.renewalRate.ratePercent, null);
});
