// server/server.js
// نسخة ESM متكاملة — تحميل روترات آمن، وضبط Google credentials تلقائياً.

import fs from 'fs';
import path from 'path';
import express from 'express';
import http from 'http';
import morgan from 'morgan';
import cors from 'cors';
import { Server } from 'socket.io';
import { fileURLToPath } from 'url';

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
      process.env.GOOGLE_APPLICATION_CREDENTIALS = targetPath; // مهم للمكتبات الرسمية
      console.log('[startup] GOOGLE_CREDENTIALS_FILE set to', targetPath);
      return;
    }

    // إذا جَاء المفتاح كـ JSON نصي
    if (process.env.GOOGLE_CREDENTIALS_JSON && process.env.GOOGLE_CREDENTIALS_JSON.trim()) {
      fs.mkdirSync(path.dirname(targetPath), { recursive: true });
      fs.writeFileSync(targetPath, process.env.GOOGLE_CREDENTIALS_JSON, { encoding: 'utf8', mode: 0o600 });
      process.env.GOOGLE_CREDENTIALS_FILE = targetPath;
      process.env.GOOGLE_APPLICATION_CREDENTIALS = targetPath;
      console.log('[startup] wrote GOOGLE_CREDENTIALS_JSON ->', targetPath);
      return;
    }

    // إذا جَاء المفتاح كـ base64
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

/* ------------------ Helper: تحميل روترات بأمان ------------------ */
/**
 * يحاول استيراد الموديول ثم:
 * - إذا الصدور default أو module نفسه دالة -> يناديها (factory) وينتظر النتيجة إن كانت promise
 * - إذا الصدور هو كائن Router/middleware -> يعيده كما هو
 * - في أي فشل يرجع null
 *
 * @param {string} relPath مسار نسبي للموديول (مثال: './routes/clients.js')
 * @returns {Promise<null|any>}
 */
async function loadRouterSafely(relPath) {
  try {
    const mod = await import(relPath).catch(() => null);
    if (!mod) return null;

    const exported = mod.default ?? mod;

    // إن كان export دالة فاعتبرها factory قد تُعيد Router أو Promise<Router>
    if (typeof exported === 'function') {
      try {
        const maybe = exported();
        if (maybe && typeof maybe.then === 'function') {
          // عادت promise -> انتظرها
          return await maybe;
        }
        return maybe;
      } catch (err) {
        // قد تكون الدالة تطلب معاملات؛ في هذه الحالة نحذّر ونرفض التحميل الآمن
        console.warn(`[warn] router factory at ${relPath} threw:`, err?.message || err);
        return null;
      }
    }

    // إن لم تكن دالة، نفترض أنها Router أو Middleware
    return exported;
  } catch (err) {
    console.warn(`[warn] failed to load router ${relPath}:`, err?.message || err);
    return null;
  }
}

/* ------------------ Express + Routers ------------------ */
const app = express();
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(morgan('dev'));

app.get('/', (req, res) => res.send('PyramidsMart Server Running ✅'));
app.get('/healthz', (req, res) => res.json({ ok: true }));

// تحميل وتركيب الروترات بأمان (إن وجدت)
const clientsRouter = await loadRouterSafely('./routes/clients.js');
const syncRouter = await loadRouterSafely('./routes/sync.js');

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

/* ------------------ Start server ------------------ */
const PORT = Number(process.env.PORT || 10000);
server.listen(PORT, '0.0.0.0', () => console.log(`✅ Server running on port ${PORT}`));

export { app, server, io };
