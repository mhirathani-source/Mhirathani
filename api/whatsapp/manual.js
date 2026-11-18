function normalizeWhatsAppPhone(raw) {
  let digits = String(raw ?? "").replace(/\D/g, "");
  if (digits.startsWith("00")) digits = digits.slice(2);
  if (digits.startsWith("0")) digits = `962${digits.slice(1)}`;
  if (digits.length < 8 || digits.length > 15) {
    throw new Error("رقم هاتف المشترك غير صالح لفتح WhatsApp");
  }
  return digits;
}

function buildManualWhatsAppLink(input) {
  const phone = normalizeWhatsAppPhone(input.phone);
  const values = {
    name: String(input.name ?? ""),
    plan: String(input.plan ?? ""),
    endDate: String(input.endDate ?? ""),
  };
  const message = String(input.template ?? "").replace(
    /\{\{(name|plan|endDate)\}\}/g,
    (_match, key) => values[key],
  );
  const url = new URL(`https://wa.me/${phone}`);
  url.searchParams.set("text", message);
  return { phone, message, url: url.href };
}

exports.normalizeWhatsAppPhone = normalizeWhatsAppPhone;
exports.buildManualWhatsAppLink = buildManualWhatsAppLink;
