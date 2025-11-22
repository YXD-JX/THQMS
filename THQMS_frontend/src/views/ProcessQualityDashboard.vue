<template>
  <div class="page">
    <header class="page-header">
      <h1>PCB 八大工序 · 质量与产能看板</h1>
      <div class="actions">
        <label class="hint" style="display:flex;align-items:center;gap:6px;">
          <input type="checkbox" v-model="linkedRealtime" /> 联动
        </label>
        <label class="hint" style="display:flex;align-items:center;gap:6px;">
          曲线刷新(ms)
          <input type="number" v-model.number="procIntervalMs" min="200" step="200" style="width:90px" />
        </label>
        <button class="link" @click="refreshNow">立即刷新</button>
        <button class="link" @click="toggleSim">{{ running ? '停止' : '启动' }}仿真</button>
      </div>
    </header>
    <main class="page-main">
      <div class="filters">
        <label>
          工序：
          <select v-model="procFilter">
            <option value="">全部</option>
            <option v-for="p in processes" :key="p.id" :value="p.id">{{ p.name }}</option>
          </select>
        </label>
        <label>
          严重度：
          <select v-model="sevFilter">
            <option value="">全部</option>
            <option value="low">低</option>
            <option value="medium">中</option>
            <option value="high">高</option>
          </select>
        </label>
        <label>
          产线：
          <select v-model="lineFilter">
            <option value="">全部</option>
            <option v-for="l in lines" :key="l" :value="l">{{ l }}</option>
          </select>
        </label>
        <label>
          工单：
          <select v-model="orderFilter">
            <option value="">全部</option>
            <option v-for="o in orderOptions" :key="o" :value="o">{{ o }}</option>
          </select>
        </label>
        <label>
          聚合：
          <select v-model="aggBucket">
            <option value="shift">班次</option>
            <option value="day">日</option>
            <option value="week">周</option>
          </select>
        </label>
      </div>
      <div class="grid">
        <ProcessCard v-for="p in toShow" :key="p.id"
          :pid="p.id"
          :line-filter="lineFilter || undefined"
          :order-filter="orderFilter || undefined"
          :agg-bucket="aggBucket"
        />
      </div>
    </main>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, onBeforeUnmount, ref, watch } from 'vue'
import { storeToRefs } from 'pinia'
import { useProcessStore } from '@/stores/processQuality'
import { useLabStore } from '@/stores/lab'
import ProcessCard from '@/components/process/ProcessCard.vue'

// Sparkline 已抽出为可复用组件，内置于 ProcessCard

const proc = useProcessStore()
const lab = useLabStore();
proc.initIfNeeded();
lab.initIfNeeded();

const { processes, kpi } = storeToRefs(proc)
const seriesMap = kpi

const procFilter = ref('')
const sevFilter = ref<'' | 'low' | 'medium' | 'high'>('')
const lineFilter = ref('')
const orderFilter = ref('')
const lines = computed(() => proc.lines)
const orderOptions = computed(() => {
  const set = new Set<string>()
  Object.values(seriesMap.value).forEach(arr => arr?.forEach(pt => set.add(pt.orderId || '')))
  set.delete('')
  return Array.from(set)
})

const severityRank = { 'low': 1, 'medium': 2, 'high': 3 }
const recentMs = 10 * 60 * 1000
const toShow = computed(() => {
  let arr = procFilter.value ? processes.value.filter(p => p.id === procFilter.value) : processes.value
  if (sevFilter.value) {
    const now = Date.now()
    arr = arr.filter(p => {
      // if any recent anomaly on related params with rank >= selected
      return lab.anomalies.some(a => now - a.ts <= recentMs && p.relatedParams.includes(a.paramId) && severityRank[a.severity] >= severityRank[sevFilter.value as 'low'|'medium'|'high'])
    })
  }
  return arr
})

// 本页仅用于筛选与下拉项构建，具体每卡片内的筛选与聚合在 ProcessCard 内完成

// aggregates
const aggBucket = ref<'shift'|'day'|'week'>('shift')
// 聚合展示逻辑由子组件负责

const running = computed(() => !!proc.simTimer)
function toggleSim() {
  if (proc.simTimer) proc.stopSimulation();
  else proc.startSimulation(Math.max(200, Number(procIntervalMs.value)||4000));
}

function refreshNow() { proc.simulateTick() }

// 异常联动（两种模式）：仅在勾选时联动，默认不勾选；开启联动自动启动仿真
const LINKED_KEY = 'thqms.proc.linked.v2'
const linkedRealtime = ref<boolean>(JSON.parse(localStorage.getItem(LINKED_KEY) ?? 'false'))
watch(linkedRealtime, v => localStorage.setItem(LINKED_KEY, JSON.stringify(!!v)))
let lastAnomTick = 0
const minAnomGap = 500
function onLabAnomaly() {
  if (!linkedRealtime.value) return
  const now = Date.now()
  if (now - lastAnomTick < minAnomGap) return
  lastAnomTick = now
  proc.simulateTick()
}

// 本页独立的 KPI 刷新间隔设置（不与追溯页共享）
const PROC_INTERVAL_KEY = 'thqms.proc.interval.v1'
const procIntervalMs = ref<number>(Number(localStorage.getItem(PROC_INTERVAL_KEY) ?? '4000'))
watch(procIntervalMs, (v) => {
  const iv = Math.max(200, Number(v)||4000)
  localStorage.setItem(PROC_INTERVAL_KEY, String(iv))
  if (proc.simTimer) { proc.stopSimulation(); proc.startSimulation(iv) }
})

// 根据联动开关动态注册/注销异常监听；开启联动时若未在仿真则自动启动
let listening = false
function updateLinkedListener(enable: boolean) {
  if (enable && !listening) {
    window.addEventListener('lab-anomaly', onLabAnomaly as EventListener)
    listening = true
    if (!proc.simTimer) {
      const iv = Math.max(200, Number(procIntervalMs.value)||4000)
      proc.startSimulation(iv)
    }
  } else if (!enable && listening) {
    window.removeEventListener('lab-anomaly', onLabAnomaly as EventListener)
    listening = false
  }
}
watch(linkedRealtime, (v) => updateLinkedListener(!!v), { immediate: true })

onMounted(() => {
  // 保持全局仿真状态，不在页面切换时强制停止；联动监听已由 updateLinkedListener 管理
})
onBeforeUnmount(() => {
  if (listening) {
    window.removeEventListener('lab-anomaly', onLabAnomaly as EventListener)
    listening = false
  }
})

// 纯工具函数已移除，避免未使用告警
</script>

<style scoped>
.page-header { position: sticky; top: var(--topnav-h, 48px); z-index: 10; padding: 12px 24px; border-bottom: 1px solid var(--color-border); backdrop-filter: saturate(120%) blur(6px); background: color-mix(in oklab, var(--color-background) 80%, transparent); display:flex; align-items:center; justify-content:space-between; gap:12px; }
.page-header h1 { font-size: 18px; font-weight: 600; }
.page-main { padding: 16px; }
.actions .link { appearance:none; border:1px solid rgba(148,163,184,.35); background:transparent; color:#93c5fd; padding:4px 8px; border-radius:8px; font-size:12px; }
.filters { display:flex; align-items:center; gap:10px; flex-wrap: wrap; margin-bottom: 12px; }
.filters select { border:1px solid #cbd5e1; border-radius:8px; padding:4px 8px; background:#fff; font-size:12px; }
.grid { display:grid; grid-template-columns: repeat(1, minmax(0,1fr)); gap: 14px; }
@media (min-width: 720px) { .grid { grid-template-columns: repeat(2, minmax(0,1fr)); } }
@media (min-width: 1280px) { .grid { grid-template-columns: repeat(3, minmax(0,1fr)); } }
.card { border: 1px solid var(--color-border); border-radius: 14px; background: color-mix(in oklab, var(--color-background) 92%, transparent); box-shadow: 0 1px 0 rgba(0,0,0,.05), 0 10px 30px rgba(0,0,0,.05); padding: 14px; }
.card-head { display:flex; align-items:center; justify-content:space-between; gap: 10px; }
.card-title { font-size: 16px; font-weight: 700; margin: 0 0 2px; }
.links { display:flex; align-items:center; gap:8px; flex-wrap: wrap; }
.param-link { color:#38bdf8; font-size:12px; }
.hint { font-size: 12px; color:#64748b; }
.kpis { display:flex; gap: 16px; margin: 8px 0; }
.kpi { background: #0f172a0d; border: 1px solid var(--color-border); border-radius: 10px; padding: 8px 10px; }
.kpi label { font-size: 11px; color:#64748b; }
.kpi b { font-size: 16px; }
.agg { display:flex; gap:10px; align-items:center; flex-wrap: wrap; margin: 6px 0 10px; font-size: 12px; }
.delta.up { color:#16a34a; }
.delta.down { color:#dc2626; }
.mini { display:flex; flex-direction: column; gap: 6px; }
.mini .row { display:flex; align-items:center; justify-content: space-between; }

@supports (-webkit-touch-callout: none) {
  .page-header { backdrop-filter: none; background: color-mix(in oklab, var(--color-background) 92%, transparent); }
}
</style>
