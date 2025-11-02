// server/routes/purchases.js
import express from "express";
const router = express.Router();

let MOCK_INVOICES = [
  { id: 1, number: "INV-1001", supplier: "Supplier A", date: "2025-10-01", total: 500 },
  { id: 2, number: "INV-1002", supplier: "Supplier B", date: "2025-10-05", total: 1200 }
];

router.get("/", async (req, res) => {
  res.json({ invoices: MOCK_INVOICES });
});

router.post("/", async (req, res) => {
  const body = req.body || {};
  const inv = { id: MOCK_INVOICES.length + 1, number: body.number || `INV-${Date.now()}`, supplier: body.supplier || "Unknown", date: body.date || new Date().toISOString(), total: body.total || 0 };
  MOCK_INVOICES.push(inv);
  res.status(201).json({ invoice: inv });
});

export default router;
