// server/routes/purchases.js
import express from "express";
import { DATA, adjustProductQty } from "../data.js";
import { syncPurchaseToSheet } from "../services/sheetsSync.js";

const router = express.Router();

/**
 * GET /api/purchases
 */
router.get("/", async (req, res) => {
  res.json({ invoices: DATA.PURCHASES });
});

/**
 * POST /api/purchases
 * Create purchase (increase stock) and sync
 */
router.post("/", async (req, res) => {
  try {
    const body = req.body || {};
    const inv = {
      id: DATA.NEXT_PURCHASE_ID++,
      number: body.number || `INV-${Date.now()}`,
      supplier: body.supplier || "Unknown",
      date: body.date || new Date().toISOString(),
      total: Number(body.total || 0),
      items: Array.isArray(body.items) ? body.items : []
    };

    // increase stock
    for (const it of inv.items) {
      const prodId = it.id || it.productId;
      const qty = Number(it.qty || 0);
      if (prodId && qty) adjustProductQty(prodId, qty);
    }

    DATA.PURCHASES.push(inv);

    try {
      const result = await syncPurchaseToSheet(inv);
      console.log("Sheets sync (create purchase) succeeded:", result);
      return res.status(201).json({ invoice: inv, sheetsSync: { success: true, result } });
    } catch (err) {
      console.error("Sheets sync (create purchase) failed:", err && err.message ? err.message : err);
      return res.status(201).json({ invoice: inv, sheetsSync: { success: false, error: (err && err.message) || String(err) } });
    }
  } catch (err) {
    console.error("purchases:create error", err);
    res.status(500).json({ error: "server error" });
  }
});

/**
 * POST /api/purchases/expenses
 * create an expense record (no sheet sync by default)
 */
router.post("/expenses", async (req, res) => {
  try {
    const body = req.body || {};
    const exp = {
      id: DATA.NEXT_EXPENSE_ID++,
      date: body.date || new Date().toISOString().slice(0, 10),
      amount: Number(body.amount || 0),
      category: body.category || "General",
      supplier: body.supplier || null,
      invoice_no: body.invoice_no || null,
      payment_method: body.payment_method || null,
      notes: body.notes || ""
    };
    DATA.EXPENSES.push(exp);
    // (optional) you can sync expenses to a dedicated sheet if implemented in sheetsSync
    res.status(201).json({ expense: exp });
  } catch (err) {
    console.error("expenses:create error", err);
    res.status(500).json({ error: "server error" });
  }
});

/**
 * POST /api/purchases/from-sheet
 * Accept purchase/invoice created via Google Sheets
 */
router.post("/from-sheet", async (req, res) => {
  try {
    const { action, row } = req.body || {};
    if (!row) return res.status(400).json({ error: "row required" });

    if (action === "create") {
      const inv = {
        id: DATA.NEXT_PURCHASE_ID++,
        number: row.number || `INV-${Date.now()}`,
        supplier: row.supplier || "Unknown",
        date: row.date || new Date().toISOString(),
        total: Number(row.total || 0),
        items: Array.isArray(row.items) ? row.items : []
      };
      // adjust stock
      for (const it of inv.items) {
        const prodId = it.id || it.productId;
        const qty = Number(it.qty || 0);
        if (prodId && qty) adjustProductQty(prodId, qty);
      }
      DATA.PURCHASES.push(inv);
      return res.json({ ok: true, invoice: inv });
    }

    return res.status(400).json({ error: "unsupported action" });
  } catch (err) {
    console.error("purchases:from-sheet error", err);
    res.status(500).json({ error: "server error" });
  }
});

export default router;
