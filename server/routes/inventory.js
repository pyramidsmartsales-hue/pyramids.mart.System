// server/routes/inventory.js
import express from "express";
const router = express.Router();

const MOCK_ITEMS = [
  { productId: 1, productName: "Rice 5kg", barcode: "123", branch: "Main", stock: 50, expected: 48, expiry: null },
  { productId: 2, productName: "Milk 1L", barcode: "987", branch: "Branch A", stock: 120, expected: 120, expiry: "2025-12-01" }
];

router.get("/", async (req, res) => {
  res.json({ items: MOCK_ITEMS });
});

// stock transfer stub
router.post("/move", async (req, res) => {
  // body: { productId, fromBranch, toBranch, qty }
  res.json({ ok: true, message: "Stock transfer recorded (mock)" });
});

// stock count stub
router.post("/count", async (req, res) => {
  // body: { productId, branch, actualCount }
  res.json({ ok: true, message: "Stock count recorded (mock)" });
});

export default router;
