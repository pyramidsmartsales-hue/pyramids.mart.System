import pkg from "whatsapp-web.js";
const { Client, LocalAuth, MessageMedia } = pkg;
import qrcode from "qrcode-terminal";
import MessageModel from "../models/Message.model.js";
import axios from "axios";

let waClient = null;
let ioGlobal = null;

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
      io.emit("wa:qr", qr);
      qrcode.generate(qr, { small: true });
      console.log("QR generated");
    });

    waClient.on("ready", () => {
      io.emit("wa:ready", true);
      console.log("WhatsApp ready");
    });

    waClient.on("auth_failure", (msg) => {
      io.emit("wa:auth_failure", msg);
      console.warn("auth_failure", msg);
    });

    waClient.initialize().catch(e => {
      io.emit("wa:init_error", e && e.message ? e.message : String(e));
      console.warn("init error", e);
    });

    // handle incoming socket sends
    io.on("connection", (socket) => {
      socket.on("wa:sendToNumber", async ({ number, message }) => {
        try {
          const normalized = normalizeNumber(number);
          const id = await waClient.getNumberId(normalized);
          if (!id) return socket.emit("wa:send_result", { number, ok: false, error: "not_registered" });
          const sent = await waClient.sendMessage(id._serialized, message);
          socket.emit("wa:send_result", { number, ok: true, id: sent.id?._serialized || null });
        } catch (err) {
          socket.emit("wa:send_result", { number, ok: false, error: err.message || String(err) });
        }
      });
    });

  } catch (err) {
    console.error("initWhatsApp error", err);
    io.emit("wa:init_error", err && err.message ? err.message : String(err));
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
        // read media from local server
        const url = `${process.env.BASE_URL || ""}${messageDoc.mediaUrl}`;
        const resp = await axios.get(url, { responseType: "arraybuffer" });
        const mime = resp.headers["content-type"];
        const data = Buffer.from(resp.data, "binary").toString("base64");
        const media = new MessageMedia(mime, data, "file");
        await waClient.sendMessage(id._serialized, media, { caption: messageDoc.body || "" });
      } else {
        await waClient.sendMessage(id._serialized, messageDoc.body || "");
      }

      await MessageModel.updateOne({ _id: messageDoc._id, "recipients.clientId": r.clientId }, {
        $set: { "recipients.$.status": "sent", "recipients.$.sentAt": new Date() }
      });

      ioGlobal.emit("wa:progress", { clientId: r.clientId, phone: r.phone, status: "sent" });

    } catch (err) {
      console.warn("send error", err);
      await MessageModel.updateOne({ _id: messageDoc._id, "recipients.clientId": r.clientId }, {
        $set: { "recipients.$.status": "failed", "recipients.$.error": err.message || String(err) }
      });
      ioGlobal.emit("wa:progress", { clientId: r.clientId, phone: r.phone, status: "failed", error: err.message });
    }
  }

  await MessageModel.findByIdAndUpdate(messageDoc._id, { overallStatus: "done" });
}
