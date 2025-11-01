// server/routes/messages.js
import express from "express";
import multer from "multer";
import path from "path";
import { sendBroadcast } from "../services/whatsapp.service.js";

const router = express.Router();
const upload = multer({ dest: path.join(process.cwd(), "uploads/") });

/**
 * Helper to normalize incoming payload into the internal messageDoc shape
 * expected by the whatsapp service (which uses `recipients` array and optionally
 * `mediaUrl`).
 *
 * Accepted client shapes:
 * - { numbers: ["2547..."], message: "text" }
 * - { recipients: [{ phone: "2547..." }], body: "text" }
 * - multipart form with file in `file` (req.file) and numbers as JSON string or CSV
 */
function buildMessageDocFromRequest(req) {
  // message text can be in `message` or `body`
  const text = req.body.message || req.body.body || "";

  // parse numbers/numbers string/recipients
  let numbers = req.body.numbers ?? req.body.numbersList ?? req.body.recipients ?? [];
  let recipients = [];

  // if recipients provided directly as array of objects
  if (Array.isArray(numbers) && numbers.length > 0 && typeof numbers[0] === "object") {
    // assume already in form [{ phone, clientId? }]
    recipients = numbers.map((r) => ({ phone: r.phone || r.number || r.to || r }));
  } else {
    // if numbers is a string, attempt to parse JSON, otherwise split CSV
    if (typeof numbers === "string") {
      try {
        const parsed = JSON.parse(numbers);
        if (Array.isArray(parsed)) {
          numbers = parsed;
        } else {
          // not an array -> fallback to CSV
          numbers = numbers.split(",").map((s) => s.trim()).filter(Boolean);
        }
      } catch (e) {
        // not JSON -> maybe CSV
        numbers = numbers.split(",").map((s) => s.trim()).filter(Boolean);
      }
    }

    if (!Array.isArray(numbers)) numbers = [];

    recipients = numbers.map((n) => ({ phone: n }));
  }

  const messageDoc = {
    body: text,
    recipients
  };

  // handle uploaded file by exposing it via the static /uploads route
  // the server serves /uploads -> <project>/uploads
  if (req.file) {
    const base = process.env.BASE_URL || "";
    const fileUrl = `${base}/uploads/${path.basename(req.file.path)}`;
    // The whatsapp service expects `mediaUrl` property (it will fetch it via axios)
    messageDoc.mediaUrl = fileUrl;
  }

  return messageDoc;
}

// POST /api/messages/broadcast
// kept for explicit broadcast route
router.post("/broadcast", upload.single("file"), async (req, res) => {
  try {
    const messageDoc = buildMessageDocFromRequest(req);

    if (!messageDoc.body && !messageDoc.mediaUrl) {
      return res.status(400).json({ error: "No message or file provided" });
    }

    console.info("Broadcast request (broadcast):", { count: (messageDoc.recipients || []).length, file: !!req.file });

    const results = await sendBroadcast({
      recipients: messageDoc.recipients,
      body: messageDoc.body,
      mediaUrl: messageDoc.mediaUrl,
      // preserve original fields for backward compatibility
    });

    res.json({ ok: true, results });
  } catch (err) {
    console.error("Error in /api/messages/broadcast:", err && err.stack ? err.stack : err);
    res.status(500).json({ error: err && err.message ? err.message : "Internal server error" });
  }
});

// POST /api/messages
// BACKWARD-COMPATIBILITY: some clients call POST /api/messages (no /broadcast)
// This route normalizes input and delegates to the same sendBroadcast implementation.
router.post("/", upload.single("file"), async (req, res) => {
  try {
    const messageDoc = buildMessageDocFromRequest(req);

    if (!messageDoc.body && !messageDoc.mediaUrl) {
      return res.status(400).json({ error: "No message or file provided" });
    }

    console.info("Broadcast request (root):", { count: (messageDoc.recipients || []).length, file: !!req.file });

    const results = await sendBroadcast({
      recipients: messageDoc.recipients,
      body: messageDoc.body,
      mediaUrl: messageDoc.mediaUrl,
    });

    res.json({ ok: true, results });
  } catch (err) {
    console.error("Error in /api/messages:", err && err.stack ? err.stack : err);
    res.status(500).json({ error: err && err.message ? err.message : "Internal server error" });
  }
});

export default router;
