// server/routes/inventory.js
import express from "express";
import { DATA } from "../data.js";

const router = express.Router();

/**
 * GET /api/inventory
 * Returns inventory derived from products (with supplier info)
 */
router.get("/", async (req, res) => {
  try {
    const items = DATA.PRODUCTS.map(p => ({
      productId: p.id,
      productName: p.name,
      barcode: p.barcode || "",
      branch: p.branch || "Main",
      stock: Number(p.qty || 0),
      expected: Number(p.qty || 0),
      expiry: p.expiry || null,
      supplier: p.supplier || null
    }));
    res.json({ items });
  } catch (err) {
    console.error("inventory:list error", err);
    res.status(500).json({ error: "server error" });
  }
});

/**
 * POST /api/inventory/move
 * Mock: handle transfer or stock adjustments
 */
router.post("/move", async (req, res) => {
  try {
    // body: { productId, fromBranch, toBranch, qty }
    // implement actual logic if needed
    res.json({ ok: true, message: "Stock transfer recorded (mock)" });
  } catch (err) {
    console.error("inventory:move error", err);
    res.status(500).json({ error: "server error" });
  }
});

/**
 * POST /api/inventory/count
 * Mock: accept stock count adjustments from sheet or UI
 * body: { productId, qty }
 */
router.post("/count", async (req, res) => {
  try {
    const { productId, qty } = req.body || {};
    if (!productId) return res.status(400).json({ error: "productId required" });
    const prod = DATA.PRODUCTS.find(p => p.id === Number(productId));
    if (!prod) return res.status(404).json({ error: "product not found" });
    prod.qty = Number(qty || 0);
    // optionally sync product to sheet here
    res.json({ ok: true, product: prod });
  } catch (err) {
    console.error("inventory:count error", err);
    res.status(500).json({ error: "server error" });
  }
});

export default router;
