// server/server.js
// ✅ نسخة محسّنة متوافقة مع Render وتدعم مزامنة Google Sheets بشكل كامل وآمن

const fs = require('fs');
const path = require('path');

// --- BEGIN: Render-friendly Google credentials bootstrap (ADD THIS) ---
(function ensureGoogleCredentials() {
  try {
    const envProvided = process.env.GOOGLE_CREDENTIALS_FILE || '/etc/secrets/google-service-key-new.json';
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
      fs.writeFileSync(targetPath, process.env.GOOGLE_CREDENTIALS_JSON, { encoding: 'utf8', mode: 0o600 });
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

    console.warn('[startup] Google credentials not found in env/file. Set GOOGLE_CREDENTIALS_FILE or GOOGLE_CREDENTIALS_JSON_B64 or GOOGLE_CREDENTIALS_JSON.');
  } catch (e) {
    console.warn('[startup] ensureGoogleCredentials error:', e && e.message ? e.message : e);
  }
})();
// --- END: Render-friendly Google credentials bootstrap ---

// --- Continue with server startup (minimal safe bootstrap) ---
const express = require('express');
const http = require('http');
const morgan = require('morgan');
const cors = require('cors');
const { Server } = require('socket.io');

let clientsRouter = null;
let syncRouter = null;
try {
  clientsRouter = require('./routes/clients');
} catch (e) {
  console.warn('[warn] clients router not found');
}
try {
  syncRouter = require('./routes/sync');
} catch (e) {
  console.warn('[warn] sync router not found');
}

const app = express();
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(morgan('dev'));

app.get('/', (req, res) => res.send('PyramidsMart Server Running ✅'));
app.get('/healthz', (req, res) => res.json({ ok: true }));

if (clientsRouter && typeof clientsRouter === 'function') app.use('/api/clients', clientsRouter());
if (syncRouter && typeof syncRouter === 'function') app.use('/api/sync', syncRouter());

const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' } });

io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);
  socket.on('disconnect', () => console.log('Client disconnected:', socket.id));
});

app.set('io', io);

const PORT = Number(process.env.PORT || 10000);
server.listen(PORT, '0.0.0.0', () => console.log(`✅ Server running on port ${PORT}`));

module.exports = { app, server, io };
