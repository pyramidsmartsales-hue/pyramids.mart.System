// server/routes/messages.js
import express from "express";
import multer from "multer";
import path from "path";
import QRCode from "qrcode";
import { sendBroadcast, getLastQr, isWhatsAppReady } from "../services/whatsapp.service.js";

const router = express.Router();
const upload = multer({ dest: path.join(process.cwd(), "uploads/") });

/**
 * Normalize incoming payload into recipients array
 * Accepts:
 * - numbers: ["2547..", ...]    OR
 * - numbers: "2547..,2547.."    OR
 * - recipients: [{ phone: "..." }, ...]
 */
function parseRecipients(req) {
  let numbers = req.body.numbers || req.body.recipients || req.body.numbersList || [];
  if (typeof numbers === "string") {
    try {
      const parsed = JSON.parse(numbers);
      numbers = parsed;
    } catch (e) {
      numbers = numbers.split(/[\n,;]+/).map(s => s.trim()).filter(Boolean);
    }
  }
  if (!Array.isArray(numbers)) numbers = [];
  return numbers.map(n => {
    if (typeof n === "object") return { phone: n.phone || n.number || n.to };
    return { phone: String(n) };
  });
}

// POST /api/messages  -> send broadcast
router.post("/", upload.single("file"), async (req, res) => {
  try {
    const body = req.body.message || req.body.body || "";
    const recipients = parseRecipients(req);
    let mediaUrl = null;
    if (req.file) {
      const base = process.env.BASE_URL || "";
      mediaUrl = `${base}/uploads/${path.basename(req.file.path)}`;
    }

    if (!isWhatsAppReady()) {
      // 503 indicates service temporarily unavailable (WA not connected)
      return res.status(503).json({ ok: false, error: "WhatsApp not connected" });
    }

    const result = await sendBroadcast({ recipients, body, mediaUrl });
    if (!result || result.ok === false) {
      return res.status(500).json(result);
    }
    return res.json(result);
  } catch (err) {
    console.error("POST /api/messages error:", err && err.stack ? err.stack : err);
    return res.status(500).json({ ok: false, error: err && err.message ? err.message : String(err) });
  }
});

// legacy POST /api/messages/broadcast -> delegate to root handler
router.post("/broadcast", upload.single("file"), async (req, res, next) => {
  // reuse root handler by forwarding
  req.url = "/";
  router.handle(req, res, next);
});

// GET /api/messages/status -> { connected: boolean }
router.get("/status", (req, res) => {
  try {
    const connected = isWhatsAppReady();
    res.json({ connected });
  } catch (e) {
    res.status(500).json({ connected: false, error: e && e.message ? e.message : String(e) });
  }
});

// GET /api/messages/qr -> { qr: string|null, connected: boolean }
router.get("/qr", (req, res) => {
  try {
    const qr = getLastQr();
    const connected = isWhatsAppReady();
    res.json({ qr: qr || null, connected });
  } catch (e) {
    res.status(500).json({ qr: null, connected: false, error: e && e.message ? e.message : String(e) });
  }
});

// GET /api/messages/qr.png -> PNG image of current QR (or 404)
router.get("/qr.png", async (req, res) => {
  try {
    const qr = getLastQr();
    if (!qr) return res.status(404).json({ error: "No QR available" });

    const buffer = await QRCode.toBuffer(qr, { type: "png", width: 300 });
    res.type("image/png").send(buffer);
  } catch (err) {
    console.error("GET /api/messages/qr.png error:", err && err.stack ? err.stack : err);
    res.status(500).json({ error: err && err.message ? err.message : String(err) });
  }
});

export default router;
