// client/src/services/api.js
import axios from "axios";

// عنوان السيرفر الأساسي (الموجود على Render)
// غيّره فقط إذا تغير رابط السيرفر لاحقًا.
const FALLBACK_BACKEND = "https://pyramids-mart-system.onrender.com";

// إن وُجد متغير VITE_API_URL في بيئة البناء سيُستخدم، وإلا fallback.
const API_BASE = (import.meta.env.VITE_API_URL && import.meta.env.VITE_API_URL.trim() !== "")
  ? import.meta.env.VITE_API_URL
  : FALLBACK_BACKEND;

const api = axios.create({
  baseURL: API_BASE,
  timeout: 15000,
  headers: { "Content-Type": "application/json" },
  withCredentials: true,
});

export default api;
export { API_BASE };
