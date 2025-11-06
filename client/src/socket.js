// client/src/socket.js
import { io } from "socket.io-client";

const API = process.env.REACT_APP_API_URL || "";
const base = (API && API.trim()) ? API.replace(/\/+$/, "") : window.location.origin;

console.log("[socket] connecting to", base);

const socket = io(base, {
  path: "/socket.io",
  transports: ["websocket", "polling"],
  autoConnect: true,
  reconnection: true,
  reconnectionAttempts: Infinity,
  reconnectionDelay: 2000,
  timeout: 20000,
});

socket.on("connect", () => console.log("[socket] connected", socket.id));
socket.on("disconnect", (reason) => console.log("[socket] disconnected", reason));
socket.on("connect_error", (err) => console.warn("[socket] connect_error", err && err.message));
socket.on("reconnect_attempt", (n) => console.log("[socket] reconnect attempt", n));
socket.on("reconnect_failed", () => console.error("[socket] reconnect failed"));

export default socket;
