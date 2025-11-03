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

// routes
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
