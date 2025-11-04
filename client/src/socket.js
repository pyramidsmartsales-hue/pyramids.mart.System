// client/src/socket.js
import { io } from "socket.io-client";

// استخدم عنوان السيرفر الذي يشغّل الـ API
// إذا كان السيرفر والواجهة على نفس الدومين (Render)، يكفي تركه فارغًا
export const socket = io("https://pyramids-mart-system.onrender.com", {
  transports: ["websocket"],
  reconnection: true,
  reconnectionAttempts: 10,
  reconnectionDelay: 2000,
});

// فقط للمراقبة
socket.on("connect", () => {
  console.log("✅ Socket connected:", socket.id);
});

socket.on("disconnect", () => {
  console.warn("⚠️ Socket disconnected");
});
