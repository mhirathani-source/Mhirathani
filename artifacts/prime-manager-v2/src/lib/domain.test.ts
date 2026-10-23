import { strict as assert } from "node:assert";
import { test } from "node:test";
import { PLANS, addDays, addMonths, diffDays, endFor, fmtMoney, isValidDate, parseJd, reminderKind, renderTemplate, seedData, seedEmployees, statusOf, validateMember } from "./domain";

test("demo seed has ten unique Jordanian members and reconciled integer-fils income", () => {
  const { members, txs } = seedData("2026-10-23");
  assert.equal(members.length, 10);
  assert.deepEqual(members.map(m => m.code), Array.from({ length: 10 }, (_, i) => `PB-${String(i + 1).padStart(3, "0")}`));
  assert.equal(new Set(members.map(m => m.phone)).size, 10);
  assert.equal(members.every(m => /^07\d{8}$/.test(m.phone)), true);
  assert.deepEqual(new Set(members.map(m => statusOf(m, "2026-10-23"))), new Set(["active", "soon", "expired"]));
  assert.equal(txs.filter(t => t.type === "income").reduce((n, t) => n + t.amount, 0), 860000);
  assert.equal(txs.filter(t => t.type === "expense").reduce((n, t) => n + t.amount, 0), 165750);
  assert.equal(members.every(m => txs.some(t => t.label.includes(m.code) && t.amount === PLANS[m.planId].price)), true);
  assert.deepEqual(seedEmployees().map(e => e.role), ["admin", "staff"]);
});

test("calendar dates and inclusive plan ends respect leap years and month lengths", () => {
  assert.equal(isValidDate("2024-02-29"), true);
  assert.equal(isValidDate("2026-02-29"), false);
  assert.equal(isValidDate("2026-13-01"), false);
  assert.equal(addDays("2026-12-31", 1), "2027-01-01");
  assert.equal(addMonths("2026-01-31", 1), "2026-02-28");
  assert.equal(endFor("2026-10-23", "monthly"), "2026-11-22");
  assert.equal(endFor("2026-10-23", "quarterly"), "2027-01-22");
  assert.equal(endFor("2026-10-23", "semiannual"), "2027-04-22");
  assert.equal(diffDays("2026-10-25", "2026-10-23"), 2);
  for (const transient of ["", "20270-03-01", "2026-02-30", "9999-12-31"]) {
    assert.equal(endFor(transient, "semiannual"), "");
  }
});

test("member validation rejects bad and duplicate phones while allowing unchanged edit", () => {
  const { members } = seedData("2026-10-23");
  const first = members[0];
  const input = { name: first.name, phone: first.phone, planId: first.planId, start: first.start };
  assert.ok(validateMember(input, members).phone);
  assert.deepEqual(validateMember(input, members, first.id), {});
  assert.ok(validateMember({ ...input, phone: "123" }, []).phone);
  assert.ok(validateMember({ ...input, start: "2026-02-30" }, []).start);
  assert.ok(validateMember({ ...input, name: " " }, []).name);
});

test("reminder eligibility and template substitutions use the actual member and date", () => {
  const today = "2026-10-23";
  const { members } = seedData(today);
  assert.equal(reminderKind(members[2], today), "قبل يومين من الانتهاء");
  assert.equal(reminderKind(members[3], today), "يوم الانتهاء");
  assert.equal(reminderKind(members[0], today), null);
  assert.equal(reminderKind({ ...members[2], pausedOn: today }, today), null);
  assert.equal(renderTemplate("{الاسم} {الكود} {تاريخ_الانتهاء}", members[2], today), `${members[2].name} PB-003 2026-10-25`);
});

test("Jordanian currency parsing rejects non-finite, fractional fils and unsafe integers", () => {
  assert.equal(parseJd("35"), 35000);
  assert.equal(parseJd("28.500"), 28500);
  assert.equal(fmtMoney(17250), "17.25 د.أ");
  for (const value of ["Infinity", "-1", "1.2345", "1e20", "9999999999999999999999999999999"]) assert.equal(parseJd(value), null);
});
