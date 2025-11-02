// server/routes/clients.js
import express from "express";
import { DATA, findClientByPhone } from "../data.js";
import { syncClientToSheet } from "../services/sheetsSync.js";

const router = express.Router();

/**
 * GET /api/clients
 * returns list of clients
 */
router.get("/", async (req, res) => {
  res.json({ clients: DATA.CLIENTS });
});

/**
 * POST /api/clients
 * body: { name, phone, area, notes, points? }
 */
router.post("/", async (req, res) => {
  try {
    const { name, phone, area, notes, points } = req.body || {};
    if (!name || !phone) return res.status(400).json({ error: "name and phone required" });
    const normalizedPhone = String(phone).trim();
    // prevent duplicate phone
    const existing = DATA.CLIENTS.find(c => c.phone === normalizedPhone);
    if (existing) {
      return res.status(409).json({ error: "client with this phone already exists", client: existing });
    }
    const client = { id: DATA.NEXT_CLIENT_ID++, name, phone: normalizedPhone, area: area || "", notes: notes || "", points: Number(points || 0) };
    DATA.CLIENTS.push(client);

    // try sync to Google Sheets (best-effort)
    try {
      await syncClientToSheet(client);
    } catch (e) {
      console.warn("Sheets sync (create client) failed:", e && e.message ? e.message : e);
    }

    res.status(201).json({ client });
  } catch (err) {
    console.error("clients:create error", err);
    res.status(500).json({ error: "server error" });
  }
});

/**
 * PUT /api/clients/:id/points
 * body: { delta }  // add (or subtract) points
 */
router.put("/:id/points", async (req, res) => {
  try {
    const id = Number(req.params.id);
    const delta = Number(req.body.delta || 0);
    const idx = DATA.CLIENTS.findIndex(c => c.id === id);
    if (idx === -1) return res.status(404).json({ error: "client not found" });
    DATA.CLIENTS[idx].points = Number(DATA.CLIENTS[idx].points || 0) + delta;

    // sync updated client
    try {
      await syncClientToSheet(DATA.CLIENTS[idx]);
    } catch (e) {
      console.warn("Sheets sync (update client points) failed:", e && e.message ? e.message : e);
    }

    res.json({ client: DATA.CLIENTS[idx] });
  } catch (err) {
    console.error("clients:update-points error", err);
    res.status(500).json({ error: "server error" });
  }
});

/**
 * Helper: find by phone
 */
router.get("/by-phone/:phone", async (req, res) => {
  const phone = req.params.phone;
  const client = findClientByPhone(phone);
  if (!client) return res.status(404).json({ error: "not found" });
  res.json({ client });
});

export default router;
