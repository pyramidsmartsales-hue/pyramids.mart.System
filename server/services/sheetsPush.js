// server/services/sheetsPush.js
// Minimal, robust helper to upsert rows and mark deleted rows in Google Sheets
// Supports GOOGLE_CREDENTIALS_FILE (path), GOOGLE_CREDENTIALS_JSON, GOOGLE_CREDENTIALS_JSON_B64 (base64)
// Uses environment variable SHEETS_ID or SHEET_ID or SHEETS_ID.

const fs = require('fs');
const { google } = require('googleapis');

const SHEET_ID = process.env.SHEETS_ID || process.env.SHEET_ID || process.env.GOOGLE_SHEETS_ID || '';

function getCredentialsObject() {
  // 1) file
  const keyFile = process.env.GOOGLE_CREDENTIALS_FILE;
  if (keyFile && fs.existsSync(keyFile)) {
    try {
      const raw = fs.readFileSync(keyFile, 'utf8');
      return JSON.parse(raw);
    } catch (e) {
      throw new Error('Failed to parse GOOGLE_CREDENTIALS_FILE: ' + (e.message || e));
    }
  }
  // 2) raw JSON env
  if (process.env.GOOGLE_CREDENTIALS_JSON) {
    try { return JSON.parse(process.env.GOOGLE_CREDENTIALS_JSON); } catch (e) { throw new Error('Invalid JSON in GOOGLE_CREDENTIALS_JSON'); }
  }
  // 3) base64 env
  if (process.env.GOOGLE_CREDENTIALS_JSON_B64) {
    try {
      const decoded = Buffer.from(process.env.GOOGLE_CREDENTIALS_JSON_B64, 'base64').toString('utf8');
      return JSON.parse(decoded);
    } catch (e) {
      throw new Error('Invalid GOOGLE_CREDENTIALS_JSON_B64 (not base64 or invalid JSON)');
    }
  }
  return null;
}

async function getSheetsClientOrThrow() {
  if (!SHEET_ID) throw new Error('SHEET_ID (or SHEETS_ID / GOOGLE_SHEETS_ID) environment variable not set.');
  const creds = getCredentialsObject();
  if (!creds) throw new Error('No key or keyFile set. Set GOOGLE_CREDENTIALS_FILE or GOOGLE_CREDENTIALS_JSON(_B64).');
  if (!creds.client_email || !creds.private_key) throw new Error('Service account JSON missing client_email or private_key.');

  // create JWT auth client
  const jwt = new google.auth.JWT(creds.client_email, null, creds.private_key, ['https://www.googleapis.com/auth/spreadsheets']);
  await jwt.authorize();
  const sheets = google.sheets({ version: 'v4', auth: jwt });
  return { sheets, spreadsheetId: SHEET_ID };
}

async function readSheetValues(sheets, sheetName) {
  const resp = await sheets.spreadsheets.values.get({ spreadsheetId: SHEET_ID, range: sheetName });
  const values = resp.data.values || [];
  if (values.length === 0) return { header: [], rows: [] };
  const header = values[0].map(h => (h || '').toString().trim());
  const rows = values.slice(1);
  return { header, rows };
}

/**
 * upsertRowToSheet(sheetName, rowObj)
 * rowObj: object with keys matching header names (e.g. external_id, name, phone, etc.)
 * Behavior:
 *  - If header contains "external_id" column: find row with same external_id and UPDATE, else APPEND.
 *  - If header does not contain external_id: append a default-order row.
 */
async function upsertRowToSheet(sheetName, rowObj = {}) {
  try {
    const { sheets } = await getSheetsClientOrThrow();
    const { header, rows } = await readSheetValues(sheets, sheetName);

    const externalIdx = header.findIndex(h => h.toLowerCase() === 'external_id');
    const makeRow = (obj) => header.map(h => (obj[h] !== undefined ? String(obj[h]) : ''));

    if (externalIdx === -1) {
      // fallback: append default-order row
      const appendRow = [
        rowObj.external_id || '',
        rowObj.last_modified || '',
        rowObj.last_synced_by || '',
        rowObj.status || '',
        rowObj.name || '',
        rowObj.phone || '',
        rowObj.country || '',
        rowObj.city || '',
        rowObj.address || '',
        rowObj.notes || '',
        (rowObj.points !== undefined ? rowObj.points : '')
      ];
      await sheets.spreadsheets.values.append({
        spreadsheetId: SHEET_ID,
        range: sheetName,
        valueInputOption: 'USER_ENTERED',
        insertDataOption: 'INSERT_ROWS',
        resource: { values: [appendRow] }
      });
      console.log('[sheetsPush] Appended row (no external_id column).');
      return true;
    }

    // find matching external_id
    let foundRowIndex = -1;
    for (let i = 0; i < rows.length; i++) {
      const r = rows[i];
      if ((r[externalIdx] || '') === (rowObj.external_id || '')) {
        foundRowIndex = i;
        break;
      }
    }

    const dataRow = makeRow(rowObj);

    if (foundRowIndex >= 0) {
      const sheetRowNumber = 2 + foundRowIndex; // header is row 1
      const updateRange = `${sheetName}!A${sheetRowNumber}`;
      await sheets.spreadsheets.values.update({
        spreadsheetId: SHEET_ID,
        range: updateRange,
        valueInputOption: 'USER_ENTERED',
        resource: { values: [dataRow] }
      });
      console.log('[sheetsPush] Updated sheet row', sheetRowNumber, 'for external_id', rowObj.external_id);
      return true;
    } else {
      await sheets.spreadsheets.values.append({
        spreadsheetId: SHEET_ID,
        range: sheetName,
        valueInputOption: 'USER_ENTERED',
        insertDataOption: 'INSERT_ROWS',
        resource: { values: [dataRow] }
      });
      console.log('[sheetsPush] Appended new row for external_id', rowObj.external_id);
      return true;
    }
  } catch (e) {
    console.warn('[sheetsPush] upsertRowToSheet error:', e && e.message ? e.message : e);
    throw e;
  }
}

/**
 * markRowDeletedInSheet(sheetName, externalId)
 * - Finds row by external_id, sets status='deleted' if status column exists, otherwise clears the row.
 */
async function markRowDeletedInSheet(sheetName, externalId) {
  try {
    const { sheets } = await getSheetsClientOrThrow();
    const { header, rows } = await readSheetValues(sheets, sheetName);
    const externalIdx = header.findIndex(h => h.toLowerCase() === 'external_id');
    const statusIdx = header.findIndex(h => h.toLowerCase() === 'status');

    if (externalIdx === -1) {
      console.log('[sheetsPush] Cannot mark deleted: no external_id column.');
      throw new Error('No external_id column');
    }

    let foundRowIndex = -1;
    for (let i = 0; i < rows.length; i++) {
      if ((rows[i][externalIdx] || '') === externalId) {
        foundRowIndex = i;
        break;
      }
    }
    if (foundRowIndex === -1) {
      console.log('[sheetsPush] Row with external_id not found in sheet:', externalId);
      return false;
    }

    const sheetRowNumber = 2 + foundRowIndex;
    if (statusIdx !== -1) {
      const colLetter = String.fromCharCode('A'.charCodeAt(0) + statusIdx);
      const range = `${sheetName}!${colLetter}${sheetRowNumber}`;
      await sheets.spreadsheets.values.update({
        spreadsheetId: SHEET_ID,
        range,
        valueInputOption: 'USER_ENTERED',
        resource: { values: [['deleted']] }
      });
      console.log('[sheetsPush] Marked status=deleted for row', sheetRowNumber, 'external_id', externalId);
      return true;
    } else {
      const range = `${sheetName}!A${sheetRowNumber}:Z${sheetRowNumber}`;
      await sheets.spreadsheets.values.clear({
        spreadsheetId: SHEET_ID,
        range
      });
      console.log('[sheetsPush] Cleared row', sheetRowNumber, 'for external_id', externalId);
      return true;
    }
  } catch (e) {
    console.warn('[sheetsPush] markRowDeletedInSheet error:', e && e.message ? e.message : e);
    throw e;
  }
}

module.exports = {
  upsertRowToSheet,
  markRowDeletedInSheet
};
