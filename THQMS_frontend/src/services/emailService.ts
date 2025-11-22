import type { LabAnomaly, LabParam } from '../stores/lab';

// Simulated email push. Replace with real API call later.
export async function sendAnomalyEmail(anomaly: LabAnomaly, param: LabParam) {
  // TODO: integrate with backend API (e.g., POST /api/notify/email)
  // For now, just log and resolve after a small delay.
  console.log('[email] send anomaly email', { anomaly, param });
  await new Promise((r) => setTimeout(r, 100));
}
