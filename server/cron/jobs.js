import { startScheduler } from "../services/scheduler.service.js";

export function initCronJobs() {
  startScheduler();
}
