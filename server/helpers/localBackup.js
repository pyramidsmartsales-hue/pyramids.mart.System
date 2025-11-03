// helpers/localBackup.js
import fs from 'fs';
import path from 'path';

const backupDir = path.join(process.cwd(), 'data');
if (!fs.existsSync(backupDir)) fs.mkdirSync(backupDir, { recursive: true });

/**
 * saveLocalBackup
 * - backward compatible:
 *    saveLocalBackup(filename, obj)
 *    saveLocalBackup(obj)  // uses default filename 'last_state_backup'
 *
 * Returns: true if wrote file, false if skipped or failed.
 */
export function saveLocalBackup(arg1, arg2) {
  try {
    let filename;
    let obj;

    // If called as saveLocalBackup(filename, obj)
    if (typeof arg1 === 'string' && typeof arg2 !== 'undefined') {
      filename = arg1;
      obj = arg2;
    } else {
      // Called as saveLocalBackup(obj)
      filename = 'last_state_backup';
      obj = arg1;
    }

    if (typeof obj === 'undefined' || obj === null) {
      console.warn('[localBackup] saveLocalBackup called with undefined/null data — skipping write.');
      return false;
    }

    let payload;
    if (typeof obj === 'string' || Buffer.isBuffer(obj)) {
      payload = obj;
    } else {
      try {
        payload = JSON.stringify(obj, null, 2);
      } catch (err) {
        console.warn('[localBackup] Failed to stringify data — skipping write:', err && err.message ? err.message : err);
        return false;
      }
    }

    const tmp = path.join(backupDir, filename + '.tmp');
    const dest = path.join(backupDir, filename + '.json');
    fs.writeFileSync(tmp, payload, { encoding: 'utf8' });
    fs.renameSync(tmp, dest);
    console.log('[localBackup] saved backup to', dest);
    return true;
  } catch (err) {
    console.warn('[localBackup] error saving backup:', err && err.message ? err.message : err);
    return false;
  }
}

export function loadLocalBackup(filename) {
  const dest = path.join(backupDir, filename + '.json');
  if (!fs.existsSync(dest)) return null;
  try {
    return JSON.parse(fs.readFileSync(dest, 'utf8'));
  } catch (e) {
    console.warn('[backup] failed to parse', dest, e && e.message ? e.message : e);
    return null;
  }
}

export function listBackups() {
  try {
    return fs.readdirSync(backupDir).filter(f => f.endsWith('.json'));
  } catch (e) {
    console.warn('[localBackup] listBackups failed:', e && e.message ? e.message : e);
    return [];
  }
}
