// server.js
import express from "express";
import http from "http";
import { Server as IOServer } from "socket.io";
import cors from "cors";
import dotenv from "dotenv";
import path from "path";
import fs from "fs";

import connectDB from "./config/db.js";
import clientsRouter from "./routes/clients.js";
import messagesRouter from "./routes/messages.js";
import templatesRouter from "./routes/templates.js";
import analyticsRouter from "./routes/analytics.js";
import overviewRouter from "./routes/overview.js"; // <-- existing
import productsRouter from "./routes/products.js"; // <-- NEW
import initWhatsApp from "./services/whatsapp.service.js";
import socketHandlers from "./socket/index.js";

dotenv.config();

const app = express();

/**
 * CLIENT_URL can be:
 * - not set: fallback to '*' (not recommended for production)
 * - a single origin: e.g. "https://example.onrender.com"
 * - multiple origins separated by commas: "https://a,https://b"
 */
const rawClient = process.env.CLIENT_URL || "";
let allowedOrigins = [];

// normalize allowed origins from env
if (rawClient && rawClient.trim() !== "") {
  allowedOrigins = rawClient.split(",").map((s) => s.trim()).filter(Boolean);
}

// If no explicit client URL provided, fall back to "*"
const useWildcard = allowedOrigins.length === 0;

if (useWildcard) {
  console.warn("CORS: No CLIENT_URL provided — using wildcard '*' (not recommended for production).");
} else {
  console.log("CORS: Allowed origins:", allowedOrigins);
}

// CORS origin check function
function originCallback(origin, callback) {
  // allow requests with no origin (like mobile apps, curl, or same-origin)
  if (!origin) return callback(null, true);

  if (useWildcard) {
    return callback(null, true);
  }

  if (allowedOrigins.includes(origin)) {
    return callback(null, true);
  }

  return callback(new Error(`Origin ${origin} is not allowed by CORS`));
}

// Apply CORS to Express routes (including preflight)
app.use(cors({ origin: originCallback, credentials: true }));
app.options("*", cors({ origin: originCallback, credentials: true }));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ensure uploads directory exists (so media serving & temp file writes don't fail)
const uploadsDir = path.join(process.cwd(), "uploads");
try {
  if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
    console.info("Created uploads directory:", uploadsDir);
  }
} catch (e) {
  console.warn("Could not ensure uploads directory:", e && e.message ? e.message : e);
}

// static uploads
app.use("/uploads", express.static(uploadsDir));

// db connection will be awaited before starting server
// attach routers (these will be active once the server is listening)
app.use("/api/clients", clientsRouter);
app.use("/api/messages", messagesRouter);
app.use("/api/templates", templatesRouter);
app.use("/api/analytics", analyticsRouter);
app.use("/api/overview", overviewRouter); // <-- existing: overview endpoint
app.use("/api/products", productsRouter); // <-- NEW: products endpoint

app.get("/", (req, res) => res.send("OK — Pyramids Mart Service API"));

const server = http.createServer(app);

// Apply the same CORS policy to Socket.IO
const io = new IOServer(server, {
  cors: {
    origin: (origin, callback) => {
      // allow non-browser clients
      if (!origin) return callback(null, true);
      if (useWildcard) return callback(null, true);
      if (allowedOrigins.includes(origin)) return callback(null, true);
      return callback(new Error("Not allowed by CORS"));
    },
    methods: ["GET", "POST"],
    credentials: true
  }
});

// start function - connects DB, initializes whatsapp + socket handlers, then listens
async function start() {
  try {
    await connectDB();
    console.log("Database connected");

    // initialize whatsapp client and pass io so it can emit events
    try {
      await initWhatsApp(io);
      console.log("WhatsApp service initialized (initWhatsApp called)");
    } catch (e) {
      console.error("initWhatsApp() failed to initialize:", e && e.message ? e.message : e);
      // continue — initWhatsApp may retry internally
    }

    // initialize socket handlers (register connection listeners)
    try {
      if (typeof socketHandlers === "function") {
        socketHandlers(io);
        console.log("Socket handlers mounted");
      } else {
        console.warn("socketHandlers is not a function; skipping socket handler mounting");
      }
    } catch (e) {
      console.warn("Failed to attach socketHandlers:", e && e.message ? e.message : e);
    }

    const PORT = process.env.PORT || 3000;
    server.listen(PORT, () => {
      console.log(`Server listening on PORT ${PORT}`);
      if (useWildcard) {
        console.log("CORS policy: wildcard '*' (allowing all origins) — consider setting CLIENT_URL in production.");
      } else {
        console.log("CORS allowed origins:", allowedOrigins.join(", "));
      }
    });
  } catch (err) {
    console.error("Failed to start server:", err && err.message ? err.message : err);
    process.exit(1);
  }
}

// global error handlers (best-effort logging)
process.on("unhandledRejection", (reason) => {
  console.error("Unhandled Rejection at:", reason && reason.stack ? reason.stack : reason);
});
process.on("uncaughtException", (err) => {
  console.error("Uncaught Exception thrown:", err && err.stack ? err.stack : err);
  // optionally exit depending on your needs:
  // process.exit(1);
});

// actually start
start();

// graceful shutdown
process.on("SIGINT", () => {
  console.info("SIGINT received - closing server");
  server.close(() => {
    console.info("HTTP server closed");
    process.exit(0);
  });
});
process.on("SIGTERM", () => {
  console.info("SIGTERM received - closing server");
  server.close(() => {
    console.info("HTTP server closed");
    process.exit(0);
  });
});
