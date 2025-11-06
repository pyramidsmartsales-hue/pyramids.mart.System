// server/routes/sync.js
// Router مُعاد كتابته بصيغة ESM كـ factory: export default (app) => router
// يعتمد على googleapis (npm install googleapis)

import express from 'express';
import { google } from 'googleapis';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * يُنشئ عميل Google Sheets باستخدام GOOGLE_APPLICATION_CREDENTIALS أو GOOGLE_CREDENTIALS_FILE.
 * يرجع { auth, sheets } أو null عند الفشل.
 */
function createSheetsClient() {
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

/**
 * Helper: Attempt to emit socket event if app has socket.io stored as 'io'
 */
function emitIo(app, event, payload) {
  try {
    if (!app || typeof app.get !== 'function') return;
    const io = app.get('io');
    if (io && typeof io.emit === 'function') io.emit(event, payload);
  } catch (e) {
    // ignore
  }
}

/**
 * The exported factory: export default (app) => router
 */
export default function initSyncRouter(app) {
  const router = express.Router();

  // بسيط لوق لكل طلب داخل الراوتر
  router.use((req, res, next) => {
    console.log(`[sync] ${req.method} ${req.originalUrl}`);
    next();
  });

  // صحة الراوتر
  router.get('/', (req, res) => res.json({ ok: true, sync: true }));

  /**
   * POST /sheet-changes
   * يتوقع payload بشكل مشابه لما ظهر في لوجّاتك:
   * { action: 'reconcile'|'upsert'|'delete', sheets: [...], timestamp: '...' }
   */
  router.post('/sheet-changes', async (req, res) => {
    const payload = req.body || {};
    console.log('📩 /api/sync/sheet-changes payload:', JSON.stringify(payload));

    const client = createSheetsClient();
    if (!client) {
      console.warn('[sync] Sheets client unavailable — skipping Google Sheets operations');
      // نُجيب 200 لتفادي retries متكررة من المرسل، مع توضيح السبب
      return res.status(200).json({ ok: false, reason: 'no_google_credentials' });
    }

    const { sheets } = client;
    const SPREADSHEET_ID = process.env.SHEET_ID || process.env.SPREADSHEET_ID || null;
    if (!SPREADSHEET_ID) {
      console.warn('[sync] No SPREADSHEET_ID / SHEET_ID set in env');
      return res.status(200).json({ ok: false, reason: 'no_spreadsheet_id' });
    }

    try {
      // ----------------- RECONCILE (bulk update) -----------------
      if (payload.action === 'reconcile') {
        for (const sheet of payload.sheets || []) {
          const sheetName = sheet.sheetName;
          const rows = sheet.rows || [];

          for (const r of rows) {
            const rn = r.rowNumber;
            const data = r.data || {};

            // ضبّط ترتيب الأعمدة هنا ليتوافق مع شيتك (A..K مثال)
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

            const range = `${sheetName}!A${rn}:K${rn}`;
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

        emitIo(app, 'clients:sync', { action: 'reconciled', ts: new Date().toISOString() });
        return res.json({ ok: true, action: 'reconcile_processed' });
      }

      // ----------------- UPSERT (append example) -----------------
      if (payload.action === 'upsert') {
        const { sheetName = 'Clients', row = {} } = payload;
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
          emitIo(app, 'clients:sync', { external_id: row.external_id, action: 'upserted' });
          return res.json({ ok: true, action: 'appended' });
        } catch (e) {
          console.warn('[sync] append error:', e?.message || e);
          return res.status(500).json({ ok: false, error: e?.message || e });
        }
      }

      // ----------------- DELETE (mark deleted) -----------------
      if (payload.action === 'delete') {
        const ext = payload.external_id;
        if (!ext) return res.status(400).json({ ok: false, reason: 'missing_external_id' });

        // قراءة العمود A (external_id) للعثور على رقم الصف
        const readResp = await sheets.spreadsheets.values.get({
          spreadsheetId: SPREADSHEET_ID,
          range: `Clients!A:A`,
        });
        const values = readResp.data.values || [];
        let foundRow = -1;
        for (let i = 0; i < values.length; i++) {
          if ((values[i][0] || '').toString() === ext.toString()) {
            foundRow = i + 1;
            break;
          }
        }
        if (foundRow === -1) {
          console.warn('[sync] external_id not found in sheet:', ext);
          emitIo(app, 'clients:sync', { external_id: ext, action: 'delete_not_found' });
          return res.json({ ok: false, reason: 'not_found' });
        }

        // هنا نعلّم الحالة 'deleted' في عمود D (غيّر الخانة حسب تصميمك)
        const markRange = `Clients!D${foundRow}`;
        await sheets.spreadsheets.values.update({
          spreadsheetId: SPREADSHEET_ID,
          range: markRange,
          valueInputOption: 'RAW',
          requestBody: { values: [['deleted']] },
        });

        emitIo(app, 'clients:sync', { external_id: ext, action: 'deleted' });
        return res.json({ ok: true, markedRow: foundRow });
      }

      // ----------------- Unknown action -----------------
      return res.status(400).json({ ok: false, reason: 'unknown_action', received: payload.action });
    } catch (err) {
      console.warn('[sync] handler error:', err?.message || err);
      return res.status(500).json({ ok: false, error: err?.message || err });
    }
  });

  return router;
}
