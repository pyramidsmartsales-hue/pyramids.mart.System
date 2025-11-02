// server/routes/messages.js
import express from "express";
import { findClientByPhone } from "../data.js";

const router = express.Router();

/**
 * Simple messages/broadcast route (mock).
 * This avoids dependency on an external whatsapp.service which wasn't included.
 * It accepts POST { numbers: [], message } and returns a mock result.
 */

router.get("/status", async (req, res) => {
  res.json({ ok: true, connected: false });
});

router.get("/qr", async (req, res) => {
  res.json({ ok: true, qr: null });
});

router.post("/", async (req, res) => {
  try {
    const { numbers, message } = req.body || {};
    if ((!numbers || numbers.length === 0) && !message) {
      return res.status(400).json({ ok: false, error: "Numbers and message are required" });
    }

    // Normalize numbers: if clients objects were passed instead of plain numbers, map phone
    const normalized = (numbers || []).map(n => {
      if (typeof n === "string") return n;
      if (n && n.phone) return n.phone;
      if (n && n.id) {
        // try to find client by id
        const c = findClientByPhone(n.id);
        return c ? c.phone : String(n.id);
      }
      return String(n);
    });

    // Mock: return list of delivered & failed (none failed)
    const result = {
      sent: normalized.length,
      details: normalized.map(num => ({ to: num, status: "mock-sent" })),
      messageSummary: (message || "").slice(0, 120)
    };

    return res.json({ ok: true, result });
  } catch (err) {
    console.error("messages:send error", err);
    res.status(500).json({ ok: false, error: err.message || "server error" });
  }
});

export default router;
