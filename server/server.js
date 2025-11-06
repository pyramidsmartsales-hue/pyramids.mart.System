// server/server.js
// ✅ نسخة ESM (import/export) متوافقة مع Render وتدعم مزامنة Google Sheets

import fs from 'fs';
import path from 'path';
import express from 'express';
import http from 'http';
import morgan from 'morgan';
import cors from 'cors';
import { Server } from 'socket.io';
import { fileURLToPath } from 'url';

// لتوليد __dirname في ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// --- BEGIN: Render-friendly Google credentials bootstrap ---
(function ensureGoogleCredentials() {
  try {
    const envProvided =
      process.env.GOOGLE_CREDENTIALS_FILE || '/etc/secrets/google-service-key-new.json';
    let targetPath = envProvided;

    if (process.env.GOOGLE_CREDENTIALS_FILE && !process.env.GOOGLE_CREDENTIALS_FILE.startsWith('/')) {
      targetPath = path.posix.join('/etc/secrets', path.basename(process.env.GOOGLE_CREDENTIALS_FILE));
    }

    if (fs.existsSync(targetPath)) {
      process.env.GOOGLE_CREDENTIALS_FILE = targetPath;
      console.log('[startup] GOOGLE_CREDENTIALS_FILE set to', targetPath);
      return;
    }

    if (process.env.GOOGLE_CREDENTIALS_JSON && process.env.GOOGLE_CREDENTIALS_JSON.trim()) {
      fs.mkdirSync(path.dirname(targetPath), { recursive: true });
      fs.writeFileSync(targetPath, process.env.GOOGLE_CREDENTIALS_JSON, {
        encoding: 'utf8',
        mode: 0o600,
      });
      process.env.GOOGLE_CREDENTIALS_FILE = targetPath;
      console.log('[startup] wrote GOOGLE_CREDENTIALS_JSON ->', targetPath);
      return;
    }

    if (process.env.GOOGLE_CREDENTIALS_JSON_B64 && process.env.GOOGLE_CREDENTIALS_JSON_B64.trim()) {
      const decoded = Buffer.from(process.env.GOOGLE_CREDENTIALS_JSON_B64, 'base64').toString('utf8');
      fs.mkdirSync(path.dirname(targetPath), { recursive: true });
      fs.writeFileSync(targetPath, decoded, { encoding: 'utf8', mode: 0o600 });
      process.env.GOOGLE_CREDENTIALS_FILE = targetPath;
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
// --- END: Google credentials bootstrap ---

// --- Routers loading (import dynamically) ---
let clientsRouter = null;
let syncRouter = null;

try {
  const clientsModule = await import('./routes/clients.js').catch(() => null);
  if (clientsModule && typeof clientsModule.default === 'function') {
    clientsRouter = clientsModule.default;
  } else if (clientsModule) {
    clientsRouter = clientsModule;
  }
} catch (e) {
  console.warn('[warn] clients router not found');
}

try {
  const syncModule = await import('./routes/sync.js').catch(() => null);
  if (syncModule && typeof syncModule.default === 'function') {
    syncRouter = syncModule.default;
  } else if (syncModule) {
    syncRouter = syncModule;
  }
} catch (e) {
  console.warn('[warn] sync router not found');
}

// --- Express setup ---
const app = express();
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(morgan('dev'));

app.get('/', (req, res) => res.send('PyramidsMart Server Running ✅'));
app.get('/healthz', (req, res) => res.json({ ok: true }));

if (clientsRouter && typeof clientsRouter === 'function') app.use('/api/clients', clientsRouter());
if (syncRouter && typeof syncRouter === 'function') app.use('/api/sync', syncRouter());

// --- Socket.io setup ---
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' } });

io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);
  socket.on('disconnect', () => console.log('Client disconnected:', socket.id));
});

app.set('io', io);

// --- Start server ---
const PORT = Number(process.env.PORT || 10000);
server.listen(PORT, '0.0.0.0', () => console.log(`✅ Server running on port ${PORT}`));

export { app, server, io };
