export function normalizeWhatsAppPhone(rawPhone: string | null | undefined): string | null {
  if (!rawPhone?.trim()) return null;

  let digits = rawPhone.replace(/\D/g, "");
  if (digits.startsWith("00")) {
    digits = digits.slice(2);
  } else if (/^0?7\d{8}$/.test(digits)) {
    digits = `962${digits.replace(/^0/, "")}`;
  } else if (!rawPhone.trim().startsWith("+") && !digits.startsWith("962")) {
    return null;
  }

  return /^[1-9]\d{7,14}$/.test(digits) ? digits : null;
}

export function buildWhatsAppReminderMessage(memberName: string): string {
  return `مرحبًا ${memberName}، نذكّرك بمتابعة اشتراكك في أكاديمية برايم للملاكمة. يسعدنا مساعدتك في التجديد أو الاستفسار.`;
}

export function buildWhatsAppChatUrl(
  phone: string | null | undefined,
  message: string,
): string | null {
  const normalizedPhone = normalizeWhatsAppPhone(phone);
  if (!normalizedPhone) return null;

  return `https://wa.me/${normalizedPhone}?text=${encodeURIComponent(message)}`;
}
