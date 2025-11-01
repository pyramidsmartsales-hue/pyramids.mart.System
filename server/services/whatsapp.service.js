// server/services/whatsapp.service.js
import pkg from "whatsapp-web.js";
const { Client, LocalAuth, MessageMedia } = pkg;
import qrcodeTerminal from "qrcode-terminal";
import fs from "fs";
import path from "path";
import axios from "axios";
import MessageModel from "../models/Message.model.js"; // optional, keep if exists

let waClient = null;
let ioGlobal = null;
let readyFlag = false;
let lastQr = null;

/**
 * initialize WhatsApp client and wire socket.io events
 * @param {import('socket.io').Server} io
 */
export default function initWhatsApp(io) {
  ioGlobal = io;

  // only init once
  if (waClient) return waClient;

  const client = new Client({
    authStrategy: new LocalAuth({
      clientId: "pyramidsmart" // optional custom id
    }),
    puppeteer: {
      headless: true,
      args: ["--no-sandbox", "--disable-setuid-sandbox"]
    }
  });

  // store reference
  waClient = client;

  client.on("qr", (qr) => {
    lastQr = qr;
    readyFlag = false;
    console.info("WhatsApp QR generated");
    // emit via socket.io so frontend can show QR immediately
    if (ioGlobal) ioGlobal.emit("whatsapp:qr", { qr });
    // also print to terminal for debug
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
    // try to destroy and re-init after a small delay to recover
    try {
      client.destroy();
    } catch (e) {}
    waClient = null;
    // optionally re-init after delay (be careful in production)
    setTimeout(() => {
      try {
        initWhatsApp(ioGlobal);
      } catch (e) {
        console.error("re-init whatsapp failed:", e && e.message ? e.message : e);
      }
    }, 3000);
  });

  client.on("message_create", (msg) => {
    // optional: update DB or emit events on new messages
    if (ioGlobal) ioGlobal.emit("whatsapp:message", { from: msg.from, body: msg.body });
  });

  client.initialize().catch((err) => {
    readyFlag = false;
    console.error("WhatsApp client failed to initialize:", err && err.message ? err.message : err);
  });

  return client;
}

/**
 * Send/broadcast message.
 * -- IMPORTANT: returns error if WhatsApp client is not ready/connected.
 *
 * @param {Object} opts
 * @param {Array<{phone:string}>} opts.recipients
 * @param {string} opts.body
 * @param {string} opts.mediaUrl optional
 */
export async function broadcastMessage({ recipients = [], body = "", mediaUrl = null } = {}) {
  if (!readyFlag || !waClient) {
    const err = new Error("WhatsApp not connected");
    console.warn("broadcastMessage blocked: whatsapp not connected");
    return { ok: false, error: err.message };
  }

  const results = [];
  try {
    for (const r of recipients) {
      const to = String((r && (r.phone || r.to || r.number)) || r).replace(/\D/g, "");
      if (!to) {
        results.push({ to: r, ok: false, error: "invalid number" });
        continue;
      }
      const jid = `${to}@c.us`;
      if (mediaUrl) {
        // try to fetch media
        try {
          const resp = await axios.get(mediaUrl, { responseType: "arraybuffer" });
          const contentType = resp.headers["content-type"] || "application/octet-stream";
          const extension = contentType.split("/")[1] || "bin";
          const tmpName = `wa-media-${Date.now()}.${extension}`;
          const tmpPath = path.join(process.cwd(), "uploads", tmpName);
          fs.writeFileSync(tmpPath, resp.data);
          const media = MessageMedia.fromFilePath(tmpPath);
          const msg = await waClient.sendMessage(jid, media, { caption: body || undefined });
          results.push({ to: jid, ok: true, id: msg.id._serialized });
          try { fs.unlinkSync(tmpPath); } catch(e) {}
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

    // optionally persist to MessageModel if exists
    try {
      if (typeof MessageModel === "function" || typeof MessageModel.create === "function") {
        // not required; wrapped to avoid crash if model missing
        // MessageModel.create({ recipients, body, results, sentAt: new Date() });
      }
    } catch (e) {}

    return { ok: true, results };
  } catch (err) {
    console.error("broadcastMessage error:", err && err.stack ? err.stack : err);
    return { ok: false, error: err && err.message ? err.message : String(err) };
  }
}

/**
 * alias for older imports
 */
export const sendBroadcast = broadcastMessage;

/**
 * helper: is connected
 */
export function isWhatsAppReady() {
  return !!readyFlag;
}

/**
 * Return last QR or null
 */
export function getLastQr() {
  return lastQr;
}
