// services/sheetsPersistWrapper.js
// Wrap your existing sheetsSync (or googleSheets) functions with queue + local backup.


import { enqueue } from '../helpers/queue.js';
import { saveLocalBackup, loadLocalBackup } from '../helpers/localBackup.js';
import * as sheetsSync from '../sheetsSync.js'; // adjust path if needed


// Example global in-memory state (restore on boot)
export const APP_STATE = {
clients: [],
sales: [],
// ... other domain objects
};


// Restore from local backup if available
export function restoreFromBackup() {
const data = loadLocalBackup('last_state');
if (data) {
Object.assign(APP_STATE, data);
console.log('[persist] restored state from local backup');
return true;
}
return false;
}


// After a successful mutation we persist locally (atomic)
function persistLocal() {
try {
saveLocalBackup('last_state', APP_STATE);
} catch (e) {
console.error('[persist] failed to save local backup', e.message);
}
}


export function enqueueAppendRow(spreadsheetId, range, values) {
enqueue(async () => {
// use the existing sheetsSync append function (synchronous promise)
await sheetsSync.appendRow(spreadsheetId, range, values);
// update our app state if appropriate and persist locally
persistLocal();
}, { maxRetries: 6, retryDelayMs: 4000 });
}


// Example wrapper for creating a client record
export function addClientRecord(record, spreadsheetId, range) {
// update memory immediately
APP_STATE.clients.push(record);
persistLocal();


// enqueue write to Google Sheets
enqueueAppendRow(spreadsheetId, range, Object.values(record));
}


export function addSaleRecord(record, spreadsheetId, range) {
APP_STATE.sales.push(record);
persistLocal();
enqueueAppendRow(spreadsheetId, range, Object.values(record));
}


// Export utilities
export function getState() { return APP_STATE; }