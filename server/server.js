import express from "express";
import http from "http";
import { Server as IOServer } from "socket.io";
import cors from "cors";
import dotenv from "dotenv";
import path from "path";

import connectDB from "./config/db.js";
import clientsRouter from "./routes/clients.js";
import messagesRouter from "./routes/messages.js";
import templatesRouter from "./routes/templates.js";
import analyticsRouter from "./routes/analytics.js";
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
  allowedOrigins = rawClient.split(",").map(s => s.trim()).filter(Boolean);
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

// static uploads
// Use process.cwd() so when Render sets root to `server`, path is correct
app.use("/uploads", express.static(path.join(process.cwd(), "uploads")));

// db
connectDB();

// routes
app.use("/api/clients", clientsRouter);
app.use("/api/messages", messagesRouter);
app.use("/api/templates", templatesRouter);
app.use("/api/analytics", analyticsRouter);

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

initWhatsApp(io);
socketHandlers(io);

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server listening on ${PORT}`);
  if (useWildcard) {
    console.log("CORS policy: wildcard '*' (allowing all origins) — consider setting CLIENT_URL in production.");
  } else {
    console.log("CORS allowed origins:", allowedOrigins.join(", "));
  }
});
