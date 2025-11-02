// server/routes/purchases.js
import express from "express";
import { DATA, adjustProductQty } from "../data.js";

const router = express.Router();

/**
 * GET /api/purchases
 * returns recorded purchases (invoices)
 */
router.get("/", async (req, res) => {
  res.json({ invoices: DATA.PURCHASES });
});

/**
 * POST /api/purchases
 * body: { number, supplier, date, total, items: [{ id, qty, price }] }
 * When a purchase is created we increase product stock by item.qty
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

    // increase stock for each item
    for (const it of inv.items) {
      const prodId = it.id || it.productId;
      const qty = Number(it.qty || 0);
      if (prodId && qty) {
        adjustProductQty(prodId, qty);
      }
    }

    DATA.PURCHASES.push(inv);
    res.status(201).json({ invoice: inv });
  } catch (err) {
    console.error("purchases:create error", err);
    res.status(500).json({ error: "server error" });
  }
});

/**
 * POST /api/expenses
 * body: { date, amount, category, supplier, invoice_no, payment_method, notes }
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
    res.status(201).json({ expense: exp });
  } catch (err) {
    console.error("expenses:create error", err);
    res.status(500).json({ error: "server error" });
  }
});

export default router;
