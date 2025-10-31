import path from "path";
import fs from "fs";

const uploadsDir = path.join(process.cwd(), "server", "uploads");
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

export function saveFile(file) {
  // multer will already have saved file; return web path
  return `/uploads/${file.filename}`;
}

export function listUploads() {
  return fs.readdirSync(uploadsDir);
}
