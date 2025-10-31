import cron from "node-cron";
import Message from "../models/Message.model.js";
import { broadcastMessage } from "./whatsapp.service.js";

// runs every minute to check scheduled messages
export function startScheduler() {
  cron.schedule("* * * * *", async () => {
    try {
      const now = new Date();
      const messages = await Message.find({ overallStatus: "pending", scheduledAt: { $ne: null, $lte: now }});
      for (const m of messages) {
        m.overallStatus = "processing";
        await m.save();
        broadcastMessage(m).catch(e => console.error("scheduler broadcast error", e));
      }
    } catch (err) {
      console.error("scheduler error", err);
    }
  });
}
