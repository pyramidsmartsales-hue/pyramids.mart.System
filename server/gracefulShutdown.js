// server/gracefulShutdown.js
// Waits for the sheets queue to finish, saves local backup of APP_STATE and exits cleanly.

import { waitForQueueEmpty } from "./helpers/queue.js";
import { saveLocalBackup } from "./helpers/localBackup.js";
import { APP_STATE } from "./services/sheetsPersistWrapper.js";

export function installGracefulShutdown() {
  async function shutdown(signal) {
    console.log(`[shutdown] received ${signal} — waiting for queue to empty...`);

    try {
      // Wait up to 30s for queue to clear
      await waitForQueueEmpty(30000);
    } catch (e) {
      console.warn("[shutdown] waitForQueueEmpty threw:", e && e.message ? e.message : e);
    }

    try {
      // Save the current application state to local backup as a final step
      saveLocalBackup("last_state", APP_STATE);
      console.log("[shutdown] saved last_state backup");
    } catch (e) {
      console.error("[shutdown] failed to save backup:", e && e.message ? e.message : e);
    }

    console.log("[shutdown] exiting process");
    process.exit(0);
  }

  process.on("SIGINT", () => shutdown("SIGINT"));
  process.on("SIGTERM", () => shutdown("SIGTERM"));

  process.on("uncaughtException", (err) => {
    console.error("[shutdown] uncaughtException:", err && err.stack ? err.stack : err);
    try {
      saveLocalBackup("last_state", APP_STATE);
      console.log("[shutdown] saved last_state after uncaughtException");
    } catch (e) {
      console.warn("[shutdown] failed to save after uncaughtException:", e && e.message ? e.message : e);
    }
    setTimeout(() => process.exit(1), 1000);
  });

  process.on("unhandledRejection", (reason) => {
    console.error("[shutdown] unhandledRejection:", reason);
    try {
      saveLocalBackup("last_state", APP_STATE);
    } catch (e) {}
    setTimeout(() => process.exit(1), 1000);
  });

  console.log("[shutdown] graceful shutdown handlers installed");
}
