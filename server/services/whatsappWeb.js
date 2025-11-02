// server/services/whatsappWeb.js
import express from "express";
import qrcode from "qrcode";
import pkg from "whatsapp-web.js";
const { Client, LocalAuth, MessageMedia } = pkg;

let client = null;
let lastQr = null;
let ready = false;

export function initWhatsApp(io = null) {
  const router = express.Router();

  client = new Client({
    authStrategy: new LocalAuth({ clientId: "pyramidsmart" }),
    puppeteer: { headless: true, args: ["--no-sandbox", "--disable-setuid-sandbox"] },
  });

  client.on("qr", async (qr) => {
    try {
      lastQr = qr;
      const dataUrl = await qrcode.toDataURL(qr);
      if (io && io.emit) io.emit("whatsapp:qr", { qrDataUrl: dataUrl });
      console.log("📱 WhatsApp QR generated");
    } catch (e) {
      console.error("QR error:", e);
    }
  });

  client.on("ready", () => {
    ready = true;
    lastQr = null;
    console.log("✅ WhatsApp Web connected and ready");
    if (io && io.emit) io.emit("whatsapp:status", { connected: true });
  });

  client.on("disconnected", (reason) => {
    ready = false;
    console.log("⚠️ WhatsApp disconnected:", reason);
    if (io && io.emit) io.emit("whatsapp:status", { connected: false, reason });
    try { client.destroy(); } catch {}
    setTimeout(() => { client.initialize(); }, 5000);
  });

  client.initialize();

  // --- Express endpoints ---

  // WhatsApp connection status
  router.get("/status", (req, res) => res.json({ ok: true, connected: ready }));

  // Retrieve QR for manual scan
  router.get("/qr", async (req, res) => {
    const qrDataUrl = lastQr ? await qrcode.toDataURL(lastQr) : null;
    res.json({ ok: true, qr: qrDataUrl });
  });

  // Send text message
  router.post("/send", async (req, res) => {
    try {
      if (!ready) return res.status(503).json({ ok: false, error: "WhatsApp not connected" });
      const { to, message } = req.body;
      if (!to || !message) return res.status(400).json({ ok: false, error: "to and message required" });
      const chatId = to.replace(/\+/g, "").replace(/\s+/g, "") + "@c.us";
      const sent = await client.sendMessage(chatId, message);
      res.json({ ok: true, sent });
    } catch (err) {
      console.error("Send error:", err);
      res.status(500).json({ ok: false, error: err.message });
    }
  });

  // Send media (image, file, etc.)
  router.post("/send-media", async (req, res) => {
    try {
      if (!ready) return res.status(503).json({ ok: false, error: "WhatsApp not connected" });
      const { to, base64, filename, caption } = req.body;
      if (!to || !base64) return res.status(400).json({ ok: false, error: "Missing parameters" });
      const chatId = to.replace(/\+/g, "").replace(/\s+/g, "") + "@c.us";
      const media = new MessageMedia("", base64, filename);
      const sent = await client.sendMessage(chatId, media, { caption: caption || "" });
      res.json({ ok: true, sent });
    } catch (err) {
      res.status(500).json({ ok: false, error: err.message });
    }
  });

  return { router, client };
}
