import express from "express";

const databaseUrl = process.env.IRAQ_ALAMEER_DATABASE_URL?.trim();
if (!databaseUrl) {
  throw new Error("IRAQ_ALAMEER_DATABASE_URL is required for the Iraq Alameer API.");
}
if (process.env.DATABASE_URL && databaseUrl === process.env.DATABASE_URL) {
  throw new Error("The Iraq Alameer database must not use Prime's database URL.");
}

const rawPort = process.env.PORT;
if (!rawPort) throw new Error("PORT environment variable is required.");
const port = Number(rawPort);
if (!Number.isSafeInteger(port) || port <= 0) throw new Error("Invalid PORT value.");

// Select the new club's database and bootstrap email before loading modules
// that create the shared Drizzle client or initialize roles.
process.env.DATABASE_URL = databaseUrl;
process.env.CLUB_ADMIN_EMAIL = process.env.IRAQ_ALAMEER_ADMIN_EMAIL?.trim() ?? "";
process.env.IRAQ_INSTANCE = "1";

const [
  { default: apiApp },
  { logger },
  { initializeAccessModel },
  { initializeConfiguredOwner },
  { startWhatsAppReminderScheduler },
] = await Promise.all([
  import("./app"),
  import("./lib/logger"),
  import("./lib/accessSetup"),
  import("./lib/ownerRole"),
  import("./lib/whatsappScheduler"),
]);

await initializeAccessModel();

const serverApp = express();
serverApp.disable("x-powered-by");
serverApp.use("/iraq-alameer-club", apiApp);

serverApp.listen(port, () => {
  logger.info({ port }, "Iraq Alameer API listening");
  void initializeConfiguredOwner()
    .then((result) => logger.info(result, "Iraq Alameer owner initialization"))
    .catch(() => logger.warn("Iraq Alameer owner setup is pending"));
  startWhatsAppReminderScheduler();
});
