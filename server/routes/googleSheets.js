// server/routes/googleSheets.js
// Server-side Google Sheets helper routes.
// Requires environment variables:
// GOOGLE_SERVICE_ACCOUNT_EMAIL
// GOOGLE_PRIVATE_KEY (with newline characters encoded as \n if necessary)
// GOOGLE_SHEETS_ID
//
// npm install googleapis

import express from "express";
import { google } from "googleapis";

const router = express.Router();

const SCOPES = ["https://www.googleapis.com/auth/spreadsheets"];

function getAuthClient() {
  const clientEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  let privateKey = process.env.GOOGLE_PRIVATE_KEY || "";
  if (!clientEmail || !privateKey) {
    throw new Error("Google service account credentials not set in env");
  }
  // If private key stored with literal '\n', convert to real newlines
  privateKey = privateKey.replace(/\\n/g, "\n");

  const jwtClient = new google.auth.JWT(clientEmail, null, privateKey, SCOPES);
  return jwtClient;
}

function getSheets() {
  const auth = getAuthClient();
  return google.sheets({ version: "v4", auth });
}

// Utility: append a row to an A1 sheet (sheetName = tab title)
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

// Utility: overwrite a sheet with 2D array
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

// Utility: read sheet values
async function readSheetValues(sheetId, sheetName) {
  const sheets = getSheets();
  const range = `'${sheetName}'`;
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: sheetId,
    range
  });
  return res.data.values || [];
}

/**
 * POST /api/sheets/push
 * body: { sheet: "Clients", row: ["col1", "col2", ...] }
 * Appends one row to given sheet.
 */
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

/**
 * POST /api/sheets/write
 * body: { sheet: "Clients", values: [ [r1c1, r1c2], [r2c1, r2c2] ] }
 * Overwrites sheet content starting A1.
 */
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

/**
 * GET /api/sheets/read?sheet=Clients
 * reads values from sheet
 */
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

/**
 * POST /api/sheets/webhook
 * This endpoint receives edits from an Apps Script webhook (sheet->server).
 * Body should include { secret, sheet, range, values } - secret is optional but recommended.
 */
router.post("/webhook", async (req, res) => {
  try {
    const secret = process.env.SHEETS_WEBHOOK_SECRET || null;
    const bodySecret = req.body?.secret ?? null;
    if (secret && secret !== bodySecret) {
      return res.status(403).json({ ok: false, error: "invalid secret" });
    }

    const { sheet, range, values } = req.body || {};
    // Implement your application-specific logic here.
    // Example: when sheet === "Clients" -> upsert client into DB.
    // For now we just log and return OK so you can extend later.
    console.log("Sheets webhook:", { sheet, range, sample: (values || [])[0] });
    // TODO: map sheet names to server actions, e.g. create/update clients/products...
    res.json({ ok: true, received: { sheet, range, sample: (values || [])[0] } });
  } catch (err) {
    console.error("sheets:webhook error", err?.message || err);
    res.status(500).json({ ok: false, error: err.message });
  }
});

export default router;
