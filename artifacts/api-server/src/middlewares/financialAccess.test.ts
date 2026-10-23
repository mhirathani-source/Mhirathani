import { strict as assert } from "node:assert";
import { test } from "node:test";
import type { Request, Response } from "express";
import { financialAccess, isOperationalRoute } from "./financialAccess";

const sensitive = [
  "/finance/transactions", "/finance/categories", "/finance/cash-movements",
  "/finance/reports/summary", "/reports", "/revenue", "/expenses",
  "/memberships/financials", "/club/finance/report", "/club/finance/transactions",
  "/club/finance/categories", "/club/dashboard", "/club/payroll", "/club/employees",
  "/club/payroll/1/pay", "/club/cash-movements", "/plans", "/plans/1",
  "/subscriptions", "/subscriptions/1", "/subscriptions/1/payments",
  "/subscriptions/1/action", "/payments/1/receipt",
  "/members/1/whatsapp-reminders", "/members/1/whatsapp-reminder",
  "/club/whatsapp/settings", "/future-financial-export",
];
test("all money-bearing and unreviewed endpoints are denied by default", () => {
  for (const path of sensitive) for (const method of ["GET", "HEAD", "POST", "PATCH", "PUT", "DELETE"]) {
    assert.equal(isOperationalRoute(method, path), false, `${method} ${path}`);
  }
});
test("only explicit non-financial operations are allowed for staff", () => {
  for (const [method, path] of [["GET", "/members"], ["POST", "/members"], ["PATCH", "/members/1"], ["GET", "/members/1/profile"], ["GET", "/club/overview"], ["GET", "/club/session"]]) assert.equal(isOperationalRoute(method, path), true);
  for (const path of ["/members/1/profile/export", "/members/1/financials", "/members/1/profile%2F..", "/members//profile"]) assert.equal(isOperationalRoute("GET", path), false);
  assert.equal(isOperationalRoute("DELETE", "/members/1"), false);
  assert.equal(isOperationalRoute("GET", "/members/1"), false);
});
test("server uses authenticated database role, never a client-supplied role", () => {
  for (const role of ["staff", "coach", "member", undefined]) {
    let status = 200; let allowed = false; let body: unknown;
    financialAccess({ method: "GET", path: "/finance/transactions", clubUser: role ? { role } : undefined, body: { role: "admin" }, headers: { "x-role": "admin" } } as unknown as Request,
      { status(code: number) { status = code; return this; }, json(value: unknown) { body = value; } } as Response, () => { allowed = true; });
    assert.equal(status, 403); assert.equal(allowed, false);
    assert.deepEqual(body, { error: "ليس لديك صلاحية - Access Denied", code: "ADMIN_REQUIRED" });
  }
  let allowed = false;
  financialAccess({ method: "GET", path: "/finance/transactions", clubUser: { role: "admin" } } as Request, {} as Response, () => { allowed = true; });
  assert.equal(allowed, true);
});
