<template>
  <div class="rounded border p-3" :class="boardClass">
    <div class="flex items-center justify-between mb-2">
      <h3 class="font-bold">异常看板</h3>
      <span class="text-sm text-gray-500">{{ anomalies.length }} 条</span>
    </div>
    <ul class="space-y-2 max-h-56 overflow-auto">
      <li
        v-for="a in anomalies"
        :key="a.id"
        class="p-2 rounded bg-white/5 border flex items-center justify-between cursor-pointer select-none"
        :class="{ 'police-highlight': selectedId===a.id }"
        @click="goToAnomaly(a)"
      >
        <div class="flex-1 mr-2">
          <div class="font-medium">{{ nameOf(a.paramId) }} - {{ a.type }}</div>
          <div class="text-sm text-gray-300">{{ new Date(a.ts).toLocaleString() }} | 值：{{ a.value }}</div>
          <div v-if="selectedId===a.id" class="detail mt-1 text-xs text-gray-200">
            <div>参数ID：{{ a.paramId }}</div>
            <div>上下限：LCL {{ limitsOf(a.paramId).lcl }} / UCL {{ limitsOf(a.paramId).ucl }}</div>
            <div>最近值：{{ latestValue(a.paramId) ?? '-' }}</div>
          </div>
        </div>
        <span :class="badgeClass(a.severity)" class="px-2 py-0.5 rounded text-xs">{{ a.severity }}</span>
      </li>
    </ul>
    <audio ref="beep" preload="auto">
      <!-- 将 alarm.mp3 放到 public/ 目录即可生效；若缺失则自动使用 WebAudio 蜂鸣作为降级 -->
      <source src="/alarm.mp3" type="audio/mpeg" />
    </audio>
  </div>
</template>

<script lang="ts" setup>
import { computed, onMounted, onBeforeUnmount, ref } from 'vue';
import { useRouter } from 'vue-router';
import { useLabStore } from '../stores/lab';

const store = useLabStore();
const props = defineProps<{ items?: LabAnomaly[] }>()
const anomalies = computed(() => props.items ?? store.anomalies);
const beep = ref<HTMLAudioElement | null>(null);
const selectedId = ref<string | null>(null);
const router = useRouter();

function nameOf(id: string) {
  return store.getParamById(id)?.name || id;
}
function badgeClass(sev: string): string {
  if (sev === 'high') return 'bg-red-600 text-white';
  if (sev === 'medium') return 'bg-amber-600 text-white';
  return 'bg-gray-600 text-white';
}
const boardClass = computed(() => anomalies.value.length ? 'border-red-500 shadow shadow-red-500/40' : 'border-gray-600');

function limitsOf(pid: string) {
  const p = store.getParamById(pid);
  return { lcl: p?.lcl ?? '-', ucl: p?.ucl ?? '-' } as { lcl: number | string; ucl: number | string };
}
function latestValue(pid: string) {
  const arr = store.series[pid] || [];
  return arr.length ? arr[arr.length - 1] : undefined;
}

// 铃声：优先播放本地 mp3，失败时用 WebAudio 生成蜂鸣音；带冷却避免连珠爆鸣
// 组件内不再负责自动蜂鸣，保留 mp3 audio 仅用于可能的后续交互需求
// 强化警报：红蓝交替的短促双/四连鸣笛（WebAudio 实现）
let audioCtx: AudioContext | null = null;
type AudioContextCtor = new() => AudioContext;
function ensureAudioCtx() {
  if (!audioCtx) {
    const w = window as unknown as { AudioContext?: AudioContextCtor; webkitAudioContext?: AudioContextCtor };
    const Ctx: AudioContextCtor | undefined = w.AudioContext || w.webkitAudioContext;
    if (Ctx) audioCtx = new Ctx();
  }
}
function playSirenPattern() {
  ensureAudioCtx();
  if (!audioCtx) return;
  if (audioCtx.state === 'suspended' && audioCtx.resume) audioCtx.resume().catch(() => {});
  const ns = useNotiStore();
  const now = audioCtx.currentTime;
  const bursts = ns.sirenPattern === 'double' ? 2 : 4; // 双/四连
  for (let i = 0; i < bursts; i++) {
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    const start = now + i * 0.2;
    const dur = 0.16;
    const f = i % 2 === 0 ? 1200 : 700; // 红蓝交替
    osc.type = 'sine';
    osc.frequency.setValueAtTime(f, start);
  const vol = Math.max(0.02, Math.min(1, Number(ns.sirenVolume || 0.8)));
  gain.gain.setValueAtTime(0.0001, start);
  gain.gain.exponentialRampToValueAtTime(0.4 * vol, start + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + dur);
    osc.connect(gain).connect(audioCtx.destination);
    osc.start(start);
    osc.stop(start + dur + 0.02);
  }
}
import type { LabAnomaly } from '@/stores/lab';
import { useNotiStore } from '@/stores/notifications';
// 全局蜂鸣已由插件处理；此处不再监听 lab-anomaly 以避免重复蜂鸣

function goToAnomaly(a: LabAnomaly) {
  // 本地高亮该异常项（警灯效果）
  selectedId.value = a.id;
  window.setTimeout(() => { if (selectedId.value === a.id) selectedId.value = null; }, 2600);
  // 跳转到对应图表（复用 /lab?param=xxx 的滚动与高亮）
  router.push({ path: '/lab', query: { param: a.paramId } });
  // 强化警报（尊重声音开关）
  const ns = useNotiStore();
  if (ns.soundEnabled) playSirenPattern();
}

onMounted(() => {});
onBeforeUnmount(() => {});
</script>

<style scoped>
/* 警车警灯效果：红蓝交替闪烁 */
.police-highlight {
  animation: policeFlash 1s linear 2;
  border-color: #ef4444;
  box-shadow: 0 0 0 2px #ef444444, 0 6px 18px #ef444422;
}
@keyframes policeFlash {
  0%, 100% { box-shadow: 0 0 0 2px #ef444444, 0 6px 18px #ef444422; border-color: #ef4444; background: linear-gradient(90deg, #ef444422, transparent); }
  25% { box-shadow: 0 0 0 2px #3b82f644, 0 6px 18px #3b82f622; border-color: #3b82f6; background: linear-gradient(270deg, #3b82f622, transparent); }
  50% { box-shadow: 0 0 0 2px #ef444444, 0 6px 18px #ef444422; border-color: #ef4444; background: linear-gradient(90deg, #ef444422, transparent); }
  75% { box-shadow: 0 0 0 2px #3b82f644, 0 6px 18px #3b82f622; border-color: #3b82f6; background: linear-gradient(270deg, #3b82f622, transparent); }
}
</style>
