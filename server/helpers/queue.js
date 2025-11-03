// helpers/queue.js


const queue = [];
let processing = false;


export function enqueue(taskFn, options = {}) {
const item = {
taskFn,
retries: 0,
maxRetries: typeof options.maxRetries === 'number' ? options.maxRetries : 5,
retryDelayMs: typeof options.retryDelayMs === 'number' ? options.retryDelayMs : 3000,
};
queue.push(item);
processQueue().catch(err => console.error('[queue] processQueue top-level error', err));
}


export async function processQueue() {
if (processing) return;
processing = true;
while (queue.length) {
const item = queue[0];
try {
await item.taskFn();
queue.shift();
} catch (e) {
item.retries++;
console.error('[queue] task failed, retries', item.retries, 'error:', e.message || e);
if (item.retries > item.maxRetries) {
console.error('[queue] max retries reached, dropping task');
queue.shift();
} else {
// wait retryDelayMs then retry
await new Promise(r => setTimeout(r, item.retryDelayMs));
}
}
}
processing = false;
}


export function getQueueLength() {
return queue.length;
}


export async function waitForQueueEmpty(timeoutMs = 30000) {
const start = Date.now();
while (queue.length > 0) {
if (Date.now() - start > timeoutMs) {
console.warn('[queue] wait timeout reached, continuing shutdown');
break;
}
await new Promise(r => setTimeout(r, 250));
}
}