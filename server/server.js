// server/server.js
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

// whatsapp-web service initializer
import { initWhatsApp } from "./services/whatsappWeb.js";

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json({ limit: "10mb" }));
app.use(morgan("dev"));

// create http server + socket.io BEFORE initializing whatsapp service
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

// initialize whatsapp-web service and get its router
let whatsappWebRouter = null;
try {
  const wa = initWhatsApp(io);
  // initWhatsApp returns { router, client, getLastQrDataUrl }
  whatsappWebRouter = wa.router;
  // Note: wa.client can be used later if needed
  console.log("✅ whatsapp-web service initialized (router ready).");
} catch (err) {
  console.warn("⚠️ Failed to initialize whatsapp-web service:", err && err.message ? err.message : err);
  whatsappWebRouter = null;
}

// register routes (API)
app.use("/api/whatsapp", whatsappRouter);              // legacy/local whatsapp routes (if present)
app.use("/api/whatsapp-cloud", whatsappCloudRouter);  // WhatsApp Cloud wrapper (optional)

// mount whatsapp-web router if available
if (whatsappWebRouter) {
  app.use("/api/whatsapp-web", whatsappWebRouter);
} else {
  // provide a simple fallback endpoint so frontend checks don't break
  app.get("/api/whatsapp-web/status", (req, res) => res.json({ ok: true, connected: false, message: "whatsapp-web not initialized" }));
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

// Google Sheets routes
app.use("/api/sheets", googleSheetsRouter);

// health
app.get("/", (req, res) => {
  res.send("PyramidsMart Server Running ✅");
});

// socket events (minimal)
io.on("connection", (socket) => {
  console.log("Client connected:", socket.id);

  socket.on("disconnect", () => {
    console.log("Client disconnected:", socket.id);
  });

  // request current WA status (client may pass callback)
  socket.on("whatsapp:status", (cb) => {
    try {
      // emit basic status (frontend was expecting this signature)
      if (typeof cb === "function") cb({ connected: false });
    } catch (e) {
      /* ignore */
    }
  });

  // allow client to request server to provide latest QR via event (service emits when available)
  socket.on("whatsapp:request_qr", async () => {
    // the whatsapp service emits 'whatsapp:qr' to all sockets when QR appears, so nothing required here.
    // This handler exists for compatibility.
    console.log("Socket requested whatsapp QR");
  });
});

const PORT = Number(process.env.PORT || 5000);
server.listen(PORT, () => console.log(`✅ Server running on port ${PORT}`));
