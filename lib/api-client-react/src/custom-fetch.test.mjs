import assert from "node:assert/strict";
import test from "node:test";
import { ApiUnexpectedResponseError, customFetch } from "./custom-fetch.ts";

test("API redirects are rejected instead of being returned as successful HTML data", async () => {
  const originalFetch = globalThis.fetch;
  let requestOptions;
  globalThis.fetch = async (_input, options) => {
    requestOptions = options;
    const response = new Response("<html>Replit Shield</html>", {
      status: 200,
      headers: { "Content-Type": "text/html; charset=utf-8" },
    });
    Object.defineProperty(response, "redirected", { value: true });
    return response;
  };

  try {
    await assert.rejects(
      customFetch("/api/club/dashboard"),
      (error) => error instanceof ApiUnexpectedResponseError
        && error.reason === "redirect"
        && error.url === "/api/club/dashboard",
    );
    assert.equal(requestOptions.credentials, "same-origin");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("successful HTML API responses are surfaced as protocol errors", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response("<html>access page</html>", {
    status: 200,
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });

  try {
    await assert.rejects(
      customFetch("https://prime.example/api/club/finance/report"),
      (error) => error instanceof ApiUnexpectedResponseError
        && error.reason === "html",
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("unfollowed API 307 responses are surfaced as access redirects", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response("", {
    status: 307,
    headers: { Location: "https://replit.com/__replshield" },
  });

  try {
    await assert.rejects(
      customFetch("/api/club/dashboard"),
      (error) => error instanceof ApiUnexpectedResponseError
        && error.reason === "redirect"
        && error.status === 307,
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});
