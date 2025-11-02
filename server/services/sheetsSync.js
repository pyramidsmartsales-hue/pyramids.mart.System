// server/services/sheetsSync.js
/**
 * sheetsSync - helper for two-way sync with Google Sheets
 *
 * Requires env:
 *  - GOOGLE_SERVICE_ACCOUNT_EMAIL
 *  - GOOGLE_PRIVATE_KEY  (use \n or newline string)
 *  - GOOGLE_SHEETS_ID
 *
 * Also: the service account must have edit access to the sheet (share the sheet with the service account email).
 */

import { google } from "googleapis";

const SCOPES = ["https://www.googleapis.com/auth/spreadsheets"];

function getAuthClient() {
  const clientEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  let privateKey = process.env.GOOGLE_PRIVATE_KEY || "";
  if (!clientEmail || !privateKey) {
    throw new Error("Google service account credentials not set in env (GOOGLE_SERVICE_ACCOUNT_EMAIL/GOOGLE_PRIVATE_KEY)");
  }
  // private key from env may contain literal \n; convert
  privateKey = privateKey.replace(/\\n/g, "\n");
  const jwtClient = new google.auth.JWT(clientEmail, null, privateKey, SCOPES);
  return jwtClient;
}

function getSheetsClient() {
  const auth = getAuthClient();
  return google.sheets({ version: "v4", auth });
}

/* --- Basic helpers --- */
export async function appendRow(sheetName, rowArray) {
  const sheets = getSheetsClient();
  const spreadsheetId = process.env.GOOGLE_SHEETS_ID;
  if (!spreadsheetId) throw new Error("GOOGLE_SHEETS_ID not set");
  const res = await sheets.spreadsheets.values.append({
    spreadsheetId,
    range: `'${sheetName}'!A:A`,
    valueInputOption: "RAW",
    insertDataOption: "INSERT_ROWS",
    requestBody: { values: [rowArray] }
  });
  return res.data;
}

export async function readSheet(sheetName) {
  const sheets = getSheetsClient();
  const spreadsheetId = process.env.GOOGLE_SHEETS_ID;
  if (!spreadsheetId) throw new Error("GOOGLE_SHEETS_ID not set");
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `'${sheetName}'`
  });
  return (res.data.values || []);
}

/**
 * Find a row index (1-based row number in sheet) where the column `keyColIndex` (0-based) equals string(value)
 * returns rowIndex (1-based) or null
 */
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

/** update entire row (replace) at rowIndex (1-based) */
export async function updateRow(sheetName, rowIndex, valuesArray) {
  const sheets = getSheetsClient();
  const spreadsheetId = process.env.GOOGLE_SHEETS_ID;
  if (!spreadsheetId) throw new Error("GOOGLE_SHEETS_ID not set");
  const range = `'${sheetName}'!A${rowIndex}`;
  const res = await sheets.spreadsheets.values.update({
    spreadsheetId,
    range,
    valueInputOption: "RAW",
    requestBody: { values: [valuesArray] }
  });
  return res.data;
}

/* --- High-level entity sync helpers --- */

function safe(v){ return v === null || v === undefined ? "" : v.toString(); }

export async function syncClientToSheet(clientObj) {
  const sheet = "Clients";
  const spreadsheetId = process.env.GOOGLE_SHEETS_ID;
  if (!spreadsheetId) throw new Error("GOOGLE_SHEETS_ID not set");

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
    safe(clientObj.points || 0)
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
    safe(prod.supplier || "")
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
    safe(Array.isArray(sup.products) ? sup.products.join("|") : (sup.products || ""))
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
    safe(JSON.stringify(purchase.items || []))
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
    safe(sale.points_used || 0)
  ];
  if (rowIndex) {
    await updateRow(sheet, rowIndex, row);
    return { action: "updated", rowIndex };
  } else {
    await appendRow(sheet, row);
    return { action: "appended" };
  }
}
