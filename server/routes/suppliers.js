// server/routes/suppliers.js
import express from "express";
import { DATA } from "../data.js";
import { syncSupplierToSheet } from "../services/sheetsSync.js";

const router = express.Router();

router.get("/", async (req, res) => {
  res.json({ suppliers: DATA.SUPPLIERS });
});

router.post("/", async (req, res) => {
  try {
    const { name, phone, company, products } = req.body || {};
    if (!name) return res.status(400).json({ error: "name required" });

    const s = {
      id: DATA.NEXT_SUPPLIER_ID++,
      name,
      phone: phone || null,
      company: company || null,
      balance: 0,
      products: Array.isArray(products) ? products : []
    };
    DATA.SUPPLIERS.push(s);

    try {
      const result = await syncSupplierToSheet(s);
      console.log("Sheets sync (create supplier) succeeded:", result);
      return res.status(201).json({ supplier: s, sheetsSync: { success: true, result } });
    } catch (err) {
      console.error("Sheets sync (create supplier) failed:", err && err.message ? err.message : err);
      return res.status(201).json({ supplier: s, sheetsSync: { success: false, error: (err && err.message) || String(err) } });
    }
  } catch (err) {
    console.error("suppliers:create error", err);
    res.status(500).json({ error: "server error" });
  }
});

/**
 * POST /api/suppliers/from-sheet
 * Accept supplier create/update from Google Sheets
 */
router.post("/from-sheet", async (req, res) => {
  try {
    const { action, row } = req.body || {};
    if (!row || !row.name) return res.status(400).json({ error: "row.name required" });

    if (action === "create") {
      const s = {
        id: DATA.NEXT_SUPPLIER_ID++,
        name: row.name,
        phone: row.phone || null,
        company: row.company || null,
        balance: Number(row.balance || 0),
        products: Array.isArray(row.products) ? row.products : []
      };
      DATA.SUPPLIERS.push(s);
      return res.json({ ok: true, created: s });
    } else if (action === "update") {
      const found = DATA.SUPPLIERS.find(s => s.name === row.name || String(s.id) === String(row.id));
      if (!found) return res.status(404).json({ error: "supplier not found" });
      found.phone = row.phone ?? found.phone;
      found.company = row.company ?? found.company;
      found.balance = Number(row.balance ?? found.balance || 0);
      found.products = Array.isArray(row.products) ? row.products : found.products;
      return res.json({ ok: true, updated: found });
    } else {
      return res.status(400).json({ error: "unknown action" });
    }
  } catch (err) {
    console.error("suppliers:from-sheet error", err);
    res.status(500).json({ error: "server error" });
  }
});

export default router;
