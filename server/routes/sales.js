// server/routes/sales.js
import express from "express";
import { DATA, findProductById, findClientByPhone, adjustProductQty } from "../data.js";
import { syncSaleToSheet, syncClientToSheet } from "../services/sheetsSync.js";

const router = express.Router();

/**
 * POST /api/sales/checkout
 * Perform checkout, decrement inventory, award points, sync sale & client
 */
router.post("/checkout", async (req, res) => {
  try {
    const body = req.body || {};
    const items = Array.isArray(body.items) ? body.items : [];
    const payment = body.payment || "cash";
    const discountPct = Number(body.discountPct || body.discount || 0);
    const customerPhone = body.customerPhone || null;
    const pointsAwardedBody = (body.pointsAwarded !== undefined && body.pointsAwarded !== null) ? Number(body.pointsAwarded) : null;

    // compute raw total
    const rawTotal = items.reduce((s, it) => {
      const price = Number(it.price || 0);
      const qty = Number(it.qty || 0);
      return s + price * qty;
    }, 0);
    const total = rawTotal * (1 - (discountPct || 0) / 100);

    // update product quantities (decrement)
    for (const it of items) {
      const prodId = it.id || it.productId;
      if (!prodId) continue;
      const qty = Number(it.qty || 0);
      adjustProductQty(prodId, -qty);
    }

    // record sale
    const sale = {
      id: DATA.NEXT_SALE_ID++,
      items,
      payment,
      discountPct,
      total,
      date: new Date().toISOString(),
      client_phone: customerPhone || null,
      pointsAwarded: (pointsAwardedBody !== null) ? pointsAwardedBody : Math.floor(total / 100)
    };
    DATA.SALES.push(sale);

    // award points and sync client
    if (customerPhone) {
      const client = findClientByPhone(customerPhone);
      if (client) {
        const awarded = (sale.pointsAwarded !== undefined && sale.pointsAwarded !== null) ? Number(sale.pointsAwarded) : Math.floor(total / 100);
        client.points = Number(client.points || 0) + awarded;
        try {
          const cliRes = await syncClientToSheet(client);
          console.log("Sheets sync (client after sale) succeeded:", cliRes);
        } catch (err) {
          console.warn("Sheets sync (client after sale) failed:", err && err.message ? err.message : err);
        }
      }
    }

    // sync sale to sheet
    try {
      const result = await syncSaleToSheet({
        id: sale.id,
        number: sale.number || `S-${sale.id}`,
        date: sale.date,
        client_phone: sale.client_phone,
        items: sale.items,
        total: sale.total,
        payment_method: sale.payment,
        points_used: sale.pointsUsed || 0
      });
      console.log("Sheets sync (sale) succeeded:", result);
      return res.json({ ok: true, invoiceId: sale.id, sale, sheetsSync: { success: true, result } });
    } catch (err) {
      console.error("Sheets sync (sale) failed:", err && err.message ? err.message : err);
      return res.json({ ok: true, invoiceId: sale.id, sale, sheetsSync: { success: false, error: (err && err.message) || String(err) } });
    }
  } catch (err) {
    console.error("checkout error", err);
    res.status(500).json({ ok: false, error: err.message || "server error" });
  }
});

router.get("/", async (req, res) => {
  res.json({ sales: DATA.SALES });
});

/**
 * POST /api/sales/from-sheet
 * Accept sale created via sheet (optional)
 */
router.post("/from-sheet", async (req, res) => {
  try {
    const { action, row } = req.body || {};
    if (!row) return res.status(400).json({ error: "row required" });

    if (action === "create") {
      const sale = {
        id: DATA.NEXT_SALE_ID++,
        items: Array.isArray(row.items) ? row.items : [],
        payment: row.payment || "cash",
        discountPct: Number(row.discountPct || 0),
        total: Number(row.total || 0),
        date: row.date || new Date().toISOString(),
        client_phone: row.client_phone || null,
        pointsAwarded: Number(row.pointsAwarded || 0)
      };
      // apply stock decrement if items provided
      for (const it of sale.items) {
        const prodId = it.id || it.productId;
        const qty = Number(it.qty || 0);
        if (prodId && qty) adjustProductQty(prodId, -qty);
      }
      DATA.SALES.push(sale);
      // sync client points if needed
      if (sale.client_phone) {
        const client = findClientByPhone(sale.client_phone);
        if (client) {
          client.points = Number(client.points || 0) + Number(sale.pointsAwarded || 0);
        }
      }
      return res.json({ ok: true, sale });
    }

    return res.status(400).json({ error: "unsupported action" });
  } catch (err) {
    console.error("sales:from-sheet error", err);
    res.status(500).json({ error: "server error" });
  }
});

export default router;
