// server/services/whatsapp.service.js (UPDATED)
// Improvements applied:
// 1. Robust re-initialization when disconnected: create a NEW Client instance instead
//    of calling initialize() on a destroyed client. This avoids race conditions.
// 2. Centralized handler registration (registerHandlers) so re-created clients get the
//    same handlers bound automatically.
// 3. Logs the LocalAuth storage path and checks if session folder exists to help
//    debug ephemeral filesystems (Docker volumes, cloud hosts).
// 4. Exports a consistent API: initWhatsApp(io, opts) -> { router, getClient, getLastQrDataUrl }

import express from "express";
import qrcode from "qrcode";
import { Client, LocalAuth, MessageMedia } from "whatsapp-web.js";
import fs from "fs";
import path from "path";

let client = null;
let lastQr = null;
let ready = false;
let authStrategy = null;

function createAuthStrategy(clientId = "pyramids-mart") {
  // LocalAuth will store session data under a folder in the user data directory
  // e.g. ./whatsapp-local-auth/<clientId> or .wwebjs_auth under current working dir.
  return new LocalAuth({ clientId });
}

function logAuthPathIfPossible(auth) {
  try {
    // LocalAuth stores data in a folder. We attempt to discover the path (best-effort).
    // This relies on internal behavior of the library so we guard with try/catch.
    const baseDir = process.cwd();
    const possible = [
      path.join(baseDir, ".wwebjs_auth"),
      path.join(baseDir, "whatsapp-local-auth"),
      // LocalAuth sometimes places under node_modules/.local or visible via auth object
    ];

    possible.forEach((p) => {
      if (fs.existsSync(p)) {
        console.log(`[WA] LocalAuth session folder exists: ${p}`);
      }
    });
  } catch (e) {
    // don't fail startup for this
  }
}

function registerHandlers(io) {
  if (!client) return;

  client.on("qr", async (qr) => {
    try {
      lastQr = qr;
      const dataUrl = await qrcode.toDataURL(qr);
      if (io && io.emit) io.emit("whatsapp:qr", { qrDataUrl: dataUrl });
      console.log("[WA] QR generated");
    } catch (err) {
      console.error("[WA] QR -> DataURL error", err);
    }
  });

  client.on("ready", () => {
    ready = true;
    lastQr = null;
    console.log("[WA] Client ready");
    if (io && io.emit) io.emit("whatsapp:status", { connected: true });
  });

  client.on("authenticated", (session) => {
    console.log("[WA] Authenticated");
    if (io && io.emit) io.emit("whatsapp:status", { connected: true });
  });

  client.on("auth_failure", (msg) => {
    console.error("[WA] Auth failure", msg);
    ready = false;
    if (io && io.emit) io.emit("whatsapp:status", { connected: false, error: msg });
  });

  client.on("change_state", (state) => {
    if (io && io.emit) io.emit("whatsapp:change_state", state);
  });

  client.on("disconnected", async (reason) => {
    console.warn("[WA] Disconnected", reason);
    ready = false;
    if (io && io.emit) io.emit("whatsapp:status", { connected: false, reason });

    // Destroy existing client and create a fresh one after a short delay.
    // This avoids re-using a destroyed client instance which can cause errors.
    try {
      await client.destroy();
    } catch (e) {
      console.warn("[WA] client.destroy() threw:", e);
    }

    // Small delay to let resources clear
    setTimeout(() => {
      try {
        console.log('[WA] Recreating client after disconnect...');
        // Recreate auth strategy and client
        authStrategy = createAuthStrategy(authStrategy?.options?.clientId || "pyramids-mart");
        startClient(io);
      } catch (err) {
        console.error('[WA] Failed to recreate client:', err);
      }
    }, 2500);
  });
}

function startClient(io, opts = {}) {
  // ensure we replace any previous client variable
  client = new Client({
    authStrategy: authStrategy,
    takeoverOnConflict: true,
    puppeteer: opts.puppeteer || {
      headless: true,
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
    },
  });

  // register handlers for new client
  registerHandlers(io);

  client
    .initialize()
    .then(() => {
      console.log('[WA] client.initialize() resolved');
    })
    .catch((err) => {
      console.error('[WA] initialization error:', err);
    });

  return client;
}

export function initWhatsApp(io = null, opts = {}) {
  const router = express.Router();

  // prepare auth strategy and start client
  authStrategy = createAuthStrategy(opts.clientId || "pyramids-mart");
  logAuthPathIfPossible(authStrategy);
  startClient(io, opts);

  // --- helper: return qr as data URL (if lastQr exists)
  async function getLastQrDataUrl() {
    if (!lastQr) return null;
    try {
      const dataUrl = await qrcode.toDataURL(lastQr);
      return dataUrl;
    } catch (e) {
      console.error("[WA] qr to data url error", e);
      return null;
    }
  }

  // --- Express endpoints ---
  router.get('/status', (req, res) => {
    res.json({ ok: true, connected: !!ready, clientInitialized: !!client });
  });

  router.get('/qr', async (req, res) => {
    try {
      const dataUrl = await getLastQrDataUrl();
      res.json({ ok: true, qr: dataUrl });
    } catch (err) {
      res.status(500).json({ ok: false, error: err.message });
    }
  });

  router.post('/send', async (req, res) => {
    try {
      if (!client) return res.status(500).json({ ok: false, error: 'WhatsApp client not initialized' });
      if (!ready) return res.status(503).json({ ok: false, error: 'WhatsApp not connected (scan QR first)' });

      const { to, message } = req.body || {};
      if (!to || !message) return res.status(400).json({ ok: false, error: 'to and message required' });

      const normalized = String(to).replace(/\s+/g, '');
      const chatId = normalized.includes('@') ? normalized : (normalized.startsWith('+') ? normalized.slice(1) : normalized) + '@c.us';

      const sent = await client.sendMessage(chatId, message);
      res.json({ ok: true, result: sent });
    } catch (err) {
      console.error('wa send error', err);
      res.status(500).json({ ok: false, error: err.message || String(err) });
    }
  });

  router.post('/send-media', async (req, res) => {
    try {
      if (!client) return res.status(500).json({ ok: false, error: 'WhatsApp client not initialized' });
      if (!ready) return res.status(503).json({ ok: false, error: 'WhatsApp not connected' });

      const { to, base64, filename, caption } = req.body || {};
      if (!to || !base64 || !filename) return res.status(400).json({ ok: false, error: 'to, base64 and filename required' });

      const normalized = String(to).replace(/\s+/g, '');
      const chatId = normalized.includes('@') ? normalized : (normalized.startsWith('+') ? normalized.slice(1) : normalized) + '@c.us';

      let rawBase64 = base64;
      const m = base64.match(/^data:(.+);base64,(.*)$/);
      if (m) rawBase64 = m[2];

      const buffer = Buffer.from(rawBase64, 'base64');
      const media = new MessageMedia('', buffer.toString('base64'), filename);
      const sent = await client.sendMessage(chatId, media, { caption: caption || '' });
      res.json({ ok: true, result: sent });
    } catch (err) {
      console.error('wa send-media error', err);
      res.status(500).json({ ok: false, error: err.message || String(err) });
    }
  });

  // Expose helper to get client instance (may be null)
  function getClient() {
    return client;
  }

  return { router, getClient, getLastQrDataUrl };
}
