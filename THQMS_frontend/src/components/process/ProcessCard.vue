<template>
  <section class="card">
    <div class="card-head">
      <h2 class="card-title">{{ procDef?.name || pid }}</h2>
      <div class="links">
        <span class="hint">关联参数：</span>
        <RouterLink v-for="rid in (procDef?.relatedParams || [])" :key="rid" class="param-link" :to="{ path: '/lab', query: { param: rid } }">{{ nameOf(rid) }}</RouterLink>
      </div>
    </div>
    <div class="kpis">
      <div class="kpi"><label>良率</label><b>{{ fmtPct(latest?.yieldRate) }}</b></div>
      <div class="kpi"><label>不良率</label><b>{{ fmtPct(latest?.defectRate) }}</b></div>
      <div class="kpi"><label>产出</label><b>{{ latest?.throughput ?? '-' }}</b></div>
    </div>
    <div class="agg">
      <span class="hint">本{{ aggBucketLabel }}均值：</span>
      <span>良率 {{ fmtPct(agg.current?.yieldAvg) }}</span>
      <span>不良 {{ fmtPct(agg.current?.defectAvg) }}</span>
      <span>产出 Σ{{ agg.current?.throughputSum ?? '-' }}</span>
      <span class="delta" :class="deltaClassYield">Δ良率 {{ fmtDelta(agg.delta?.yieldAvg) }}</span>
      <span class="delta" :class="deltaClassDefect">Δ不良 {{ fmtDelta(agg.delta?.defectAvg) }}</span>
      <span class="delta">Δ产出 {{ fmtIntDelta(agg.delta?.throughputSum) }}</span>
    </div>
    <div class="mini">
      <div class="row">
        <span>良率走势</span>
        <Sparkline :points="seriesYield" color="#22c55e" />
      </div>
      <div class="row">
        <span>不良走势</span>
        <Sparkline :points="seriesDefect" color="#ef4444" />
      </div>
      <div class="row">
        <span>产出走势</span>
        <Sparkline :points="seriesThroughput" color="#3b82f6" />
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { RouterLink } from 'vue-router'
import { useProcessStore } from '@/stores/processQuality'
import { useLabStore } from '@/stores/lab'
import Sparkline from './Sparkline.vue'

type Bucket = 'shift'|'day'|'week'

const props = defineProps<{ pid: string; lineFilter?: string; orderFilter?: string; aggBucket: Bucket }>()
const proc = useProcessStore()
const lab = useLabStore()

const procDef = computed(() => proc.processes.find(p => p.id === props.pid))
const nameOf = (id: string) => lab.getParamById(id)?.name || id

function filteredSeries() {
  let arr = proc.kpi[props.pid] || []
  if (props.lineFilter) arr = arr.filter(x => x.lineId === props.lineFilter)
  if (props.orderFilter) arr = arr.filter(x => x.orderId === props.orderFilter)
  return arr
}

const latest = computed(() => {
  const arr = filteredSeries()
  return arr.length ? arr[arr.length - 1] : proc.latestOf(props.pid)
})

const aggBucketLabel = computed(() => props.aggBucket === 'shift' ? '班次' : props.aggBucket === 'day' ? '日' : '周')
const agg = computed(() => {
  const list = proc.computeAggregates(props.aggBucket, { lineId: props.lineFilter || undefined, orderId: props.orderFilter || undefined }).filter(g => g.processId === props.pid)
  if (!list.length) return { current: undefined, prev: undefined, delta: undefined }
  const sorted = list.sort((a, b) => a.endTs - b.endTs)
  const current = sorted[sorted.length - 1]
  const prev = sorted.length > 1 ? sorted[sorted.length - 2] : undefined
  const delta = prev ? {
    yieldAvg: current.yieldAvg - prev.yieldAvg,
    defectAvg: current.defectAvg - prev.defectAvg,
    throughputSum: current.throughputSum - prev.throughputSum,
  } : undefined
  return { current, prev, delta }
})

const seriesYield = computed(() => filteredSeries().map(x => x.yieldRate))
const seriesDefect = computed(() => filteredSeries().map(x => x.defectRate))
const seriesThroughput = computed(() => filteredSeries().map(x => x.throughput))

function fmtPct(v?: number) { if (typeof v !== 'number') return '-'; return (v * 100).toFixed(1) + '%' }
function fmtDelta(v?: number) { if (typeof v !== 'number') return '-'; const s = (v * 100).toFixed(1); const sign = v>0?'+':''; return `${sign}${s}%` }
function fmtIntDelta(v?: number) { if (typeof v !== 'number') return '-'; const sign = v>0?'+':''; return `${sign}${Math.round(v)}` }

const deltaClassYield = computed(() => {
  const d = agg.value?.delta
  if (!d) return ''
  return d.yieldAvg >= 0 ? 'up' : 'down'
})
const deltaClassDefect = computed(() => {
  const d = agg.value?.delta
  if (!d) return ''
  return d.defectAvg <= 0 ? 'up' : 'down'
})
</script>

<style scoped>
.card { border: 1px solid var(--color-border); border-radius: 14px; background: color-mix(in oklab, var(--color-background) 92%, transparent); box-shadow: 0 1px 0 rgba(0,0,0,.05), 0 10px 30px rgba(0,0,0,.05); padding: 14px; }
.card-head { display:flex; align-items:center; justify-content:space-between; gap: 10px; flex-wrap: wrap; }
.card-title { font-size: 16px; font-weight: 700; margin: 0 0 2px; }
.links { display:flex; align-items:center; gap:8px; flex-wrap: wrap; }
.param-link { color:#38bdf8; font-size:12px; }
.hint { font-size: 12px; color:#64748b; }
.kpis { display:flex; gap: 16px; margin: 8px 0; flex-wrap: wrap; }
.kpi { background: #0f172a0d; border: 1px solid var(--color-border); border-radius: 10px; padding: 8px 10px; }
.kpi label { font-size: 11px; color:#64748b; }
.kpi b { font-size: 16px; }
.agg { display:flex; gap:10px; align-items:center; flex-wrap: wrap; margin: 6px 0 10px; font-size: 12px; }
.delta.up { color:#16a34a; }
.delta.down { color:#dc2626; }
.mini { display:flex; flex-direction: column; gap: 6px; }
.mini .row { display:flex; align-items:center; justify-content: space-between; }
</style>
