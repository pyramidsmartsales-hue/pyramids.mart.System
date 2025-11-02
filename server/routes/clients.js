// server/routes/clients.js
import express from "express";
import { DATA, findClientByPhone } from "../data.js";
import { syncClientToSheet } from "../services/sheetsSync.js";

const router = express.Router();

/**
 * GET /api/clients
 */
router.get("/", async (req, res) => {
  res.json({ clients: DATA.CLIENTS });
});

/**
 * POST /api/clients
 * Creates a client and attempts to sync to Google Sheets (returns sync result for debug)
 */
router.post("/", async (req, res) => {
  try {
    const { name, phone, area, notes, points } = req.body || {};
    if (!name || !phone) return res.status(400).json({ error: "name and phone required" });

    const normalizedPhone = String(phone).trim();
    const existing = DATA.CLIENTS.find(c => c.phone === normalizedPhone);
    if (existing) {
      return res.status(409).json({ error: "client with this phone already exists", client: existing });
    }

    const client = {
      id: DATA.NEXT_CLIENT_ID++,
      name,
      phone: normalizedPhone,
      area: area || "",
      notes: notes || "",
      points: Number(points || 0)
    };
    DATA.CLIENTS.push(client);

    // attempt sync (synchronous for debug) and return result
    try {
      const result = await syncClientToSheet(client);
      console.log("Sheets sync (create client) succeeded:", result);
      return res.status(201).json({ client, sheetsSync: { success: true, result } });
    } catch (err) {
      console.error("Sheets sync (create client) failed:", err && err.message ? err.message : err);
      return res.status(201).json({ client, sheetsSync: { success: false, error: (err && err.message) || String(err) } });
    }
  } catch (err) {
    console.error("clients:create error", err);
    res.status(500).json({ error: "server error", detail: err && err.message ? err.message : String(err) });
  }
});

/**
 * PUT /api/clients/:id/points
 * Update points and sync
 */
router.put("/:id/points", async (req, res) => {
  try {
    const id = Number(req.params.id);
    const delta = Number(req.body.delta || 0);
    const idx = DATA.CLIENTS.findIndex(c => c.id === id);
    if (idx === -1) return res.status(404).json({ error: "client not found" });

    DATA.CLIENTS[idx].points = Number(DATA.CLIENTS[idx].points || 0) + delta;

    try {
      const result = await syncClientToSheet(DATA.CLIENTS[idx]);
      console.log("Sheets sync (update client points) succeeded:", result);
    } catch (err) {
      console.warn("Sheets sync (update client points) failed:", err && err.message ? err.message : err);
    }

    res.json({ client: DATA.CLIENTS[idx] });
  } catch (err) {
    console.error("clients:update-points error", err);
    res.status(500).json({ error: "server error" });
  }
});

/**
 * POST /api/clients/from-sheet
 * Accepts an object from Google Sheets webhook (sheet -> app)
 * body: { action: 'create'|'update', row: { id?, name, phone, area, notes, points } }
 */
router.post("/from-sheet", async (req, res) => {
  try {
    const { action, row } = req.body || {};
    if (!row || !row.phone) return res.status(400).json({ error: "row.phone required" });

    const phone = String(row.phone).trim();
    const existing = DATA.CLIENTS.find(c => c.phone === phone);

    if (action === "create" && !existing) {
      const client = {
        id: DATA.NEXT_CLIENT_ID++,
        name: row.name || "",
        phone,
        area: row.area || "",
        notes: row.notes || "",
        points: Number(row.points || 0)
      };
      DATA.CLIENTS.push(client);
      return res.json({ ok: true, created: client });
    } else if ((action === "update" || existing) && existing) {
      existing.name = row.name || existing.name;
      existing.area = row.area || existing.area;
      existing.notes = row.notes || existing.notes;
      existing.points = Number(row.points || existing.points || 0);
      return res.json({ ok: true, updated: existing });
    } else {
      return res.status(400).json({ error: "no action performed" });
    }
  } catch (err) {
    console.error("clients:from-sheet error", err);
    res.status(500).json({ error: "server error" });
  }
});

router.get("/by-phone/:phone", async (req, res) => {
  const phone = req.params.phone;
  const client = findClientByPhone(phone);
  if (!client) return res.status(404).json({ error: "not found" });
  res.json({ client });
});

export default router;
