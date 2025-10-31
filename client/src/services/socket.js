// client/src/services/socket.js
import { io } from "socket.io-client";

// Use VITE_API_URL if provided at build time, otherwise fall back to the page origin
const API = import.meta.env.VITE_API_URL || window.location.origin;

const socket = io(API, {
  path: "/socket.io",
  withCredentials: true,
  transports: ["websocket", "polling"]
});

export default socket;
