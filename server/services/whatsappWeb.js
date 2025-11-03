// server/services/whatsappWeb.js
import express from "express";
import qrcode from "qrcode";
import pkg from "whatsapp-web.js";
const { Client, LocalAuth, MessageMedia } = pkg;

let client = null;
let lastQr = null;
let ready = false;

function sleep(ms) {
  return new Promise((res) => setTimeout(res, ms));
}

export function initWhatsApp(io = null) {
  const router = express.Router();

  // HEADLESS env
  const headlessEnv = process.env.HEADLESS;
  const HEADLESS = typeof headlessEnv !== "undefined" ? headlessEnv === "true" : true;

  // chromium path default (when using Dockerfile we set /usr/bin/chromium)
  const chromiumPath = process.env.CHROMIUM_PATH || "/usr/bin/chromium";

  // factory to create client instance
  const createClient = () =>
    new Client({
      authStrategy: new LocalAuth({ clientId: "pyramidsmart" }),
      puppeteer: {
        headless: HEADLESS,
        executablePath: chromiumPath,
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
      },
      takeoverOnConflict: true,
      takeoverTimeoutMs: 60000,
    });

  // initialize with retry strategy
  const initializeWithRetry = async (maxAttempts = 5) => {
    let attempt = 0;
    while (attempt < maxAttempts) {
      attempt++;
      try {
        console.log(`[wa] initializing whatsapp client (attempt ${attempt}/${maxAttempts})`);
        client = createClient();

        // register essential listeners before initialize
        client.on("qr", async (qr) => {
          lastQr = qr;
          try {
            const dataUrl = await qrcode.toDataURL(qr);
            if (io && io.emit) io.emit("whatsapp:qr", { qrDataUrl: dataUrl });
            console.log("📱 WhatsApp QR generated");
          } catch (e) {
            console.error("QR generation error:", e);
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
          try { client.destroy(); } catch (e) {}
          // schedule re-initialize
          setTimeout(() => initializeWithRetry(5), 5000);
        });

        client.on("message", (msg) => console.log("💬 Message received from:", msg.from));

        // Start (this can throw if browser fails)
        await client.initialize();
        // if initialize succeeded, break retry loop
        return;
      } catch (err) {
        console.error(`[wa] init attempt ${attempt} failed:`, err && err.message ? err.message : err);
        // if browser launch failed, wait longer each attempt
        const waitMs = Math.min(30000, 2000 * attempt);
        console.log(`[wa] will retry in ${waitMs}ms`);
        try { await sleep(waitMs); } catch (_) {}
      }
    }
    console.error("[wa] all initialization attempts failed, continuing without active client (will keep retrying on disconnect).");
  };

  // start background init (non-blocking)
  initializeWithRetry().catch((e) => console.error("[wa] unexpected init error:", e));

  // endpoints
  router.get("/healthz", (req, res) => res.status(200).json({ ok: true, connected: ready }));
  router.get("/status", (req, res) => res.json({ ok: true, connected: ready }));
  router.get("/qr", async (req, res) => {
    try {
      const qrDataUrl = lastQr ? await qrcode.toDataURL(lastQr) : null;
      return res.json({ ok: true, qr: qrDataUrl });
    } catch (e) {
      console.error("QR fetch error:", e);
      return res.status(500).json({ ok: false, error: "Failed to generate QR" });
    }
  });

  router.post("/send", async (req, res) => {
    try {
      if (!ready) return res.status(503).json({ ok: false, error: "WhatsApp not connected" });
      const { to, message } = req.body;
      if (!to || !message) return res.status(400).json({ ok: false, error: "to and message required" });
      const chatId = to.replace(/\+/g, "").replace(/\s+/g, "") + "@c.us";
      const sent = await client.sendMessage(chatId, message);
      return res.json({ ok: true, sent });
    } catch (err) {
      console.error("Send error:", err && err.message ? err.message : err);
      return res.status(500).json({ ok: false, error: err && err.message ? err.message : String(err) });
    }
  });

  router.post("/send-media", async (req, res) => {
    try {
      if (!ready) return res.status(503).json({ ok: false, error: "WhatsApp not connected" });
      const { to, base64, filename, caption } = req.body;
      if (!to || !base64) return res.status(400).json({ ok: false, error: "Missing parameters" });
      const chatId = to.replace(/\+/g, "").replace(/\s+/g, "") + "@c.us";
      const media = new MessageMedia("", base64, filename);
      const sent = await client.sendMessage(chatId, media, { caption: caption || "" });
      return res.json({ ok: true, sent });
    } catch (err) {
      console.error("Send media error:", err && err.message ? err.message : err);
      return res.status(500).json({ ok: false, error: err && err.message ? err.message : String(err) });
    }
  });

  return { router, client: () => client };
}
