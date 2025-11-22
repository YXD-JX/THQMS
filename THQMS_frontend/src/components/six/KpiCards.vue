<template>
  <section class="cards small">
    <div v-for="key in order" :key="key"
         class="card"
         draggable="true"
         @dragstart="onDragStart($event, key)"
         @dragover.prevent="onDragOver"
         @drop.prevent="onDrop($event, key)"
         @mousemove="onMove($event, key)"
         @mouseleave="onLeave">
      <label>{{ labels[key] }}</label>
      <b>{{ valueText(key) }}</b>
    </div>
  </section>
  <div v-if="hover.visible" class="tooltip kpi" ref="tt" :style="{ left: hover.x + 'px', top: hover.y + 'px', position: 'fixed' }">
    <div class="tt-name">{{ hover.title }}</div>
    <div class="tt-line" v-for="(line,i) in hover.lines" :key="i">{{ line }}</div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { useSixStore, type KpiKey } from '@/stores/six'

const six = useSixStore()
const order = computed(() => six.kpiOrder)

let dragKey: KpiKey | null = null
function onDragStart(ev: DragEvent, key: KpiKey) { dragKey = key; ev.dataTransfer?.setData('text/plain', key) }
function onDragOver(ev: DragEvent) { ev.dataTransfer!.dropEffect = 'move' }
function onDrop(ev: DragEvent, targetKey: KpiKey) {
  const sourceKey = (ev.dataTransfer?.getData('text/plain') as KpiKey) || dragKey
  dragKey = null
  if (!sourceKey || sourceKey===targetKey) return
  const arr = [...six.kpiOrder]
  const si = arr.indexOf(sourceKey), ti = arr.indexOf(targetKey)
  if (si<0 || ti<0) return
  arr.splice(si,1)
  arr.splice(ti,0,sourceKey)
  // update store array immutably
  six.kpiOrder.splice(0, six.kpiOrder.length, ...arr)
}

const labels: Record<KpiKey,string> = { n:'样本数', mean:'均值', sigmaShort:'σ短期', sigmaLong:'σ长期', cpCpk:'Cp/Cpk', ppPpk:'Pp/Ppk', zbench:'Zbench', ppm:'PPM', yield:'良率' }
function fmt(x?: number) { if (x==null || Number.isNaN(x)) return '-'; return Number(x).toFixed(3) }
function fmtPct(x?: number) { if (x==null || Number.isNaN(x)) return '-'; return (x*100).toFixed(3)+'%' }
function valueText(key: KpiKey) {
  switch (key) {
    case 'n': return String(six.metrics.n)
    case 'mean': return fmt(six.metrics.mean)
    case 'sigmaShort': return fmt(six.cap.shortSigma)
    case 'sigmaLong': return fmt(six.metrics.sigma)
    case 'cpCpk': return `${fmt(six.cap.cpShort)}/${fmt(six.cap.cpkShort)}`
    case 'ppPpk': return `${fmt(six.cap.pp)}/${fmt(six.cap.ppk)}`
    case 'zbench': return fmt(six.cap.zShort)
    case 'ppm': return String(Math.round((six.cap.defectShort||0)*1e6))
    case 'yield': return fmtPct(1 - (six.cap.defectShort||0))
  }
}

// tooltip
const tt = ref<HTMLDivElement|null>(null)
const hover = ref<{ visible:boolean; which?: 'KPI'; x:number; y:number; title?:string; lines?:string[] }>({ visible:false, x:0, y:0 })
function placeTooltipFor(el: HTMLElement|null, px: number, py: number) {
  const margin = 12
  const w = el?.offsetWidth ?? 260
  const h = el?.offsetHeight ?? 140
  let x = px + margin
  let y = py + margin
  if (x + w > window.innerWidth - 8) x = px - w - margin
  if (x < 8) x = 8
  if (y + h > window.innerHeight - 8) y = py - h - margin
  if (y < 8) y = 8
  return { x, y }
}
function onMove(ev: MouseEvent, key: KpiKey) {
  const p = six.param
  const pos = placeTooltipFor(tt.value, ev.clientX, ev.clientY)
  const title = (() => {
    const base = p?.name || six.pid
    const map: Record<KpiKey,string> = { n:'样本数', mean:'均值', sigmaShort:'σ短期(MR)', sigmaLong:'σ长期(样本)', cpCpk:'Cp/Cpk', ppPpk:'Pp/Ppk', zbench:'Zbench', ppm:'PPM(短)', yield:'良率(短)' }
    return `${base} · ${map[key]}`
  })()
  const lines: string[] = []
  const num = (x?: number)=> (x==null||Number.isNaN(x)? '-' : Number(x).toFixed(3))
  switch (key) {
    case 'n':
      lines.push(`当前样本数：${six.metrics.n}`)
      lines.push('含义：参与统计的有效数据量')
      break
    case 'mean':
      lines.push(`均值：${num(six.metrics.mean)}${p?.unit||''}`)
      lines.push('含义：样本平均值，作为过程中心估计')
      break
    case 'sigmaShort':
      lines.push(`σ短期：${num(six.cap.shortSigma)}${p?.unit||''}`)
      lines.push('估计：MR/d2（n=2），反映短期波动（受控状态）')
      break
    case 'sigmaLong':
      lines.push(`σ长期：${num(six.metrics.sigma)}${p?.unit||''}`)
      lines.push('估计：样本标准差，反映长期总体波动')
      break
    case 'cpCpk':
      lines.push(`Cp/Cpk：${num(six.cap.cpShort)}/${num(six.cap.cpkShort)}`)
      lines.push('Cp = (UCL-LCL)/(6σ短期)，Cpk = min((UCL-μ)/(3σ短期),(μ-LCL)/(3σ短期))')
      lines.push('建议：≥1.33 可接受；≥1.67 卓越')
      break
    case 'ppPpk':
      lines.push(`Pp/Ppk：${num(six.cap.pp)}/${num(six.cap.ppk)}`)
      lines.push('Pp/Ppk 以σ长期估计长期能力，适用于整体表现评估')
      break
    case 'zbench':
      lines.push(`Zbench(短)：${num(six.cap.zShort)}`)
      lines.push('含义：离最近规格界的Z值（短期），越大越好')
      break
    case 'ppm':
      lines.push(`PPM(短)：${Math.round((six.cap.defectShort||0)*1e6)}`)
      lines.push('由Zbench推导的缺陷水平（每百万机会缺陷数）')
      break
    case 'yield':
      lines.push(`良率(短)：${fmtPct(1-(six.cap.defectShort||0))}`)
      lines.push('估计：1 - 缺陷率（短期）')
      break
  }
  hover.value = { visible: true, which: 'KPI', x: pos.x, y: pos.y, title, lines }
}
function onLeave() { hover.value.visible=false }
</script>

<style scoped>
.cards { display:grid; grid-template-columns: repeat(auto-fit, minmax(130px, 1fr)); gap:10px; margin-bottom: 12px; }
.card { background: #0f172a0d; border:1px solid var(--color-border); border-radius:10px; padding:6px 8px; min-width:120px; }
.card label { font-size:11px; color:#64748b; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; display:block; line-height:1.1; }
.card b { font-size:15px; font-variant-numeric: tabular-nums; font-feature-settings: 'tnum'; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; display:block; line-height:1.2; }
.tooltip { position:absolute; pointer-events:none; background: rgba(15,23,42,.95); color:#e2e8f0; border:1px solid #334155; padding:6px 8px; border-radius:8px; font-size:12px; box-shadow: 0 8px 20px rgba(0,0,0,.25); max-width: 50ch; z-index: 20; }
.tt-name { font-weight: 700; margin-bottom: 2px; }
.tt-line { color:#cbd5e1; }
</style>
