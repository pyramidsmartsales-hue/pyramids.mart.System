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
      price: Number(price ?? DATA.PRODUCTS[idx].price || 0),
      qty: Number(qty ?? DATA.PRODUCTS[idx].qty || 0),
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

/**
 * POST /api/products/from-sheet
 * Accept product create/update from Google Sheets
 * body: { action: 'create'|'update', row: { id?, name, barcode, unit, price, qty, expiry, supplier } }
 */
router.post("/from-sheet", async (req, res) => {
  try {
    const { action, row } = req.body || {};
    if (!row || !row.name) return res.status(400).json({ error: "row.name required" });

    if (action === "create") {
      const product = {
        id: DATA.NEXT_PRODUCT_ID++,
        name: row.name,
        barcode: row.barcode || "",
        category: row.category || "",
        unit: row.unit || "",
        price: Number(row.price || 0),
        qty: Number(row.qty || 0),
        expiry: row.expiry || null,
        supplier: row.supplier || null
      };
      DATA.PRODUCTS.push(product);
      return res.json({ ok: true, created: product });
    } else if (action === "update") {
      // try to find by barcode or id or name
      let found = null;
      if (row.barcode) found = DATA.PRODUCTS.find(p => p.barcode === row.barcode);
      if (!found && row.id) found = DATA.PRODUCTS.find(p => p.id === Number(row.id));
      if (!found && row.name) found = DATA.PRODUCTS.find(p => p.name === row.name);
      if (!found) return res.status(404).json({ error: "product not found to update" });

      found.name = row.name ?? found.name;
      found.barcode = row.barcode ?? found.barcode;
      found.unit = row.unit ?? found.unit;
      found.price = Number(row.price ?? found.price || 0);
      found.qty = Number(row.qty ?? found.qty || 0);
      found.expiry = row.expiry ?? found.expiry;
      found.supplier = row.supplier ?? found.supplier;
      return res.json({ ok: true, updated: found });
    } else {
      return res.status(400).json({ error: "unknown action" });
    }
  } catch (err) {
    console.error("products:from-sheet error", err);
    res.status(500).json({ error: "server error" });
  }
});

export default router;
