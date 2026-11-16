import { strict as assert } from "node:assert";
import { test } from "node:test";
import { CreateMemberBody, CreateMemberResponse, CreateSubscriptionBody, UpdateSubscriptionBody } from "@workspace/api-zod";
import { addCalendarDays, buildMemberSearch, memberSearchLimit, MembershipError, normalizedMemberBody, validCalendarDate } from "./membership";

test("calendar validation rejects rollover, timestamps and non-calendar input", () => {
  assert.equal(validCalendarDate("2024-02-29"), true);
  for (const value of ["2025-02-29", "2026-02-31", "2026-13-01", "2026-00-01", "", null, "2026-01-01T00:00:00Z"]) {
    assert.equal(validCalendarDate(value), false);
  }
  assert.equal(addCalendarDays("2024-02-28", 1), "2024-02-29");
  assert.equal(addCalendarDays("2026-12-31", 1), "2027-01-01");
});

test("member validation trims text, normalizes phone and explicitly clears optional fields", () => {
  assert.deepEqual(normalizedMemberBody({ name: "  اسم المشترك  ", phone: "+962 (790) 000-001", email: " ", notes: "", birthDate: null, active: false }), {
    name: "اسم المشترك", phone: "+962790000001", email: null, notes: null, birthDate: null, active: false,
  });
  assert.deepEqual(normalizedMemberBody({ active: false }), { active: false });
  for (const body of [{ phone: "-------" }, { phone: "+962invalid" }, { birthDate: "2026-02-31" }, { birthDate: "2999-01-01" }]) {
    assert.throws(() => normalizedMemberBody(body), MembershipError);
  }
  assert.equal(CreateMemberBody.safeParse(normalizedMemberBody({ name: "  ", phone: "0790000001" })).success, false);
});

test("member phone search normalizes formatting and distinguishes full numbers", () => {
  assert.equal(buildMemberSearch("079 (123)-4567").exactPhone, true);
  assert.equal(buildMemberSearch("079 123").exactPhone, false);
  assert.equal(memberSearchLimit("079 (123)-4567", 1), undefined);
  assert.equal(memberSearchLimit("079 123", 1), 1);
});

test("member calendar field survives response validation without timestamp conversion", () => {
  const input = CreateMemberBody.parse({ name: "اختبار", phone: "0790000001", birthDate: "2001-02-03" });
  assert.equal(input.birthDate, "2001-02-03");
  const response = CreateMemberResponse.parse({ ...input, id: 123, joinedAt: new Date(), active: true });
  assert.equal(response.birthDate, "2001-02-03");
  assert.equal(CreateMemberResponse.parse({ ...response, birthDate: null }).birthDate, null);
});

test("subscription contracts keep date-only strings and reject invalid amounts", () => {
  const data = CreateSubscriptionBody.parse({ memberId: 1, planId: 1, startDate: "2026-10-23", initialPaymentFils: 1000 });
  assert.equal(data.startDate, "2026-10-23");
  assert.equal(CreateSubscriptionBody.safeParse({ ...data, initialPaymentFils: -1 }).success, false);
  assert.equal(UpdateSubscriptionBody.safeParse({ planId: 1, startDate: "2026-10-23", endDate: "2026-11-21", priceFils: 2_000_000_001 }).success, false);
  assert.equal(UpdateSubscriptionBody.safeParse({}).success, false);
});
