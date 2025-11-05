// server/services/sheetsPush.js
import fs from "fs";
import { google } from "googleapis";

const SHEET_ID = process.env.SHEET_ID || "";
const CREDENTIALS_FILE = process.env.GOOGLE_CREDENTIALS_FILE || null;
const CREDENTIALS_JSON = process.env.GOOGLE_CREDENTIALS_JSON || null;
const HEADER_ROW = Number(process.env.SHEET_HEADER_ROW || 1);

function getAuthClient() {
  let creds;
  if (CREDENTIALS_JSON) {
    creds = JSON.parse(CREDENTIALS_JSON);
  } else if (CREDENTIALS_FILE && fs.existsSync(CREDENTIALS_FILE)) {
    creds = JSON.parse(fs.readFileSync(CREDENTIALS_FILE, "utf8"));
  } else {
    throw new Error("Google credentials not provided (GOOGLE_CREDENTIALS_FILE or GOOGLE_CREDENTIALS_JSON)");
  }

  const jwt = new google.auth.JWT(
    creds.client_email,
    undefined,
    creds.private_key,
    ["https://www.googleapis.com/auth/spreadsheets"]
  );
  return jwt;
}

async function getSheetHeaders(sheets, sheetName) {
  const range = `${sheetName}!${HEADER_ROW}:${HEADER_ROW}`;
  const resp = await sheets.spreadsheets.values.get({ spreadsheetId: SHEET_ID, range });
  const row = (resp.data.values && resp.data.values[0]) || [];
  return row;
}

async function findRowByExternalId(sheets, sheetName, externalId) {
  const range = `${sheetName}!A${HEADER_ROW + 1}:A`;
  const resp = await sheets.spreadsheets.values.get({ spreadsheetId: SHEET_ID, range });
  const values = resp.data.values || [];
  for (let i = 0; i < values.length; i++) {
    const v = values[i] && values[i][0] ? String(values[i][0]) : "";
    if (v === externalId) {
      const rowNumber = HEADER_ROW + 1 + i;
      return { rowNumber };
    }
  }
  return null;
}

function mapRowDataToRowArray(headers, rowData) {
  return headers.map(h => (rowData[h] == null ? "" : String(rowData[h])));
}

export async function upsertRowToSheet(sheetName, rowData = {}) {
  if (!rowData || !rowData.external_id) throw new Error("rowData.external_id is required");
  const auth = getAuthClient();
  await auth.authorize();
  const sheets = google.sheets({ version: "v4", auth });

  const headers = await getSheetHeaders(sheets, sheetName);
  if (!headers || headers.length === 0 || headers[0].toLowerCase() !== "external_id") {
    throw new Error(`Header row for sheet "${sheetName}" must have 'external_id' as first column`);
  }

  const found = await findRowByExternalId(sheets, sheetName, String(rowData.external_id));
  const rowArray = mapRowDataToRowArray(headers, rowData);

  if (found && found.rowNumber) {
    const lastColLetter = String.fromCharCode(65 + headers.length - 1);
    const range = `${sheetName}!A${found.rowNumber}:${lastColLetter}${found.rowNumber}`;
    await sheets.spreadsheets.values.update({
      spreadsheetId: SHEET_ID,
      range,
      valueInputOption: "RAW",
      requestBody: { values: [rowArray] }
    });
    return { updated: true, rowNumber: found.rowNumber };
  } else {
    const appendRange = `${sheetName}!A${HEADER_ROW + 1}`;
    const resp = await sheets.spreadsheets.values.append({
      spreadsheetId: SHEET_ID,
      range: appendRange,
      valueInputOption: "RAW",
      insertDataOption: "INSERT_ROWS",
      requestBody: { values: [rowArray] }
    });
    return { appended: true, result: resp.data };
  }
}

export async function markRowDeletedInSheet(sheetName, externalId) {
  const auth = getAuthClient();
  await auth.authorize();
  const sheets = google.sheets({ version: "v4", auth });

  const headers = await getSheetHeaders(sheets, sheetName);
  const found = await findRowByExternalId(sheets, sheetName, String(externalId));
  if (!found) return { found: false };

  const statusIdx = headers.findIndex(h => String(h).toLowerCase() === "status");
  if (statusIdx >= 0) {
    const colLetter = String.fromCharCode(65 + statusIdx);
    const range = `${sheetName}!${colLetter}${found.rowNumber}`;
    await sheets.spreadsheets.values.update({
      spreadsheetId: SHEET_ID,
      range,
      valueInputOption: "RAW",
      requestBody: { values: [["deleted"]] }
    });
    return { markedDeleted: true, rowNumber: found.rowNumber };
  } else {
    const lastColLetter = String.fromCharCode(65 + headers.length - 1);
    const clearRange = `${sheetName}!A${found.rowNumber}:${lastColLetter}${found.rowNumber}`;
    await sheets.spreadsheets.values.clear({ spreadsheetId: SHEET_ID, range: clearRange });
    return { cleared: true, rowNumber: found.rowNumber };
  }
}
