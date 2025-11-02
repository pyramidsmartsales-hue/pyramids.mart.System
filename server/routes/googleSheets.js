// server/routes/googleSheets.js
/**
 * Google Sheets helper + webhook mapping to server DATA.
 *
 * - Provides read/write helpers (requires GOOGLE_SERVICE_ACCOUNT_EMAIL, GOOGLE_PRIVATE_KEY, GOOGLE_SHEETS_ID)
 * - Accepts webhook POST at /api/sheets/webhook from Apps Script:
 *    body: {
 *      secret?,         // optional shared secret for security
 *      sheet: "Clients",
 *      headers: ["id","name","phone","area","notes","points"],
 *      rowIndex: 5,     // 1-based row index in sheet
 *      values: ["3","Ali","+2547...","Nairobi","note", "10"]
 *    }
 *
 * On webhook, this file will map sheet -> in-memory DATA operations:
 *  - "Clients" -> upsert client by id (if provided) or phone
 *  - "Products" -> upsert product by id or barcode
 *  - "Suppliers" -> upsert supplier
 *  - "Purchases" -> append purchase/invoice and increase stock
 *  - "Expenses" -> append expense
 *
 * NOTE: This operates on DATA in-memory. For persistence you should use a DB.
 */

import express from "express";
import { google } from "googleapis";
import { DATA, findProductById, findClientByPhone, adjustProductQty } from "../data.js";

const router = express.Router();
const SCOPES = ["https://www.googleapis.com/auth/spreadsheets"];

function getAuthClient() {
  const clientEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  let privateKey = process.env.GOOGLE_PRIVATE_KEY || "";
  if (!clientEmail || !privateKey) {
    throw new Error("Google service account credentials not set in env");
  }
  privateKey = privateKey.replace(/\\n/g, "\n");
  const jwtClient = new google.auth.JWT(clientEmail, null, privateKey, SCOPES);
  return jwtClient;
}

function getSheets() {
  const auth = getAuthClient();
  return google.sheets({ version: "v4", auth });
}

/* --- read / write helpers (kept from previous implementation) --- */

async function appendRowToSheet(sheetId, sheetName, row) {
  const sheets = getSheets();
  const range = `'${sheetName}'!A:A`;
  const res = await sheets.spreadsheets.values.append({
    spreadsheetId: sheetId,
    range,
    valueInputOption: "RAW",
    insertDataOption: "INSERT_ROWS",
    requestBody: {
      values: [row]
    }
  });
  return res.data;
}

async function writeSheetValues(sheetId, sheetName, values2d) {
  const sheets = getSheets();
  const range = `'${sheetName}'!A1`;
  const res = await sheets.spreadsheets.values.update({
    spreadsheetId: sheetId,
    range,
    valueInputOption: "RAW",
    requestBody: { values: values2d }
  });
  return res.data;
}

async function readSheetValues(sheetId, sheetName) {
  const sheets = getSheets();
  const range = `'${sheetName}'`;
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: sheetId,
    range
  });
  return res.data.values || [];
}

/* --- normal helper: map array values to object using headers --- */
function mapRow(headers = [], values = []) {
  const obj = {};
  for (let i = 0; i < headers.length; i++) {
    const key = String(headers[i] || "").trim();
    if (!key) continue;
    obj[key] = values[i] !== undefined ? values[i] : null;
  }
  return obj;
}

/* --- Web API for read/write (unchanged) --- */
router.post("/push", async (req, res) => {
  try {
    const sheetId = process.env.GOOGLE_SHEETS_ID;
    if (!sheetId) return res.status(400).json({ error: "GOOGLE_SHEETS_ID not configured" });
    const { sheet, row } = req.body || {};
    if (!sheet || !row || !Array.isArray(row)) return res.status(400).json({ error: "sheet and row array required" });
    const result = await appendRowToSheet(sheetId, sheet, row);
    res.json({ ok: true, result });
  } catch (err) {
    console.error("sheets:push error", err?.message || err);
    res.status(500).json({ ok: false, error: err.message });
  }
});

router.post("/write", async (req, res) => {
  try {
    const sheetId = process.env.GOOGLE_SHEETS_ID;
    if (!sheetId) return res.status(400).json({ error: "GOOGLE_SHEETS_ID not configured" });
    const { sheet, values } = req.body || {};
    if (!sheet || !values || !Array.isArray(values)) return res.status(400).json({ error: "sheet and values array required" });
    const result = await writeSheetValues(sheetId, sheet, values);
    res.json({ ok: true, result });
  } catch (err) {
    console.error("sheets:write error", err?.message || err);
    res.status(500).json({ ok: false, error: err.message });
  }
});

router.get("/read", async (req, res) => {
  try {
    const sheetId = process.env.GOOGLE_SHEETS_ID;
    if (!sheetId) return res.status(400).json({ error: "GOOGLE_SHEETS_ID not configured" });
    const sheet = req.query.sheet;
    if (!sheet) return res.status(400).json({ error: "sheet query required" });
    const values = await readSheetValues(sheetId, sheet);
    res.json({ ok: true, values });
  } catch (err) {
    console.error("sheets:read error", err?.message || err);
    res.status(500).json({ ok: false, error: err.message });
  }
});

/* --- Webhook: Apps Script calls this on edit --- */
router.post("/webhook", async (req, res) => {
  try {
    // security: optionally require SHEETS_WEBHOOK_SECRET
    const expectedSecret = process.env.SHEETS_WEBHOOK_SECRET || null;
    const bodySecret = req.body?.secret ?? null;
    if (expectedSecret && expectedSecret !== bodySecret) {
      return res.status(403).json({ ok: false, error: "invalid secret" });
    }

    const payload = req.body || {};
    // expected fields: sheet, headers (array), rowIndex (1-based), values (array)
    const { sheet, headers, rowIndex, values } = payload;
    if (!sheet || !Array.isArray(headers) || !Array.isArray(values)) {
      // allow legacy simple payloads
      console.log("Sheets webhook received (unexpected format):", payload);
      return res.json({ ok: true, note: "no-op (unexpected payload)" });
    }

    const rowObj = mapRow(headers, values);
    console.log("Sheets webhook mapping:", { sheet, rowIndex, rowObj });

    // --- implement mapping per sheet name (case-insensitive) ---
    const name = String(sheet || "").trim().toLowerCase();

    if (name === "clients" || name === "clients ") {
      // expected columns: id(optional), name, phone, area, notes, points
      const id = rowObj.id ? Number(rowObj.id) : null;
      const phone = String(rowObj.phone || "").trim();
      const nameVal = rowObj.name || rowObj.fullname || rowObj["الاسم"] || "";
      const area = rowObj.area || rowObj.region || "";
      const notes = rowObj.notes || "";
      const points = Number(rowObj.points || rowObj.bonus || 0);

      // upsert by id -> if id found, update; else try match by phone; else create new
      let client = null;
      if (id) client = DATA.CLIENTS.find(c => Number(c.id) === Number(id));
      if (!client && phone) client = findClientByPhone(phone);
      if (client) {
        client.name = nameVal || client.name;
        client.phone = phone || client.phone;
        client.area = area || client.area;
        client.notes = notes || client.notes;
        client.points = Number(points || client.points || 0);
        console.log("Updated client via Sheets:", client);
        return res.json({ ok: true, action: "updated", client });
      } else {
        const newClient = {
          id: DATA.NEXT_CLIENT_ID++,
          name: nameVal || "Unknown",
          phone: phone || "",
          area: area || "",
          notes: notes || "",
          points: points || 0
        };
        DATA.CLIENTS.push(newClient);
        console.log("Created client via Sheets:", newClient);
        return res.json({ ok: true, action: "created", client: newClient });
      }
    }

    if (name === "products" || name === "products ") {
      // expected headers: id(optional), name, barcode, category, unit, price, qty, expiry, supplier
      const id = rowObj.id ? Number(rowObj.id) : null;
      const barcode = String(rowObj.barcode || "").trim();
      const prodName = rowObj.name || rowObj.product || "Unnamed";
      const category = rowObj.category || "";
      const unit = rowObj.unit || "";
      const price = Number(rowObj.price || rowObj.cost || 0);
      const qty = Number(rowObj.qty || rowObj.stock || rowObj.quantity || 0);
      const expiry = rowObj.expiry || null;
      const supplier = rowObj.supplier || null;

      // upsert: by id, then barcode
      let product = null;
      if (id) product = DATA.PRODUCTS.find(p => Number(p.id) === Number(id));
      if (!product && barcode) product = DATA.PRODUCTS.find(p => String(p.barcode) === String(barcode));
      if (product) {
        product.name = prodName || product.name;
        product.barcode = barcode || product.barcode;
        product.category = category || product.category;
        product.unit = unit || product.unit;
        product.price = Number(price || product.price || 0);
        product.qty = Number(qty || product.qty || 0);
        product.expiry = expiry || product.expiry;
        product.supplier = supplier || product.supplier || null;
        console.log("Updated product via Sheets:", product);
        return res.json({ ok: true, action: "updated", product });
      } else {
        const newProd = {
          id: DATA.NEXT_PRODUCT_ID++,
          name: prodName,
          barcode: barcode,
          category,
          unit,
          price: Number(price || 0),
          qty: Number(qty || 0),
          expiry: expiry || null,
          image: null,
          supplier: supplier || null
        };
        DATA.PRODUCTS.push(newProd);
        console.log("Created product via Sheets:", newProd);
        return res.json({ ok: true, action: "created", product: newProd });
      }
    }

    if (name === "suppliers") {
      const id = rowObj.id ? Number(rowObj.id) : null;
      const sname = rowObj.name || rowObj.company || "Supplier";
      const phone = rowObj.phone || "";
      const company = rowObj.company || sname;
      // upsert by id or by phone/company
      let sup = null;
      if (id) sup = DATA.SUPPLIERS.find(s => Number(s.id) === Number(id));
      if (!sup && phone) sup = DATA.SUPPLIERS.find(s => (s.phone || "") === phone);
      if (!sup) sup = DATA.SUPPLIERS.find(s => (s.company || "").toLowerCase() === String(company || "").toLowerCase());
      if (sup) {
        sup.name = sname || sup.name;
        sup.phone = phone || sup.phone;
        sup.company = company || sup.company;
        console.log("Updated supplier via Sheets:", sup);
        return res.json({ ok: true, action: "updated", supplier: sup });
      } else {
        const newSup = { id: DATA.NEXT_SUPPLIER_ID++, name: sname, phone, company: company, balance: 0, products: [] };
        DATA.SUPPLIERS.push(newSup);
        console.log("Created supplier via Sheets:", newSup);
        return res.json({ ok: true, action: "created", supplier: newSup });
      }
    }

    if (name === "purchases" || name === "invoices") {
      // expected headers: number, supplier, date, total, itemsJson
      // itemsJson can be JSON string: [{ "id":1, "qty": 10, "price": 2400 }, ...]
      const number = rowObj.number || `INV-${Date.now()}`;
      const supplier = rowObj.supplier || "Unknown";
      const date = rowObj.date || new Date().toISOString().slice(0, 10);
      const total = Number(rowObj.total || 0);
      let items = [];
      if (rowObj.itemsJson) {
        try { items = JSON.parse(rowObj.itemsJson); } catch (e) { items = []; }
      } else if (rowObj.items) {
        try { items = JSON.parse(rowObj.items); } catch (e) { items = []; }
      }

      const invoice = { id: DATA.NEXT_PURCHASE_ID++, number, supplier, date, total, items };
      // increase stock for each item
      for (const it of items) {
        const prodId = it.id || it.productId;
        const qty = Number(it.qty || 0);
        if (prodId && qty) adjustProductQty(prodId, qty);
      }
      DATA.PURCHASES.push(invoice);
      console.log("Created purchase/invoice via Sheets:", invoice);
      return res.json({ ok: true, action: "created", invoice });
    }

    if (name === "expenses") {
      const date = rowObj.date || new Date().toISOString().slice(0, 10);
      const amount = Number(rowObj.amount || rowObj.total || 0);
      const category = rowObj.category || "General";
      const supplier = rowObj.supplier || null;
      const invoice_no = rowObj.invoice_no || null;
      const payment_method = rowObj.payment_method || null;
      const notes = rowObj.notes || "";

      const exp = { id: DATA.NEXT_EXPENSE_ID++, date, amount, category, supplier, invoice_no, payment_method, notes };
      DATA.EXPENSES.push(exp);
      console.log("Created expense via Sheets:", exp);
      return res.json({ ok: true, action: "created", expense: exp });
    }

    // default: no mapping for sheet name
    console.log("Sheets webhook: unmapped sheet:", sheet);
    res.json({ ok: true, note: "unmapped sheet", sheet });
  } catch (err) {
    console.error("sheets:webhook mapping error:", err);
    res.status(500).json({ ok: false, error: err.message || String(err) });
  }
});

export default router;
