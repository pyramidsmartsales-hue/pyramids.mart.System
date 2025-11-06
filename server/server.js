// server/server.js
// نسخة ESM محسّنة — تحميل روترات مرن (يدعم factory(), factory(app), factory(router), factory(express))
// يضبط GOOGLE_APPLICATION_CREDENTIALS تلقائياً للمكتبات الرسمية.

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

/* ------------------ Helper: تحقق مما إذا كان كائنًا Router أو Middleware صالح ------------------ */
function isValidRouter(obj) {
  if (!obj) return false;
  // Express Router is a function (callable) and usually has 'stack' array or 'use' function.
  if (typeof obj === 'function') return true;
  if (typeof obj === 'object') {
    if (Array.isArray(obj.stack) && obj.stack.length >= 0) return true;
    if (typeof obj.use === 'function' || typeof obj.handle === 'function') return true;
  }
  return false;
}

/* ------------------ Helper: تحميل روترات بمرونة ------------------ */
/**
 * يجرب استيراد الموديول وإرجاع Router صالح بعد محاولة استدعائه بطرق متعددة.
 * @param {string} relPath مسار نسبي (مثال './routes/clients.js')
 * @param {object} opts خيارات (يمكن تمرير app أو غيره)
 * @returns {Promise<null|any>}
 */
async function loadRouterFlexibly(relPath, opts = {}) {
  try {
    const mod = await import(relPath).catch((e) => {
      console.warn(`[warn] import failed for ${relPath}:`, e?.message || e);
      return null;
    });
    if (!mod) return null;

    const exported = mod.default ?? mod;

    // إذا المصدر نفسه يبدو كـ Router صالح، رجّعه فوراً
    if (isValidRouter(exported)) {
      return exported;
    }

    // نجهز بدائل للتمرير إلى الدالة factory إن كانت دالة:
    const routerCandidates = [];
    const expressRouter = express.Router();

    // إذا كانت exported دالة نحاول استدعاءها بعدة أنماط
    if (typeof exported === 'function') {
      const tryCalls = [
        () => exported(), // factory()
        () => exported(expressRouter), // factory(router)
        () => exported(opts.app ?? null), // factory(app)
        () => exported(opts.app ?? express), // factory(express)
        () => exported({ app: opts.app }), // factory({app})
        () => exported.bind(null, opts.app) && null, // skip binding placeholder
      ];

      for (const callFn of tryCalls) {
        try {
          let result = callFn();
          // إذا عادت Promise فانتظرها
          if (result && typeof result.then === 'function') {
            result = await result;
          }
          if (isValidRouter(result)) {
            return result;
          }
        } catch (e) {
          // لا نريد مقاطعة السلسلة، بل نكمل لتجربة النمط التالي
          // لكن نحتفظ بلوق تحذيري
          console.warn(`[warn] calling factory from ${relPath} threw:`, e?.message || e);
        }
      }

      // أخيراً: إذا لم تُرجع أي Router لكن factory قد تكون صمّمت لترك التسجيل بنفسها على app
      // (مثال: module.exports = (app) => { app.get(...) }) -> في هذه الحالة نعيد رجوع expressRouter فارغ
      // ولكن نتحقق إن كانت الدالة استدعت على الأقل app (ليس مضمونًا). نجرب استدعاءها بتمرير app صريح.
      try {
        const maybe = exported(opts.app ?? express());
        if (maybe && typeof maybe.then === 'function') await maybe;
      } catch (e) {
        // تجاهل
      }
      return null;
    }

    // إن لم تكن دالة ولم تكن Router صالح -> فشل
    return null;
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

// تحميل وتركيب الروترات بأكثر من طريقة (مرن)
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

/* ------------------ Start server ------------------ */
const PORT = Number(process.env.PORT || 10000);
server.listen(PORT, '0.0.0.0', () => console.log(`✅ Server running on port ${PORT}`));

export { app, server, io };
