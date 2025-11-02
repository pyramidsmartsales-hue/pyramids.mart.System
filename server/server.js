// server/server.js (fixed, without messages/templates/analytics)
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

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json({ limit: "10mb" }));
app.use(morgan("dev"));

// Routes (removed messages/templates/analytics)
app.use("/api/whatsapp", whatsappRouter);
app.use("/api/overview", overviewRouter);
app.use("/api/products", productsRouter);
app.use("/api/inventory", inventoryRouter);
app.use("/api/sales", salesRouter);
app.use("/api/suppliers", suppliersRouter);
app.use("/api/purchases", purchasesRouter);

// Base test route
app.get("/", (req, res) => {
  res.send("PyramidsMart Server Running ✅");
});

const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: "*" },
});

// WebSocket events (safe)
io.on("connection", (socket) => {
  console.log("Client connected:", socket.id);

  socket.on("disconnect", () => {
    console.log("Client disconnected:", socket.id);
  });
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => console.log(`✅ Server running on port ${PORT}`));
