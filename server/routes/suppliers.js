// server/routes/suppliers.js
import express from "express";
import { DATA } from "../data.js";
const router = express.Router();

router.get("/", async (req, res) => {
  res.json({ suppliers: DATA.SUPPLIERS });
});

router.post("/", async (req, res) => {
  try {
    const { name, phone, company, products } = req.body;
    const s = { id: DATA.NEXT_SUPPLIER_ID++, name, phone, company, balance: 0, products: Array.isArray(products) ? products : [] };
    DATA.SUPPLIERS.push(s);
    res.status(201).json({ supplier: s });
  } catch (err) {
    console.error("suppliers:create error", err);
    res.status(500).json({ error: "server error" });
  }
});

router.get("/:id/invoices", async (req, res) => {
  const supplierId = Number(req.params.id);
  // find purchases matching supplier name (simple heuristic)
  const supplier = DATA.SUPPLIERS.find(s => s.id === supplierId);
  if (!supplier) return res.json({ invoices: [] });
  const invoices = DATA.PURCHASES.filter(inv => inv.supplier === supplier.name || inv.supplier === supplierId);
  res.json({ invoices });
});

export default router;
