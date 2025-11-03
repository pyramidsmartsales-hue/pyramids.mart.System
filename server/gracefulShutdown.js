// server/gracefulShutdown.js
import { waitForQueueEmpty } from '../helpers/queue.js';
import { saveLocalBackup } from '../helpers/localBackup.js';
import { APP_STATE } from '../services/sheetsPersistWrapper.js';


export function installGracefulShutdown() {
async function shutdown(signal) {
console.log('[shutdown] received', signal, 'waiting for queue...');
try {
await waitForQueueEmpty(30000);
} catch (e) {
console.warn('[shutdown] waitForQueueEmpty threw', e.message);
}
try {
saveLocalBackup('last_state', APP_STATE);
console.log('[shutdown] saved last_state backup');
} catch (e) {
console.error('[shutdown] failed to save backup', e.message);
}
console.log('[shutdown] exiting');
process.exit(0);
}


process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
}