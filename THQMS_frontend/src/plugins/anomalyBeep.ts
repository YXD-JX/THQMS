import { useNotiStore } from '@/stores/notifications';
import type { LabAnomaly } from '@/stores/lab';

// 全局蜂鸣（WebAudio）。避免依赖任何组件是否挂载。
let audioCtx: AudioContext | null = null;
let lastBeep = 0;
const cooldownMs = 700; // 保护：避免异常风暴时连珠爆鸣

type AudioContextCtor = new () => AudioContext;
function ensureAudioCtx() {
  if (!audioCtx) {
    const w = window as unknown as { AudioContext?: AudioContextCtor; webkitAudioContext?: AudioContextCtor };
    const Ctx: AudioContextCtor | undefined = w.AudioContext || w.webkitAudioContext;
    if (Ctx) audioCtx = new Ctx();
  }
}

function playBeepForSeverity(sev: 'low' | 'medium' | 'high', volume = 0.8) {
  ensureAudioCtx();
  if (!audioCtx) return;
  if (audioCtx.state === 'suspended' && audioCtx.resume) audioCtx.resume().catch(() => {});

  const now = audioCtx.currentTime;
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();

  const cfg = sev === 'high' ? { f: 1200, dur: 0.22 }
    : sev === 'medium' ? { f: 900, dur: 0.18 }
    : { f: 700, dur: 0.16 };

  const vol = Math.max(0.02, Math.min(1, Number(volume || 0.8)));
  osc.type = 'sine';
  osc.frequency.setValueAtTime(cfg.f, now);
  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.exponentialRampToValueAtTime(0.35 * vol, now + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + cfg.dur);
  osc.connect(gain).connect(audioCtx.destination);
  osc.start(now);
  osc.stop(now + cfg.dur + 0.03);
}

export function installAnomalyBeep() {
  // 主动解锁策略：首次用户交互尝试 resume()，然后移除监听
  const unlock = () => {
    ensureAudioCtx();
    if (audioCtx && audioCtx.state === 'suspended' && audioCtx.resume) {
      audioCtx.resume().catch(() => {});
    }
    window.removeEventListener('pointerdown', unlock);
    window.removeEventListener('keydown', unlock);
    window.removeEventListener('touchstart', unlock);
  };
  window.addEventListener('pointerdown', unlock, { once: true });
  window.addEventListener('keydown', unlock, { once: true });
  window.addEventListener('touchstart', unlock, { once: true });

  const handler = (ev: Event) => {
    const a = (ev as CustomEvent<LabAnomaly>).detail;
    if (!a) return;
    const ns = useNotiStore();
    if (!ns.soundEnabled) return;

    const now = Date.now();
    if (now - lastBeep < cooldownMs) return;
    lastBeep = now;

    // 使用通知里的音量
    playBeepForSeverity((a.severity as 'low'|'medium'|'high') ?? 'medium', ns.sirenVolume ?? 0.8);
  };
  window.addEventListener('lab-anomaly', handler as EventListener);
  return () => window.removeEventListener('lab-anomaly', handler as EventListener);
}
