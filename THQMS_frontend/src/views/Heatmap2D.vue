<template>
  <div class="page">
    <header class="page-header">
      <h1>2D 热力图 · PCB QMS 标准与异常</h1>
      <div class="actions">
        <label class="hint">工序
          <select v-model="procId">
            <option value="">全部</option>
            <option v-for="p in processes" :key="p.id" :value="p.id">{{ p.name }}</option>
          </select>
        </label>
        <label class="hint">参数
          <select v-model="paramId">
            <option value="">全部</option>
            <option v-for="p in paramOptions" :key="p.id" :value="p.id">{{ p.name }}</option>
          </select>
        </label>
        <label class="hint">列数
          <input type="number" v-model.number="cols" min="30" max="300" step="10" style="width:80px" />
        </label>
        <label class="hint">刷新(ms)
          <input type="number" v-model.number="refreshMs" min="200" step="200" style="width:90px" />
        </label>
        <label class="hint" style="display:flex;align-items:center;gap:6px;">
          <input type="checkbox" v-model="showStandards" /> 显示标准
        </label>
        <label class="hint" style="display:flex;align-items:center;gap:6px;">
          <input type="checkbox" v-model="showAnomalies" /> 显示异常
        </label>
        <div class="hint add">
          新增测量：
          <select v-model="addParamId">
            <option v-for="p in lab.params" :key="p.id" :value="p.id">{{ p.name }}</option>
          </select>
          <input type="number" v-model.number="addValue" placeholder="值" style="width:90px" />
          <button class="link" @click="addMeasurement">新增</button>
          <label class="hint">批量
            <input type="number" v-model.number="batchCount" min="1" max="200" step="1" style="width:70px" />
          </label>
          <button class="link" @click="addRandomBatch">随机生成</button>
        </div>
      </div>
    </header>
    <main class="page-main">
      <div class="canvas-wrap" ref="wrapRef">
  <canvas ref="canvas" :width="cw" :height="ch"></canvas>
  <div v-if="hover.visible" class="tooltip" ref="tt" :style="{ left: hover.x + 'px', top: hover.y + 'px', position: 'fixed' }">
          <div class="tt-name">{{ hover.paramName }}</div>
          <div class="tt-line">值：{{ hover.valueText }}</div>
          <div class="tt-line">状态：{{ hover.stateText }}</div>
          <div class="tt-line">偏差：{{ hover.deviationText }}</div>
          <div class="tt-line">裕度：{{ hover.marginText }}</div>
          <div class="tt-line">建议：{{ hover.adviceText }}</div>
          <div class="tt-line">时间：{{ hover.timeText }}</div>
        </div>
      </div>
      <div class="legend">
        <div class="row"><span class="name">颜色含义：</span>
          <span><i class="chip" style="--c:#3b82f6"></i>低于下限</span>
          <span><i class="chip" style="--c:#10b981"></i>接近目标</span>
          <span><i class="chip" style="--c:#ef4444"></i>高于上限</span>
        </div>
      </div>
    </main>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { storeToRefs } from 'pinia'
import { useLabStore, type LabParam } from '@/stores/lab'
import { useProcessStore } from '@/stores/processQuality'

const lab = useLabStore();
const proc = useProcessStore();
lab.initIfNeeded();
proc.initIfNeeded();

const { params: labParams } = storeToRefs(lab)
const { processes } = storeToRefs(proc)

// filters
const COLS_KEY = 'thqms.heat2d.cols.v1'
const REFRESH_KEY = 'thqms.heat2d.refresh.v1'
const STD_KEY = 'thqms.heat2d.showStd.v1'
const ANO_KEY = 'thqms.heat2d.showAno.v1'

const procId = ref('')
const paramId = ref('')
const cols = ref<number>(Number(localStorage.getItem(COLS_KEY) ?? '120'))
const refreshMs = ref<number>(Number(localStorage.getItem(REFRESH_KEY) ?? '1000'))
const showStandards = ref<boolean>(JSON.parse(localStorage.getItem(STD_KEY) ?? 'true'))
const showAnomalies = ref<boolean>(JSON.parse(localStorage.getItem(ANO_KEY) ?? 'true'))

// add measurement controls
const addParamId = ref<string>(labParams.value[0]?.id || '')
const addValue = ref<number | null>(null)
const batchCount = ref<number>(20)
function addMeasurement() {
  const pid = addParamId.value
  if (!pid || addValue.value == null || Number.isNaN(addValue.value)) return
  lab.addMeasurement({ ts: Date.now(), paramId: pid, value: Number(addValue.value) })
}

function addRandomBatch() {
  const pid = addParamId.value
  if (!pid || batchCount.value <= 0) return
  const p = lab.getParamById(pid)
  if (!p) return
  const now = Date.now()
  for (let i = 0; i < batchCount.value; i++) {
    const noise = (Math.random() + Math.random() + Math.random()) / 3 - 0.5
    const range = (p.ucl - p.lcl) / 6
    let v = p.target + noise * range * 2
    if (Math.random() < 0.1) v = Math.random() < 0.5 ? p.lcl - range * (1 + Math.random()) : p.ucl + range * (1 + Math.random())
    lab.addMeasurement({ ts: now + i, paramId: pid, value: parseFloat(v.toFixed(2)) })
  }
}

// derive param options by process filter
const paramOptions = computed(() => {
  if (!procId.value) return labParams.value
  const p = processes.value.find(x => x.id === procId.value)
  if (!p) return labParams.value
  return labParams.value.filter(lp => p.relatedParams.includes(lp.id))
})

// canvas and draw logic
const wrapRef = ref<HTMLDivElement | null>(null)
const canvas = ref<HTMLCanvasElement | null>(null)
const tt = ref<HTMLDivElement | null>(null)
const cw = ref<number>(1200)
const ch = ref<number>(320)
const padding = { l: 60, r: 20, t: 20, b: 26 }
const rowGap = 6

function rowsForCalc() {
  return (!procId.value ? paramOptions.value : labParams.value.filter(x => x.id === procId.value))
}

function recalcCanvasSize() {
  const vw = typeof window !== 'undefined' ? window.innerWidth : 1280
  const vh = typeof window !== 'undefined' ? window.innerHeight : 800
  const wrapW = wrapRef.value?.clientWidth || Math.max(320, vw - 32)
  const n = Math.max(1, rowsForCalc().length)
  const perRow = vw <= 600 ? 44 : 36
  const baseH = padding.t + padding.b + n * perRow + (n - 1) * rowGap
  const targetW = Math.max(320, Math.min(2000, wrapW))
  cw.value = Math.round(targetW)
  ch.value = Math.max(220, Math.min(1200, Math.round(baseH)))
}

function colorFor(p: LabParam, v?: number): string {
  if (typeof v !== 'number') return '#334155'
  if (v < p.lcl) {
    const t = Math.min(1, (p.lcl - v) / ((p.ucl - p.lcl) / 3))
    return `hsl(${210}, ${80}%, ${50 - 10 * t}%)` // blue-ish
  }
  if (v > p.ucl) {
    const t = Math.min(1, (v - p.ucl) / ((p.ucl - p.lcl) / 3))
    return `hsl(${0}, ${80}%, ${50 - 10 * t}%)` // red-ish
  }
  const span = p.ucl - p.lcl
  const t = 1 - Math.min(1, Math.abs(v - p.target) / (span / 2))
  const l = 40 + 20 * t
  return `hsl(${130}, ${70}%, ${l}%)` // green-ish
}

function draw() {
  if (!canvas.value) return
  const ctx = canvas.value.getContext('2d')!
  const W = cw.value, H = ch.value
  ctx.clearRect(0, 0, W, H)
  const rows = rowsForCalc()
  const n = rows.length
  if (!n) return
  const innerH = H - padding.t - padding.b
  const rowH = Math.max(18, Math.floor((innerH - rowGap * (n - 1)) / n))
  const colsN = Math.max(10, Math.min(500, Number(cols.value)||120))
  const innerW = W - padding.l - padding.r
  const cellW = Math.floor(innerW / colsN)

  // axes labels
  ctx.fillStyle = '#94a3b8'
  ctx.font = '12px system-ui, -apple-system, Segoe UI, Roboto'
  ctx.textBaseline = 'middle'

  rows.forEach((p, rIdx) => {
    const y = padding.t + rIdx * (rowH + rowGap)
    // name
    ctx.fillText(p.name, 8, y + rowH / 2)
    // standards labels & ticks
    if (showStandards.value) {
      ctx.fillStyle = '#64748b'
      ctx.textAlign = 'left'
      ctx.fillText(`LCL ${p.lcl}${p.unit||''}`, padding.l, y + 10)
      ctx.textAlign = 'center'
      ctx.fillText(`Target ${p.target}${p.unit||''}`, padding.l + innerW/2, y + 10)
      ctx.textAlign = 'right'
  ctx.fillText(`UCL ${p.ucl}${p.unit||''}`, W - padding.r, y + 10)
      ctx.textAlign = 'left'
    }

    // cells
    for (let c = 0; c < colsN; c++) {
      const arr = lab.meas[p.id] || []
      const idxFromNewest = colsN - 1 - c
      const i = Math.max(0, arr.length - 1 - idxFromNewest)
      const v = arr[i]?.value
      ctx.fillStyle = colorFor(p, v)
      const x = padding.l + c * cellW
      ctx.fillRect(x, y, cellW - 1, rowH)
    }

    // anomalies overlay
    if (showAnomalies.value) {
      const anos = lab.anomalies.filter(a => a.paramId === p.id).slice(0, colsN)
      ctx.fillStyle = '#f59e0b'
      anos.forEach(a => {
        // find approx x by time proximity
        const arr = lab.meas[p.id] || []
        let iBest = arr.length - 1
        let best = Number.POSITIVE_INFINITY
        for (let i = arr.length - 1; i >= 0 && i > arr.length - colsN - 2; i--) {
          const d = Math.abs(arr[i].ts - a.ts)
          if (d < best) { best = d; iBest = i }
        }
        const offset = (arr.length - 1) - iBest
        const col = colsN - 1 - Math.max(0, Math.min(colsN - 1, offset))
        const x = padding.l + col * cellW
        ctx.fillRect(x, y, Math.max(2, Math.floor(cellW / 2)), 3)
      })
    }
  })

  // x-axis label
  ctx.fillStyle = '#94a3b8'
  ctx.textAlign = 'right'
  ctx.fillText('← 时间（旧 → 新）', W - 8, H - 10)
}

function onAnomaly() { draw() }

// hover tooltip
type Hover = { visible: boolean; x: number; y: number; paramName?: string; valueText?: string; stateText?: string; timeText?: string; deviationText?: string; marginText?: string; adviceText?: string }
const hover = ref<Hover>({ visible: false, x: 0, y: 0 })
function classify(p: LabParam, v?: number) {
  if (typeof v !== 'number') return '无数据'
  if (v < p.lcl) return '低于下限'
  if (v > p.ucl) return '高于上限'
  return '合格'
}
function adviceFor(p: LabParam, v?: number) {
  if (v == null) return '—'
  const dir = v > p.target ? '偏高' : (v < p.target ? '偏低' : '居中')
  // 简单基于参数类型的建议
  if (p.id === 'cu' || p.id === 'ni') {
    return dir === '偏高' ? '核查电镀/沉铜配比与加料频次，评估溶液更新与过滤' : '检查上料浓度与药液老化，评估补加策略'
  }
  if (p.id === 'acid') {
    return dir === '偏高' ? '检查酸比与补加，校验滴定/传感器' : '评估进液稀释与中和控制，校验取样'
  }
  if (p.id === 'temp') {
    return dir === '偏高' ? '核查加热/冷却回路与温控阈值，检查搅拌与换热' : '提高设定或排查冷端过强，关注传感器漂移'
  }
  return '核查取样、计量与上游工艺设定'
}
function placeTooltip(px: number, py: number) {
  const margin = 12
  const w = tt.value?.offsetWidth ?? 260
  const h = tt.value?.offsetHeight ?? 140
  let x = px + margin
  let y = py + margin
  if (x + w > window.innerWidth - 8) x = px - w - margin
  if (x < 8) x = 8
  if (y + h > window.innerHeight - 8) y = py - h - margin
  if (y < 8) y = 8
  return { x, y }
}

function onMouseMove(ev: MouseEvent) {
  if (!canvas.value) return
  const rect = (ev.target as HTMLCanvasElement).getBoundingClientRect()
  const ox = ev.clientX - rect.left
  const oy = ev.clientY - rect.top
  const rows = (!paramId.value ? paramOptions.value : labParams.value.filter(x => x.id === paramId.value))
  const n = rows.length
  const innerH = ch.value - padding.t - padding.b
  const rowH = Math.max(18, Math.floor((innerH - rowGap * (n - 1)) / n))
  const colsN = Math.max(10, Math.min(500, Number(cols.value)||120))
  const innerW = cw.value - padding.l - padding.r
  const cellW = Math.floor(innerW / colsN)
  if (ox < padding.l || ox > cw.value - padding.r || oy < padding.t || oy > ch.value - padding.b) { hover.value.visible = false; return }
  const rIdx = Math.floor((oy - padding.t) / (rowH + rowGap))
  if (rIdx < 0 || rIdx >= rows.length) { hover.value.visible = false; return }
  const p = rows[rIdx]
  const cIdx = Math.max(0, Math.min(colsN - 1, Math.floor((ox - padding.l) / cellW)))
  const arr = lab.meas[p.id] || []
  const idxFromNewest = colsN - 1 - cIdx
  const i = Math.max(0, arr.length - 1 - idxFromNewest)
  const item = arr[i]
  const v = item?.value
  const ts = item?.ts
  const timeText = ts ? new Date(ts).toLocaleTimeString('zh-CN', { hour12: false }) : '-'
  const span = p.ucl - p.lcl
  const dev = (v != null ? v - p.target : 0)
  const devPct = span>0 ? Math.abs(dev) / span * 100 : 0
  const toLimit = v == null ? 0 : (v > p.target ? (p.ucl - v) : (v - p.lcl))
  const marginPct = span>0 ? Math.max(0, toLimit) / span * 100 : 0
  const pos = placeTooltip(ev.clientX, ev.clientY)
  hover.value = {
    visible: true,
    x: pos.x,
    y: pos.y,
    paramName: p.name,
    valueText: (v != null ? v : '-') + (p.unit || ''),
    stateText: classify(p, v),
    deviationText: v==null? '-' : `${dev>=0?'+':''}${dev.toFixed(2)}${p.unit||''} · 约 ${devPct.toFixed(1)}% 带宽`,
    marginText: v==null? '-' : `距最近控制限约 ${Math.max(0,toLimit).toFixed(2)}${p.unit||''} · ${marginPct.toFixed(1)}% 裕度`,
    adviceText: adviceFor(p, v),
    timeText,
  }
}
function onMouseLeave() { hover.value.visible = false }

onMounted(() => {
  recalcCanvasSize()
  draw()
  window.addEventListener('lab-anomaly', onAnomaly)
  canvas.value?.addEventListener('mousemove', onMouseMove)
  canvas.value?.addEventListener('mouseleave', onMouseLeave)
  window.addEventListener('resize', onResize)
})
onBeforeUnmount(() => {
  window.removeEventListener('lab-anomaly', onAnomaly)
  canvas.value?.removeEventListener('mousemove', onMouseMove)
  canvas.value?.removeEventListener('mouseleave', onMouseLeave)
  window.removeEventListener('resize', onResize)
})

watch([procId, paramId, showStandards, showAnomalies, () => lab.anomalies.length, () => Object.values(lab.meas).reduce((s,a)=>s+(a?.length||0),0)], () => {
  // 变更时重绘
  recalcCanvasSize()
  requestAnimationFrame(draw)
})

// persist & timers
let refreshTimer: number | undefined
watch(cols, (v) => localStorage.setItem(COLS_KEY, String(Math.max(10, Math.min(500, Number(v)||120)))))
watch(refreshMs, (v) => {
  const iv = Math.max(200, Number(v)||1000)
  localStorage.setItem(REFRESH_KEY, String(iv))
  if (refreshTimer) { clearInterval(refreshTimer); refreshTimer = undefined }
  refreshTimer = window.setInterval(() => draw(), iv)
}, { immediate: true })
watch(showStandards, (v) => localStorage.setItem(STD_KEY, JSON.stringify(!!v)))
watch(showAnomalies, (v) => localStorage.setItem(ANO_KEY, JSON.stringify(!!v)))

// link addParamId with process filter
watch(procId, () => {
  const first = paramOptions.value[0]
  if (first) addParamId.value = first.id
})

function onResize(){ recalcCanvasSize(); requestAnimationFrame(draw) }
</script>

<style scoped>
.page-header { position: sticky; top: var(--topnav-h, 48px); z-index: 10; padding: 12px 24px; border-bottom: 1px solid var(--color-border); backdrop-filter: saturate(120%) blur(6px); background: color-mix(in oklab, var(--color-background) 80%, transparent); display:flex; align-items:center; justify-content:space-between; gap:12px; }
.page-header h1 { font-size: 18px; font-weight: 600; }
.actions { display:flex; align-items:center; gap:10px; flex-wrap:wrap; }
.actions .hint { font-size:12px; color:#64748b; display:flex; align-items:center; gap:6px; }
.actions select { border:1px solid #cbd5e1; border-radius:8px; padding:4px 8px; background:#fff; font-size:12px; }
.actions .add { display:flex; align-items:center; gap:6px; }
.actions .link { appearance:none; border:1px solid rgba(148,163,184,.35); background:transparent; color:#93c5fd; padding:4px 8px; border-radius:8px; font-size:12px; }
.page-main { padding: 12px 16px; }
.canvas-wrap { position: relative; border:1px solid var(--color-border); border-radius: 12px; overflow: hidden; background: #0b1220; }
.legend { font-size: 12px; color:#94a3b8; margin-top: 8px; display:flex; gap:12px; align-items:center; }
.chip { display:inline-block; width:12px; height:12px; border-radius:3px; background:var(--c); margin:0 6px; vertical-align: middle; }
.tooltip { position:absolute; pointer-events:none; background: rgba(15,23,42,.95); color:#e2e8f0; border:1px solid #334155; padding:6px 8px; border-radius:8px; font-size:12px; box-shadow: 0 8px 20px rgba(0,0,0,.25); max-width: 50ch; }
.tt-name { font-weight: 700; margin-bottom: 2px; }
.tt-line { color:#cbd5e1; }

@media (max-width: 960px) {
  .page-main { padding: 10px; }
}

@supports (-webkit-touch-callout: none) {
  .page-header { backdrop-filter: none; background: color-mix(in oklab, var(--color-background) 92%, transparent); }
}
</style>
