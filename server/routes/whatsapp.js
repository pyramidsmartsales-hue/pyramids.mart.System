// server/routes/whatsapp.js
import express from "express";
const router = express.Router();

/**
 * Minimal stub for whatsapp routes so server can start.
 * Replace with your real whatsapp service endpoints later.
 */

router.get("/", (req, res) => {
  res.json({ ok: true, message: "WhatsApp route (stub) — implement real endpoints here." });
});

/**
 * Example endpoints that your frontend/server code sometimes call.
 * Keep them as stubs until you add the real implementation.
 */

router.post("/send", (req, res) => {
  // body: { to, message }
  res.json({ ok: true, status: "mock-sent", body: req.body || {} });
});

router.get("/status", (req, res) => {
  res.json({ ok: true, status: "mock", connected: false });
});

export default router;
