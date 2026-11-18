import assert from "node:assert/strict";
import test from "node:test";
import {
  dashboardClientErrorSchema,
  sanitizeDashboardDiagnostic,
} from "./dashboardClientError.ts";

test("dashboard diagnostics keep source locations while redacting credentials and identifiers", () => {
  const stack = [
    "TypeError: failed for member 0791234567",
    "at DashboardPage (https://prime.example/assets/DashboardPage.js?token=eyJabcdefghijklmno:40:12)",
    "contact owner@example.com",
  ].join("\n");

  const result = sanitizeDashboardDiagnostic(stack, 8_000);

  assert.match(result, /DashboardPage\.js/);
  assert.match(result, /:40:12/);
  assert.doesNotMatch(result, /0791234567/);
  assert.doesNotMatch(result, /owner@example\.com/);
  assert.doesNotMatch(result, /token=eyJ/);
});

test("dashboard diagnostics reject paths outside the dashboard", () => {
  const result = dashboardClientErrorSchema.safeParse({
    name: "TypeError",
    message: "failed",
    stack: "",
    componentStack: "",
    pathname: "/finance",
  });

  assert.equal(result.success, false);
});
