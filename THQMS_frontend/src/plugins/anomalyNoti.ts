import { useNotiStore } from '@/stores/notifications';
import type { LabAnomaly } from '@/stores/lab';

export function installAnomalyNotifications() {
  const ns = useNotiStore();
  const handler = (ev: Event) => {
    const a = (ev as CustomEvent<LabAnomaly>).detail;
    if (!a) return;
    ns.push({
      id: `noti-${a.id}`,
  title: `${a.severity === 'high' ? '严重' : a.severity === 'medium' ? '告警' : '提示'} · ${a.paramId}`,
      body: a.message,
      severity: a.severity,
      ts: a.ts,
  targetRoute: '/lab',
  targetParamId: a.paramId,
    });
  };
  window.addEventListener('lab-anomaly', handler as EventListener);
  return () => window.removeEventListener('lab-anomaly', handler as EventListener);
}
