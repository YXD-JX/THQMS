export function isSecureLike(): boolean {
  if (typeof window === 'undefined') return false;
  const { protocol, hostname } = window.location;
  return protocol === 'https:' || hostname === 'localhost' || hostname === '127.0.0.1';
}

export function isNotificationSupported(): boolean {
  // Notification API 基础能力 + 需要可信上下文（https/localhost）
  return typeof window !== 'undefined' && 'Notification' in window && isSecureLike();
}

export type NotiSupportInfo = { ok: boolean; reason?: 'no-api' | 'insecure' | 'ios-pwa-required' | 'denied' | 'unknown'; hint?: string };

export function getNotificationSupportInfo(): NotiSupportInfo {
  if (typeof window === 'undefined') return { ok: false, reason: 'unknown' };
  const hasApi = 'Notification' in window;
  if (!hasApi) return { ok: false, reason: 'no-api', hint: '该浏览器不提供 Notification 能力' };
  const secure = isSecureLike();
  if (!secure) return { ok: false, reason: 'insecure', hint: '需通过 https 或 localhost 访问' };
  // iOS: Safari/Chrome 仅在“安装到主屏幕”的 PWA 中支持推送
  const ua = navigator.userAgent || '';
  const isIOS = /iPhone|iPad|iPod/i.test(ua);
  type NavWithStandalone = Navigator & { standalone?: boolean };
  const nvs = navigator as NavWithStandalone;
  const isStandalone = (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) || !!nvs.standalone;
  if (isIOS && !isStandalone) {
    return { ok: false, reason: 'ios-pwa-required', hint: 'iOS 需将站点安装为 PWA 后再开启系统通知' };
  }
  if (Notification.permission === 'denied') return { ok: false, reason: 'denied', hint: '通知权限被拒绝，请在浏览器设置中开启' };
  return { ok: true };
}

export async function requestNotificationPermission(): Promise<NotificationPermission> {
  const info = getNotificationSupportInfo();
  if (!info.ok && info.reason !== 'denied') return 'denied';
  if (Notification.permission === 'granted') return 'granted';
  if (Notification.permission === 'denied') return 'denied';
  try {
    const perm = await Notification.requestPermission();
    return perm;
  } catch {
    return Notification.permission;
  }
}
