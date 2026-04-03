require("dotenv/config");
const app = require("./app");
const env = require("./config/env");
const logger = require("./config/logger");

const server = app.listen(env.port, () => {
  logger.info(`API running on http://localhost:${env.port}`);
});

function shutdown(signal) {
  logger.info(`${signal} received, shutting down`);
  server.close(() => process.exit(0));
}

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));
