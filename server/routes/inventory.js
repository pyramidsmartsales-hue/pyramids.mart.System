// server/routes/inventory.js
import express from "express";
import { DATA } from "../data.js";
const router = express.Router();

router.get("/", async (req, res) => {
  // return items built from products (including supplier)
  const items = DATA.PRODUCTS.map(p => ({
    productId: p.id,
    productName: p.name,
    barcode: p.barcode,
    branch: "Main",
    stock: p.qty || 0,
    expected: p.qty || 0,
    expiry: p.expiry || null,
    supplier: p.supplier || null
  }));
  res.json({ items });
});

router.post("/move", async (req, res) => {
  res.json({ ok: true, message: "Stock transfer recorded (mock)" });
});

router.post("/count", async (req, res) => {
  res.json({ ok: true, message: "Stock count recorded (mock)" });
});

export default router;
