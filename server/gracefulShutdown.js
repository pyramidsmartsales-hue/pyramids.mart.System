// server/gracefulShutdown.js
// ESM version — dynamic import for helpers/queue.js and robust graceful shutdown.

import { saveLocalBackup } from "./helpers/localBackup.js";
import { APP_STATE } from "./services/sheetsPersistWrapper.js";

/**
 * installGracefulShutdown(options)
 * options:
 *  - shutdownTimeout: number ms to wait for the queue (default 30000)
 */
export function installGracefulShutdown({ shutdownTimeout = 30000 } = {}) {
  let isShuttingDown = false;

  async function tryWaitForQueueEmpty(timeoutMs) {
    try {
      // dynamic import: if helpers/queue.js doesn't exist, skip waiting
      const mod = await import("./helpers/queue.js").catch(() => null);
      if (!mod) {
        console.log("[shutdown] helpers/queue.js not found — skipping queue wait");
        return false;
      }

      const waitForQueueEmptyFn = mod.waitForQueueEmpty || mod.default || null;
      if (typeof waitForQueueEmptyFn !== "function") {
        console.log("[shutdown] waitForQueueEmpty not exported by helpers/queue.js — skipping");
        return false;
      }

      // race between waiting and a timeout
      const start = Date.now();
      await Promise.race([
        waitForQueueEmptyFn(timeoutMs),
        new Promise((_, rej) => setTimeout(() => rej(new Error("waitForQueueEmpty timeout")), timeoutMs))
      ]);
      console.log(`[shutdown] waitForQueueEmpty finished in ${Date.now() - start}ms`);
      return true;
    } catch (err) {
      console.warn("[shutdown] error during waitForQueueEmpty (continuing):", err.message || err);
      return false;
    }
  }

  async function doBackupSafe() {
    try {
      if (typeof saveLocalBackup === "function") {
        console.log("[shutdown] saving local backup...");
        await Promise.resolve(saveLocalBackup(APP_STATE));
        console.log("[shutdown] saved last_state backup");
      } else {
        console.warn("[shutdown] saveLocalBackup is not a function — skipping backup");
      }
    } catch (err) {
      console.warn("[shutdown] failed to save local backup:", err.message || err);
    }
  }

  async function shutdown(signal) {
    if (isShuttingDown) {
      console.log("[shutdown] already shutting down — ignoring further signal", signal);
      return;
    }
    isShuttingDown = true;
    console.log(`[shutdown] received ${signal} — starting graceful shutdown sequence`);

    // 1) wait for queue if possible
    try {
      await tryWaitForQueueEmpty(shutdownTimeout);
    } catch (err) {
      console.warn("[shutdown] error waiting for queue:", err.message || err);
    }

    // 2) save backup
    await doBackupSafe();

    // 3) short delay to allow logs to flush, then exit
    console.log("[shutdown] completed tasks, exiting...");
    setTimeout(() => {
      try {
        process.exit(0);
      } catch (e) {}
    }, 200);
  }

  // register system signals
  process.on("SIGINT", () => shutdown("SIGINT"));
  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGHUP", () => shutdown("SIGHUP"));
  process.on("uncaughtException", (err) => {
    console.error("[shutdown] uncaughtException:", err.stack || err);
    shutdown("uncaughtException");
  });
  process.on("unhandledRejection", (reason) => {
    console.error("[shutdown] unhandledRejection:", reason);
    shutdown("unhandledRejection");
  });

  return { shutdown, isShuttingDown: () => isShuttingDown };
}

export default installGracefulShutdown;
