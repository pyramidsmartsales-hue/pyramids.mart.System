// server/routes/whatsappCloud.js
// Simple wrapper to send messages via Meta WhatsApp Cloud API.
// Requires env:
// WA_PHONE_NUMBER_ID
// WA_ACCESS_TOKEN
//
// Usage: POST /api/whatsapp/send { to: "+2547...", message: "Hello" }

import express from "express";
import fetch from "node-fetch";

const router = express.Router();

const WA_PHONE_ID = process.env.WA_PHONE_NUMBER_ID;
const WA_TOKEN = process.env.WA_ACCESS_TOKEN;

function hasConfig() {
  return !!(WA_PHONE_ID && WA_TOKEN);
}

router.get("/status", (req, res) => {
  res.json({ ok: true, enabled: hasConfig() });
});

/**
 * POST /api/whatsapp/send
 * body: { to: "+2547...", message: "text here" }
 */
router.post("/send", async (req, res) => {
  if (!hasConfig()) {
    return res.status(400).json({ ok: false, error: "WhatsApp Cloud API not configured (WA_PHONE_NUMBER_ID / WA_ACCESS_TOKEN)" });
  }
  try {
    const { to, message } = req.body || {};
    if (!to || !message) return res.status(400).json({ ok: false, error: "to and message required" });

    const url = `https://graph.facebook.com/v17.0/${WA_PHONE_ID}/messages`;
    const body = {
      messaging_product: "whatsapp",
      to,
      type: "text",
      text: { body: message }
    };

    const r = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${WA_TOKEN}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(body)
    });

    const json = await r.json();
    if (!r.ok) {
      console.error("WhatsApp API error:", json);
      return res.status(500).json({ ok: false, error: json });
    }
    res.json({ ok: true, result: json });
  } catch (err) {
    console.error("whatsapp:send error", err);
    res.status(500).json({ ok: false, error: err.message });
  }
});

export default router;
