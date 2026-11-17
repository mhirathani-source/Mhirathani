import { logger } from "./logger";

let started = false;

export function startWhatsAppReminderScheduler() {
  if (started) return;
  started = true;
  logger.info("Automatic WhatsApp sending is disabled; manual chat links are active");
}
