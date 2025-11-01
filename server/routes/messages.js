// server/routes/messages.js
import express from "express";
import multer from "multer";
import path from "path";
import { sendBroadcast } from "../services/whatsapp.service.js";

const router = express.Router();
const upload = multer({ dest: path.join(process.cwd(), "uploads/") });

// POST /api/messages/broadcast
// body: { message: string, numbers: string[] } optionally file in multipart under "file"
router.post("/broadcast", upload.single("file"), async (req, res) => {
  try {
    const { message } = req.body;
    // numbers might be sent as JSON string from client, handle both
    let { numbers } = req.body;
    if (!numbers) numbers = [];
    else if (typeof numbers === "string") {
      try {
        numbers = JSON.parse(numbers);
      } catch (e) {
        // maybe CSV separated
        numbers = numbers.split(",").map((s) => s.trim()).filter(Boolean);
      }
    }

    if (!message && !req.file) {
      return res.status(400).json({ error: "No message or file provided" });
    }

    console.info("Broadcast request:", { count: numbers.length, file: !!req.file });

    const fileInfo = req.file ? {
      path: req.file.path,
      originalname: req.file.originalname,
      mimetype: req.file.mimetype,
      size: req.file.size
    } : null;

    // sendBroadcast should return results per number (success/fail)
    const results = await sendBroadcast({ numbers, message, file: fileInfo });

    // results is expected to be an array of { number, ok: true/false, error?: string }
    res.json({ ok: true, results });
  } catch (err) {
    // full logging for debugging (will appear in Render logs)
    console.error("Error in /api/messages/broadcast:", err && err.stack ? err.stack : err);
    // return error message to client so UI can show helpful text
    res.status(500).json({ error: err && err.message ? err.message : "Internal server error" });
  }
});

export default router;
