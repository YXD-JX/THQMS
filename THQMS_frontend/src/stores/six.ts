import { defineStore } from 'pinia'
import { computed, ref, watch, onMounted, onUnmounted } from 'vue'
import { useLabStore, type LabParam } from './lab'

export type KpiKey = 'n'|'mean'|'sigmaShort'|'sigmaLong'|'cpCpk'|'ppPpk'|'zbench'|'ppm'|'yield'
export type ChartKey = 'HIST'|'BOX'|'I'|'MR'|'QQ'|'CAP'

const PID_KEY = 'thqms.six.pid.v1'
const BINS_KEY = 'thqms.six.bins.v1'
const SPEC_KEY = 'thqms.six.spec.v1'
const CTL_KEY = 'thqms.six.ctl.v1'
const KPI_ORDER_KEY = 'thqms.six.kpi.order.v1'
const CHART_ORDER_KEY = 'thqms.six.chart.order.v1'

function mean(arr: number[]) { return arr.length ? arr.reduce((a,b)=>a+b,0)/arr.length : 0 }
function sampleStd(arr: number[]) {
  const n = arr.length; if (n < 2) return 0
  const m = mean(arr); const v = arr.reduce((s,x)=>s+(x-m)*(x-m),0)/(n-1); return Math.sqrt(v)
}
// erf & normal CDF
function erf(x: number) {
  const a1=0.254829592,a2=-0.284496736,a3=1.421413741,a4=-1.453152027,a5=1.061405429,p=0.3275911
  const sign = x<0?-1:1; x=Math.abs(x); const t=1/(1+p*x)
  const y=1-((((a5*t+a4)*t+a3)*t+a2)*t+a1)*t*Math.exp(-x*x)
  return sign*y
}
function normCdf(z: number) { return 0.5 * (1 + erf(z/Math.SQRT2)) }

// I-MR constants
const d2 = 1.128, D4 = 3.267

export const useSixStore = defineStore('six', () => {
  const lab = useLabStore()
  lab.initIfNeeded()

  const pid = ref<string>(localStorage.getItem(PID_KEY) || lab.params[0]?.id || '')
  const bins = ref<number>(Number(localStorage.getItem(BINS_KEY) || '20'))
  const showSpec = ref<boolean>(JSON.parse(localStorage.getItem(SPEC_KEY) || 'true'))
  const showCtl = ref<boolean>(JSON.parse(localStorage.getItem(CTL_KEY) || 'true'))

  // orders
  type KKey = KpiKey
  const defaultKpiOrder: KKey[] = ['n','mean','sigmaShort','sigmaLong','cpCpk','ppPpk','zbench','ppm','yield']
  const kpiOrder = ref<KKey[]>([...defaultKpiOrder])
  try {
    const saved = JSON.parse(localStorage.getItem(KPI_ORDER_KEY)||'[]')
    const arr = Array.isArray(saved) ? saved.filter((x:string)=> (defaultKpiOrder as string[]).includes(x)) as KKey[] : []
    kpiOrder.value = [...new Set<KKey>([...arr, ...defaultKpiOrder])]
  } catch {/* keep default */}

  type CKey = ChartKey
  const defaultChartOrder: CKey[] = ['HIST','BOX','I','MR','QQ','CAP']
  const chartOrder = ref<CKey[]>([...defaultChartOrder])
  try {
    const saved = JSON.parse(localStorage.getItem(CHART_ORDER_KEY)||'[]')
    const arr = Array.isArray(saved) ? saved.filter((x:string)=> (defaultChartOrder as string[]).includes(x)) as CKey[] : []
    chartOrder.value = [...new Set<CKey>([...arr, ...defaultChartOrder])]
  } catch {/* keep default */}

  watch(pid, v => localStorage.setItem(PID_KEY, v || ''))
  watch(bins, v => localStorage.setItem(BINS_KEY, String(Math.max(5, Math.min(60, Number(v)||20)))))
  watch(showSpec, v => localStorage.setItem(SPEC_KEY, JSON.stringify(!!v)))
  watch(showCtl, v => localStorage.setItem(CTL_KEY, JSON.stringify(!!v)))
  watch(kpiOrder, v => localStorage.setItem(KPI_ORDER_KEY, JSON.stringify(v)), { deep: true })
  watch(chartOrder, v => localStorage.setItem(CHART_ORDER_KEY, JSON.stringify(v)), { deep: true })

  const values = computed(() => (lab.meas[pid.value] || []).map(x => x.value))
  const param = computed<LabParam | undefined>(() => lab.getParamById(pid.value))

  const metrics = computed(() => {
    const arr = values.value
    const p = param.value
    const n = arr.length
    const m = mean(arr)
    const s = sampleStd(arr)
    let cp: number|undefined, cpk: number|undefined, zbench: number|undefined, defectRate: number|undefined
    if (p && s > 0) {
      cp = (p.ucl - p.lcl) / (6 * s)
      const zU = (p.ucl - m) / s
      const zL = (m - p.lcl) / s
      cpk = Math.min(zU/3, zL/3)
      zbench = Math.min(zU, zL)
      const pHi = 1 - normCdf(zU)
      const pLo = 1 - normCdf(zL)
      defectRate = Math.max(0, Math.min(1, pHi + pLo))
    } else {
      cp = cpk = zbench = defectRate = undefined
    }
    return { n, mean: m, sigma: s, cp, cpk, zbench, defectRate }
  })

  function movingRanges(arr: number[]) { const res:number[]=[]; for(let i=1;i<arr.length;i++) res.push(Math.abs(arr[i]-arr[i-1])); return res }
  const ctl = computed(() => {
    const arr = values.value
    const m = mean(arr)
    const mr = movingRanges(arr)
    const mrbar = mr.length ? mean(mr) : 0
    const sigma = mrbar>0 ? mrbar/d2 : 0
    const ucl = m + 3*sigma
    const lcl = m - 3*sigma
    const uclMr = mrbar * D4
    const lclMr = 0
    return { m, mrbar, sigma, ucl, lcl, uclMr, lclMr, mr }
  })

  type CapRes = { shortSigma: number; longSigma: number; cpShort?: number; cpkShort?: number; pp?: number; ppk?: number; zShort?: number; defectShort?: number }
  const cap = computed<CapRes>(() => {
    const p = param.value; const m = metrics.value.mean
    const sLong = metrics.value.sigma
    const sShort = ctl.value.sigma
  if (!p || !m || (!sLong && !sShort)) return { shortSigma: sShort, longSigma: sLong }
    let cpShort, cpkShort, pp, ppk, zShort, defectShort
    if (sShort>0) {
      cpShort = (p.ucl - p.lcl) / (6 * sShort)
      const zU = (p.ucl - m) / sShort
      const zL = (m - p.lcl) / sShort
      cpkShort = Math.min(zU/3, zL/3)
      zShort = Math.min(zU, zL)
      const pHi = 1 - normCdf(zU); const pLo = 1 - normCdf(zL)
      defectShort = Math.max(0, Math.min(1, pHi + pLo))
    }
    if (sLong>0) {
      pp = (p.ucl - p.lcl) / (6 * sLong)
      const zU = (p.ucl - m) / sLong
      const zL = (m - p.lcl) / sLong
      ppk = Math.min(zU/3, zL/3)
    }
    return { shortSigma: sShort, longSigma: sLong, cpShort, cpkShort, pp, ppk, zShort, defectShort }
  })

  // WECO rules for I-chart
  type RuleCode = 'R1(>3σ)' | 'R2(2/3>2σ)' | 'R3(4/5>1σ)' | 'R4(8同侧)'
  const weco = computed(() => {
    const arr = values.value; const m = ctl.value.m; const s = ctl.value.sigma
    const res = new Map<number, RuleCode[]>()
    if (!arr.length || s <= 0) return res
    const side = (v:number)=> (v>m?1:(v<m?-1:0))
    // R1: any point beyond 3σ
    arr.forEach((v,i)=>{ if (Math.abs(v-m) > 3*s) res.set(i, [...(res.get(i)||[]), 'R1(>3σ)']) })
    // R2: 2 of 3 consecutive beyond 2σ on same side
    for (let i=2;i<arr.length;i++) {
      const seg = [i-2,i-1,i]; const picks = seg.filter(k=> Math.abs(arr[k]-m)>2*s && side(arr[k])!==0)
      if (picks.length>=2) picks.forEach(k=> res.set(k, [...(res.get(k)||[]), 'R2(2/3>2σ)']))
    }
    // R3: 4 of 5 beyond 1σ on same side
    for (let i=4;i<arr.length;i++) {
      const seg = [i-4,i-3,i-2,i-1,i]
      const groups = { pos: [] as number[], neg: [] as number[] }
      seg.forEach(k=>{ const sd=side(arr[k]); if (Math.abs(arr[k]-m)>1*s && sd>0) groups.pos.push(k); else if (Math.abs(arr[k]-m)>1*s && sd<0) groups.neg.push(k) })
      if (groups.pos.length>=4) groups.pos.forEach(k=> res.set(k, [...(res.get(k)||[]), 'R3(4/5>1σ)']))
      if (groups.neg.length>=4) groups.neg.forEach(k=> res.set(k, [...(res.get(k)||[]), 'R3(4/5>1σ)']))
    }
    // R4: 8 consecutive on one side of mean
    let run = 0; let lastSide = 0
    for (let i=0;i<arr.length;i++) {
      const sgn = side(arr[i])
      if (sgn===0) { run=0; lastSide=0; continue }
      if (sgn===lastSide) run++; else { run=1; lastSide=sgn }
      if (run>=8) { for (let k=i-run+1; k<=i; k++) res.set(k, [...(res.get(k)||[]), 'R4(8同侧)']) }
    }
    return res
  })

  // expose convenience flags
  const labRunning = computed(() => !!lab.simTimer)
  function toggleSim() { if (lab.simTimer) lab.stopSimulation(); else lab.startSimulation(2000) }

  // listen to global dock controls so所有页面同步
  function onSixControls(ev: Event) {
    const ce = ev as CustomEvent<{ bins?: number; showSpec?: boolean; showCtl?: boolean }>
    const d = ce.detail || {}
    if (d.bins != null) bins.value = Math.max(5, Math.min(60, Number(d.bins)||20))
    if (d.showSpec != null) showSpec.value = !!d.showSpec
    if (d.showCtl != null) showCtl.value = !!d.showCtl
  }
  function onSixExport(_ev: Event) { /* handled by view if needed */ }

  // lifecycle helpers for non-setup consumers
  function mountListeners() { window.addEventListener('six:controls', onSixControls as EventListener); window.addEventListener('six:export', onSixExport as EventListener) }
  function unmountListeners() { window.removeEventListener('six:controls', onSixControls as EventListener); window.removeEventListener('six:export', onSixExport as EventListener) }

  // if used inside setup, auto attach/detach
  try {
    onMounted(mountListeners)
    onUnmounted(unmountListeners)
  } catch { /* no-op if not in setup context */ }

  return {
    // state
    pid, bins, showSpec, showCtl, kpiOrder, chartOrder,
    // data from lab
    values, param,
    // derived
    metrics, ctl, cap, weco,
    // sim control
    labRunning, toggleSim,
    // events
    mountListeners, unmountListeners,
  }
})
