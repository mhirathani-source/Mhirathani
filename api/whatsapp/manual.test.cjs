const { test } = require("node:test");
const assert = require("node:assert/strict");
const {
  buildManualWhatsAppLink,
  normalizeWhatsAppPhone,
} = require("./manual.js");

test("normalizes Jordanian mobile numbers to international WhatsApp format", () => {
  assert.equal(normalizeWhatsAppPhone("07946 41874"), "962794641874");
  assert.equal(normalizeWhatsAppPhone("+962 79 464 1874"), "962794641874");
  assert.equal(normalizeWhatsAppPhone("00962 79 464 1874"), "962794641874");
});

test("rejects phone numbers that cannot safely identify a chat", () => {
  assert.throws(() => normalizeWhatsAppPhone("not a phone"), /غير صالح/);
  assert.throws(() => normalizeWhatsAppPhone("123"), /غير صالح/);
  assert.throws(() => normalizeWhatsAppPhone("123456789012345678"), /غير صالح/);
});

test("builds an encoded click-to-chat URL and fills only named placeholders", () => {
  const result = buildManualWhatsAppLink({
    phone: "0794641874",
    name: "محمد أحمد",
    plan: "اشتراك شهري",
    endDate: "2026-12-31",
    template: "مرحبًا {{name}}، ينتهي {{plan}} في {{endDate}}.",
  });
  const url = new URL(result.url);
  assert.equal(url.origin, "https://wa.me");
  assert.equal(url.pathname, "/962794641874");
  assert.equal(url.searchParams.get("text"), "مرحبًا محمد أحمد، ينتهي اشتراك شهري في 2026-12-31.");
  assert.equal(result.message, url.searchParams.get("text"));
  assert.doesNotMatch(result.message, /\{\{(?:name|plan|endDate)\}\}/);
});
