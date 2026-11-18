import app from "./app";
import { logger } from "./lib/logger";
import { initializeConfiguredOwner } from "./lib/ownerRole";
import { initializeAccessModel } from "./lib/accessSetup";

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

await initializeAccessModel();
app.listen(port, (err) => {
  if (err) {
    logger.error({ err }, "Error listening on port");
    process.exit(1);
  }

  logger.info({ port }, "Server listening");
  void initializeConfiguredOwner().then(result => logger.info(result, "Owner role initialization"))
    .catch(() => logger.warn("Owner role initialization unavailable; no role changes assumed"));
});
