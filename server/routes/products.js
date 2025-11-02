// server/routes/products.js
import express from "express";
import path from "path";
import fs from "fs";
import { DATA, findProductById } from "../data.js";
import { syncProductToSheet } from "../services/sheetsSync.js";

const router = express.Router();

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
    res.json({ products: DATA.PRODUCTS });
  } catch (err) {
    console.error("products:list error", err);
    res.status(500).json({ error: "server error" });
  }
});

// POST /api/products
router.post("/", async (req, res) => {
  try {
    const { name, barcode, category, price, unit, qty, expiry, supplier } = req.body;
    if (!name) return res.status(400).json({ error: "name required" });

    const product = { id: DATA.NEXT_PRODUCT_ID++, name, barcode, category, price: Number(price || 0), unit, qty: Number(qty || 0), expiry, image: null, supplier: supplier || null };
    DATA.PRODUCTS.push(product);

    // try sync to Sheets
    try {
      await syncProductToSheet(product);
    } catch (e) {
      console.warn("Sheets sync (create product) failed:", e && e.message ? e.message : e);
    }

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
    const idx = DATA.PRODUCTS.findIndex(p => p.id === id);
    if (idx === -1) return res.status(404).json({ error: "not found" });

    const { name, barcode, category, price, unit, qty, expiry, supplier } = req.body;
    const updated = { ...DATA.PRODUCTS[idx], name, barcode, category, price: Number(price || 0), unit, qty: Number(qty || 0), expiry, supplier: supplier || DATA.PRODUCTS[idx].supplier };
    DATA.PRODUCTS[idx] = updated;

    // try sync update to Sheets
    try {
      await syncProductToSheet(updated);
    } catch (e) {
      console.warn("Sheets sync (update product) failed:", e && e.message ? e.message : e);
    }

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
    const idx = DATA.PRODUCTS.findIndex(p => p.id === id);
    if (idx === -1) return res.status(404).json({ error: "not found" });
    DATA.PRODUCTS.splice(idx, 1);
    res.json({ ok: true });
  } catch (err) {
    console.error("products:delete error", err);
    res.status(500).json({ error: "server error" });
  }
});

router.post("/:id/image", async (req, res) => {
  res.status(501).json({
    error: "Image upload not enabled on server.",
    hint: "Install 'multer' and update server/routes/products.js to handle multipart/form-data."
  });
});

router.post("/import", async (req, res) => {
  res.status(501).json({
    error: "Import not enabled on server.",
    hint: "Install 'multer' and 'exceljs' then update this route to parse and insert rows."
  });
});

router.get("/export", async (req, res) => {
  try {
    const header = "id,name,barcode,category,unit,price,qty,expiry,supplier\n";
    const rows = DATA.PRODUCTS.map(p =>
      `${p.id},"${(p.name || "").replace(/"/g, '""')}",${p.barcode || ""},${p.category || ""},${p.unit || ""},${p.price || 0},${p.qty || 0},${p.expiry || ""},${p.supplier || ""}`
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
