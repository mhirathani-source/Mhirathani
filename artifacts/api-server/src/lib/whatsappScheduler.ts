import { logger } from "./logger";
import { ensureDefaultWhatsAppTemplates, runWhatsAppReminderBatch } from "./whatsapp";

let started = false;

export function startWhatsAppReminderScheduler() {
  if (started) return;
  started = true;
  void ensureDefaultWhatsAppTemplates().catch((error) => logger.error({ error }, "WhatsApp template setup failed"));
  const run = () => void runWhatsAppReminderBatch().catch((error) => logger.error({ error }, "WhatsApp reminder scheduler failed"));
  run();
  const timer = setInterval(run, 60_000);
  timer.unref();
  logger.info("WhatsApp reminder scheduler started; sending remains disabled until configured");
}
