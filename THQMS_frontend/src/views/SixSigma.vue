<template>
  <div class="page">
    <header class="page-header">
      <h1>六西格玛 · 参数动态管理</h1>
      <div class="actions">
        <label class="hint">直方图分箱
          <input type="number" v-model.number="bins" min="5" max="60" step="1" style="width:70px" />
        </label>
        <label class="hint" style="display:flex;align-items:center;gap:6px;"><input type="checkbox" v-model="showSpec" /> 显示规格线</label>
        <label class="hint" style="display:flex;align-items:center;gap:6px;"><input type="checkbox" v-model="showCtl" /> 显示控制线</label>
        <div class="hint add">
          新增测量：
          <input type="number" v-model.number="addValue" placeholder="值" style="width:90px" />
          <button class="link" @click="addOne">新增</button>
          <label class="hint">批量
            <input type="number" v-model.number="batch" min="1" max="500" step="1" style="width:70px" />
          </label>
          <button class="link" @click="addRandomBatch">随机生成</button>
        </div>
        <button class="link" @click="toggleSim">{{ labRunning ? '停止' : '启动' }}实验室仿真</button>
        <button class="link" @click="exportPNGs">导出图片</button>
        <button class="link" @click="exportPDF">导出PDF</button>
  <button class="link" @click="resetKpiOrder">重置卡片顺序</button>
  <button class="link" @click="resetChartOrder">重置图表顺序</button>
      </div>
    </header>
    <main class="page-main">
          <div class="layout">
            <!-- 左：参数面板（可复用组件） -->
            <ParamList v-model:pid="(pid as any)" />

            <!-- 中：图表（居中） -->
            <section class="center">
              <SixCharts ref="charts" />
            </section>

            <!-- 右：动态解说/报告 -->
            <aside class="panel right">
              <h3 class="panel-title">动态六西格玛报告</h3>
              <KpiCards />
              <div class="report">
                <div class="p" v-for="(line, i) in report" :key="i">{{ line }}</div>
              </div>
            </aside>
          </div>
    </main>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, onBeforeUnmount, ref, watch } from 'vue'
import { useLabStore, type LabParam } from '@/stores/lab'
import { useSixStore } from '@/stores/six'
import ParamList from '@/components/six/ParamList.vue'
import KpiCards from '@/components/six/KpiCards.vue'
import SixCharts from '@/components/six/SixCharts.vue'

const lab = useLabStore()
lab.initIfNeeded()
const six = useSixStore()

const pid = computed({ get: ()=> six.pid, set: v=> six.pid = v })
const bins = computed({ get: ()=> six.bins, set: v=> six.bins = v })
const showSpec = computed({ get: ()=> six.showSpec, set: v=> six.showSpec = v })
const showCtl = computed({ get: ()=> six.showCtl, set: v=> six.showCtl = v })

const labRunning = computed(() => six.labRunning)
function toggleSim() { six.toggleSim() }

const values = computed(() => six.values)
const param = computed<LabParam | undefined>(() => six.param)

// metrics/ctl/cap now from store
const metrics = computed(()=> six.metrics)
const ctl = computed(()=> six.ctl)
const cap = computed(()=> six.cap)

const weco = computed(()=> six.weco)

// add measurement
const addValue = ref<number | null>(null)
const batch = ref<number>(50)
function addOne() {
  if (!pid.value || addValue.value == null || Number.isNaN(addValue.value)) return
  lab.addMeasurement({ ts: Date.now(), paramId: pid.value, value: Number(addValue.value) })
}
function addRandomBatch() {
  const p = param.value; if (!pid.value || !p || batch.value<=0) return
  const now = Date.now()
  for (let i=0;i<batch.value;i++) {
    const noise = (Math.random()+Math.random()+Math.random())/3 - 0.5
    const range = (p.ucl - p.lcl) / 6
    let v = p.target + noise * range * 2
    if (Math.random()<0.1) v = Math.random()<0.5 ? p.lcl - range*(1+Math.random()) : p.ucl + range*(1+Math.random())
    lab.addMeasurement({ ts: now+i, paramId: pid.value, value: parseFloat(v.toFixed(2)) })
  }
}

// charts moved to SixCharts component
const charts = ref<InstanceType<typeof SixCharts> | null>(null)

function fmt(x?: number) { if (x==null || Number.isNaN(x)) return '-'; return Number(x).toFixed(3) }
function fmtPct(x?: number) { if (x==null || Number.isNaN(x)) return '-'; return (x*100).toFixed(3)+'%' }

function onAnomaly() { /* charts handle redraw internally */ }
onMounted(() => {
  window.addEventListener('lab-anomaly', onAnomaly)
  // listen to global dock controls
  window.addEventListener('six:controls', onSixControls as EventListener)
  window.addEventListener('six:export', onSixExport as EventListener)
  // charts has its own timer/hover handlers
})
onBeforeUnmount(() => {
  window.removeEventListener('lab-anomaly', onAnomaly)
  window.removeEventListener('six:controls', onSixControls as EventListener)
  window.removeEventListener('six:export', onSixExport as EventListener)
})

watch([pid, bins, showSpec, showCtl, () => lab.anomalies.length, () => (lab.meas[pid.value]?.length||0)], () => { /* charts react internally */ })

// handlers for global dock events
function onSixControls() { /* handled in store; keep for backward compat no-op */ }
function onSixExport(ev: Event) {
  const ce = ev as CustomEvent<{ kind: 'png'|'pdf' }>
  const k = ce.detail?.kind
  if (k === 'png') exportPNGs(); else if (k === 'pdf') exportPDF()
}

function resetKpiOrder() { six.kpiOrder.splice(0, six.kpiOrder.length, 'n','mean','sigmaShort','sigmaLong','cpCpk','ppPpk','zbench','ppm','yield') }

// 图表拖拽排序移至 SixCharts 组件；仍提供重置按钮
function resetChartOrder() { six.chartOrder.splice(0, six.chartOrder.length, 'HIST','BOX','I','MR','QQ','CAP') }
// KPI tooltip moved into KpiCards component

// param tooltip moved into ParamList component

// ensure imported components are marked as used for TS
void ParamList; void KpiCards; void SixCharts

// export images & PDF
function exportPNGs() {
  const canvases = charts.value?.getCanvasEls?.() ?? []
  canvases.forEach((c, idx) => {
    const link = document.createElement('a'); link.href = c.toDataURL('image/png'); link.download = `six-${pid.value}-${idx}.png`; link.click()
  })
}
function exportPDF() {
  const canvases = charts.value?.getCanvasEls?.() ?? []
  const imgs = canvases.map(c => c.toDataURL('image/png'))
  const w = window.open('', '_blank')
  if (!w) return
  const metricHtml = `
    <div style="font-family:system-ui,Segoe UI,Roboto;line-height:1.4;margin-bottom:8px;">
      <h2>六西格玛报告 - ${param.value?.name||pid.value}</h2>
      <div>样本数: ${metrics.value.n}；均值: ${fmt(metrics.value.mean)}；σ短期: ${fmt(cap.value.shortSigma)}；σ长期: ${fmt(cap.value.longSigma)}</div>
      <div>Cp/Cpk(短): ${fmt(cap.value.cpShort)}/${fmt(cap.value.cpkShort)}；Pp/Ppk(长): ${fmt(cap.value.pp)}/${fmt(cap.value.ppk)}</div>
    </div>`
  const reportEl = document.querySelector('.report') as HTMLElement | null
  const reportHtml = reportEl ? `<div style='border:1px solid #ddd;border-radius:8px;padding:8px;margin:8px 0;'>${reportEl.innerHTML}</div>` : ''
  w.document.write(`<html><head><title>Six Sigma Report</title></head><body>`)
  w.document.write(metricHtml)
  if (reportHtml) w.document.write(reportHtml)
  imgs.forEach(src => w.document.write(`<div style='margin:6px 0;'><img src='${src}' style='max-width:100%;border:1px solid #ddd'/></div>`))
  w.document.write(`</body></html>`)
  w.document.close()
  // trigger print from parent after content loads
  setTimeout(() => { try { w.print() } catch {} }, 200)
}

// dynamic analysis report
const lastTimeText = computed(() => {
  const arr = lab.meas[pid.value]||[]
  const ts = arr.length ? arr[arr.length-1].ts : undefined
  return ts ? new Date(ts).toLocaleString('zh-CN',{hour12:false}) : '-'
})
const ppmShort = computed(() => String(Math.round((cap.value.defectShort||0)*1e6)))
const analysis = computed(() => {
  const p = param.value
  const m = metrics.value.mean
  const sShort = ctl.value.sigma
  const sLong = metrics.value.sigma
  let deltaText='-', zMeanText='-'
  if (p && Number.isFinite(m)) {
    const delta = m - p.target
    deltaText = `${delta>=0?'+':''}${delta.toFixed(3)}${p.unit||''}`
    if (sShort>0) zMeanText = ((m-p.target)/sShort).toFixed(2)
  }
  const cp = cap.value.cpShort, cpk = cap.value.cpkShort
  const level = (cp?:number, cpk?:number) => {
    if (!cp || !cpk) return '—'
    const base = Math.min(cp, cpk)
    if (base >= 1.67) return '卓越（>1.67）'
    if (base >= 1.33) return '可接受（1.33~1.67）'
    if (base >= 1.00) return '勉强（1.00~1.33）'
    return '不足（<1.00）'
  }
  // stability
  const rulesCount = new Map<string, number>()
  weco.value.forEach((rules)=> rules.forEach(r=> rulesCount.set(r, (rulesCount.get(r)||0)+1)))
  const stabilityText = rulesCount.size===0 ? '稳定（未触发 WECO 规则）' : `不稳定（触发：${[...rulesCount.entries()].map(([k,v])=>`${k}×${v}`).join('，')}）`
  // trend via simple regression on last K points
  const arr = values.value
  let trendText = '—'
  if (arr.length>=5) {
    const K = Math.min(30, arr.length)
    const xs = Array.from({length:K}, (_,i)=>i)
    const ys = arr.slice(-K)
    const xbar = xs.reduce((a,b)=>a+b,0)/K
    const ybar = ys.reduce((a,b)=>a+b,0)/K
    let num=0, den=0; for (let i=0;i<K;i++){ num += (xs[i]-xbar)*(ys[i]-ybar); den += (xs[i]-xbar)*(xs[i]-xbar) }
    const slope = den? num/den : 0
    if (Math.abs(slope) < (sShort||sLong||1e-6) * 0.01) trendText = '无明显趋势'
    else trendText = `${slope>0?'上升':'下降'}趋势，斜率≈${slope.toFixed(4)} /样本`
  }
  // margin to nearest spec at mean
  let marginText='-'
  if (p && Number.isFinite(m)) {
    const margin = Math.min(Math.abs(p.ucl - m), Math.abs(m - p.lcl))
    const sigmaRef = sShort>0? sShort : (sLong>0? sLong : 0)
    marginText = `${margin.toFixed(3)}${p.unit||''}（≈${sigmaRef? (margin/sigmaRef).toFixed(2)+'σ':''}距最近规格）`
  }
  // advice
  let adviceText = '维持受控，按既定频率监控'
  if (rulesCount.size>0) adviceText = '存在异常信号：请立即进行原因分析（人机料法环测），必要时按 SOP 执行纠偏与复测'
  if (cp && cpk && Math.min(cp,cpk) < 1.33) adviceText = '能力不足：优先降波动（优化配方/工艺参数、改善测量系统），其次校正目标中心'
  if (p && Number.isFinite(m) && Math.abs(m - p.target) > (sShort||sLong||0)*0.5) adviceText += '；建议微调目标设定使均值贴近 Target'
  return { deltaText, zMeanText, capabilityLevel: level(cp, cpk), stabilityText, trendText, marginText, adviceText }
})
const report = computed(() => {
  const lines: string[] = []
  lines.push(`参数：${param.value?.name || pid.value}`)
  lines.push(`数据规模：n=${metrics.value.n}；最新时间：${lastTimeText.value}`)
  lines.push(`中心偏移：Δ=${analysis.value.deltaText}；Zμ=${analysis.value.zMeanText}`)
  lines.push(`能力评估：Cp/Cpk=${fmt(cap.value.cpShort)}/${fmt(cap.value.cpkShort)}；Pp/Ppk=${fmt(cap.value.pp)}/${fmt(cap.value.ppk)}（${analysis.value.capabilityLevel}）`)
  lines.push(`良率(短)：${fmtPct(1-(cap.value.defectShort||0))}；PPM=${ppmShort.value}`)
  lines.push(`稳定性：${analysis.value.stabilityText}`)
  lines.push(`趋势：${analysis.value.trendText}`)
  lines.push(`规格裕度：${analysis.value.marginText}`)
  lines.push(`建议：${analysis.value.adviceText}`)
  return lines
})
</script>

<style scoped>
.page-header { position: sticky; top: var(--topnav-h, 48px); z-index: 20; padding: 12px 24px; border-bottom: 1px solid var(--color-border); backdrop-filter: saturate(120%) blur(6px); background: color-mix(in oklab, var(--color-background) 80%, transparent); display:flex; align-items:center; justify-content:space-between; gap:12px; }
.page-header h1 { font-size: 18px; font-weight: 600; }
.actions { display:flex; align-items:center; gap:10px; flex-wrap:wrap; }
.actions .hint { font-size:12px; color:#64748b; display:flex; align-items:center; gap:6px; }
.actions select, .actions input[type=number] { border:1px solid #cbd5e1; border-radius:8px; padding:4px 8px; background:#fff; font-size:12px; }
.actions .add { display:flex; align-items:center; gap:6px; }
.actions .link { appearance:none; border:1px solid rgba(148,163,184,.35); background:transparent; color:#93c5fd; padding:4px 8px; border-radius:8px; font-size:12px; }
.page-main { padding: 12px 16px; margin-top: 6px; }
.layout { display:grid; grid-template-columns: 240px minmax(0,1fr) 360px; gap:12px; align-items:start; }
.panel { border:1px solid var(--color-border); border-radius:12px; padding:10px; background: color-mix(in oklab, var(--color-background) 92%, transparent); min-width:0; }
.panel-title { margin: 2px 0 8px; font-size: 14px; }
.left .param-list { list-style:none; margin:0; padding:0; display:flex; flex-direction:column; gap:4px; }
.param-item { display:flex; align-items:center; gap:8px; padding:6px 8px; border-radius:8px; cursor:pointer; }
.param-item:hover { background: #0f172a0a; }
.param-item.active { background:#0ea5ff14; border:1px solid #38bdf8; }
.param-item .dot { width:8px; height:8px; border-radius:999px; display:inline-block; }
.param-item .name { flex: 0 0 auto; font-size: 13px; color:#0f172a; }
.param-item .spec { margin-left:auto; font-size: 12px; color:#64748b; }
.center { display:flex; justify-content:center; }
.cards { display:grid; grid-template-columns: repeat(auto-fit, minmax(130px, 1fr)); gap:10px; margin-bottom: 12px; }
.report { border:1px solid var(--color-border); border-radius: 12px; padding: 10px; background: color-mix(in oklab, var(--color-background) 92%, transparent); max-height: 38vh; overflow:auto; word-break: break-word; }
.report h3 { margin: 2px 0 8px; font-size: 14px; }
.report .r-line { font-size: 12px; color:#334155; margin: 4px 0; }
.report b { color:#0f172a; }
/* iPad 横屏（~1024宽）时避免右侧被覆盖：切两列并允许中区滚动 */
@media (max-width: 1280px) and (min-width: 961px) {
  .layout { grid-template-columns: 260px 1fr; grid-auto-rows: auto; }
  .panel.right { grid-column: 2 / 3; }
}
@media (max-width: 1200px) { .layout { grid-template-columns: 240px minmax(0,1fr) 320px; } }
@media (max-width: 960px) { .layout { grid-template-columns: 1fr; } .center { order: 3; } .panel.right { order: 2; } .panel.left { order: 1; } .cards { grid-template-columns: 1fr; } }
.card { background: #0f172a0d; border:1px solid var(--color-border); border-radius:10px; padding:6px 8px; min-width:120px; }
.card label { font-size:11px; color:#64748b; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; display:block; line-height:1.1; }
.card b { font-size:15px; font-variant-numeric: tabular-nums; font-feature-settings: 'tnum'; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; display:block; line-height:1.2; }
.charts { display:grid; grid-template-columns: 1fr; gap:12px; }
.chart { border:1px solid var(--color-border); border-radius: 12px; padding: 10px; background: color-mix(in oklab, var(--color-background) 92%, transparent); }
.chart-rel { position: relative; }
.chart h3 { margin: 2px 0 8px; font-size: 14px; }
.tooltip { position:absolute; pointer-events:none; background: rgba(15,23,42,.95); color:#e2e8f0; border:1px solid #334155; padding:6px 8px; border-radius:8px; font-size:12px; box-shadow: 0 8px 20px rgba(0,0,0,.25); max-width: 50ch; z-index: 20; }
.chart-rel .tooltip { z-index: 40; }
.tt-name { font-weight: 700; margin-bottom: 2px; }
.tt-line { color:#cbd5e1; }

/* Mobile/iPad: avoid header overlay charts/tooltips */
@media (max-width: 960px) {
  .page-header { position: sticky; top: var(--topnav-h, 48px); z-index: 30; /* stick below global nav */ }
  .page-main { padding-top: 8px; }
}
/* iPad 横屏时 header 依然置顶，防止图表遮挡 */
@media (max-width: 1280px) and (min-width: 961px) {
  .page-header { position: sticky; top: var(--topnav-h, 48px); z-index: 30; }
}
@supports (-webkit-touch-callout: none) {
  /* iOS Safari: backdrop-filter can create stacking issues; reduce effects */
  .page-header { backdrop-filter: none; background: color-mix(in oklab, var(--color-background) 92%, transparent); }
}
/* Ensure tooltips always over header */
.tooltip, .kpi.tooltip { z-index: 1000; }
</style>
