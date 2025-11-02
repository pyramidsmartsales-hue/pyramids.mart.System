// server/routes/products.js
import express from "express";
import path from "path";
import fs from "fs";
import { DATA, findProductById } from "../data.js";
import { syncProductToSheet } from "../services/sheetsSync.js";

const router = express.Router();

// ensure uploads dir
const uploadsDir = path.join(process.cwd(), "uploads", "products");
try { if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true }); } catch (e) {}

// list
router.get("/", async (req, res) => {
  try {
    res.json({ products: DATA.PRODUCTS });
  } catch (err) {
    console.error("products:list error", err);
    res.status(500).json({ error: "server error" });
  }
});

// create
router.post("/", async (req, res) => {
  try {
    const { name, barcode, category, price, unit, qty, expiry, supplier } = req.body || {};
    if (!name) return res.status(400).json({ error: "name required" });

    const product = {
      id: DATA.NEXT_PRODUCT_ID++,
      name,
      barcode: barcode || "",
      category: category || "",
      unit: unit || "",
      price: Number(price || 0),
      qty: Number(qty || 0),
      expiry: expiry || null,
      supplier: supplier || null,
      image: null
    };
    DATA.PRODUCTS.push(product);

    // sync
    try {
      const result = await syncProductToSheet(product);
      console.log("Sheets sync (create product) succeeded:", result);
      return res.status(201).json({ product, sheetsSync: { success: true, result } });
    } catch (err) {
      console.error("Sheets sync (create product) failed:", err && err.message ? err.message : err);
      return res.status(201).json({ product, sheetsSync: { success: false, error: (err && err.message) || String(err) } });
    }
  } catch (err) {
    console.error("products:create error", err);
    res.status(500).json({ error: "server error" });
  }
});

// update
router.put("/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);
    const idx = DATA.PRODUCTS.findIndex(p => p.id === id);
    if (idx === -1) return res.status(404).json({ error: "not found" });

    const { name, barcode, category, price, unit, qty, expiry, supplier } = req.body || {};
    const updated = {
      ...DATA.PRODUCTS[idx],
      name: name ?? DATA.PRODUCTS[idx].name,
      barcode: barcode ?? DATA.PRODUCTS[idx].barcode,
      category: category ?? DATA.PRODUCTS[idx].category,
      unit: unit ?? DATA.PRODUCTS[idx].unit,
      // use parentheses to avoid precedence issues between ?? and ||
      price: Number((price ?? DATA.PRODUCTS[idx].price) || 0),
      qty: Number((qty ?? DATA.PRODUCTS[idx].qty) || 0),
      expiry: expiry ?? DATA.PRODUCTS[idx].expiry,
      supplier: supplier ?? DATA.PRODUCTS[idx].supplier
    };
    DATA.PRODUCTS[idx] = updated;

    try {
      const result = await syncProductToSheet(updated);
      console.log("Sheets sync (update product) succeeded:", result);
    } catch (err) {
      console.warn("Sheets sync (update product) failed:", err && err.message ? err.message : err);
    }

    res.json({ product: updated });
  } catch (err) {
    console.error("products:update error", err);
    res.status(500).json({ error: "server error" });
  }
});

// delete
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
