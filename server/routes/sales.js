// server/routes/sales.js
import express from "express";
const router = express.Router();

let MOCK_SALES = [];
let NEXT_SALE_ID = 1;

router.post("/checkout", async (req, res) => {
  const body = req.body || {};
  const sale = { id: NEXT_SALE_ID++, items: body.items || [], payment: body.payment || "cash", discount: body.discount || 0, total: 0, date: new Date().toISOString() };
  sale.total = sale.items.reduce((s, it) => s + (it.price * (it.qty || 1)), 0) * (1 - (sale.discount || 0) / 100);
  MOCK_SALES.push(sale);
  res.json({ ok: true, invoiceId: sale.id });
});

router.get("/", async (req, res) => {
  res.json({ sales: MOCK_SALES });
});

export default router;
