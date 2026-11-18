export function normalizeWhatsAppPhone(raw: string): string;
export function buildManualWhatsAppLink(input: {
  phone: string;
  name: string;
  plan: string;
  endDate: string;
  template: string;
}): { phone: string; message: string; url: string };
