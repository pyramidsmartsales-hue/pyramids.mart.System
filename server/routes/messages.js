// server/routes/messages.js
import express from "express";
import { getStatus, getQr, sendBroadcast } from "../services/whatsapp.service.js";

const router = express.Router();

// ✅ حالة اتصال الواتساب
router.get("/status", async (req, res) => {
  try {
    const status = await getStatus();
    res.json({ ok: true, connected: status.connected });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// ✅ الحصول على كود QR
router.get("/qr", async (req, res) => {
  try {
    const qr = await getQr();
    res.json({ ok: true, qr });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// ✅ إرسال رسالة إلى أرقام محددة
router.post("/", async (req, res) => {
  try {
    const { numbers, message } = req.body;

    if (!numbers || !message) {
      return res.status(400).json({ ok: false, error: "Numbers and message are required" });
    }

    const result = await sendBroadcast(numbers, message);
    res.json({ ok: true, result });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, error: err.message });
  }
});

export default router;
