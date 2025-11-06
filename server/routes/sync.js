// server/routes/sync.js
// ESM router factory -> export default (app) => router
// Requires: npm install googleapis
import express from 'express';
import { google } from 'googleapis';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function createSheetsClient() {
  // Google client libraries use GOOGLE_APPLICATION_CREDENTIALS env var by default.
  const keyFile = process.env.GOOGLE_APPLICATION_CREDENTIALS || process.env.GOOGLE_CREDENTIALS_FILE;
  if (!keyFile) {
    console.warn('[sync] No GOOGLE_APPLICATION_CREDENTIALS / GOOGLE_CREDENTIALS_FILE set');
    return null;
  }
  if (!fs.existsSync(keyFile)) {
    console.warn('[sync] keyFile not found at', keyFile);
    return null;
  }

  try {
    const auth = new google.auth.GoogleAuth({
      keyFilename: keyFile,
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });
    const sheets = google.sheets({ version: 'v4', auth });
    return { auth, sheets };
  } catch (e) {
    console.warn('[sync] createSheetsClient error:', e?.message || e);
    return null;
  }
}

export default function initSyncRouter(app) {
  const router = express.Router();

  // middleware simple logger for this router
  router.use((req, res, next) => {
    console.log(`[sync] ${req.method} ${req.originalUrl}`);
    next();
  });

  router.get('/', (req, res) => res.json({ ok: true, sync: true }));

  /**
   * POST /sheet-changes
   * Body example (your system already sends shape like this):
   * { action: 'reconcile'|'upsert'|'delete', sheets: [...], timestamp: '...' }
   */
  router.post('/sheet-changes', async (req, res) => {
    const payload = req.body;
    console.log('📩 /api/sync/sheet-changes payload:', JSON.stringify(payload, null, 2));

    const client = createSheetsClient();
    if (!client) {
      // respond 200 so caller doesn't keep retrying heavily, but explain failure in body
      console.warn('[sync] Sheets client unavailable — skipping push to Google Sheets');
      return res.status(200).json({ ok: false, reason: 'no_google_credentials' });
    }

    const { sheets } = client;
    // helper: safe wrapper for API calls
    async function safeBatchUpdate(spreadsheetId, requests) {
      try {
        const resp = await sheets.spreadsheets.batchUpdate({
          spreadsheetId,
          requestBody: { requests },
        });
        return resp.data;
      } catch (e) {
        console.warn('[sync] batchUpdate error:', e?.message || e);
        throw e;
      }
    }

    // NOTE: you must set SPREADSHEET_ID env or include sheet IDs in payload
    const SPREADSHEET_ID = process.env.SHEET_ID || process.env.SPREADSHEET_ID || null;
    if (!SPREADSHEET_ID) {
      console.warn('[sync] No SPREADSHEET_ID / SHEET_ID set in env');
      return res.status(200).json({ ok: false, reason: 'no_spreadsheet_id' });
    }

    try {
      // handle 'reconcile' action as bulk upsert example
      if (payload.action === 'reconcile') {
        // payload.sheets is an array containing sheetName and rows array (as your logs show)
        for (const sheet of payload.sheets || []) {
          const sheetName = sheet.sheetName;
          const rows = sheet.rows || [];
          // Example approach: for each row, we will update a range by rowNumber.
          // You should adapt ranges/columns to your sheet structure.
          for (const r of rows) {
            const rn = r.rowNumber;
            const data = r.data || {};
            // Map object fields to columns — change this mapping according to your sheet layout:
            // Example: A=external_id, B=last_modified, C=last_synced_by, D=status, E=name, F=phone ...
            const values = [
              data.external_id ?? '',
              data.last_modified ?? '',
              data.last_synced_by ?? '',
              data.status ?? '',
              data.name ?? '',
              data.phone ?? '',
              data.country ?? '',
              data.city ?? '',
              data.address ?? '',
              data.notes ?? '',
              data.points ?? '',
            ];

            const range = `${sheetName}!A${rn}:K${rn}`; // columns A..K
            try {
              await sheets.spreadsheets.values.update({
                spreadsheetId: SPREADSHEET_ID,
                range,
                valueInputOption: 'RAW',
                requestBody: { values: [values] },
              });
              console.log(`[sync] Updated ${range}`);
            } catch (e) {
              console.warn(`[sync] failed updating ${range}:`, e?.message || e);
            }
          }
        }
        // Emit to sockets if app has io
        try {
          const io = app && app.get && app.get('io');
          if (io) io.emit('clients:sync', { action: 'reconciled', timestamp: new Date().toISOString() });
        } catch (e) {
          // ignore
        }
        return res.json({ ok: true, action: 'reconcile_processed' });
      }

      // handle upsert: payload should include sheetName and row data
      if (payload.action === 'upsert') {
        const { sheetName = 'Clients', row = {} } = payload;
        // implement upsert logic appropriate to your sheet structure...
        // Simple example: append row if no external_id match => here we append
        const appendValues = [
          row.external_id ?? '',
          row.last_modified ?? '',
          row.last_synced_by ?? '',
          row.status ?? '',
          row.name ?? '',
          row.phone ?? '',
          row.country ?? '',
          row.city ?? '',
          row.address ?? '',
          row.notes ?? '',
          row.points ?? '',
        ];
        try {
          await sheets.spreadsheets.values.append({
            spreadsheetId: SPREADSHEET_ID,
            range: `${sheetName}!A:K`,
            valueInputOption: 'RAW',
            insertDataOption: 'INSERT_ROWS',
            requestBody: { values: [appendValues] },
          });
          return res.json({ ok: true, action: 'appended' });
        } catch (e) {
          console.warn('[sync] append error:', e?.message || e);
          return res.status(500).json({ ok: false, error: e?.message || e });
        }
      }

      // handle delete marking: expect payload { action: 'delete', external_id: '...' }
      if (payload.action === 'delete') {
        // Implementation note: deleting by external_id requires scanning sheet to find row number
        // Here we do a safe scan of the sheet's A column (external_id) and mark the row deleted (e.g., set status='deleted')
        const ext = payload.external_id;
        if (!ext) return res.status(400).json({ ok: false, reason: 'missing_external_id' });

        // read column A values
        const readResp = await sheets.spreadsheets.values.get({
          spreadsheetId: SPREADSHEET_ID,
          range: `Clients!A:A`,
        });
        const values = readResp.data.values || [];
        let foundRow = -1;
        for (let i = 0; i < values.length; i++) {
          if ((values[i][0] || '').toString() === ext.toString()) {
            foundRow = i + 1; // sheet rows are 1-indexed
            break;
          }
        }
        if (foundRow === -1) {
          console.warn('[sync] external_id not found in sheet:', ext);
          return res.json({ ok: false, reason: 'not_found' });
        }
        const markRange = `Clients!D${foundRow}`; // assume column D is status
        await sheets.spreadsheets.values.update({
          spreadsheetId: SPREADSHEET_ID,
          range: markRange,
          valueInputOption: 'RAW',
          requestBody: { values: [['deleted']] },
        });
        return res.json({ ok: true, markedRow: foundRow });
      }

      // unknown acti
