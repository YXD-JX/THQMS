<template>
  <section class="charts">
    <!-- 直方图 -->
    <div class="chart"
         :style="{ order: orderIdx.HIST }"
         draggable="true"
         @dragstart="onChartDragStart($event, 'HIST')"
         @dragover.prevent="onChartDragOver"
         @drop.prevent="onChartDrop($event, 'HIST')">
      <h3>直方图</h3>
      <canvas ref="hist" :width="cw" :height="220"></canvas>
      <div v-if="hover.visible && hover.which==='HIST'" class="tooltip" ref="tt" :style="{ left: hover.x + 'px', top: hover.y + 'px', position: 'fixed' }">
        <div class="tt-name">{{ param?.name }} · 直方图</div>
        <div class="tt-line">分箱：{{ hover.index }}（{{ hover.binRangeText }}）</div>
        <div class="tt-line">计数：{{ hover.countText }}（{{ hover.pctText }}）</div>
        <div class="tt-line" v-if="hover.densityText">密度：{{ hover.densityText }}</div>
      </div>
    </div>
    <!-- 箱线图 -->
    <div class="chart chart-rel"
         :style="{ order: orderIdx.BOX }"
         draggable="true"
         @dragstart="onChartDragStart($event, 'BOX')"
         @dragover.prevent="onChartDragOver"
         @drop.prevent="onChartDrop($event, 'BOX')">
      <h3>箱线图</h3>
      <canvas ref="box" :width="cw" :height="180"></canvas>
      <div v-if="hover.visible && hover.which==='BOX'" class="tooltip" ref="tt" :style="{ left: hover.x + 'px', top: hover.y + 'px', position: 'fixed' }">
        <div class="tt-name">{{ param?.name }} · 箱线图</div>
        <template v-if="hover.title && hover.lines && hover.lines.length">
          <div class="tt-line" v-for="(line,i) in hover.lines" :key="i">{{ line }}</div>
        </template>
      </div>
    </div>
    <!-- I 图 -->
    <div class="chart chart-rel"
         :style="{ order: orderIdx.I }"
         draggable="true"
         @dragstart="onChartDragStart($event, 'I')"
         @dragover.prevent="onChartDragOver"
         @drop.prevent="onChartDrop($event, 'I')">
      <h3>I 图（个体）</h3>
      <canvas ref="ichart" :width="cw" :height="220"></canvas>
      <div v-if="hover.visible && hover.which==='I'" class="tooltip" ref="tt" :style="{ left: hover.x + 'px', top: hover.y + 'px', position: 'fixed' }">
        <div class="tt-name">{{ param?.name }} · I</div>
        <div class="tt-line">值：{{ hover.valueText }}</div>
        <div class="tt-line">Z距均值：{{ hover.zToMeanText }}</div>
        <div class="tt-line">距规格：{{ hover.marginSpecText }}</div>
        <div class="tt-line" v-if="hover.abnormal">判异：{{ hover.rules?.join(', ') }}</div>
        <div class="tt-line">建议：{{ hover.adviceText }}</div>
        <div class="tt-line">时间：{{ hover.timeText }}</div>
      </div>
    </div>
    <!-- MR 图 -->
    <div class="chart chart-rel"
         :style="{ order: orderIdx.MR }"
         draggable="true"
         @dragstart="onChartDragStart($event, 'MR')"
         @dragover.prevent="onChartDragOver"
         @drop.prevent="onChartDrop($event, 'MR')">
      <h3>MR 图（移动极差）</h3>
      <canvas ref="mrchart" :width="cw" :height="180"></canvas>
      <div v-if="hover.visible && hover.which==='MR'" class="tooltip" ref="tt" :style="{ left: hover.x + 'px', top: hover.y + 'px', position: 'fixed' }">
        <div class="tt-name">{{ param?.name }} · MR</div>
        <div class="tt-line">MR：{{ hover.valueText }}</div>
        <div class="tt-line">索引：{{ hover.index }}</div>
        <div class="tt-line" v-if="hover.abnormal">异常：超出 UCL</div>
      </div>
    </div>
    <!-- QQ 图 -->
    <div class="chart chart-rel"
         :style="{ order: orderIdx.QQ }"
         draggable="true"
         @dragstart="onChartDragStart($event, 'QQ')"
         @dragover.prevent="onChartDragOver"
         @drop.prevent="onChartDrop($event, 'QQ')">
      <h3>QQ 图（正态性评估）</h3>
      <canvas ref="qq" :width="cw" :height="220"></canvas>
      <div v-if="hover.visible && hover.which==='QQ'" class="tooltip" ref="tt" :style="{ left: hover.x + 'px', top: hover.y + 'px', position: 'fixed' }">
        <div class="tt-name">{{ param?.name }} · QQ</div>
        <div class="tt-line">理论分位：{{ hover.title }}</div>
        <div class="tt-line" v-for="(line,i) in hover.lines" :key="i">{{ line }}</div>
      </div>
    </div>
    <!-- 能力对比 -->
    <div class="chart chart-rel"
         :style="{ order: orderIdx.CAP }"
         draggable="true"
         @dragstart="onChartDragStart($event, 'CAP')"
         @dragover.prevent="onChartDragOver"
         @drop.prevent="onChartDrop($event, 'CAP')">
      <h3>能力对比（Cp/Cpk vs Pp/Ppk）</h3>
      <canvas ref="capcmp" :width="cw" :height="200"></canvas>
      <div v-if="hover.visible && hover.which==='CAP'" class="tooltip" ref="tt" :style="{ left: hover.x + 'px', top: hover.y + 'px', position: 'fixed' }">
        <div class="tt-name">{{ hover.title }}</div>
        <div class="tt-line" v-for="(line,i) in hover.lines" :key="i">{{ line }}</div>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch, defineExpose } from 'vue'
import { useSixStore } from '@/stores/six'
import { useLabStore, type LabParam } from '@/stores/lab'

const six = useSixStore()
const lab = useLabStore()

// expose canvases for export
const hist = ref<HTMLCanvasElement|null>(null)
const box = ref<HTMLCanvasElement|null>(null)
const ichart = ref<HTMLCanvasElement|null>(null)
const mrchart = ref<HTMLCanvasElement|null>(null)
const qq = ref<HTMLCanvasElement|null>(null)
const capcmp = ref<HTMLCanvasElement|null>(null)
defineExpose({ getCanvasEls: () => [hist.value, box.value, ichart.value, mrchart.value, qq.value, capcmp.value].filter(Boolean) as HTMLCanvasElement[] })

// state from stores
const param = computed<LabParam|undefined>(() => six.param)
const values = computed<number[]>(() => six.values)
const ctl = computed(() => six.ctl)
const cap = computed(() => six.cap)
const bins = computed(() => six.bins)
const showSpec = computed(() => six.showSpec)
const showCtl = computed(() => six.showCtl)

// chart ordering using store
const order = computed(() => six.chartOrder)
const orderIdx = computed<Record<'HIST'|'BOX'|'I'|'MR'|'QQ'|'CAP', number>>(()=>{
  const idx: Record<'HIST'|'BOX'|'I'|'MR'|'QQ'|'CAP', number> = { HIST:0, BOX:1, I:2, MR:3, QQ:4, CAP:5 }
  order.value.forEach((k, i)=> { idx[k as keyof typeof idx] = i })
  return idx
})
let dragChartKey: 'HIST'|'BOX'|'I'|'MR'|'QQ'|'CAP' | null = null
function onChartDragStart(ev: DragEvent, key: 'HIST'|'BOX'|'I'|'MR'|'QQ'|'CAP') { dragChartKey = key; ev.dataTransfer?.setData('text/chart', key); ev.dataTransfer!.effectAllowed = 'move' }
function onChartDragOver(ev: DragEvent) { ev.dataTransfer!.dropEffect = 'move' }
function onChartDrop(ev: DragEvent, targetKey: 'HIST'|'BOX'|'I'|'MR'|'QQ'|'CAP') {
  const src = (ev.dataTransfer?.getData('text/chart') as typeof targetKey) || dragChartKey
  dragChartKey = null
  if (!src || src===targetKey) return
  const arr = [...order.value]
  const si = arr.indexOf(src), ti = arr.indexOf(targetKey)
  if (si<0 || ti<0) return
  arr.splice(si,1)
  arr.splice(ti,0,src)
  six.chartOrder.splice(0, six.chartOrder.length, ...arr)
}

// drawing shared helpers
const cw = 960
const tt = ref<HTMLDivElement|null>(null)
type Pt = { x:number; y:number; idx:number; v:number; ts:number; abnormal?: boolean; rules?: string[] }
let iPts: Pt[] = []
let mrPts: Pt[] = []
type BinPt = { x:number; y:number; w:number; h:number; idx:number; count:number; vMin:number; vMax:number }
let histBins: BinPt[] = []
type Hover = { visible: boolean; which?: 'I'|'MR'|'HIST'|'BOX'|'QQ'|'CAP'; x: number; y: number; valueText?: string; timeText?: string; abnormal?: boolean; rules?: string[]; index?: number; zToMeanText?: string; marginSpecText?: string; adviceText?: string; binRangeText?: string; countText?: string; pctText?: string; densityText?: string; title?: string; lines?: string[] }
const hover = ref<Hover>({ visible:false, x:0, y:0 })

function niceStep(range: number, targetTicks = 5) { if (!(range > 0)) return 1; const raw = range / Math.max(1, targetTicks); const pow = Math.pow(10, Math.floor(Math.log10(raw))); const n = raw / pow; let step:number; if (n < 1.5) step = 1; else if (n < 3) step = 2; else if (n < 7) step = 5; else step = 10; return step * pow }
function makeTicks(min: number, max: number, target = 5) { if (!(max > min)) return [min]; const step = niceStep(max - min, target); const start = Math.ceil(min / step) * step; const ticks: number[] = []; for (let v = start; v <= max + 1e-9; v += step) ticks.push(Number(v.toFixed(10))); return ticks }
function pickPt<T extends { x:number; y:number }>(ev: MouseEvent, list: T[], canvas: HTMLCanvasElement) { const rect = canvas.getBoundingClientRect(); const px = ev.clientX - rect.left; const py = ev.clientY - rect.top; let best: T | undefined; let bestD = 8; for (const pt of list) { const dx = pt.x - px; const dy = pt.y - py; const d = Math.hypot(dx, dy); if (d < bestD) { bestD = d; best = pt } } return { pt: best, cx: ev.clientX, cy: ev.clientY } }
function pickBin(ev: MouseEvent, bins: BinPt[], canvas: HTMLCanvasElement) { const rect = canvas.getBoundingClientRect(); const px = ev.clientX - rect.left; const py = ev.clientY - rect.top; for (const b of bins) { if (px >= b.x && px <= b.x + b.w && py >= b.y && py <= b.y + b.h) { return { bin: b, cx: ev.clientX, cy: ev.clientY } } } return { bin: undefined as unknown as BinPt | undefined, cx: ev.clientX, cy: ev.clientY } }
function placeTooltipFor(el: HTMLElement|null, px: number, py: number) { const margin = 12; const w = el?.offsetWidth ?? 260; const h = el?.offsetHeight ?? 140; let x = px + margin; let y = py + margin; if (x + w > window.innerWidth - 8) x = px - w - margin; if (x < 8) x = 8; if (y + h > window.innerHeight - 8) y = py - h - margin; if (y < 8) y = 8; return { x, y } }
function placeTooltip(px: number, py: number) { return placeTooltipFor(tt.value, px, py) }

// HIST
function drawHist() {
  const c = hist.value; if (!c) return; const ctx = c.getContext('2d')!
  ctx.clearRect(0,0,c.width,c.height)
  const arr = values.value; if (!arr.length) return
  let min = Math.min(...arr), max = Math.max(...arr)
  if (param.value) { min = Math.min(min, param.value.lcl); max=Math.max(max, param.value.ucl) }
  if (!(min<max)) return
  const nBins = Math.max(5, Math.min(60, Number(bins.value)||20))
  const bw = (max - min) / nBins
  const binsArr = Array.from({length:nBins}, ()=>0)
  for (const v of arr) { let idx = Math.floor((v - min)/bw); if (idx<0) idx=0; if (idx>=nBins) idx=nBins-1; binsArr[idx]++ }
  const pad = {l:50,r:20,t:10,b:30}; const iw = c.width - pad.l - pad.r; const ih = c.height - pad.t - pad.b
  const maxCnt = Math.max(...binsArr)
  ctx.strokeStyle = '#475569'; ctx.beginPath(); ctx.moveTo(pad.l,pad.t); ctx.lineTo(pad.l,pad.t+ih); ctx.lineTo(pad.l+iw,pad.t+ih); ctx.stroke()
  ctx.save(); ctx.fillStyle = '#64748b'; ctx.font = '10px system-ui'; ctx.textAlign = 'center'; ctx.textBaseline = 'top'
  const xTicks = makeTicks(min, max, 6)
  for (const tv of xTicks) { const x = pad.l + (tv - min)/(max-min)*iw; ctx.strokeStyle = '#94a3b8'; ctx.beginPath(); ctx.moveTo(x, pad.t+ih); ctx.lineTo(x, pad.t+ih+4); ctx.stroke(); ctx.fillText(String(Number(tv.toFixed(3))), x, pad.t+ih+6) }
  ctx.textAlign = 'right'; ctx.textBaseline = 'middle'
  const yTicks = makeTicks(0, maxCnt, 5)
  for (const tv of yTicks) { const y = pad.t + (1 - (tv / Math.max(1, maxCnt))) * ih; ctx.strokeStyle = '#94a3b8'; ctx.beginPath(); ctx.moveTo(pad.l-4, y); ctx.lineTo(pad.l, y); ctx.stroke(); ctx.fillText(String(tv), pad.l-6, y) }
  ctx.restore()
  const cwBin = iw / nBins
  ctx.fillStyle = '#60a5fa'
  histBins = []
  for (let i=0;i<nBins;i++) { const h = maxCnt? (binsArr[i]/maxCnt)*ih : 0; const x = pad.l + i*cwBin; ctx.fillRect(x, pad.t+ih-h, cwBin-1, h); histBins.push({ x, y: pad.t+ih-h, w: cwBin-1, h, idx: i, count: binsArr[i], vMin: min + i*bw, vMax: min + (i+1)*bw }) }
  if (showSpec.value && param.value) { const p = param.value; const xOf = (v:number)=> pad.l + (v-min)/(max-min)*iw; ctx.strokeStyle = '#ef4444'; ctx.setLineDash([4,3]); ctx.beginPath(); ctx.moveTo(xOf(p.ucl), pad.t); ctx.lineTo(xOf(p.ucl), pad.t+ih); ctx.stroke(); ctx.strokeStyle = '#3b82f6'; ctx.beginPath(); ctx.moveTo(xOf(p.lcl), pad.t); ctx.lineTo(xOf(p.lcl), pad.t+ih); ctx.stroke(); ctx.strokeStyle = '#10b981'; ctx.beginPath(); ctx.moveTo(xOf(p.target), pad.t); ctx.lineTo(xOf(p.target), pad.t+ih); ctx.stroke(); ctx.setLineDash([]); ctx.save(); ctx.fillStyle = '#64748b'; ctx.font = '10px system-ui'; ctx.textAlign = 'left'; ctx.textBaseline = 'top'; ctx.fillText('UCL', xOf(p.ucl)+4, pad.t+2); ctx.fillText('LCL', xOf(p.lcl)+4, pad.t+2); ctx.fillText('Target', xOf(p.target)+4, pad.t+2); ctx.restore() }
}

// I chart
function drawIChart() {
  const c = ichart.value; if (!c) return; const ctx = c.getContext('2d')!
  ctx.clearRect(0,0,c.width,c.height)
  const arr = values.value; if (!arr.length) return
  const pad = {l:50,r:20,t:10,b:20}; const iw=c.width-pad.l-pad.r; const ih=c.height-pad.t-pad.b
  let min = Math.min(...arr), max = Math.max(...arr)
  if (showCtl.value) { min = Math.min(min, ctl.value.lcl); max=Math.max(max, ctl.value.ucl) }
  if (param.value && showSpec.value) { min = Math.min(min, param.value.lcl); max=Math.max(max, param.value.ucl) }
  if (!(min<max)) return
  const xOf = (i:number)=> pad.l + (i/(arr.length-1))*iw
  const yOf = (v:number)=> pad.t + (1-(v-min)/(max-min))*ih
  if (showCtl.value && ctl.value.sigma > 0) {
    const m = ctl.value.m, s = ctl.value.sigma
    const bands: Array<{lo:number, hi:number, color:string}> = [
      { lo: m-1*s, hi: m+1*s, color: 'rgba(16,185,129,0.10)' },
      { lo: m-2*s, hi: m-1*s, color: 'rgba(234,179,8,0.08)' },
      { lo: m+1*s, hi: m+2*s, color: 'rgba(234,179,8,0.08)' },
      { lo: m-3*s, hi: m-2*s, color: 'rgba(239,68,68,0.06)' },
      { lo: m+2*s, hi: m+3*s, color: 'rgba(239,68,68,0.06)' },
    ]
    ctx.save();
    for (const b of bands) { const y1 = yOf(Math.min(max, Math.max(min, b.lo))); const y2 = yOf(Math.min(max, Math.max(min, b.hi))); const yTop = Math.min(y1, y2), yBot = Math.max(y1, y2); ctx.fillStyle = b.color; ctx.fillRect(pad.l, yTop, iw, yBot - yTop) }
    ctx.restore()
  }
  ctx.strokeStyle='#475569'; ctx.beginPath(); ctx.moveTo(pad.l,pad.t); ctx.lineTo(pad.l,pad.t+ih); ctx.lineTo(pad.l+iw,pad.t+ih); ctx.stroke()
  ctx.save(); ctx.fillStyle = '#64748b'; ctx.font = '10px system-ui'; ctx.textBaseline='middle'; ctx.textAlign='right'
  const yTicks = makeTicks(min, max, 6)
  for (const tv of yTicks) { const y = yOf(tv); ctx.strokeStyle = '#94a3b8'; ctx.beginPath(); ctx.moveTo(pad.l-4, y); ctx.lineTo(pad.l, y); ctx.stroke(); ctx.fillText(String(Number(tv.toFixed(3))), pad.l-6, y) }
  ctx.textAlign='center'; ctx.textBaseline='top'
  const xTickCount = Math.min(6, Math.max(2, Math.round(arr.length/10)))
  for (let i=0;i<=xTickCount;i++) { const frac = xTickCount? i/xTickCount : 0; const idx = Math.round(frac*(arr.length-1)); const x = xOf(idx); ctx.strokeStyle = '#94a3b8'; ctx.beginPath(); ctx.moveTo(x, pad.t+ih); ctx.lineTo(x, pad.t+ih+4); ctx.stroke(); ctx.fillText(String(idx), x, pad.t+ih+6) }
  ctx.restore()
  if (showSpec.value && param.value) {
    ctx.setLineDash([4,3])
    ctx.strokeStyle='#3b82f6'; ctx.beginPath(); ctx.moveTo(pad.l,yOf(param.value.lcl)); ctx.lineTo(pad.l+iw,yOf(param.value.lcl)); ctx.stroke()
    ctx.strokeStyle='#ef4444'; ctx.beginPath(); ctx.moveTo(pad.l,yOf(param.value.ucl)); ctx.lineTo(pad.l+iw,yOf(param.value.ucl)); ctx.stroke()
    ctx.strokeStyle='#10b981'; ctx.beginPath(); ctx.moveTo(pad.l,yOf(param.value.target)); ctx.lineTo(pad.l+iw,yOf(param.value.target)); ctx.stroke(); ctx.setLineDash([])
    ctx.save(); ctx.fillStyle = '#64748b'; ctx.font = '10px system-ui'; ctx.textAlign='left'; ctx.textBaseline='bottom'
    ctx.fillText('LCL(spec)', pad.l+4, yOf(param.value.lcl)-2)
    ctx.fillText('UCL(spec)', pad.l+4, yOf(param.value.ucl)-2)
    ctx.fillText('Target', pad.l+4, yOf(param.value.target)-2)
    ctx.restore()
  }
  if (showCtl.value) {
    ctx.strokeStyle='#f59e0b'; ctx.setLineDash([6,3])
    ctx.beginPath(); ctx.moveTo(pad.l,yOf(ctl.value.ucl)); ctx.lineTo(pad.l+iw,yOf(ctl.value.ucl)); ctx.stroke()
    ctx.beginPath(); ctx.moveTo(pad.l,yOf(ctl.value.lcl)); ctx.lineTo(pad.l+iw,yOf(ctl.value.lcl)); ctx.stroke()
    ctx.beginPath(); ctx.moveTo(pad.l,yOf(ctl.value.m)); ctx.lineTo(pad.l+iw,yOf(ctl.value.m)); ctx.stroke(); ctx.setLineDash([])
    ctx.save(); ctx.fillStyle = '#a16207'; ctx.font = '10px system-ui'; ctx.textAlign='left'; ctx.textBaseline='bottom'
    ctx.fillText('UCL', pad.l+4, yOf(ctl.value.ucl)-2)
    ctx.fillText('LCL', pad.l+4, yOf(ctl.value.lcl)-2)
    ctx.fillText('CL', pad.l+4, yOf(ctl.value.m)-2)
    ctx.restore()
  }
  ctx.strokeStyle='#93c5fd'; ctx.beginPath(); for (let i=0;i<arr.length;i++) { const x=xOf(i), y=yOf(arr[i]); if (i===0) ctx.moveTo(x,y); else ctx.lineTo(x,y) } ctx.stroke()
  iPts = []
  const tsArr = (lab.meas[six.pid]||[]).map(x=>x.ts)
  for (let i=0;i<arr.length;i++) { const x=xOf(i), y=yOf(arr[i]); const rules = six.weco.get(i); const abnormal = !!rules && rules.length>0; iPts.push({ x, y, idx:i, v:arr[i], ts: tsArr[i]||0, abnormal, rules }); ctx.fillStyle = abnormal ? '#ef4444' : '#60a5fa'; ctx.beginPath(); ctx.arc(x, y, abnormal? 3.5 : 2.5, 0, Math.PI*2); ctx.fill() }
}

// MR chart
function drawMRChart() {
  const c = mrchart.value; if (!c) return; const ctx = c.getContext('2d')!
  ctx.clearRect(0,0,c.width,c.height)
  const mr = ctl.value.mr; if (!mr.length) return
  const pad = {l:50,r:20,t:10,b:20}; const iw=c.width-pad.l-pad.r; const ih=c.height-pad.t-pad.b
  const min = 0; const max = Math.max(ctl.value.uclMr, Math.max(...mr))
  const xOf = (i:number)=> pad.l + (i/(mr.length-1))*iw
  const yOf = (v:number)=> pad.t + (1-(v-min)/(max-min))*ih
  ctx.strokeStyle='#475569'; ctx.beginPath(); ctx.moveTo(pad.l,pad.t); ctx.lineTo(pad.l,pad.t+ih); ctx.lineTo(pad.l+iw,pad.t+ih); ctx.stroke()
  ctx.save(); ctx.fillStyle = '#64748b'; ctx.font = '10px system-ui'; ctx.textBaseline='middle'; ctx.textAlign='right'
  const yTicks = makeTicks(min, max, 5)
  for (const tv of yTicks) { const y = yOf(tv); ctx.strokeStyle = '#94a3b8'; ctx.beginPath(); ctx.moveTo(pad.l-4, y); ctx.lineTo(pad.l, y); ctx.stroke(); ctx.fillText(String(Number(tv.toFixed(3))), pad.l-6, y) }
  ctx.textAlign='center'; ctx.textBaseline='top'
  const xTickCount = Math.min(6, Math.max(2, Math.round(mr.length/10)))
  for (let i=0;i<=xTickCount;i++) { const frac = xTickCount? i/xTickCount : 0; const idx = Math.round(frac*(mr.length-1)); const x = xOf(idx); ctx.strokeStyle = '#94a3b8'; ctx.beginPath(); ctx.moveTo(x, pad.t+ih); ctx.lineTo(x, pad.t+ih+4); ctx.stroke(); ctx.fillText(String(idx), x, pad.t+ih+6) }
  ctx.restore()
  if (showCtl.value) { ctx.strokeStyle='#f59e0b'; ctx.setLineDash([6,3]); ctx.beginPath(); ctx.moveTo(pad.l,yOf(ctl.value.uclMr)); ctx.lineTo(pad.l+iw,yOf(ctl.value.uclMr)); ctx.stroke(); ctx.beginPath(); ctx.moveTo(pad.l,yOf(ctl.value.mrbar)); ctx.lineTo(pad.l+iw,yOf(ctl.value.mrbar)); ctx.stroke(); ctx.setLineDash([]); ctx.save(); ctx.fillStyle = '#a16207'; ctx.font = '10px system-ui'; ctx.textAlign='left'; ctx.textBaseline='bottom'; ctx.fillText('UCL(MR)', pad.l+4, yOf(ctl.value.uclMr)-2); ctx.fillText('MRbar', pad.l+4, yOf(ctl.value.mrbar)-2); ctx.restore() }
  ctx.strokeStyle='#93c5fd'; ctx.beginPath(); for (let i=0;i<mr.length;i++) { const x=xOf(i), y=yOf(mr[i]); if (i===0) ctx.moveTo(x,y); else ctx.lineTo(x,y) } ctx.stroke()
  mrPts = []
  for (let i=0;i<mr.length;i++) { const x=xOf(i), y=yOf(mr[i]); const abnormal = mr[i] > ctl.value.uclMr; mrPts.push({ x, y, idx:i, v:mr[i], ts: (lab.meas[six.pid]?.[i+1]?.ts)||0, abnormal, rules: abnormal? ['>UCL'] : undefined }); ctx.fillStyle = abnormal ? '#ef4444' : '#60a5fa'; ctx.beginPath(); ctx.arc(x, y, abnormal? 3.5 : 2.5, 0, Math.PI*2); ctx.fill() }
}

// QQ helpers
let qqPts: Array<{x:number;y:number;v:number;theo:number;idx:number}> = []
function invErf(x:number) { const a = 0.147; const ln = Math.log(1 - x*x); const s = (2/(Math.PI*a) + ln/2); const q = Math.sign(x) * Math.sqrt( Math.sqrt(s*s - ln/a) - s ); return q }
function normInv(p:number) { if (p<=0) return -Infinity; if (p>=1) return Infinity; return Math.SQRT2 * invErf(2*p-1) }
function drawQQ() {
  const c = qq.value; if (!c) return; const ctx = c.getContext('2d')!
  ctx.clearRect(0,0,c.width,c.height)
  const arr = values.value; const n = arr.length; if (n<3) return
  const s = [...arr].sort((a,b)=>a-b)
  const zs = s.map((_,i)=> normInv((i+0.5)/n))
  const m = (s.reduce((a,b)=>a+b,0)/n) || 0; const sd = (()=>{ const n=s.length; if(n<2) return 0; const mu=m; const v=s.reduce((acc,x)=>acc+(x-mu)*(x-mu),0)/(n-1); return Math.sqrt(v) })()
  const obs = s.map(v=> (sd? (v - m)/sd : 0))
  const pad = {l:50,r:20,t:10,b:30}; const iw=c.width-pad.l-pad.r; const ih=c.height-pad.t-pad.b
  let minX = Math.min(...zs), maxX = Math.max(...zs)
  let minY = Math.min(...obs), maxY = Math.max(...obs)
  if (!(maxX>minX)) { minX -= 1; maxX += 1 }
  if (!(maxY>minY)) { minY -= 1; maxY += 1 }
  const xOf=(x:number)=> pad.l + (x-minX)/Math.max(1e-9,(maxX-minX))*iw
  const yOf=(y:number)=> pad.t + (1-(y-minY)/Math.max(1e-9,(maxY-minY)))*ih
  ctx.strokeStyle='#475569'; ctx.beginPath(); ctx.moveTo(pad.l,pad.t); ctx.lineTo(pad.l,pad.t+ih); ctx.lineTo(pad.l+iw,pad.t+ih); ctx.stroke()
  ctx.save(); ctx.fillStyle='#64748b'; ctx.font='10px system-ui'; ctx.textBaseline='middle'; ctx.textAlign='right'
  for (const tv of makeTicks(minY,maxY,6)) { const y=yOf(tv); ctx.strokeStyle='#94a3b8'; ctx.beginPath(); ctx.moveTo(pad.l-4,y); ctx.lineTo(pad.l,y); ctx.stroke(); ctx.fillText(String(Number(tv.toFixed(2))), pad.l-6, y) }
  ctx.textAlign='center'; ctx.textBaseline='top'
  for (const tv of makeTicks(minX,maxX,6)) { const x=xOf(tv); ctx.strokeStyle='#94a3b8'; ctx.beginPath(); ctx.moveTo(x,pad.t+ih); ctx.lineTo(x,pad.t+ih+4); ctx.stroke(); ctx.fillText(String(Number(tv.toFixed(2))), x, pad.t+ih+6) }
  ctx.restore()
  let num=0, den=0; const xbar=zs.reduce((a,b)=>a+b,0)/n; const ybar=obs.reduce((a,b)=>a+b,0)/n
  for (let i=0;i<n;i++){ num += (zs[i]-xbar)*(obs[i]-ybar); den += (zs[i]-xbar)*(zs[i]-xbar) }
  const slope = den? num/den : 1; const intercept = ybar - slope*xbar
  const x1=minX, x2=maxX; const y1=slope*x1+intercept, y2=slope*x2+intercept
  ctx.strokeStyle='#10b981'; ctx.setLineDash([6,3]); ctx.beginPath(); ctx.moveTo(xOf(x1), yOf(y1)); ctx.lineTo(xOf(x2), yOf(y2)); ctx.stroke(); ctx.setLineDash([])
  qqPts = []
  ctx.fillStyle='#60a5fa'
  for (let i=0;i<n;i++) { const x=xOf(zs[i]), y=yOf(obs[i]); qqPts.push({x,y,v:obs[i],theo:zs[i],idx:i}); ctx.beginPath(); ctx.arc(x,y,2.5,0,Math.PI*2); ctx.fill() }
}
function onQQMove(ev: MouseEvent) { const c = qq.value; if (!c || !qqPts || qqPts.length===0) return; const { pt, cx, cy } = pickPt(ev, qqPts, c); if (!pt) { hover.value.visible=false; return } const pos = placeTooltip(cx, cy); const lines = [ `理论Z：${pt.theo.toFixed(3)}`, `观测Z：${pt.v.toFixed(3)}` ]; hover.value = { visible:true, which:'QQ', x:pos.x, y:pos.y, title:`分位点 #${pt.idx+1}`, lines } }
function onQQLeave() { hover.value.visible=false }

// 能力对比
type CapBar = { x:number; y:number; w:number; h:number; key:string; v:number }
let capBars: CapBar[] = []
function drawCapCompare() {
  const c = capcmp.value; if (!c) return; const ctx = c.getContext('2d')!
  ctx.clearRect(0,0,c.width,c.height)
  const pad = {l:50,r:20,t:10,b:30}; const iw=c.width-pad.l-pad.r; const ih=c.height-pad.t-pad.b
  const items = [
    { key:'Cp', v: cap.value.cpShort },
    { key:'Cpk', v: cap.value.cpkShort },
    { key:'Pp', v: cap.value.pp },
    { key:'Ppk', v: cap.value.ppk },
  ]
  const vals = items.map(x=> (Number.isFinite(x.v as number)? (x.v as number) : 0))
  const maxV = Math.max(1.8, ...vals)
  const xOf=(i:number)=> pad.l + (i+0.5)/items.length*iw
  const yOf=(v:number)=> pad.t + (1 - v/maxV) * ih
  ctx.strokeStyle='#475569'; ctx.beginPath(); ctx.moveTo(pad.l,pad.t); ctx.lineTo(pad.l,pad.t+ih); ctx.lineTo(pad.l+iw,pad.t+ih); ctx.stroke()
  ctx.save(); ctx.fillStyle='#64748b'; ctx.font='10px system-ui'; ctx.textBaseline='middle'; ctx.textAlign='right'
  for (const tv of makeTicks(0, maxV, 5)) { const y=yOf(tv); ctx.strokeStyle='#94a3b8'; ctx.beginPath(); ctx.moveTo(pad.l-4,y); ctx.lineTo(pad.l,y); ctx.stroke(); ctx.fillText(String(Number(tv.toFixed(2))), pad.l-6, y) }
  ctx.restore()
  const thresh = [ {v:1.0, color:'#f59e0b'}, {v:1.33, color:'#10b981'}, {v:1.67, color:'#0ea5e9'} ]
  ctx.save(); ctx.setLineDash([6,3])
  for (const t of thresh) { const y=yOf(t.v); ctx.strokeStyle=t.color; ctx.beginPath(); ctx.moveTo(pad.l,y); ctx.lineTo(pad.l+iw,y); ctx.stroke() }
  ctx.setLineDash([]); ctx.restore()
  const barW = Math.min(80, iw/items.length*0.5)
  capBars = []
  items.forEach((it, i)=>{
    const x = xOf(i) - barW/2
    const v = Number.isFinite(it.v as number) ? (it.v as number) : 0
    const y = yOf(v)
    const h = pad.t+ih - y
    ctx.fillStyle = i<2 ? '#60a5fa' : '#34d399'
    ctx.fillRect(x, y, barW, h)
    ctx.fillStyle = '#334155'; ctx.font='11px system-ui'; ctx.textAlign='center'; ctx.textBaseline='top'
    ctx.fillText(it.key, x+barW/2, pad.t+ih+6)
    ctx.fillStyle = '#0f172a'; ctx.font='11px system-ui'; ctx.textAlign='center'; ctx.textBaseline='bottom'
    ctx.fillText(String(v.toFixed(2)), x+barW/2, y-2)
    capBars.push({ x, y, w: barW, h, key: it.key, v })
  })
}
function onCapMove(ev: MouseEvent) { const c = capcmp.value; if (!c) return; const rect = c.getBoundingClientRect(); const px = ev.clientX - rect.left; const py = ev.clientY - rect.top; const hit = capBars.find(b => px >= b.x && px <= b.x + b.w && py >= b.y && py <= b.y + b.h); if (!hit) { hover.value.visible = false; return } const pos = placeTooltip(ev.clientX, ev.clientY); const level = (v:number)=> Number.isFinite(v) && v>=1.67? '卓越(≥1.67)' : Number.isFinite(v) && v>=1.33? '可接受(≥1.33)' : Number.isFinite(v) && v>=1.00? '勉强(≥1.00)' : '不足(<1.00)'; const phase = (k:string)=> (k==='Cp'||k==='Cpk')? '短期能力（基于MR σ）' : '长期能力（基于样本 σ）'; const lines = [ `值：${hit.v.toFixed(2)}`, `评级：${level(hit.v)}`, `说明：${phase(hit.key)}` ]; hover.value = { visible: true, which: 'CAP', x: pos.x, y: pos.y, title: `能力对比 · ${hit.key}` , lines } }
function onCapLeave() { hover.value.visible = false }

// 箱线图
type BoxGeom = { yMid:number; boxTop:number; boxBot:number; xMin:number; xQ1:number; xMed:number; xQ3:number; xMax:number; xLo:number; xHi:number; outliers: Array<{x:number;y:number;v:number;idx:number}>; pad:{l:number;r:number;t:number;b:number} }
let boxGeom: BoxGeom | undefined
function quantile(sorted: number[], p: number) { const n = sorted.length; if (!n) return NaN; if (n === 1) return sorted[0]; const idx = (n - 1) * p; const lo = Math.floor(idx); const hi = Math.ceil(idx); const frac = idx - lo; if (hi >= n) return sorted[n - 1]; return sorted[lo] * (1 - frac) + sorted[hi] * frac }
function computeFive(arr: number[]) { const s = [...arr].sort((a,b)=>a-b); const n = s.length; const min = n? s[0] : NaN; const max = n? s[n-1] : NaN; const q1 = quantile(s, 0.25); const med = quantile(s, 0.5); const q3 = quantile(s, 0.75); const iqr = (q3 - q1); const loFence = q1 - 1.5*iqr; const hiFence = q3 - -1.5*iqr; let lo = min, hi = max; const outliers: number[] = []; for (const v of s) { if (v < loFence) outliers.push(v); else { lo = v; break } } for (let i=n-1;i>=0;i--) { const v = s[i]; if (v > hiFence) outliers.push(v); else { hi = v; break } } return { min, q1, med, q3, max, iqr, lo, hi, outliers } }
function drawBoxPlot() {
  const c = box.value; if (!c) return; const ctx = c.getContext('2d')!
  ctx.clearRect(0,0,c.width,c.height)
  const arr = values.value; if (!arr.length) return
  const pad = { l: 50, r: 20, t: 12, b: 26 }
  const iw = c.width - pad.l - pad.r
  const ih = c.height - pad.t - pad.b
  const p = param.value
  let vMin = Math.min(...arr), vMax = Math.max(...arr)
  if (p && showSpec.value) { vMin = Math.min(vMin, p.lcl); vMax = Math.max(vMax, p.ucl) }
  if (!(vMin < vMax)) { vMin -= 1; vMax += 1 }
  const five = computeFive(arr)
  const xOf = (v:number)=> pad.l + (v - vMin)/(vMax - vMin) * iw
  const yMid = pad.t + ih/2
  const boxH = Math.min(24, Math.max(16, ih*0.25))
  const boxTop = yMid - boxH/2
  const boxBot = yMid + boxH/2
  ctx.strokeStyle = '#475569'; ctx.beginPath(); ctx.moveTo(pad.l, pad.t+ih); ctx.lineTo(pad.l+iw, pad.t+ih); ctx.stroke()
  ctx.save(); ctx.fillStyle = '#64748b'; ctx.font = '10px system-ui'; ctx.textAlign='center'; ctx.textBaseline='top'
  const xTicks = makeTicks(vMin, vMax, 6)
  for (const t of xTicks) { const x=xOf(t); ctx.strokeStyle='#94a3b8'; ctx.beginPath(); ctx.moveTo(x, pad.t+ih); ctx.lineTo(x, pad.t+ih+4); ctx.stroke(); ctx.fillText(String(Number(t.toFixed(3))), x, pad.t+ih+6) }
  ctx.restore()
  if (showSpec.value && p) { const xs = [ {v:p.lcl, color:'#3b82f6', label:'LCL'}, {v:p.ucl, color:'#ef4444', label:'UCL'}, {v:p.target, color:'#10b981', label:'Target'} ]; ctx.save(); ctx.setLineDash([4,3]); for (const it of xs) { const x=xOf(it.v); ctx.strokeStyle=it.color; ctx.beginPath(); ctx.moveTo(x, pad.t); ctx.lineTo(x, pad.t+ih); ctx.stroke() }; ctx.setLineDash([]); ctx.fillStyle='#64748b'; ctx.font='10px system-ui'; ctx.textAlign='left'; ctx.textBaseline='top'; for (const it of xs) { const x=xOf(it.v); ctx.fillText(it.label, x+4, pad.t+2) } ctx.restore() }
  const xQ1 = xOf(five.q1), xQ3 = xOf(five.q3), xMed = xOf(five.med)
  ctx.fillStyle = '#c7d2fe'; ctx.strokeStyle = '#6366f1'
  ctx.fillRect(xQ1, boxTop, xQ3 - xQ1, boxH)
  ctx.strokeRect(xQ1, boxTop, xQ3 - xQ1, boxH)
  ctx.strokeStyle = '#1d4ed8'; ctx.beginPath(); ctx.moveTo(xMed, boxTop); ctx.lineTo(xMed, boxBot); ctx.stroke()
  const xLo = xOf(five.lo), xHi = xOf(five.hi)
  ctx.strokeStyle = '#64748b'; ctx.beginPath(); ctx.moveTo(xLo, yMid); ctx.lineTo(xQ1, yMid); ctx.moveTo(xQ3, yMid); ctx.lineTo(xHi, yMid); ctx.stroke()
  ctx.beginPath(); ctx.moveTo(xLo, yMid-6); ctx.lineTo(xLo, yMid+6); ctx.moveTo(xHi, yMid-6); ctx.lineTo(xHi, yMid+6); ctx.stroke()
  const outs: Array<{x:number;y:number;v:number;idx:number}> = []
  const sorted = [...arr].sort((a,b)=>a-b)
  for (let i=0;i<sorted.length;i++) { const v = sorted[i]; if (v < five.lo || v > five.hi) { const x = xOf(v); const y = yMid; outs.push({ x, y, v, idx: i }); ctx.fillStyle = '#ef4444'; ctx.beginPath(); ctx.arc(x, y, 3, 0, Math.PI*2); ctx.fill() } }
  boxGeom = { yMid, boxTop, boxBot, xMin: xOf(five.min), xQ1, xMed, xQ3, xMax: xOf(five.max), xLo, xHi, outliers: outs, pad }
}
function onBoxMove(ev: MouseEvent) { const c = box.value; if (!c || !boxGeom) return; const rect = c.getBoundingClientRect(); const px = ev.clientX - rect.left; const py = ev.clientY - rect.top; const by = boxGeom; const p = param.value; const pos = placeTooltip(ev.clientX, ev.clientY); const outHit = by.outliers.find(pt => Math.hypot(pt.x-px, pt.y-py) <= 6); if (outHit) { const lines = [ `异常点：${outHit.v.toFixed(3)}${p?.unit||''}`, `规则：超出须范围 (±1.5·IQR)` ]; hover.value = { visible:true, which:'BOX', x:pos.x, y:pos.y, title:`${p?.name||six.pid} · Outlier`, lines }; return } const inBox = px >= by.xQ1 && px <= by.xQ3 && py >= by.boxTop && py <= by.boxBot; if (inBox) { const iqr = Math.abs(by.xQ3 - by.xQ1); const lines = [ `Q1：${(+computeFive(values.value).q1).toFixed(3)}${p?.unit||''}`, `Q3：${(+computeFive(values.value).q3).toFixed(3)}${p?.unit||''}`, `IQR：${(+computeFive(values.value).q3 - +computeFive(values.value).q1).toFixed(3)}${p?.unit||''}`, `箱宽(像素)：${Number(iqr.toFixed(1))}` ]; hover.value = { visible:true, which:'BOX', x:pos.x, y:pos.y, title:`${p?.name||six.pid} · IQR`, lines }; return } if (Math.abs(px - by.xMed) <= 5 && py >= by.boxTop && py <= by.boxBot) { const med = computeFive(values.value).med; const lines = [ `中位数：${(+med).toFixed(3)}${p?.unit||''}` ]; hover.value = { visible:true, which:'BOX', x:pos.x, y:pos.y, title:`${p?.name||six.pid} · Median`, lines }; return } if (Math.abs(px - by.xLo) <= 5 && Math.abs(py - by.yMid) <= 8) { const lo = computeFive(values.value).lo; const lines = [ `下须：${(+lo).toFixed(3)}${p?.unit||''}` ]; hover.value = { visible:true, which:'BOX', x:pos.x, y:pos.y, title:`${p?.name||six.pid} · Whisker`, lines }; return } if (Math.abs(px - by.xHi) <= 5 && Math.abs(py - by.yMid) <= 8) { const hi = computeFive(values.value).hi; const lines = [ `上须：${(+hi).toFixed(3)}${p?.unit||''}` ]; hover.value = { visible:true, which:'BOX', x:pos.x, y:pos.y, title:`${p?.name||six.pid} · Whisker`, lines }; return } hover.value.visible = false }
function onBoxLeave() { hover.value.visible = false }

// I/MR/Hist hover
function onIMove(ev: MouseEvent) { const c = ichart.value; if (!c) return; const { pt, cx, cy } = pickPt(ev, iPts, c); if (!pt) { hover.value.visible = false; return } const s = ctl.value.sigma; const m = ctl.value.m; const p = param.value; const zToMean = s>0 ? (pt.v - m)/s : NaN; const marginSpec = p ? Math.min(Math.abs((p.ucl-pt.v)), Math.abs((pt.v-p.lcl))) : NaN; const advice = (()=>{ if (!p) return '—'; const dir = pt.v > p.target ? '偏高' : (pt.v < p.target ? '偏低' : '居中'); if (p.id==='cu' || p.id==='ni') return dir==='偏高' ? '检查电镀电流/补加；评估溶液更新与过滤' : '检查浓度与补加策略；校核取样'; if (p.id==='acid') return dir==='偏高' ? '校核滴定与传感器；降低补加速率' : '评估进液稀释与中和控制'; if (p.id==='temp') return dir==='偏高' ? '降低设定或加强冷却；检查搅拌换热' : '提高设定或减弱冷端；校验传感器'; return '核查取样与上游工艺设定' })(); const pos = placeTooltip(cx, cy); hover.value = { visible: true, which:'I', x: pos.x, y: pos.y, valueText: String(pt.v), timeText: pt.ts? new Date(pt.ts).toLocaleTimeString('zh-CN',{hour12:false}) : '-', abnormal: pt.abnormal, rules: pt.rules, index: pt.idx, zToMeanText: Number.isNaN(zToMean)? '-' : `${zToMean.toFixed(2)} σ`, marginSpecText: (!p || Number.isNaN(marginSpec))? '-' : `${marginSpec.toFixed(2)}${p.unit||''} 至最近规格限`, adviceText: advice }
}
function onILeave() { hover.value.visible = false }
function onMRMove(ev: MouseEvent) { const c = mrchart.value; if (!c) return; const { pt, cx, cy } = pickPt(ev, mrPts, c); if (!pt) { hover.value.visible = false; return } const pos = placeTooltip(cx, cy); hover.value = { visible: true, which:'MR', x: pos.x, y: pos.y, valueText: String(pt.v), timeText: pt.ts? new Date(pt.ts).toLocaleTimeString('zh-CN',{hour12:false}) : '-', abnormal: pt.abnormal, rules: pt.rules, index: pt.idx } }
function onMRLeave() { hover.value.visible = false }
function onHistMove(ev: MouseEvent) { const c = hist.value; if (!c) return; const { bin, cx, cy } = pickBin(ev, histBins, c); if (!bin) { hover.value.visible = false; return } const total = six.metrics.n || 1; const pct = (bin.count/total)*100; const density = (bin.count / Math.max(1, (bin.vMax - bin.vMin) * total)); const pos = placeTooltip(cx, cy); hover.value = { visible: true, which: 'HIST', x: pos.x, y: pos.y, index: bin.idx, binRangeText: `${bin.vMin.toFixed(3)} ~ ${bin.vMax.toFixed(3)}${param.value?.unit||''}`, countText: String(bin.count), pctText: pct.toFixed(2) + '%', densityText: Number.isFinite(density)? density.toFixed(4) : undefined } }
function onHistLeave() { hover.value.visible = false }

// draw driver
function drawAll() { drawHist(); drawBoxPlot(); drawIChart(); drawMRChart(); drawQQ(); drawCapCompare() }
let timer: number | undefined
function onAnomaly() { drawAll() }
onMounted(() => {
  drawAll()
  window.addEventListener('lab-anomaly', onAnomaly)
  timer = window.setInterval(drawAll, 1000)
  hist.value?.addEventListener('mousemove', onHistMove)
  hist.value?.addEventListener('mouseleave', onHistLeave)
  box.value?.addEventListener('mousemove', onBoxMove)
  box.value?.addEventListener('mouseleave', onBoxLeave)
  ichart.value?.addEventListener('mousemove', onIMove)
  ichart.value?.addEventListener('mouseleave', onILeave)
  mrchart.value?.addEventListener('mousemove', onMRMove)
  mrchart.value?.addEventListener('mouseleave', onMRLeave)
  qq.value?.addEventListener('mousemove', onQQMove)
  qq.value?.addEventListener('mouseleave', onQQLeave)
  capcmp.value?.addEventListener('mousemove', onCapMove)
  capcmp.value?.addEventListener('mouseleave', onCapLeave)
})
onBeforeUnmount(() => {
  window.removeEventListener('lab-anomaly', onAnomaly)
  if (timer) clearInterval(timer)
  hist.value?.removeEventListener('mousemove', onHistMove)
  hist.value?.removeEventListener('mouseleave', onHistLeave)
  box.value?.removeEventListener('mousemove', onBoxMove)
  box.value?.removeEventListener('mouseleave', onBoxLeave)
  ichart.value?.removeEventListener('mousemove', onIMove)
  ichart.value?.removeEventListener('mouseleave', onILeave)
  mrchart.value?.removeEventListener('mousemove', onMRMove)
  mrchart.value?.removeEventListener('mouseleave', onMRLeave)
  qq.value?.removeEventListener('mousemove', onQQMove)
  qq.value?.removeEventListener('mouseleave', onQQLeave)
  capcmp.value?.removeEventListener('mousemove', onCapMove)
  capcmp.value?.removeEventListener('mouseleave', onCapLeave)
})

// react to inputs
watch([() => six.pid, () => six.bins, () => six.showSpec, () => six.showCtl, () => six.metrics.n], () => { requestAnimationFrame(drawAll) })

</script>

<style scoped>
.charts { display:grid; grid-template-columns: 1fr; gap:12px; }
.chart { border:1px solid var(--color-border); border-radius: 12px; padding: 10px; background: color-mix(in oklab, var(--color-background) 92%, transparent); }
.chart-rel { position: relative; }
.chart h3 { margin: 2px 0 8px; font-size: 14px; }
.tooltip { position:absolute; pointer-events:none; background: rgba(15,23,42,.95); color:#e2e8f0; border:1px solid #334155; padding:6px 8px; border-radius:8px; font-size:12px; box-shadow: 0 8px 20px rgba(0,0,0,.25); max-width: 50ch; z-index: 40; }
.tt-name { font-weight: 700; margin-bottom: 2px; }
.tt-line { color:#cbd5e1; }
</style>
