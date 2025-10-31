import { broadcastMessage } from "../services/whatsapp.service.js";

export default function socketHandlers(io) {
  io.on("connection", (socket) => {
    console.log("Socket connected", socket.id);

    socket.on("request:qr", () => {
      // client requests QR: whatsapp.service emits via io
      // nothing needed here if whatsapp.service already emits 'wa:qr'
      socket.emit("info", { msg: "QR request received" });
    });

    socket.on("broadcast:message", async ({ messageId }) => {
      try {
        // fetch message and broadcast
        const msg = await (await import("../models/Message.model.js")).default.findById(messageId);
        if (!msg) return socket.emit("broadcast:error", { messageId, error: "not_found" });
        await broadcastMessage(msg);
        socket.emit("broadcast:done", { messageId });
      } catch (err) {
        socket.emit("broadcast:error", { messageId, error: err.message });
      }
    });
  });
}
