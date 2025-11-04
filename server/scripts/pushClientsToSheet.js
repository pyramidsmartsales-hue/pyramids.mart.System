// server/scripts/pushClientsToSheet.js
import fs from "fs";
import { google } from "googleapis";
import dotenv from "dotenv";
dotenv.config();

// CONFIG: تأكد وضع SHEET_ID و GOOGLE_CREDENTIALS_FILE أو GOOGLE_SA_JSON في env
const SPREADSHEET_ID = process.env.SHEET_ID;
const SHEET_NAME = "Clients";
const SERVER_API_BASE = process.env.LOCAL_API_BASE || "http://localhost:10000"; // عدّل لو سيرفرك على منفذ آخر
const CLIENTS_API = `${SERVER_API_BASE}/api/clients`;
const CREDENTIALS_FILE = process.env.GOOGLE_CREDENTIALS_FILE || null;
const CREDENTIALS_JSON = process.env.GOOGLE_SA_JSON || null;

if (!SPREADSHEET_ID) {
  console.error("Error: set SHEET_ID environment variable to spreadsheet id");
  process.exit(1);
}

// load credentials (file preferred)
let credentials;
if (CREDENTIALS_JSON) {
  try {
    credentials = JSON.parse(CREDENTIALS_JSON);
  } catch (e) {
    console.error("Invalid GOOGLE_SA_JSON:", e.message || e);
    process.exit(1);
  }
} else if (CREDENTIALS_FILE && fs.existsSync(CREDENTIALS_FILE)) {
  credentials = JSON.parse(fs.readFileSync(CREDENTIALS_FILE, "utf8"));
} else {
  console.error("Provide GOOGLE_SA_JSON env or GOOGLE_CREDENTIALS_FILE path");
  process.exit(1);
}

// google auth
const auth = new google.auth.GoogleAuth({
  credentials,
  scopes: ["https://www.googleapis.com/auth/spreadsheets"],
});
const sheets = google.sheets({ version: "v4", auth });

// headers mapping
const HEADERS = ["external_id","created_at","updated_at","last_modified","last_synced_by","name","company","email","phone","country","city","address","status","notes"];

function objToRow(obj) {
  return HEADERS.map(h => {
    let v = obj[h];
    if (v === null || typeof v === "undefined") return "";
    if (h === "last_modified" || h === "created_at" || h === "updated_at") {
      return (typeof v === "string") ? v : (new Date(v)).toISOString();
    }
    return String(v);
  });
}

// fetch clients from local API
async function fetchAllClientsFromAPI() {
  const res = await fetch(CLIENTS_API, { headers: { "Accept": "application/json" } });
  if (!res.ok) {
    throw new Error(`Failed to fetch clients: ${res.status} ${res.statusText}`);
  }
  const body = await res.json();
  // support different shapes: either array or { data: [...] }
  if (Array.isArray(body)) return body;
  if (Array.isArray(body.data)) return body.data;
  // sometimes API returns { ok:true, clients: [...] }
  if (Array.isArray(body.clients)) return body.clients;
  throw new Error("Unexpected API response shape for /api/clients");
}

async function clearSheetRange() {
  const range = `${SHEET_NAME}!A2:Z`;
  await sheets.spreadsheets.values.clear({ spreadsheetId: SPREADSHEET_ID, range });
}

async function appendRows(rows) {
  if (!rows || rows.length === 0) {
    console.log("No rows to append.");
    return { updatedRows: 0 };
  }
  const range = `${SHEET_NAME}!A2`;
  const res = await sheets.spreadsheets.values.append({
    spreadsheetId: SPREADSHEET_ID,
    range,
    valueInputOption: "RAW",
    insertDataOption: "INSERT_ROWS",
    resource: { values: rows },
  });
  return res.data.updates || {};
}

async function run() {
  try {
    console.log("Fetching clients from DB (via API):", CLIENTS_API);
    const clients = await fetchAllClientsFromAPI();
    console.log("Clients count:", clients.length);

    const rows = clients.map(c => {
      if (!c.external_id) c.external_id = c.id ? String(c.id) : require('crypto').randomUUID();
      c.last_synced_by = "app";
      c.last_modified = c.last_modified || new Date().toISOString();
      return objToRow(c);
    });

    await clearSheetRange();
    console.log("Cleared old rows. Appending new rows...");
    const result = await appendRows(rows);
    console.log("Append result:", result.updatedRows || result.updatedRowsCount || "unknown");
    console.log("Done. Now open the spreadsheet and run initializeSyncSnapshot() in Apps Script.");
    process.exit(0);
  } catch (err) {
    console.error("Error:", err && err.message ? err.message : err);
    process.exit(1);
  }
}

run();