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

// CORS: allow specific CLIENT_URL (set in Render) or fallback to *
const corsOrigin = process.env.CLIENT_URL || "*";
app.use(cors({ origin: corsOrigin }));

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
const io = new IOServer(server, { cors: { origin: corsOrigin } });

initWhatsApp(io);
socketHandlers(io);

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server listening on ${PORT}`);
});
