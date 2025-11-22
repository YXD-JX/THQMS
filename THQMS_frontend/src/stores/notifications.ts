import { defineStore } from 'pinia';

export type NotiSeverity = 'low' | 'medium' | 'high';
export interface NotiItem {
  id: string;
  title: string;
  body?: string;
  severity?: NotiSeverity;
  ts: number;
  targetRoute?: string;
  targetParamId?: string;
}

export const useNotiStore = defineStore('notifications', {
  state: () => ({
    items: [] as NotiItem[],
    timers: {} as Record<string, number>,
    maxVisible: 3,
    defaultMs: 3800,
    enabled: JSON.parse(localStorage.getItem('noti.enabled') ?? 'true') as boolean,
    soundEnabled: JSON.parse(localStorage.getItem('noti.soundEnabled') ?? 'true') as boolean,
  browserNotiEnabled: JSON.parse(localStorage.getItem('noti.browserNotiEnabled') ?? 'false') as boolean,
  emailEnabled: JSON.parse(localStorage.getItem('noti.emailEnabled') ?? 'false') as boolean,
  sirenVolume: Number(localStorage.getItem('noti.sirenVolume') ?? '0.8'),
  sirenPattern: (localStorage.getItem('noti.sirenPattern') as 'double' | 'quad' | null) ?? 'quad',
  }),
  actions: {
    push(n: NotiItem, autoCloseMs?: number) {
      if (!this.enabled) return; // 全局关闭通知展示
      // enqueue at head
      this.items.unshift(n);
      // trim overflow
      if (this.items.length > this.maxVisible) {
        const drop = this.items.splice(this.maxVisible);
        drop.forEach(d => this.clearTimer(d.id));
      }
      const ms = autoCloseMs ?? this.defaultMs;
      this.clearTimer(n.id);
      this.timers[n.id] = window.setTimeout(() => this.remove(n.id), ms);
    },
    remove(id: string) {
      this.items = this.items.filter(x => x.id !== id);
      this.clearTimer(id);
    },
    clearTimer(id: string) {
      const t = this.timers[id];
      if (t) {
        clearTimeout(t);
        delete this.timers[id];
      }
    },
    clearAll() {
      Object.keys(this.timers).forEach(id => this.clearTimer(id));
      this.items = [];
    },
    setEnabled(v: boolean) {
      this.enabled = v;
      localStorage.setItem('noti.enabled', JSON.stringify(v));
      if (!v) this.clearAll();
    },
    setSoundEnabled(v: boolean) {
      this.soundEnabled = v;
      localStorage.setItem('noti.soundEnabled', JSON.stringify(v));
    },
    setBrowserNotiEnabled(v: boolean) {
      this.browserNotiEnabled = v;
      localStorage.setItem('noti.browserNotiEnabled', JSON.stringify(v));
    },
    setEmailEnabled(v: boolean) {
      this.emailEnabled = v;
      localStorage.setItem('noti.emailEnabled', JSON.stringify(v));
    },
    setSirenVolume(v: number) {
      this.sirenVolume = Math.max(0, Math.min(1, Number(v)));
      localStorage.setItem('noti.sirenVolume', String(this.sirenVolume));
    },
    setSirenPattern(p: 'double' | 'quad') {
      this.sirenPattern = p;
      localStorage.setItem('noti.sirenPattern', p);
    }
  }
});
