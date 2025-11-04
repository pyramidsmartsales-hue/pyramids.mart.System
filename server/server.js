// server/server.js
import express from "express";
import cors from "cors";
import morgan from "morgan";
import http from "http";
import { Server } from "socket.io";
import dotenv from "dotenv";
import fs from "fs";
import path from "path";
import { v4 as uuidv4 } from "uuid";

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

// <-- IMPORT SYNC SERVICE (تأكد أن هذا الملف موجود في server/services/syncService.js)
import * as syncService from "./services/syncService.js";

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json({ limit: "10mb" }));
app.use(morgan("dev"));

// Ensure data folder exists (so syncService file-based DB won't fail if used)
const DATA_DIR = path.join(process.cwd(), "server", "data");
const SYNC_DB_PATH = path.join(DATA_DIR, "sync_db.json");
try {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(SYNC_DB_PATH)) {
    fs.writeFileSync(SYNC_DB_PATH, JSON.stringify({ clients: [] }, null, 2), { encoding: "utf8" });
    console.log("[startup] created placeholder sync_db.json at", SYNC_DB_PATH);
  }
} catch (e) {
  console.warn("[startup] could not ensure data dir/file:", e && e.message ? e.message : e);
}

// safety: global handlers to avoid process crash on unhandledRejection
process.on("unhandledRejection", (reason, promise) => {
  console.error("[process] unhandledRejection:", reason && reason.stack ? reason.stack : reason);
});
process.on("uncaughtException", (err) => {
  console.error("[process] uncaughtException:", err && err.stack ? err.stack : err);
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

// existing routes
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
 * POST /api/sync/sheet-changes
 * - Expects POST JSON from Apps Script:
 *   { action: 'add'|'edit'|'remove_rows'|'reconcile', sheetName, row, rowData, rows, sheets, timestamp, editor }
 *
 * Behavior:
 *  - add/edit: upsert -> returns external_id and emits socket 'clients:sync'
 *  - remove_rows: ask Apps Script to run reconcile
 *  - reconcile: upsert all rows, mark missing external_ids deleted, emit for upserts
 */
app.post("/api/sync/sheet-changes", async (req, res) => {
  try {
    const payload = req.body || {};
    console.log("📩 /api/sync/sheet-changes payload:", JSON.stringify(payload, null, 2));

    const action = (payload.action || "").toString().toLowerCase();
    const sheetName = payload.sheetName || null;
    const row = payload.row || null;
    const rowData = payload.rowData || null;

    const ok = (data) => res.status(200).json(Object.assign({ ok: true }, data || {}));
    const err = (message, code = 500) => res.status(code).json({ ok: false, error: message });

    // Helper to notify via socket and log
    const notifyUpsert = (result, sname, actionName) => {
      try {
        const payload = { external_id: result.external_id, action: actionName, sheetName: sname };
        io.emit("clients:sync", payload);
        console.log("🔔 Emitted socket clients:sync:", payload);
      } catch (e) {
        console.warn("⚠️ socket emit failed:", e && e.message ? e.message : e);
      }
    };

    // ADD (create or upsert)
    if (action === "add") {
      console.log(`🟢 [sheet:${sheetName}] ADD row=${row}`);
      const result = await syncService.upsertClient(rowData || {});
      // notify frontends to reload
      notifyUpsert(result, sheetName, result.created ? "created" : "upserted");
      return ok({
        message: "record created_or_upserted",
        external_id: result.external_id,
        created: result.created,
        set_last_synced_by: "server"
      });
    }

    // EDIT (upsert)
    if (action === "edit") {
      console.log(`🟡 [sheet:${sheetName}] EDIT row=${row}`);
      const result = await syncService.upsertClient(rowData || {});
      notifyUpsert(result, sheetName, result.created ? "created" : "upserted");
      return ok({ message: "record upserted", external_id: result.external_id, created: result.created });
    }

    // REMOVE_ROWS -> ask Apps Script to run reconcile (or rely on scheduled reconcile)
    if (action === "remove_rows") {
      console.log(`🔴 [sheet:${sheetName}] REMOVE_ROWS received — server requests a reconcile.`);
      return ok({ message: "remove_rows received; please send reconcile payload (apps script will call reconcileWithServer())" });
    }

    // RECONCILE -> payload.sheets (array) or payload.rows for single sheet
    if (action === "reconcile") {
      console.log(`🌀 [sheet:${sheetName}] RECONCILE payload`);
      const sheetsPayload =
        payload.sheets ||
        (payload.sheetName ? [{ sheetName: payload.sheetName, rows: payload.rows || [] }] : payload.sheets || []);
      const summary = [];

      for (const s of sheetsPayload) {
        const sname = s.sheetName || "unknown";
        const srows = s.rows || [];
        const sheetExternalIds = new Set();

        // Upsert each row and notify
        for (const r of srows) {
          const data = r.data || r.rowData || {};
          if (data.external_id) sheetExternalIds.add(String(data.external_id));
          const result = await syncService.upsertClient(data);
          notifyUpsert(result, sname, result.created ? "created" : "upserted");
        }

        // Compare DB external ids for this sheet (in this simple service we don't separate by sheetName)
        const dbExternalIds = await syncService.getAllExternalIds();
        const deleted = [];
        for (const id of dbExternalIds) {
          if (!sheetExternalIds.has(id)) {
            // mark deleted
            await syncService.markClientDeleted(id);
            deleted.push(id);
            // optionally emit deletion notification
            try {
              io.emit("clients:sync", { external_id: id, action: "deleted", sheetName: sname });
              console.log("🔔 Emitted socket clients:sync for deletion:", id);
            } catch (e) {
              console.warn("⚠️ socket emit failed for deletion:", e && e.message ? e.message : e);
            }
          }
        }

        summary.push({ sheetName: sname, upserted: srows.length, markedDeleted: deleted.length });
      }

      return ok({ message: "reconcile processed", summary });
    }

    // fallback
    console.log("⚪ Unrecognized action; returning ok.");
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
