// server/routes/messages.js
import express from "express";
import multer from "multer";
import path from "path";
import { broadcastMessage, sendBroadcast, getLastQr, isWhatsAppReady } from "../services/whatsapp.service.js";

const router = express.Router();
const upload = multer({ dest: path.join(process.cwd(), "uploads/") });

function parseRecipients(req) {
  let numbers = req.body.numbers || req.body.recipients || req.body.numbersList || [];
  if (typeof numbers === "string") {
    try {
      const parsed = JSON.parse(numbers);
      numbers = parsed;
    } catch (e) {
      // maybe comma-separated
      numbers = numbers.split(",").map(s => s.trim()).filter(Boolean);
    }
  }
  if (!Array.isArray(numbers)) numbers = [];
  return numbers.map(n => {
    if (typeof n === "object") return { phone: n.phone || n.number || n.to };
    return { phone: String(n) };
  });
}

// POST /api/messages  (public frontend calls this)
router.post("/", upload.single("file"), async (req, res) => {
  try {
    const body = req.body.message || req.body.body || "";
    const recipients = parseRecipients(req);
    let mediaUrl = null;
    if (req.file) {
      // serve via /uploads static route
      const base = process.env.BASE_URL || "";
      mediaUrl = `${base}/uploads/${path.basename(req.file.path)}`;
    }

    // block if WA not connected
    if (!isWhatsAppReady()) {
      return res.status(503).json({ ok: false, error: "WhatsApp not connected" });
    }

    const result = await broadcastMessage({ recipients, body, mediaUrl });
    if (!result || result.ok === false) {
      return res.status(500).json(result);
    }
    return res.json(result);
  } catch (err) {
    console.error("POST /api/messages error:", err && err.stack ? err.stack : err);
    return res.status(500).json({ ok: false, error: err && err.message ? err.message : String(err) });
  }
});

// legacy route: /api/messages/broadcast (keep for compat)
router.post("/broadcast", upload.single("file"), async (req, res) => {
  // simply delegate to root handler
  return router.handle(req, res);
});

// GET /api/whatsapp/status -> { connected: boolean }
router.get("/status", (req, res) => {
  try {
    const connected = isWhatsAppReady();
    res.json({ connected });
  } catch (e) {
    res.status(500).json({ connected: false, error: e && e.message ? e.message : String(e) });
  }
});

// GET /api/whatsapp/qr -> { qr: string|null, connected: boolean }
router.get("/qr", (req, res) => {
  try {
    const qr = getLastQr();
    const connected = isWhatsAppReady();
    res.json({ qr: qr || null, connected });
  } catch (e) {
    res.status(500).json({ qr: null, connected: false, error: e && e.message ? e.message : String(e) });
  }
});

export default router;
