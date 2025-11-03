// server/services/whatsappWeb.js
// نسخة معدّلة لاستخدام وضع مرئي مؤقتًا وتقنيات تقليل كشف الأتمتة (stealth).
// بعد النجاح يمكنك إعادة headless: true أو إزالة التعليقات الخاصة بـ puppeteer-extra إذا لم تعمل.

import express from "express";
import qrcode from "qrcode";
import pkg from "whatsapp-web.js";
const { Client, LocalAuth, MessageMedia } = pkg;

// حاول استدعاء puppeteer-extra / stealth إذا تم تثبيته
let puppeteerExtra;
let StealthPlugin;
try {
  // الحزم اختياريّة؛ ثبّتها إذا أردت تجربة stealth:
  // npm install puppeteer-extra puppeteer-extra-plugin-stealth --save
  // (لا تثبت puppeteer يدوياً هنا لأن whatsapp-web.js يجلب puppeteer داخليًا)
  puppeteerExtra = await import("puppeteer-extra").then(m => m.default || m);
  StealthPlugin = await import("puppeteer-extra-plugin-stealth").then(m => m.default || m);
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
  // إذا كانت puppeteerExtra متاحة ونريد تمريرها لwhatsapp-web.js قد تعمل بعض النسخ بشكل مختلف.
  // هنا نمرّر إعدادات puppeteer التقليدية مع محاولة تمويه علامات الأتمتة.
  client = new Client({
    authStrategy: new LocalAuth({ clientId: "pyramidsmart" }),

    // خيارات puppeteer — اجعل headless:false أثناء التصحيح لملاحظة صفحة WhatsApp مباشرة.
    puppeteer: {
      headless: false, // اجعل false مؤقتًا للمشاهدة أثناء التشخيص؛ بعد النجاح ضعه true
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage",
        "--disable-extensions",
        "--disable-gpu",
        "--window-size=1200,900",
        "--disable-blink-features=AutomationControlled" // يقلل من اكتشاف automation
      ],
      // إذا تريد إجبار استخدام Chrome المحلي (أقل كشفاً) فكّ التعليق وغيّر المسار إن لزم:
      // executablePath: "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    },

    // منع بعض تضاربات الجلسة واختيار مهلة أطول
    takeoverOnConflict: true,
    takeoverTimeoutMs: 60000
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
    // طباعة بسيطة للرسائل الواردة (اختياري)
    console.log("💬 Message received from:", msg.from);
  });

  // ----- بدء التشغيل -----
  client.initialize();

  // --- Express endpoints ---

  // حالة الاتصال
  router.get("/status", (req, res) => res.json({ ok: true, connected: ready }));

  // استرجاع QR لمسحه
  router.get("/qr", async (req, res) => {
    const qrDataUrl = lastQr ? await qrcode.toDataURL(lastQr) : null;
    res.json({ ok: true, qr: qrDataUrl });
  });

  // إرسال رسالة نصية
  router.post("/send", async (req, res) => {
    try {
      if (!ready)
        return res.status(503).json({ ok: false, error: "WhatsApp not connected" });

      const { to, message } = req.body;
      if (!to || !message)
        return res.status(400).json({ ok: false, error: "to and message required" });

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
      if (!ready)
        return res.status(503).json({ ok: false, error: "WhatsApp not connected" });

      const { to, base64, filename, caption } = req.body;
      if (!to || !base64)
        return res.status(400).json({ ok: false, error: "Missing parameters" });

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
