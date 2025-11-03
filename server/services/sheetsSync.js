// server/services/sheetsSync.js (UPDATED)
// Improvements applied:
// 1. Cache auth JWT client to avoid repeated full authorize() calls.
// 2. Add simple retry wrapper for network operations (append/read/update).
// 3. Throw detailed errors so callers (queue wrapper) can retry accordingly.

import { google } from "googleapis";

const SCOPES = ["https://www.googleapis.com/auth/spreadsheets"];
let _cachedJwt = null;
let _cachedJwtExpiresAt = 0; // timestamp

function getAuthClient() {
  const clientEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  let privateKey = process.env.GOOGLE_PRIVATE_KEY || "";

  if (!clientEmail || !privateKey) {
    throw new Error(
      "Google service account credentials not set in env (GOOGLE_SERVICE_ACCOUNT_EMAIL/GOOGLE_PRIVATE_KEY)"
    );
  }

  privateKey = privateKey.replace(/\\n/g, "\n");

  // reuse cached jwt if not expired
  const now = Date.now();
  if (_cachedJwt && _cachedJwtExpiresAt > now + 5000) {
    return _cachedJwt;
  }

  const jwtClient = new google.auth.JWT({
    email: clientEmail,
    key: privateKey,
    scopes: SCOPES,
  });

  _cachedJwt = jwtClient;
  // do not set expires until authorize() completes in ensureAuth
  return jwtClient;
}

async function ensureAuth() {
  const jwt = getAuthClient();
  try {
    const r = await jwt.authorize();
    // google returns an expiry_date in ms
    if (r && r.expiry_date) _cachedJwtExpiresAt = r.expiry_date;
    return jwt;
  } catch (err) {
    console.error("Google JWT auth error:", err && err.message ? err.message : err);
    throw new Error(`Google auth failed: ${err && err.message ? err.message : err}`);
  }
}

async function getSheetsClient() {
  const auth = await ensureAuth();
  return google.sheets({ version: "v4", auth });
}

async function withRetries(fn, attempts = 3, delayMs = 1000) {
  let lastErr;
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn();
    } catch (e) {
      lastErr = e;
      // small backoff
      await new Promise((r) => setTimeout(r, delayMs * (i + 1)));
    }
  }
  throw lastErr;
}

/* --- Basic helpers --- */
export async function appendRow(sheetName, rowArray) {
  const spreadsheetId = process.env.GOOGLE_SHEETS_ID;
  if (!spreadsheetId) throw new Error("GOOGLE_SHEETS_ID not set");

  return withRetries(async () => {
    const sheets = await getSheetsClient();
    const res = await sheets.spreadsheets.values.append({
      spreadsheetId,
      range: `'${sheetName}'!A:A`,
      valueInputOption: "RAW",
      insertDataOption: "INSERT_ROWS",
      requestBody: { values: [rowArray] },
    });
    if (!res || res.status < 200 || res.status >= 300) throw new Error(`appendRow failed: ${res?.status}`);
    return res.data;
  }, 4, 1200);
}

export async function readSheet(sheetName) {
  const spreadsheetId = process.env.GOOGLE_SHEETS_ID;
  if (!spreadsheetId) throw new Error("GOOGLE_SHEETS_ID not set");

  return withRetries(async () => {
    const sheets = await getSheetsClient();
    const res = await sheets.spreadsheets.values.get({ spreadsheetId, range: `'${sheetName}'` });
    if (!res || res.status < 200 || res.status >= 300) throw new Error(`readSheet failed: ${res?.status}`);
    return res.data.values || [];
  }, 3, 1000);
}

export async function findRowIndex(sheetName, keyColIndex, value) {
  const rows = await readSheet(sheetName);
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    if ((r[keyColIndex] || "").toString() === value.toString()) {
      return i + 1; // sheet rows are 1-based
    }
  }
  return null;
}

export async function updateRow(sheetName, rowIndex, valuesArray) {
  const spreadsheetId = process.env.GOOGLE_SHEETS_ID;
  if (!spreadsheetId) throw new Error("GOOGLE_SHEETS_ID not set");

  return withRetries(async () => {
    const sheets = await getSheetsClient();
    const range = `'${sheetName}'!A${rowIndex}`;
    const res = await sheets.spreadsheets.values.update({
      spreadsheetId,
      range,
      valueInputOption: "RAW",
      requestBody: { values: [valuesArray] },
    });
    if (!res || res.status < 200 || res.status >= 300) throw new Error(`updateRow failed: ${res?.status}`);
    return res.data;
  }, 4, 1200);
}

/* --- High-level entity sync helpers (unchanged semantics) --- */
function safe(v) {
  return v === null || v === undefined ? "" : v.toString();
}

export async function syncClientToSheet(clientObj) {
  const sheet = "Clients";
  let rowIndex = null;
  if (clientObj.id) {
    rowIndex = await findRowIndex(sheet, 0, clientObj.id);
  }
  if (!rowIndex && clientObj.phone) {
    rowIndex = await findRowIndex(sheet, 2, clientObj.phone);
  }

  const row = [
    safe(clientObj.id || ""),
    safe(clientObj.name || ""),
    safe(clientObj.phone || ""),
    safe(clientObj.notes || ""),
    safe(clientObj.area || ""),
    safe(clientObj.points || 0),
  ];

  if (rowIndex) {
    await updateRow(sheet, rowIndex, row);
    return { action: "updated", rowIndex };
  } else {
    await appendRow(sheet, row);
    return { action: "appended" };
  }
}

export async function syncProductToSheet(prod) {
  const sheet = "Products";
  let rowIndex = null;
  if (prod.id) rowIndex = await findRowIndex(sheet, 0, prod.id);
  if (!rowIndex && prod.barcode) rowIndex = await findRowIndex(sheet, 2, prod.barcode);

  const row = [
    safe(prod.id || ""),
    safe(prod.name || ""),
    safe(prod.barcode || ""),
    safe(prod.category || ""),
    safe(prod.unit || ""),
    safe(prod.price || 0),
    safe(prod.qty || prod.stock || 0),
    safe(prod.expiry || ""),
    safe(prod.supplier || ""),
  ];

  if (rowIndex) {
    await updateRow(sheet, rowIndex, row);
    return { action: "updated", rowIndex };
  } else {
    await appendRow(sheet, row);
    return { action: "appended" };
  }
}

export async function syncSupplierToSheet(sup) {
  const sheet = "Suppliers";
  let rowIndex = null;
  if (sup.id) rowIndex = await findRowIndex(sheet, 0, sup.id);
  if (!rowIndex && sup.phone) rowIndex = await findRowIndex(sheet, 2, sup.phone);

  const row = [
    safe(sup.id || ""),
    safe(sup.name || ""),
    safe(sup.phone || ""),
    safe(sup.company || ""),
    safe(sup.balance || 0),
    safe(Array.isArray(sup.products) ? sup.products.join("|") : sup.products || ""),
  ];

  if (rowIndex) {
    await updateRow(sheet, rowIndex, row);
    return { action: "updated", rowIndex };
  } else {
    await appendRow(sheet, row);
    return { action: "appended" };
  }
}

export async function syncPurchaseToSheet(purchase) {
  const sheet = "Purchases";
  let rowIndex = null;
  if (purchase.id) rowIndex = await findRowIndex(sheet, 0, purchase.id);
  const row = [
    safe(purchase.id || ""),
    safe(purchase.number || ""),
    safe(purchase.supplier || ""),
    safe(purchase.date || ""),
    safe(purchase.total || 0),
    safe(JSON.stringify(purchase.items || [])),
  ];
  if (rowIndex) {
    await updateRow(sheet, rowIndex, row);
    return { action: "updated", rowIndex };
  } else {
    await appendRow(sheet, row);
    return { action: "appended" };
  }
}

export async function syncSaleToSheet(sale) {
  const sheet = "Sales";
  let rowIndex = null;
  if (sale.id) rowIndex = await findRowIndex(sheet, 0, sale.id);
  const row = [
    safe(sale.id || ""),
    safe(sale.number || ""),
    safe(sale.date || ""),
    safe(sale.client_phone || ""),
    safe(JSON.stringify(sale.items || [])),
    safe(sale.total || 0),
    safe(sale.payment_method || ""),
    safe(sale.points_used || 0),
  ];
  if (rowIndex) {
    await updateRow(sheet, rowIndex, row);
    return { action: "updated", rowIndex };
  } else {
    await appendRow(sheet, row);
    return { action: "appended" };
  }
}
