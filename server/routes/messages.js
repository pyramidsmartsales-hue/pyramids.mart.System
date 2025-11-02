// server/routes/messages.js
import express from "express";
import fetch from "node-fetch";

const router = express.Router();

// If WA Cloud API route is enabled in server, we can proxy to it.
// Otherwise this remains a mock.

const WA_PHONE_ID = process.env.WA_PHONE_NUMBER_ID;
const WA_TOKEN = process.env.WA_ACCESS_TOKEN;
const useWhatsAppCloud = !!(WA_PHONE_ID && WA_TOKEN);

router.get("/status", async (req, res) => {
  if (useWhatsAppCloud) return res.json({ ok: true, connected: true, provider: "whatsapp-cloud" });
  return res.json({ ok: true, connected: false, provider: "mock" });
});

router.get("/qr", async (req, res) => {
  // No QR for cloud API. Return placeholder.
  res.json({ ok: true, qr: null });
});

router.post("/", async (req, res) => {
  try {
    const { numbers, message } = req.body || {};
    if ((!numbers || numbers.length === 0) && !message) {
      return res.status(400).json({ ok: false, error: "Numbers and message are required" });
    }

    // If WhatsApp Cloud configured, send via API per-number (be mindful of rate limits).
    if (useWhatsAppCloud) {
      const results = [];
      for (const to of numbers) {
        // ensure format like "2547..." or "+2547..."
        const r = await fetch(`https://graph.facebook.com/v17.0/${WA_PHONE_ID}/messages`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${WA_TOKEN}`,
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            messaging_product: "whatsapp",
            to,
            type: "text",
            text: { body: message }
          })
        });
        const json = await r.json();
        results.push({ to, status: r.ok ? "sent" : "failed", raw: json });
      }
      return res.json({ ok: true, results });
    }

    // fallback mock: echo
    const normalized = (numbers || []).map(n => {
      if (typeof n === "string") return n;
      if (n && n.phone) return n.phone;
      if (n && n.id) return String(n.id);
      return String(n);
    });

    const result = {
      sent: normalized.length,
      details: normalized.map(num => ({ to: num, status: "mock-sent" })),
      messageSummary: (message || "").slice(0, 120)
    };
    return res.json({ ok: true, result });
  } catch (err) {
    console.error("messages:send error", err);
    res.status(500).json({ ok: false, error: err.message || String(err) });
  }
});

export default router;
