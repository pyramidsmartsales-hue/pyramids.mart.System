// server/routes/products.js
import express from "express";
import path from "path";
import fs from "fs";

const router = express.Router();

/**
 * Safe products router (mock)
 * - GET /api/products
 * - POST /api/products
 * - PUT /api/products/:id
 * - DELETE /api/products/:id
 * - POST /api/products/:id/image   (stub -> returns 501 if multer not installed)
 * - POST /api/products/import     (stub -> returns 501 if multer not installed)
 * - GET /api/products/export      (returns CSV from mock)
 *
 * This implementation purposefully does NOT require 'multer' or other native upload libs
 * to avoid introducing runtime dependency that could break the server if not installed.
 *
 * When ready to enable uploads/import, install multer and replace the stubs.
 */

// ===== In-memory mock DB (safe default) =====
let MOCK_PRODUCTS = [
  { id: 1, name: "Rice 5kg", barcode: "1234567890123", category: "Groceries", price: 25.5, unit: "bag", qty: 50, expiry: null, image: null },
  { id: 2, name: "Milk 1L", barcode: "9876543210987", category: "Dairy", price: 1.5, unit: "bottle", qty: 120, expiry: "2025-12-01", image: null }
];
let NEXT_ID = MOCK_PRODUCTS.length + 1;

// Ensure uploads dir exists (for potential future files)
const uploadsDir = path.join(process.cwd(), "uploads", "products");
try {
  if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });
} catch (e) {
  console.warn("Could not ensure uploads/products directory:", e && e.message ? e.message : e);
}

// GET /api/products
router.get("/", async (req, res) => {
  try {
    res.json({ products: MOCK_PRODUCTS });
  } catch (err) {
    console.error("products:list error", err);
    res.status(500).json({ error: "server error" });
  }
});

// POST /api/products
router.post("/", async (req, res) => {
  try {
    const { name, barcode, category, price, unit, qty, expiry } = req.body;
    if (!name) return res.status(400).json({ error: "name required" });

    const product = { id: NEXT_ID++, name, barcode, category, price, unit, qty, expiry, image: null };
    MOCK_PRODUCTS.push(product);

    res.status(201).json({ product });
  } catch (err) {
    console.error("products:create error", err);
    res.status(500).json({ error: "server error" });
  }
});

// PUT /api/products/:id
router.put("/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);
    const idx = MOCK_PRODUCTS.findIndex(p => p.id === id);
    if (idx === -1) return res.status(404).json({ error: "not found" });

    const { name, barcode, category, price, unit, qty, expiry } = req.body;
    const updated = { ...MOCK_PRODUCTS[idx], name, barcode, category, price, unit, qty, expiry };
    MOCK_PRODUCTS[idx] = updated;

    res.json({ product: updated });
  } catch (err) {
    console.error("products:update error", err);
    res.status(500).json({ error: "server error" });
  }
});

// DELETE /api/products/:id
router.delete("/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);
    const idx = MOCK_PRODUCTS.findIndex(p => p.id === id);
    if (idx === -1) return res.status(404).json({ error: "not found" });
    MOCK_PRODUCTS.splice(idx, 1);
    res.json({ ok: true });
  } catch (err) {
    console.error("products:delete error", err);
    res.status(500).json({ error: "server error" });
  }
});

/**
 * POST /api/products/:id/image
 * Stub: If you want actual file upload support, install multer and update this route.
 * For now we intentionally do NOT parse multipart to avoid requiring multer at runtime.
 */
router.post("/:id/image", async (req, res) => {
  // Inform the user/admin how to enable uploads without breaking the server.
  res.status(501).json({
    error: "Image upload not enabled on server.",
    hint: "Install 'multer' and update server/routes/products.js to handle multipart/form-data."
  });
});

/**
 * POST /api/products/import
 * Stub for Excel/CSV import. To enable: install 'multer' and 'exceljs' and parse req.file.
 */
router.post("/import", async (req, res) => {
  res.status(501).json({
    error: "Import not enabled on server.",
    hint: "Install 'multer' and 'exceljs' then update this route to parse and insert rows."
  });
});

/**
 * GET /api/products/export
 * Returns a CSV constructed from the mock dataset for download.
 */
router.get("/export", async (req, res) => {
  try {
    const header = "id,name,barcode,category,unit,price,qty,expiry\n";
    const rows = MOCK_PRODUCTS.map(p =>
      `${p.id},"${(p.name || "").replace(/"/g, '""')}",${p.barcode || ""},${p.category || ""},${p.unit || ""},${p.price || 0},${p.qty || 0},${p.expiry || ""}`
    ).join("\n");
    const csv = header + rows;
    res.setHeader("Content-Type", "text/csv");
    res.setHeader("Content-Disposition", `attachment; filename="products_export_${Date.now()}.csv"`);
    res.send(csv);
  } catch (err) {
    console.error("products:export error", err);
    res.status(500).json({ error: "server error" });
  }
});

export default router;
