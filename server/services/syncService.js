// server/services/syncService.js
import fs from "fs";
import path from "path";
import { v4 as uuidv4 } from "uuid";

const DB_FILE = path.join(process.cwd(), "server", "data", "sync_db.json");
const DATA_DIR = path.dirname(DB_FILE);
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

function readDB() {
  try {
    if (!fs.existsSync(DB_FILE)) {
      fs.writeFileSync(DB_FILE, JSON.stringify({ clients: [] }, null, 2));
    }
    const raw = fs.readFileSync(DB_FILE, "utf8");
    return JSON.parse(raw);
  } catch (err) {
    console.error("[syncService] readDB error:", err);
    return { clients: [] };
  }
}

function writeDB(db) {
  fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2));
}

function normalizeExternalId(id) {
  if (id === null || id === undefined) return null;
  return String(id).trim();
}

export async function listAllClients() {
  const db = readDB();
  return db.clients;
}

export async function findClientByExternalId(external_id) {
  const id = normalizeExternalId(external_id);
  if (!id) return null;
  const db = readDB();
  return db.clients.find(c => String(c.external_id) === id) || null;
}

export async function upsertClient(rowData) {
  const db = readDB();
  let external_id = normalizeExternalId(rowData && rowData.external_id);

  if (!external_id) {
    external_id = uuidv4();
    const newRec = Object.assign({
      external_id,
      created_at: new Date().toISOString(),
      last_modified: new Date().toISOString()
    }, rowData || {});
    db.clients.push(newRec);
    writeDB(db);
    return { created: true, external_id, record: newRec };
  }

  const idx = db.clients.findIndex(c => String(c.external_id) === external_id);
  if (idx === -1) {
    const newRec = Object.assign({
      external_id,
      created_at: new Date().toISOString(),
      last_modified: new Date().toISOString()
    }, rowData || {});
    db.clients.push(newRec);
    writeDB(db);
    return { created: true, external_id, record: newRec };
  } else {
    const existing = db.clients[idx];
    const updated = Object.assign({}, existing, rowData || {}, { last_modified: new Date().toISOString() });
    db.clients[idx] = updated;
    writeDB(db);
    return { created: false, external_id, record: updated };
  }
}

export async function markClientDeleted(external_id) {
  const id = normalizeExternalId(external_id);
  const db = readDB();
  const idx = db.clients.findIndex(c => String(c.external_id) === id);
  if (idx === -1) return { ok: false, reason: "not_found" };
  db.clients[idx].status = "deleted";
  db.clients[idx].last_modified = new Date().toISOString();
  writeDB(db);
  return { ok: true, external_id: id };
}

export async function getAllExternalIds() {
  const db = readDB();
  return db.clients.map(c => String(c.external_id));
}
