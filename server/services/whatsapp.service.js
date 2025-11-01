// server/services/whatsapp.service.js
import pkg from "whatsapp-web.js";
const { Client, LocalAuth, MessageMedia } = pkg;
import qrcodeTerminal from "qrcode-terminal";
import fs from "fs";
import path from "path";
import axios from "axios";
import os from "os";

let waClient = null;
let ioGlobal = null;
let readyFlag = false;
let lastQr = null;

/**
 * Initialize WhatsApp client and wire socket.io events
 * @param {import('socket.io').Server} io
 */
export default function initWhatsApp(io) {
  ioGlobal = io;

  // already initialized
  if (waClient) return waClient;

  // Puppeteer args improved for headless servers like Render
  const puppeteerArgs = [
    "--no-sandbox",
    "--disable-setuid-sandbox",
    "--disable-dev-shm-usage",
    "--single-process",
    "--no-zygote",
    "--disable-background-timer-throttling",
    "--disable-backgrounding-occluded-windows",
    "--disable-renderer-backgrounding"
  ];

  const client = new Client({
    authStrategy: new LocalAuth({
      clientId: "pyramidsmart" // keep sessions separated if needed
    }),
    puppeteer: {
      headless: true,
      args: puppeteerArgs,
      defaultViewport: null
    }
  });

  waClient = client;

  client.on("qr", (qr) => {
    lastQr = qr;
    readyFlag = false;
    console.info("WhatsApp QR generated");
    if (ioGlobal) ioGlobal.emit("whatsapp:qr", { qr });
    try { qrcodeTerminal.generate(qr, { small: true }); } catch (e) {}
  });

  client.on("ready", () => {
    readyFlag = true;
    console.info("WhatsApp ready");
    if (ioGlobal) ioGlobal.emit("whatsapp:ready", { connected: true });
    lastQr = null;
  });

  client.on("authenticated", (session) => {
    console.info("WhatsApp authenticated");
    if (ioGlobal) ioGlobal.emit("whatsapp:authenticated", { ok: true });
  });

  client.on("auth_failure", (msg) => {
    readyFlag = false;
    console.warn("WhatsApp auth failed:", msg);
    if (ioGlobal) ioGlobal.emit("whatsapp:auth_failure", { msg });
  });

  client.on("disconnected", (reason) => {
    readyFlag = false;
    console.warn("WhatsApp disconnected:", reason);
    if (ioGlobal) ioGlobal.emit("whatsapp:disconnected", { reason, connected: false });
    // try to cleanup and reinitialize after short delay
    try { client.destroy(); } catch (e) {}
    waClient = null;
    setTimeout(() => {
      try { initWhatsApp(ioGlobal); } catch (e) { console.error("re-init whatsapp failed:", e); }
    }, 3000);
  });

  client.on("message_create", (msg) => {
    if (ioGlobal) ioGlobal.emit("whatsapp:message", { from: msg.from, body: msg.body });
  });

  // start client
  client.initialize().catch((err) => {
    readyFlag = false;
    console.error("WhatsApp client failed to initialize:", err && err.message ? err.message : err);
    if (ioGlobal) ioGlobal.emit("whatsapp:init_error", { error: err && err.message ? err.message : String(err) });
  });

  return client;
}

/**
 * Send/broadcast message.
 * Returns { ok: true, results } or { ok:false, error: "..."}
 */
export async function broadcastMessage({ recipients = [], body = "", mediaUrl = null } = {}) {
  if (!readyFlag || !waClient) {
    const errMsg = "WhatsApp not connected";
    console.warn("broadcastMessage blocked:", errMsg);
    return { ok: false, error: errMsg };
  }

  const results = [];
  try {
    for (const r of recipients) {
      const raw = (r && (r.phone || r.to || r.number)) || r || "";
      const to = String(raw).replace(/\D/g, "");
      if (!to) {
        results.push({ to: raw, ok: false, error: "invalid number" });
        continue;
      }
      const jid = `${to}@c.us`;
      if (mediaUrl) {
        try {
          const resp = await axios.get(mediaUrl, { responseType: "arraybuffer" });
          const contentType = resp.headers["content-type"] || "application/octet-stream";
          const extension = contentType.split("/")[1] || "bin";
          const tmpName = `wa-media-${Date.now()}.${extension}`;
          const tmpPath = path.join(process.cwd(), "uploads", tmpName);
          fs.writeFileSync(tmpPath, resp.data);
          const media = MessageMedia.fromFilePath(tmpPath);
          const msg = await waClient.sendMessage(jid, media, { caption: body || undefined });
          results.push({ to: jid, ok: true, id: msg.id ? msg.id._serialized : null });
          try { fs.unlinkSync(tmpPath); } catch (e) {}
        } catch (err) {
          results.push({ to: jid, ok: false, error: err && err.message ? err.message : String(err) });
        }
      } else {
        try {
          const msg = await waClient.sendMessage(jid, body || "");
          results.push({ to: jid, ok: true, id: msg.id ? msg.id._serialized : null });
        } catch (err) {
          results.push({ to: jid, ok: false, error: err && err.message ? err.message : String(err) });
        }
      }
    }
    return { ok: true, results };
  } catch (err) {
    console.error("broadcastMessage error:", err && err.stack ? err.stack : err);
    return { ok: false, error: err && err.message ? err.message : String(err) };
  }
}

export const sendBroadcast = broadcastMessage;

export function isWhatsAppReady() {
  return !!readyFlag;
}

export function getLastQr() {
  return lastQr;
}
