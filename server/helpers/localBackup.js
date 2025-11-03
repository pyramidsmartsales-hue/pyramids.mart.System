// helpers/localBackup.js
import fs from 'fs';
import path from 'path';


const backupDir = path.join(process.cwd(), 'data');
if (!fs.existsSync(backupDir)) fs.mkdirSync(backupDir, { recursive: true });


export function saveLocalBackup(filename, obj) {
const tmp = path.join(backupDir, filename + '.tmp');
const dest = path.join(backupDir, filename + '.json');
fs.writeFileSync(tmp, JSON.stringify(obj, null, 2), 'utf8');
fs.renameSync(tmp, dest);
}


export function loadLocalBackup(filename) {
const dest = path.join(backupDir, filename + '.json');
if (!fs.existsSync(dest)) return null;
try {
return JSON.parse(fs.readFileSync(dest, 'utf8'));
} catch (e) {
console.warn('[backup] failed to parse', dest, e.message);
return null;
}
}


export function listBackups() {
return fs.readdirSync(backupDir).filter(f => f.endsWith('.json'));
}