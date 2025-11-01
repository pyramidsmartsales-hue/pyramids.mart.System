import pkg from "whatsapp-web.js";
const { Client, LocalAuth, MessageMedia } = pkg;
import qrcode from "qrcode-terminal";
import MessageModel from "../models/Message.model.js";
import axios from "axios";

let waClient = null;
let ioGlobal = null;
let readyFlag = false;

function normalizeNumber(n) {
  if (!n) return n;
  return String(n).replace(/[^\d]/g, "");
}

export default function initWhatsApp(io) {
  ioGlobal = io;
  const sessionPath = process.env.SESSION_STORE_PATH || "./.wwebjs_auth";
  try {
    waClient = new Client({
      authStrategy: new LocalAuth({ clientId: "pyramids", dataPath: sessionPath }),
      puppeteer: { headless: true, args: ["--no-sandbox", "--disable-setuid-sandbox"] }
    });

    waClient.on("qr", (qr) => {
      try {
        io.emit("wa:qr", qr);
        qrcode.generate(qr, { small: true });
        console.log("QR generated");
      } catch (err) {
        console.warn("Error emitting QR:", err);
      }
    });

    waClient.on("ready", () => {
      readyFlag = true;
      try {
        io.emit("wa:ready", true);
      } catch (err) {}
      console.log("WhatsApp ready");
    });

    waClient.on("auth_failure", (msg) => {
      readyFlag = false;
      try { io.emit("wa:auth_failure", msg); } catch (e) {}
      console.warn("auth_failure", msg);
    });

    waClient.on("disconnected", (reason) => {
      readyFlag = false;
      try { io.emit("wa:disconnected", reason); } catch (e) {}
      console.warn("WhatsApp disconnected:", reason);
    });

    waClient.initialize().catch(e => {
      readyFlag = false;
      try { io.emit("wa:init_error", e && e.message ? e.message : String(e)); } catch (e2) {}
      console.warn("init error", e);
    });

    // handle incoming socket sends
    io.on("connection", (socket) => {
      socket.on("wa:sendToNumber", async ({ number, message }) => {
        try {
          if (!readyFlag) {
            return socket.emit("wa:send_result", { number, ok: false, error: "client_not_ready" });
          }
          const normalized = normalizeNumber(number);
          const id = await waClient.getNumberId(normalized);
          if (!id) return socket.emit("wa:send_result", { number, ok: false, error: "not_registered" });
          const sent = await waClient.sendMessage(id._serialized, message);
          socket.emit("wa:send_result", { number, ok: true, id: sent.id?._serialized || null });
        } catch (err) {
          console.warn("Socket send error:", err && err.message ? err.message : err);
          socket.emit("wa:send_result", { number, ok: false, error: err.message || String(err) });
        }
      });
    });

  } catch (err) {
    readyFlag = false;
    console.error("initWhatsApp error", err);
    try { io.emit("wa:init_error", err && err.message ? err.message : String(err)); } catch (e) {}
  }
}

// helper to check if WA client is ready
export function isWhatsAppReady() {
  return !!readyFlag && !!waClient;
}

// helper to send a single message from server code (returns result object)
export async function sendToNumberServer(number, message) {
  if (!isWhatsAppReady()) {
    return { ok: false, error: "client_not_ready" };
  }
  try {
    const normalized = normalizeNumber(number);
    const id = await waClient.getNumberId(normalized);
    if (!id) return { ok: false, error: "not_registered" };

    const sent = await waClient.sendMessage(id._serialized, message);
    return { ok: true, id: sent.id?._serialized || null };
  } catch (err) {
    console.warn("sendToNumberServer error:", err && err.message ? err.message : err);
    return { ok: false, error: err.message || String(err) };
  }
}

// Broadcast a MessageModel instance (updates recipients statuses)
export async function broadcastMessage(messageDoc) {
  if (!waClient) throw new Error("WhatsApp client not initialized");
  const recipients = messageDoc.recipients || [];
  for (const r of recipients) {
    try {
      ioGlobal.emit("wa:progress", { clientId: r.clientId, phone: r.phone, status: "sending" });
      const normalized = normalizeNumber(r.phone);
      const id = await waClient.getNumberId(normalized);
      if (!id) {
        // update status in DB
        await MessageModel.updateOne({ _id: messageDoc._id, "recipients.clientId": r.clientId }, {
          $set: { "recipients.$.status": "failed", "recipients.$.error": "not_registered" }
        });
        ioGlobal.emit("wa:progress", { clientId: r.clientId, phone: r.phone, status: "failed" });
        continue;
      }

      // send text or media
      if (messageDoc.mediaUrl) {
        try {
          const base = process.env.BASE_URL || "";
          const url = `${base}${messageDoc.mediaUrl}`;
          const resp = await axios.get(url, { responseType: "arraybuffer" });
          const mime = resp.headers["content-type"] || "application/octet-stream";
          const data = Buffer.from(resp.data, "binary").toString("base64");
          const media = new MessageMedia(mime, data, "file");
          await waClient.sendMessage(id._serialized, media, { caption: messageDoc.body || "" });
        } catch (errMedia) {
          console.warn("media send error for", r.phone, errMedia && errMedia.message ? errMedia.message : errMedia);
          await MessageModel.updateOne({ _id: messageDoc._id, "recipients.clientId": r.clientId }, {
            $set: { "recipients.$.status": "failed", "recipients.$.error": "media_fetch_error" }
          });
          ioGlobal.emit("wa:progress", { clientId: r.clientId, phone: r.phone, status: "failed", error: "media_fetch_error" });
          continue;
        }
      } else {
        await waClient.sendMessage(id._serialized, messageDoc.body || "");
      }

      await MessageModel.updateOne({ _id: messageDoc._id, "recipients.clientId": r.clientId }, {
        $set: { "recipients.$.status": "sent", "recipients.$.sentAt": new Date() }
      });

      ioGlobal.emit("wa:progress", { clientId: r.clientId, phone: r.phone, status: "sent" });

    } catch (err) {
      console.warn("send error", err && err.message ? err.message : err);
      await MessageModel.updateOne({ _id: messageDoc._id, "recipients.clientId": r.clientId }, {
        $set: { "recipients.$.status": "failed", "recipients.$.error": err.message || String(err) }
      });
      ioGlobal.emit("wa:progress", { clientId: r.clientId, phone: r.phone, status: "failed", error: err.message });
    }
  }

  await MessageModel.findByIdAndUpdate(messageDoc._id, { overallStatus: "done" });
}
