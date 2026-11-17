import assert from "node:assert/strict";
import { test } from "node:test";
import { buildWhatsAppChatUrl, normalizeWhatsAppPhone } from "../src/whatsappLink.ts";

test("builds an ordinary WhatsApp link for a Jordanian local number", () => {
  assert.equal(
    buildWhatsAppChatUrl("0791234567", "رسالة جاهزة"),
    "https://wa.me/962791234567?text=%D8%B1%D8%B3%D8%A7%D9%84%D8%A9%20%D8%AC%D8%A7%D9%87%D8%B2%D8%A9",
  );
});

test("accepts international numbers and rejects ambiguous local numbers", () => {
  assert.equal(normalizeWhatsAppPhone("+962 7 9123 4567"), "962791234567");
  assert.equal(normalizeWhatsAppPhone("0044 7700 900123"), "447700900123");
  assert.equal(normalizeWhatsAppPhone("079123456"), null);
  assert.equal(normalizeWhatsAppPhone(""), null);
});
