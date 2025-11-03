// server/server.js (UPDATED)
// - Restores app state from local backup (if present) on startup
// - Installs graceful shutdown handler to wait for queue and persist state

import express from "express";
import cors from "cors";
import morgan from "morgan";
import http from "http";
import { Server } from "socket.io";
import dotenv from "dotenv";

// route imports
import whatsappRouter from "./routes/whatsapp.js";
import overviewRouter from "./routes/overview.js";
import productsRouter from "./routes/products.js";
import inventoryRouter from "./routes/inventory.js";
import salesRouter from "./routes/sales.js";
import suppliersRouter from "./routes/suppliers.js";
import purchasesRouter from "./routes/purchases.js";
import messagesRouter from "./routes/messages.js";
import clientsRouter from "./routes/clients.js";

// new feature routes (google sheets + whatsapp cloud)
import googleSheetsRouter from "./routes/googleSheets.js";
import whatsappCloudRouter from "./routes/whatsappCloud.js";

// ✅ test route for Sheets sync
import sheetsTestRouter from "./routes/sheetsTest.js";

// whatsapp-web service initializer
import { initWhatsApp } from "./services/whatsappWeb.js";

// state persistence helpers
import { restoreFromBackup } from "./services/sheetsPersistWrapper.js";
import { installGracefulShutdown } from "./gracefulShutdown.js";

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json({ limit: "10mb" }));
app.use(morgan("dev"));

// Attempt to restore state from local backup BEFORE starting services
try {
  const restored = restoreFromBackup();
  console.log("[startup] restoreFromBackup ->", restored ? "restored" : "no backup found");
} catch (e) {
  console.warn('[startup] restoreFromBackup failed:', e && e.message ? e.message : e);
}

// create http server + socket.io BEFORE initializing whatsapp service
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

// initialize whatsapp-web service and get its router
let whatsappWebRouter = null;
try {
  const wa = initWhatsApp(io);
  // initWhatsApp returns { router, getClient, getLastQrDataUrl }
  whatsappWebRouter = wa.router;
  console.log("✅ whatsapp-web service initialized (router ready).");
} catch (err) {
  console.warn(
    "⚠️ Failed to initialize whatsapp-web service:",
    err && err.message ? err.message : err
  );
  whatsappWebRouter = null;
}

// register routes (API)
app.use("/api/whatsapp", whatsappRouter);              // legacy/local whatsapp routes (if present)
app.use("/api/whatsapp-cloud", whatsappCloudRouter);   // WhatsApp Cloud wrapper (optional)

// mount whatsapp-web router if available
if (whatsappWebRouter) {
  app.use("/api/whatsapp-web", whatsappWebRouter);
} else {
  app.get("/api/whatsapp-web/status", (req, res) =>
    res.json({ ok: true, connected: false, message: "whatsapp-web not initialized" })
  );
  app.get("/api/whatsapp-web/qr", (req, res) =>
    res.json({ ok: true, qr: null })
  );
}

app.use("/api/overview", overviewRouter);
app.use("/api/products", productsRouter);
app.use("/api/inventory", inventoryRouter);
app.use("/api/sales", salesRouter);
app.use("/api/suppliers", suppliersRouter);
app.use("/api/purchases", purchasesRouter);
app.use("/api/messages", messagesRouter);
app.use("/api/clients", clientsRouter);

// Google Sheets routes
app.use("/api/sheets", googleSheetsRouter);

// ✅ Sheets test route (new)
app.use("/api/sheets", sheetsTestRouter);

// health check
app.get("/", (req, res) => {
  res.send("PyramidsMart Server Running ✅");
});

// socket events
io.on("connection", (socket) => {
  console.log("Client connected:", socket.id);

  socket.on("disconnect", () => {
    console.log("Client disconnected:", socket.id);
  });

  socket.on("whatsapp:status", (cb) => {
    try {
      if (typeof cb === "function") cb({ connected: false });
    } catch (e) {}
  });

  socket.on("whatsapp:request_qr", async () => {
    console.log("Socket requested whatsapp QR");
  });
});

const PORT = Number(process.env.PORT || 5000);

// install graceful shutdown handlers BEFORE starting the server
try {
  installGracefulShutdown();
  console.log('[startup] graceful shutdown installed');
} catch (e) {
  console.warn('[startup] failed to install graceful shutdown', e && e.message ? e.message : e);
}

server.listen(PORT, () => console.log(`✅ Server running on port ${PORT}`));
