import { strict as assert } from "node:assert";
import { randomUUID } from "node:crypto";
import { test } from "node:test";
import { and, eq } from "drizzle-orm";
import {
  db, membersTable, paymentsTable, plansTable, subscriptionsTable,
} from "@workspace/db";
import { buildMemberSearch } from "./membership";

test("same-phone members remain independent and exact phone search returns every match", async () => {
  const rollback = Symbol("rollback test fixture");
  const suffix = randomUUID();
  const phone = `079${suffix.replace(/\D/g, "").slice(0, 7).padEnd(7, "0")}`;
  const day = "2026-01-01";

  await assert.rejects(db.transaction(async (trx) => {
    const [first, second] = await trx.insert(membersTable).values([
      { name: `Test sibling A ${suffix}`, phone },
      { name: `Test sibling B ${suffix}`, phone },
    ]).returning();
    assert.notEqual(first.id, second.id);

    const search = buildMemberSearch(`079 (${phone.slice(3, 6)}) ${phone.slice(6)}`);
    assert.equal(search.exactPhone, true);
    const matches = await trx.select().from(membersTable).where(search.condition).orderBy(membersTable.id);
    assert.deepEqual(matches.map((member) => member.id), [first.id, second.id]);

    const [plan] = await trx.insert(plansTable).values({
      name: `Test plan ${suffix}`, durationDays: 30, priceFils: 35000,
    }).returning();
    const [firstSubscription, secondSubscription] = await trx.insert(subscriptionsTable).values([
      { memberId: first.id, planId: plan.id, priceFils: 35000, startDate: day, endDate: "2026-01-30" },
      { memberId: second.id, planId: plan.id, priceFils: 90000, startDate: day, endDate: "2026-01-30" },
    ]).returning();
    await trx.insert(paymentsTable).values([
      { subscriptionId: firstSubscription.id, amountFils: 12000, method: "cash", receiptNumber: `TEST-${suffix}-A`, createdBy: "integration-test" },
      { subscriptionId: secondSubscription.id, amountFils: 23000, method: "card", receiptNumber: `TEST-${suffix}-B`, createdBy: "integration-test" },
    ]);

    await trx.update(membersTable).set({ name: "Updated sibling A" }).where(eq(membersTable.id, first.id));
    const [unchanged] = await trx.select().from(membersTable).where(eq(membersTable.id, second.id));
    assert.equal(unchanged.name, `Test sibling B ${suffix}`);
    assert.equal((await trx.select().from(subscriptionsTable).where(eq(subscriptionsTable.memberId, first.id))).length, 1);
    assert.equal((await trx.select().from(subscriptionsTable).where(eq(subscriptionsTable.memberId, second.id))).length, 1);

    const firstPayments = await trx.select({ id: paymentsTable.id }).from(paymentsTable)
      .innerJoin(subscriptionsTable, eq(paymentsTable.subscriptionId, subscriptionsTable.id))
      .where(and(eq(subscriptionsTable.memberId, first.id), eq(paymentsTable.amountFils, 12000)));
    const secondPayments = await trx.select({ id: paymentsTable.id }).from(paymentsTable)
      .innerJoin(subscriptionsTable, eq(paymentsTable.subscriptionId, subscriptionsTable.id))
      .where(and(eq(subscriptionsTable.memberId, second.id), eq(paymentsTable.amountFils, 23000)));
    assert.equal(firstPayments.length, 1);
    assert.equal(secondPayments.length, 1);

    throw rollback;
  }), (error) => error === rollback);
});
