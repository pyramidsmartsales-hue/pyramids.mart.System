// server/server.js
// كامل وجاهز للاستبدال
// ESM, flexible router loading, Google credentials bootstrap, Sheets poller -> app deletions

import fs from 'fs';
import path from 'path';
import express from 'express';
import http from 'http';
import morgan from 'morgan';
import cors from 'cors';
import { Server } from 'socket.io';
import { fileURLToPath } from 'url';
import process from 'process';

// __dirname في ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/* ------------------ Google credentials bootstrap ------------------ */
(function ensureGoogleCredentials() {
  try {
    const defaultTarget = '/etc/secrets/google-service-key-new.json';
    const envProvided = process.env.GOOGLE_CREDENTIALS_FILE || defaultTarget;
    let targetPath = envProvided;

    // إذا المستخدم مرّر اسم ملف نسبي في env، نضعه تحت /etc/secrets للحاوية
    if (process.env.GOOGLE_CREDENTIALS_FILE && !process.env.GOOGLE_CREDENTIALS_FILE.startsWith('/')) {
      targetPath = path.posix.join('/etc/secrets', path.basename(process.env.GOOGLE_CREDENTIALS_FILE));
    }

    if (fs.existsSync(targetPath)) {
      process.env.GOOGLE_CREDENTIALS_FILE = targetPath;
      process.env.GOOGLE_APPLICATION_CREDENTIALS = targetPath;
      console.log('[startup] GOOGLE_CREDENTIALS_FILE set to', targetPath);
      return;
    }

    if (process.env.GOOGLE_CREDENTIALS_JSON && process.env.GOOGLE_CREDENTIALS_JSON.trim()) {
      fs.mkdirSync(path.dirname(targetPath), { recursive: true });
      fs.writeFileSync(targetPath, process.env.GOOGLE_CREDENTIALS_JSON, { encoding: 'utf8', mode: 0o600 });
      process.env.GOOGLE_CREDENTIALS_FILE = targetPath;
      process.env.GOOGLE_APPLICATION_CREDENTIALS = targetPath;
      console.log('[startup] wrote GOOGLE_CREDENTIALS_JSON ->', targetPath);
      return;
    }

    if (process.env.GOOGLE_CREDENTIALS_JSON_B64 && process.env.GOOGLE_CREDENTIALS_JSON_B64.trim()) {
      const decoded = Buffer.from(process.env.GOOGLE_CREDENTIALS_JSON_B64, 'base64').toString('utf8');
      fs.mkdirSync(path.dirname(targetPath), { recursive: true });
      fs.writeFileSync(targetPath, decoded, { encoding: 'utf8', mode: 0o600 });
      process.env.GOOGLE_CREDENTIALS_FILE = targetPath;
      process.env.GOOGLE_APPLICATION_CREDENTIALS = targetPath;
      console.log('[startup] wrote GOOGLE_CREDENTIALS_JSON_B64 ->', targetPath);
      return;
    }

    console.warn(
      '[startup] Google credentials not found. Set GOOGLE_CREDENTIALS_FILE or GOOGLE_CREDENTIALS_JSON_B64 or GOOGLE_CREDENTIALS_JSON.'
    );
  } catch (e) {
    console.warn('[startup] ensureGoogleCredentials error:', e?.message || e);
  }
})();

/* ------------------ Helpers for router loading ------------------ */
function isValidRouter(obj) {
  if (!obj) return false;
  if (typeof obj === 'function') return true;
  if (typeof obj === 'object') {
    if (Array.isArray(obj.stack)) return true;
    if (typeof obj.use === 'function' || typeof obj.handle === 'function') return true;
  }
  return false;
}

async function loadRouterFlexibly(relPath, opts = {}) {
  try {
    const mod = await import(relPath).catch((e) => {
      console.warn(`[warn] import failed for ${relPath}:`, e?.message || e);
      return null;
    });
    if (!mod) return null;

    const exported = mod.default ?? mod;

    if (isValidRouter(exported)) {
      return exported;
    }

    const expressRouter = express.Router();

    if (typeof exported === 'function') {
      const tryCalls = [
        () => exported(), // factory()
        () => exported(expressRouter), // factory(router)
        () => exported(opts.app ?? null), // factory(app)
        () => exported(opts.app ?? express), // factory(express)
        () => exported({ app: opts.app }), // factory({app})
      ];

      for (const callFn of tryCalls) {
        try {
          let result = callFn();
          if (result && typeof result.then === 'function') {
            result = await result;
          }
          if (isValidRouter(result)) {
            return result;
          }
        } catch (e) {
          console.warn(`[warn] calling factory from ${relPath} threw:`, e?.message || e);
        }
      }

      // try once with an express() app in case factory registers routes directly on passed app
      try {
        const maybe = exported(opts.app ?? express());
        if (maybe && typeof maybe.then === 'function') await maybe;
      } catch (e) {
        // ignore
      }
      return null;
    }

    return null;
  } catch (err) {
    console.warn(`[warn] failed to load router ${relPath}:`, err?.message || err);
    return null;
  }
}

/* ------------------ Sheets client helper ------------------ */
async function createSheetsClient() {
  const keyFile = process.env.GOOGLE_APPLICATION_CREDENTIALS || process.env.GOOGLE_CREDENTIALS_FILE;
  if (!keyFile) {
    console.warn('[sheets] No GOOGLE_APPLICATION_CREDENTIALS / GOOGLE_CREDENTIALS_FILE set');
    return null;
  }
  if (!fs.existsSync(keyFile)) {
    console.warn('[sheets] keyFile not found at', keyFile);
    return null;
  }
  try {
    const { google } = await import('googleapis');
    const auth = new google.auth.GoogleAuth({
      keyFilename: keyFile,
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });
    const sheets = google.sheets({ version: 'v4', auth });
    return { auth, sheets };
  } catch (e) {
    console.warn('[sheets] createSheetsClient error:', e?.message || e);
    return null;
  }
}

/* ------------------ Express app setup ------------------ */
const app = express();
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(morgan('dev'));

app.get('/', (req, res) => res.send('PyramidsMart Server Running ✅'));
app.get('/healthz', (req, res) => res.json({ ok: true }));

/* ------------------ Dynamic router loading ------------------ */
const clientsRouter = await loadRouterFlexibly('./routes/clients.js', { app });
const syncRouter = await loadRouterFlexibly('./routes/sync.js', { app });

if (clientsRouter) {
  app.use('/api/clients', clientsRouter);
  console.log('[startup] mounted /api/clients');
} else {
  console.log('[startup] /api/clients not mounted (router missing or invalid)');
}

if (syncRouter) {
  app.use('/api/sync', syncRouter);
  console.log('[startup] mounted /api/sync');
} else {
  console.log('[startup] /api/sync not mounted (router missing or invalid)');
}

/* ------------------ Socket.io ------------------ */
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' } });

io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);
  socket.on('disconnect', () => console.log('Client disconnected:', socket.id));
});

app.set('io', io);

/* ------------------ Poller: reconcile sheet -> app (deletions) ------------------ */
/**
 * Poller reads Clients!A2:A (external_id column) and compares to GET /api/clients result.
 * If a client exists in app but its external_id is missing from sheet, poller attempts to delete it.
 */
const POLL_INTERVAL_MS = Number(process.env.SHEET_POLL_INTERVAL_MS || 60_000);

async function pollSheetAndSync() {
  try {
    const keyFile = process.env.GOOGLE_APPLICATION_CREDENTIALS || process.env.GOOGLE_CREDENTIALS_FILE;
    const SPREADSHEET_ID = process.env.SHEET_ID || process.env.SPREADSHEET_ID || null;
    if (!keyFile || !SPREADSHEET_ID) {
      console.warn('[poller] missing GOOGLE_APPLICATION_CREDENTIALS or SHEET_ID; poller paused');
      return;
    }

    const { google } = await import('googleapis');
    const auth = new google.auth.GoogleAuth({
      keyFilename: keyFile,
      scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
    });
    const sheets = google.sheets({ version: 'v4', auth });

    // اقرأ العمود A (external_id) بدءًا من الصف 2
    const resp = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: `Clients!A2:A`,
    });
    const sheetVals = resp.data.values || [];
    const sheetExternalIds = new Set(sheetVals.map(r => (r[0] || '').toString()));

    // استدعاء API الداخلي للحصول على العملاء الحاليين
    const CLIENTS_API = `${process.env.BASE_URL || `http://localhost:${process.env.PORT || 10000}`}/api/clients`;

    // GET /api/clients
    let clientsResp;
    try {
      clientsResp = await fetch(CLIENTS_API, { method: 'GET' });
    } catch (e) {
      console.warn('[poller] fetch /api/clients failed:', e?.message || e);
      return;
    }
    if (!clientsResp.ok) {
      console.warn('[poller] failed to fetch /api/clients', clientsResp.status);
      return;
    }
    const clients = await clientsResp.json();
    if (!Array.isArray(clients)) {
      console.warn('[poller] /api/clients did not return array');
      return;
    }

    for (const client of clients) {
      const ext = (client.external_id || '').toString();
      if (!ext) continue;
      if (!sheetExternalIds.has(ext)) {
        console.log(`[poller] client ${client.id || client.external_id} missing in sheet -> deleting from app`);
        const tryDeletePaths = [
          `${CLIENTS_API}/${client.id}`, // DELETE by internal id
          `${CLIENTS_API}/external/${encodeURIComponent(ext)}`, // alternate
          `${CLIENTS_API}/${encodeURIComponent(ext)}`, // maybe external id used directly
        ];
        let deleted = false;
        for (const p of tryDeletePaths) {
          try {
            const dresp = await fetch(p, { method: 'DELETE' });
            if (dresp.ok) {
              console.log(`[poller] deleted via ${p}`);
              deleted = true;
              const ioInst = app.get('io');
              if (ioInst) ioInst.emit('clients:sync', { external_id: ext, action: 'deleted_by_sheet' });
              break;
            } else {
              console.warn(`[poller] delete ${p} returned ${dresp.status}`);
            }
          } catch (e) {
            console.warn('[poller] delete attempt failed:', e?.message || e);
          }
        }
        if (!deleted) {
          console.warn(`[poller] couldn't delete client ${ext} — no matching delete route responded`);
        }
      }
    }
  } catch (err) {
    console.warn('[poller] error:', err?.message || err);
  }
}

// run periodically
setInterval(() => {
  pollSheetAndSync().catch(e => console.warn('[poller] unhandled error:', e?.message || e));
}, POLL_INTERVAL_MS);

// run once immediately
pollSheetAndSync().catch(e => console.warn('[poller] initial run error:', e?.message || e));

/* ------------------ Start server ------------------ */
const PORT = Number(process.env.PORT || 10000);
server.listen(PORT, '0.0.0.0', () => {
  console.log(`✅ Server running on port ${PORT}`);
  console.log('[startup] GOOGLE_APPLICATION_CREDENTIALS =', process.env.GOOGLE_APPLICATION_CREDENTIALS || process.env.GOOGLE_CREDENTIALS_FILE);
  console.log('[startup] SHEET_ID =', process.env.SHEET_ID || process.env.SPREADSHEET_ID);
  console.log('[startup] SERVICE ACCOUNT EMAIL (env GOOGLE_SERVICE_ACCOUNT_EMAIL) =', process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL || '(not set)');
});

export { app, server, io };
