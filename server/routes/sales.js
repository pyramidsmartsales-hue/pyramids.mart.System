// server/routes/sales.js
import express from "express";
import { DATA, findProductById, findClientByPhone, adjustProductQty } from "../data.js";

const router = express.Router();

router.post("/checkout", async (req, res) => {
  try {
    const body = req.body || {};
    const items = Array.isArray(body.items) ? body.items : [];
    const payment = body.payment || "cash";
    const discountPct = Number(body.discountPct || body.discount || 0);
    const customerPhone = body.customerPhone || null;
    const pointsAwarded = Number(body.pointsAwarded || 0);

    // compute total before discount
    const rawTotal = items.reduce((s, it) => {
      const price = Number(it.price || 0);
      const qty = Number(it.qty || 0);
      return s + price * qty;
    }, 0);
    const total = rawTotal * (1 - (discountPct || 0) / 100);

    // update product quantities
    for (const it of items) {
      const prodId = it.id || it.productId;
      if (!prodId) continue;
      const qty = Number(it.qty || 0);
      // decrement stock
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
      customerPhone: customerPhone || null,
      pointsAwarded: pointsAwarded || Math.floor(total / 100) // fallback rule 1 point per 100 KSh
    };
    DATA.SALES.push(sale);

    // award points to client if present
    if (customerPhone) {
      const client = findClientByPhone(customerPhone);
      if (client) {
        client.points = Number(client.points || 0) + Number(sale.pointsAwarded || 0);
      }
    }

    res.json({ ok: true, invoiceId: sale.id, sale });
  } catch (err) {
    console.error("checkout error", err);
    res.status(500).json({ ok: false, error: err.message || "server error" });
  }
});

router.get("/", async (req, res) => {
  res.json({ sales: DATA.SALES });
});

export default router;
