import { initializeApp, type FirebaseApp, type FirebaseOptions } from 'firebase/app';
import { getMessaging, getToken, onMessage, type Messaging, type MessagePayload } from 'firebase/messaging';

let app: FirebaseApp | null = null;
let messaging: Messaging | null = null;

export interface FcmConfig {
  apiKey: string;
  authDomain?: string;
  projectId: string;
  messagingSenderId: string;
  appId: string;
  vapidKey: string; // Web Push 公开 VAPID Key
}

export function initFcm(cfg: FcmConfig) {
  const options: FirebaseOptions = {
    apiKey: cfg.apiKey,
    authDomain: cfg.authDomain,
    projectId: cfg.projectId,
    appId: cfg.appId,
    messagingSenderId: cfg.messagingSenderId,
  };
  if (!app) app = initializeApp(options);
  if (!messaging) messaging = getMessaging(app);
  return messaging;
}

export async function getFcmToken(vapidKey: string) {
  if (!messaging) throw new Error('FCM not initialized');
  // 需要 https 环境或 localhost
  return await getToken(messaging, { vapidKey });
}

export function onFcmForeground(cb: (payload: MessagePayload) => void) {
  if (!messaging) throw new Error('FCM not initialized');
  onMessage(messaging, cb);
}
