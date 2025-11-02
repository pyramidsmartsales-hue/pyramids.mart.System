// server/services/whatsappWeb.js
// WhatsApp Web integration using whatsapp-web.js + LocalAuth.
// Exports: initWhatsApp(io, options) -> returns { router, client, getLastQrDataUrl }
// - router: express router with endpoints for status, qr, send
// - client: whatsapp client instance (useful for advanced usage)
// - getLastQrDataUrl: function to get latest QR data URL

import express from "express";
import qrcode from "qrcode";
import { Client, LocalAuth, MessageMedia } from "whatsapp-web.js";
import fs from "fs";
import path from "path";

let lastQr = null;
let client = null;
let ready = false;

/**
 * initWhatsApp(io, opts)
 * - io: Socket.IO server instance (optional) — used to emit 'whatsapp:qr' and 'whatsapp:status'
 * - opts: { puppeteer?: object } optional puppeteer args
 */
export function initWhatsApp(io = null, opts = {}) {
  const router = express.Router();

  // create client using LocalAuth (stores session in ./session or default path)
  const authStrategy = new LocalAuth({
    clientId: "pyramids-mart" // folder per-client, change if multiple instances
  });

  client = new Client({
    authStrategy,
    takeoverOnConflict: true,
    puppeteer: opts.puppeteer || {
      headless: true,
      args: ["--no-sandbox", "--disable-setuid-sandbox"]
    }
  });

  client.on("qr", async (qr) => {
    // save last QR and emit to socket if present
    try {
      lastQr = qr;
      const dataUrl = await qrcode.toDataURL(qr);
      if (io && io.emit) io.emit("whatsapp:qr", { qrDataUrl: dataUrl });
      console.log("[WA] QR generated (emitted via socket)");
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

  client.on("disconnected", (reason) => {
    console.warn("[WA] Disconnected", reason);
    ready = false;
    if (io && io.emit) io.emit("whatsapp:status", { connected: false, reason });
    // try to destroy and reinitialize cleanly
    try {
      client.destroy();
    } catch (e) {}
    // re-init after small delay
    setTimeout(() => {
      try { client.initialize(); } catch (e) { console.error("[WA] re-init failed", e); }
    }, 3000);
  });

  client.on("change_state", (state) => {
    // optionally emit state changes
    if (io && io.emit) io.emit("whatsapp:change_state", state);
  });

  client.initialize().catch(err => {
    console.error("[WA] initialization error:", err);
  });

  // helper: return qr as data URL (if lastQr exists)
  async function getLastQrDataUrl() {
    if (!lastQr) return null;
    try {
      const dataUrl = await qrcode.toDataURL(lastQr);
      return dataUrl;
    } catch (e) {
      console.error("qr to data url error", e);
      return null;
    }
  }

  // --- Express endpoints ---

  // GET /api/whatsapp-web/status
  router.get("/status", (req, res) => {
    res.json({ ok: true, connected: !!ready, clientInitialized: !!client });
  });

  // GET /api/whatsapp-web/qr  -> returns { ok, qrDataUrl }
  router.get("/qr", async (req, res) => {
    try {
      const dataUrl = await getLastQrDataUrl();
      res.json({ ok: true, qr: dataUrl });
    } catch (err) {
      res.status(500).json({ ok: false, error: err.message });
    }
  });

  /**
   * POST /api/whatsapp-web/send
   * body: { to: "+2547...", message: "text" }
   */
  router.post("/send", async (req, res) => {
    try {
      if (!client) return res.status(500).json({ ok: false, error: "WhatsApp client not initialized" });
      if (!ready) return res.status(503).json({ ok: false, error: "WhatsApp not connected (scan QR first)" });

      const { to, message } = req.body || {};
      if (!to || !message) return res.status(400).json({ ok: false, error: "to and message required" });

      // Ensure correct format: whatsapp-web.js expects '2547...' or '2547...' without plus, but accepts with + sometimes.
      const normalized = String(to).replace(/\s+/g, "");
      // For whatsapp-web.js you need the chat id: e.g., "2547xxxxxxx@c.us"
      const chatId = normalized.includes("@") ? normalized : (normalized.startsWith("+") ? normalized.slice(1) : normalized) + "@c.us";

      const sent = await client.sendMessage(chatId, message);
      res.json({ ok: true, result: sent });
    } catch (err) {
      console.error("wa send error", err);
      res.status(500).json({ ok: false, error: err.message || String(err) });
    }
  });

  /**
   * POST /api/whatsapp-web/send-media
   * body: { to: "+2547...", base64: "<data>", filename: "photo.jpg", caption: "caption" }
   */
  router.post("/send-media", async (req, res) => {
    try {
      if (!client) return res.status(500).json({ ok: false, error: "WhatsApp client not initialized" });
      if (!ready) return res.status(503).json({ ok: false, error: "WhatsApp not connected" });

      const { to, base64, filename, caption } = req.body || {};
      if (!to || !base64 || !filename) return res.status(400).json({ ok: false, error: "to, base64 and filename required" });

      const normalized = String(to).replace(/\s+/g, "");
      const chatId = normalized.includes("@") ? normalized : (normalized.startsWith("+") ? normalized.slice(1) : normalized) + "@c.us";

      // base64 should be dataURL or raw base64. If starts with "data:" strip prefix.
      let rawBase64 = base64;
      const m = base64.match(/^data:(.+);base64,(.*)$/);
      if (m) rawBase64 = m[2];

      const buffer = Buffer.from(rawBase64, "base64");
      const media = new MessageMedia("", buffer.toString("base64"), filename);
      const sent = await client.sendMessage(chatId, media, { caption: caption || "" });
      res.json({ ok: true, result: sent });
    } catch (err) {
      console.error("wa send-media error", err);
      res.status(500).json({ ok: false, error: err.message || String(err) });
    }
  });

  // Return router + helpers
  return { router, client, getLastQrDataUrl };
}
