// server/services/whatsapp.service.js
// Safe, compatible whatsapp service with named export `broadcastMessage`
// and alias `sendBroadcast` for backward compatibility.
// Keeps initWhatsApp as default export.

import pkg from "whatsapp-web.js";
const { Client, LocalAuth, MessageMedia } = pkg;
import qrcodeTerminal from "qrcode-terminal";
import fs from "fs";
import path from "path";
import axios from "axios";
import MessageModel from "../models/Message.model.js"; // used to update statuses if present

let waClient = null;
let ioGlobal = null;
let readyFlag = false;

function normalizeNumber(n) {
  if (!n) return null;
  const s = String(n).replace(/[^\d]/g, "");
  if (s.length === 0) return null;
  return s;
}

export default function initWhatsApp(io) {
  ioGlobal = io;
  const sessionPath = process.env.SESSION_STORE_PATH || "./.wwebjs_auth";

  if (waClient) {
    return waClient;
  }

  waClient = new Client({
    authStrategy: new LocalAuth({ clientId: "pyramids", dataPath: sessionPath }),
    puppeteer: { headless: true, args: ["--no-sandbox", "--disable-setuid-sandbox"] },
  });

  waClient.on("qr", (qr) => {
    try {
      if (ioGlobal) ioGlobal.emit("wa:qr", qr);
      try { qrcodeTerminal.generate(qr, { small: true }); } catch (e) {}
      console.log("QR generated");
    } catch (err) {
      console.warn("Error in qr handler:", err);
    }
  });

  waClient.on("ready", () => {
    readyFlag = true;
    console.log("WhatsApp ready");
    if (ioGlobal) ioGlobal.emit("wa:ready", true);
  });

  waClient.on("authenticated", () => {
    readyFlag = true;
    console.log("WhatsApp authenticated");
    if (ioGlobal) ioGlobal.emit("wa:authenticated", true);
  });

  waClient.on("auth_failure", (msg) => {
    readyFlag = false;
    console.warn("WhatsApp auth_failure:", msg);
    if (ioGlobal) ioGlobal.emit("wa:auth_failure", msg);
  });

  waClient.on("disconnected", (reason) => {
    readyFlag = false;
    console.warn("WhatsApp disconnected:", reason);
    if (ioGlobal) ioGlobal.emit("wa:disconnected", reason);
    setTimeout(() => {
      try {
        waClient.destroy().catch(()=>{});
        waClient.initialize().catch((e) => console.error("re-init error:", e));
      } catch (e) {
        console.warn("re-init attempt failed:", e);
      }
    }, 3000);
  });

  waClient.initialize().catch((e) => {
    readyFlag = false;
    console.error("waClient initialize error:", e && e.stack ? e.stack : e);
    if (ioGlobal) ioGlobal.emit("wa:init_error", e && e.message ? e.message : String(e));
  });

  if (ioGlobal) {
    ioGlobal.on("connection", (socket) => {
      socket.on("request:sendToNumber", async ({ number, message }) => {
        try {
          if (!readyFlag) return socket.emit("response:sendToNumber", { ok: false, error: "client_not_ready" });
          const normalized = normalizeNumber(number);
          const id = await waClient.getNumberId(normalized);
          if (!id) return socket.emit("response:sendToNumber", { ok: false, error: "not_registered" });
          const sent = await waClient.sendMessage(id._serialized, message);
          socket.emit("response:sendToNumber", { ok: true, id: sent.id?._serialized || null });
        } catch (err) {
          console.warn("socket send error:", err && err.message ? err.message : err);
          socket.emit("response:sendToNumber", { ok: false, error: err && err.message ? err.message : String(err) });
        }
      });
    });
  }

  return waClient;
}

/**
 * broadcastMessage
 * Accepts message object:
 * { body: string, recipients: [{ clientId?, phone }], mediaUrl? }
 * Returns array of results { clientId?, phone, ok, error? }
 */
export async function broadcastMessage(messageDoc) {
  if (!waClient) {
    throw new Error("WhatsApp client not initialized");
  }

  const recipients = (messageDoc && Array.isArray(messageDoc.recipients)) ? messageDoc.recipients : [];
  const results = [];

  for (const r of recipients) {
    const phoneRaw = r.phone || r.number || r.to || "";
    const clientId = r.clientId || null;
    const normalized = normalizeNumber(phoneRaw);
    const result = { clientId, phone: phoneRaw, ok: false };

    if (!normalized) {
      result.error = "invalid_number";
      results.push(result);
      try {
        if (messageDoc && messageDoc._id && MessageModel) {
          await MessageModel.updateOne({ _id: messageDoc._id, "recipients.clientId": clientId }, {
            $set: { "recipients.$.status": "failed", "recipients.$.error": "invalid_number" }
          });
        }
      } catch (e) {}
      continue;
    }

    try {
      const numberId = await waClient.getNumberId(normalized);
      if (!numberId) {
        result.error = "not_registered";
        results.push(result);
        try {
          if (messageDoc && messageDoc._id && MessageModel) {
            await MessageModel.updateOne({ _id: messageDoc._id, "recipients.clientId": clientId }, {
              $set: { "recipients.$.status": "failed", "recipients.$.error": "not_registered" }
            });
          }
        } catch (e) {}
        continue;
      }

      const to = numberId._serialized;

      if (messageDoc.mediaUrl) {
        try {
          const base = process.env.BASE_URL || "";
          const url = messageDoc.mediaUrl.startsWith("http") ? messageDoc.mediaUrl : `${base}${messageDoc.mediaUrl}`;
          const resp = await axios.get(url, { responseType: "arraybuffer" });
          const mime = resp.headers["content-type"] || "application/octet-stream";
          const data = Buffer.from(resp.data, "binary").toString("base64");
          const fileName = path.basename(url.split("?")[0]) || "file";
          const media = new MessageMedia(mime, data, fileName);
          await waClient.sendMessage(to, media, { caption: messageDoc.body || "" });
        } catch (errMedia) {
          console.warn("Media send error for", normalized, errMedia && errMedia.message ? errMedia.message : errMedia);
          result.error = "media_send_failed";
          results.push(result);
          try {
            if (messageDoc && messageDoc._id && MessageModel) {
              await MessageModel.updateOne({ _id: messageDoc._id, "recipients.clientId": clientId }, {
                $set: { "recipients.$.status": "failed", "recipients.$.error": "media_send_failed" }
              });
            }
          } catch (e) {}
          continue;
        }
      } else {
        await waClient.sendMessage(to, messageDoc.body || "");
      }

      result.ok = true;
      results.push(result);

      try {
        if (messageDoc && messageDoc._id && MessageModel) {
          await MessageModel.updateOne({ _id: messageDoc._id, "recipients.clientId": clientId }, {
            $set: { "recipients.$.status": "sent", "recipients.$.sentAt": new Date() }
          });
        }
      } catch (e) {
        console.warn("DB update warning:", e && e.message ? e.message : e);
      }

      try { if (ioGlobal) ioGlobal.emit("wa:progress", { clientId, phone: normalized, status: "sent" }); } catch(e){}
    } catch (err) {
      console.error("Error sending to", normalized, err && err.stack ? err.stack : err);
      result.error = err && err.message ? err.message : String(err);
      results.push(result);
      try {
        if (messageDoc && messageDoc._id && MessageModel) {
          await MessageModel.updateOne({ _id: messageDoc._id, "recipients.clientId": clientId }, {
            $set: { "recipients.$.status": "failed", "recipients.$.error": result.error }
          });
        }
      } catch (e) {}
      try { if (ioGlobal) ioGlobal.emit("wa:progress", { clientId, phone: normalized, status: "failed", error: result.error }); } catch(e){}
    }
  }

  try {
    if (messageDoc && messageDoc._id && MessageModel) {
      await MessageModel.findByIdAndUpdate(messageDoc._id, { overallStatus: "done" });
    }
  } catch (e) {}

  return results;
}

/**
 * sendToNumberServer helper
 */
export async function sendToNumberServer(number, message) {
  if (!waClient) return { ok: false, error: "client_not_initialized" };
  if (!readyFlag) return { ok: false, error: "client_not_ready" };
  const normalized = normalizeNumber(number);
  if (!normalized) return { ok: false, error: "invalid_number" };
  try {
    const numberId = await waClient.getNumberId(normalized);
    if (!numberId) return { ok: false, error: "not_registered" };
    const sent = await waClient.sendMessage(numberId._serialized, message);
    return { ok: true, id: sent.id?._serialized || null };
  } catch (err) {
    return { ok: false, error: err && err.message ? err.message : String(err) };
  }
}

/**
 * isWhatsAppReady helper
 */
export function isWhatsAppReady() {
  return !!readyFlag;
}

// ===== Backward-compatibility aliases =====
// some modules import `sendBroadcast` or `broadcastMessage`; export both names
export const sendBroadcast = broadcastMessage;
export { broadcastMessage as broadcastMessage }; // named export already exists above
