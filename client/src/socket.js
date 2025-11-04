// client/src/socket.js
import { io } from "socket.io-client";

const API = import.meta.env.VITE_API_URL || "";
function getSocketUrl() {
  if (API && API.trim()) return API.replace(/\/+$/, "");
  return window.location.origin;
}

const SOCKET_URL = getSocketUrl();
console.log("[socket] connecting to", SOCKET_URL);

export const socket = io(SOCKET_URL, {
  path: "/socket.io",
  transports: ["websocket", "polling"], // allow polling as fallback
  upgrade: true,
  reconnection: true,
  reconnectionAttempts: Infinity,
  reconnectionDelay: 2000,
  timeout: 20000,
  autoConnect: true,
});

// Logging (خفف أو أزل في الإنتاج)
socket.on("connect", () => {
  console.log("[socket] connected:", socket.id);
});
socket.on("connect_error", (err) => {
  console.warn("[socket] connect_error:", err && err.message ? err.message : err);
});
socket.on("reconnect_attempt", (n) => {
  console.log("[socket] reconnect attempt", n);
});
socket.on("reconnect_failed", () => {
  console.error("[socket] reconnect failed");
});
socket.on("disconnect", (reason) => {
  console.warn("[socket] disconnected:", reason);
});

/**
 * Helper subscribe: returns an "off" function for cleanup.
 * Usage:
 *   const off = subscribe('clients:sync', handler);
 *   off(); // to unsubscribe
 */
export function subscribe(event, handler) {
  if (!socket) return () => {};
  socket.on(event, handler);
  return () => {
    try {
      socket.off(event, handler);
    } catch (e) {
      // ignore
    }
  };
}
