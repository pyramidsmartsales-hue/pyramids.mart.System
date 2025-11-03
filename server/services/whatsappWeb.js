// server/services/whatsappWeb.js
// تم تعديل الإعدادات لتشغيل puppeteer في بيئات مثل Render (headless + args مناسبة).
import express from "express";
import qrcode from "qrcode";
import pkg from "whatsapp-web.js";
const { Client, LocalAuth, MessageMedia } = pkg;

// حاول استدعاء puppeteer-extra / stealth إذا تم تثبيته (اختياري)
let puppeteerExtra;
let StealthPlugin;
try {
  // الحزم اختياريّة؛ ثبّتها إذا أردت تجربة stealth:
  // npm install puppeteer-extra puppeteer-extra-plugin-stealth --save
  // (لا تثبت puppeteer يدوياً هنا لأن whatsapp-web.js يجلب puppeteer داخليًا)
  puppeteerExtra = await import("puppeteer-extra").then((m) => m.default || m);
  StealthPlugin = await import("puppeteer-extra-plugin-stealth").then((m) => m.default || m);
  if (puppeteerExtra && StealthPlugin) {
    puppeteerExtra.use(StealthPlugin());
    console.log("🛡️ puppeteer-extra + stealth plugin loaded");
  }
} catch (e) {
  // غير حرج — سنكمل بدون stealth
  // console.warn("puppeteer-extra / stealth not available:", e && e.message ? e.message : e);
}

let client = null;
let lastQr = null;
let ready = false;

export function initWhatsApp(io = null) {
  const router = express.Router();

  // ----- تهيئة عميل WhatsApp -----
  // اجعل HEADLESS قابلاً للتغيير عبر متغير بيئة، القيمة الافتراضية: true
  const headlessEnv = process.env.HEADLESS;
  const HEADLESS = typeof headlessEnv !== "undefined" ? headlessEnv === "true" : true;

  // اذا كان هناك مسار Chromium محدد في البيئة فمرره
  const chromiumPath = process.env.CHROMIUM_PATH || undefined;

  client = new Client({
    authStrategy: new LocalAuth({ clientId: "pyramidsmart" }),

    // إعدادات puppeteer المصححة للعمل في بيئات مثل Render
    puppeteer: {
      headless: HEADLESS,
      executablePath: chromiumPath, // قد يكون undefined ويستخدم الافتراضي الذي يجلبه whatsapp-web.js
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage",
        "--single-process",
        "--no-zygote",
        "--disable-gpu",
        "--disable-extensions",
        "--disable-infobars",
        "--window-size=1200,900",
        "--disable-blink-features=AutomationControlled",
      ],
      // يمكنك ضبط timeout هنا لو احتجت:
      // timeout: 0
    },

    takeoverOnConflict: true,
    takeoverTimeoutMs: 60000,
  });

  // ----- مستمعات الأحداث (debug / logs) -----
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

  client.on("auth_failure", (msg) => {
    console.error("🔒 auth_failure:", msg);
    if (io && io.emit) io.emit("whatsapp:auth_failure", { msg });
  });

  client.on("auth", () => {
    console.log("🔐 Authentication successful, session stored.");
    if (io && io.emit) io.emit("whatsapp:auth_success", { ok: true });
  });

  client.on("change_state", (state) => {
    console.log("🔁 Client state changed:", state);
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
    try {
      client.destroy();
    } catch (e) {
      console.error("Error destroying client:", e);
    }
    setTimeout(() => {
      console.log("♻️ Reinitializing WhatsApp client after disconnect...");
      client.initialize();
    }, 5000);
  });

  client.on("message", (msg) => {
    console.log("💬 Message received from:", msg.from);
  });

  // ----- بدء التشغيل -----
  try {
    client.initialize();
  } catch (initErr) {
    console.error("Failed to initialize WhatsApp client:", initErr);
  }

  // --- Express endpoints ---

  // health endpoint صريح لـ Render / healthchecks
  router.get("/healthz", (req, res) => {
    res.status(200).json({ ok: true, connected: ready });
  });

  // حالة الاتصال
  router.get("/status", (req, res) => res.json({ ok: true, connected: ready }));

  // استرجاع QR لمسحه
  router.get("/qr", async (req, res) => {
    try {
      const qrDataUrl = lastQr ? await qrcode.toDataURL(lastQr) : null;
      res.json({ ok: true, qr: qrDataUrl });
    } catch (e) {
      console.error("QR fetch error:", e);
      res.status(500).json({ ok: false, error: "Failed to generate QR" });
    }
  });

  // إرسال رسالة نصية
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

  // إرسال وسائط (صور، ملفات...)
  router.post("/send-media", async (req, res) => {
    try {
      if (!ready) return res.status(503).json({ ok: false, error: "WhatsApp not connected" });

      const { to, base64, filename, caption } = req.body;
      if (!to || !base64) return res.status(400).json({ ok: false, error: "Missing parameters" });

      const chatId = to.replace(/\+/g, "").replace(/\s+/g, "") + "@c.us";
      const media = new MessageMedia("", base64, filename);
      const sent = await client.sendMessage(chatId, media, {
        caption: caption || "",
      });
      res.json({ ok: true, sent });
    } catch (err) {
      console.error("Send media error:", err);
      res.status(500).json({ ok: false, error: err.message });
    }
  });

  return { router, client };
}
