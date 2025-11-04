// server/server.js
import express from "express";
import cors from "cors";
import morgan from "morgan";
import http from "http";
import { Server } from "socket.io";
import dotenv from "dotenv";

import whatsappRouter from "./routes/whatsapp.js";
import overviewRouter from "./routes/overview.js";
import productsRouter from "./routes/products.js";
import inventoryRouter from "./routes/inventory.js";
import salesRouter from "./routes/sales.js";
import suppliersRouter from "./routes/suppliers.js";
import purchasesRouter from "./routes/purchases.js";
import messagesRouter from "./routes/messages.js";
import clientsRouter from "./routes/clients.js";

import googleSheetsRouter from "./routes/googleSheets.js";
import whatsappCloudRouter from "./routes/whatsappCloud.js";
import sheetsTestRouter from "./routes/sheetsTest.js";

import { initWhatsApp } from "./services/whatsappWeb.js";
import { restoreFromBackup } from "./services/sheetsPersistWrapper.js";
import installGracefulShutdown from "./gracefulShutdown.js";

import { v4 as uuidv4 } from "uuid"; // لأجل توليد external_id مؤقت إذا لزم

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json({ limit: "10mb" }));
app.use(morgan("dev"));

// safety: global handlers to avoid process crash on unhandledRejection
process.on("unhandledRejection", (reason, promise) => {
  console.error("[process] unhandledRejection:", reason && reason.stack ? reason.stack : reason);
  // DO NOT process.exit(1) here; prefer to log and let graceful shutdown handle it
});

process.on("uncaughtException", (err) => {
  console.error("[process] uncaughtException:", err && err.stack ? err.stack : err);
  // optionally: notify/alerting system here, then exit gracefully
});

try {
  const restored = restoreFromBackup();
  console.log("[startup] restoreFromBackup ->", restored ? "restored" : "no backup found");
} catch (e) {
  console.warn("[startup] restoreFromBackup failed:", e && e.message ? e.message : e);
}

// create http server + socket.io
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

// initialize whatsapp-web (non-blocking)
let whatsappWebRouter = null;
try {
  const wa = initWhatsApp(io);
  whatsappWebRouter = wa.router;
  console.log("✅ whatsapp-web service initialized (router ready).");
} catch (err) {
  console.warn("⚠️ Failed to initialize whatsapp-web service:", err && err.message ? err.message : err);
  whatsappWebRouter = null;
}

// routes (existing)
app.use("/api/whatsapp", whatsappRouter);
app.use("/api/whatsapp-cloud", whatsappCloudRouter);
if (whatsappWebRouter) {
  app.use("/api/whatsapp-web", whatsappWebRouter);
} else {
  app.get("/api/whatsapp-web/status", (req, res) =>
    res.json({ ok: true, connected: false, message: "whatsapp-web not initialized" })
  );
  app.get("/api/whatsapp-web/qr", (req, res) => res.json({ ok: true, qr: null }));
}

app.use("/api/overview", overviewRouter);
app.use("/api/products", productsRouter);
app.use("/api/inventory", inventoryRouter);
app.use("/api/sales", salesRouter);
app.use("/api/suppliers", suppliersRouter);
app.use("/api/purchases", purchasesRouter);
app.use("/api/messages", messagesRouter);
app.use("/api/clients", clientsRouter);
app.use("/api/sheets", googleSheetsRouter);
app.use("/api/sheets", sheetsTestRouter);

/**
 * NEW: Google Sheets webhook endpoint
 * - Expect POST requests from Apps Script with payload:
 *   { action: 'add'|'edit'|'remove_rows'|'reconcile', sheetName, row, rowData, rows, timestamp, editor }
 *
 * - Behavior:
 *   - add: create record in DB (or simulate) and return external_id
 *   - edit: update record by external_id
 *   - remove_rows: trigger reconciliation (server should compare sheet external_ids with DB)
 *   - reconcile: receive full sheets payload and reconcile (create/update/delete as needed)
 *
 * IMPORTANT: Apps Script sends POST. If you open this url in browser (GET) you'll see "Cannot GET".
 */

app.post("/api/sync/sheet-changes", async (req, res) => {
  try {
    const payload = req.body || {};
    console.log("📩 /api/sync/sheet-changes received payload:", JSON.stringify(payload, null, 2));

    const action = (payload.action || "").toString().toLowerCase();
    const sheetName = payload.sheetName || null;
    const row = payload.row || null;
    const rowData = payload.rowData || null;

    // Helper: respond helper
    const ok = (data) => res.status(200).json(Object.assign({ ok: true }, data || {}));
    const err = (message, code = 500) => res.status(code).json({ ok: false, error: message });

    // --- ACTION: ADD ---
    if (action === "add") {
      console.log(`🟢 [sheet:${sheetName}] ADD row=${row} data=`, rowData);

      // TODO: هنا ضع منطق إنشاء السجل في قاعدة البيانات الحقيقية (مثلاً clients service)
      // مثال افتراضي: لو قاعدة بيانات موجودة يمكنك استدعاء db.createClient(rowData) ثم الحصول على external_id
      // الآن: سنولد external_id تلقائياً إن لم يعطه الشيت، وأرجعها لكتابة العمود A في الشيت
      const newExternalId = (rowData && rowData.external_id) ? String(rowData.external_id) : uuidv4();

      // مثال: تسجيل بسيط (في Production استبدل بالـDB)
      console.log(`Created new record with external_id=${newExternalId}`);

      // العودة للـ Apps Script ليكتب external_id في العمود A للصف
      return ok({ message: "record created", external_id: newExternalId, set_last_synced_by: "server" });
    }

    // --- ACTION: EDIT ---
    if (action === "edit") {
      console.log(`🟡 [sheet:${sheetName}] EDIT row=${row} data=`, rowData);
      const externalId = rowData && rowData.external_id ? String(rowData.external_id) : null;
      if (!externalId) {
        // cannot identify record — ask client to create first or handle as new
        console.warn("Edit action received but no external_id present. Consider handling as add.");
        return ok({ message: "no external_id provided; nothing updated" });
      }

      // TODO: ضع هنا منطق تحديث السجل في DB حسب externalId
      // مثال: await db.updateByExternalId(externalId, rowData)

      console.log(`Updated record external_id=${externalId}`);
      return ok({ message: "record updated", external_id: externalId });
    }

    // --- ACTION: REMOVE_ROWS ---
    if (action === "remove_rows") {
      console.log(`🔴 [sheet:${sheetName}] REMOVE_ROWS received — request reconciliation`);
      // onChange REMOVE_ROW لا يمدنا بأي بيانات عن الصف المحذوف.
      // يجب أن تطلب من السكربت عمل reconcile (إرسال قائمة external_id الحالية) أو ننفّذ مقارنة من السيرفر.
      // خيار: نقول للـApps Script أن يستدعي /api/sync/sheet-changes?action=reconcile (أو يستخدم reconcile payload)
      return ok({ message: "remove_rows received; please call reconcile or server will run periodic reconcile" });
    }

    // --- ACTION: RECONCILE ---
    if (action === "reconcile") {
      console.log(`🌀 [sheet:${sheetName}] RECONCILE payload received`);
      // payload may contain: rows (for single sheet) or sheets (array of sheets)
      // Example minimal algorithm:
      // 1) build set of external_ids received from sheet
      // 2) compare with DB external_ids for that sheet -> deleted = inDB but not inSheet
      // 3) create/update for rows with no external_id or changed data

      // This area must be wired to your DB. Below is a placeholder log and success response.
      // If payload.rows exists (single sheet), iterate it:
      const allRows = payload.rows || payload.sheets || null;
      console.log("Reconcile data preview:", Array.isArray(allRows) ? allRows.slice(0,5) : allRows);
      // TODO: replace with real reconciliation code (DB operations)
      return ok({ message: "reconcile processed (server stub)", processed: Array.isArray(allRows) ? allRows.length : 0 });
    }

    // If no action recognized:
    console.log("⚪ Unrecognized or empty action field; returning generic OK.");
    return ok({ message: "action not recognized", received: payload });

  } catch (error) {
    console.error("❌ Error in /api/sync/sheet-changes:", error && error.stack ? error.stack : error);
    return res.status(500).json({ ok: false, error: error && error.message ? error.message : String(error) });
  }
});

// root & health
app.get("/", (req, res) => res.send("PyramidsMart Server Running ✅"));
app.get("/healthz", (req, res) => res.status(200).json({ ok: true }));

io.on("connection", (socket) => {
  console.log("Client connected:", socket.id);
  socket.on("disconnect", () => console.log("Client disconnected:", socket.id));
  socket.on("whatsapp:status", (cb) => {
    try { if (typeof cb === "function") cb({ connected: false }); } catch (e) {}
  });
  socket.on("whatsapp:request_qr", async () => console.log("Socket requested whatsapp QR"));
});

const PORT = Number(process.env.PORT || 5000);

// graceful shutdown
try {
  installGracefulShutdown({ shutdownTimeout: 30000 });
  console.log("[startup] graceful shutdown installed");
} catch (e) {
  console.warn("[startup] failed to install graceful shutdown", e && e.message ? e.message : e);
}

// bind to 0.0.0.0 for containers
server.listen(PORT, "0.0.0.0", () => console.log(`✅ Server running on port ${PORT}`));
