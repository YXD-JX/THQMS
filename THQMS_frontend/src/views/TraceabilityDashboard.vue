<script setup lang="ts">
import { ref, computed, onMounted, nextTick, watch, onBeforeUnmount } from 'vue'
import { useProcessStore } from '@/stores/processQuality'
import { useLabStore, type LabParam } from '@/stores/lab'
import { useStandardsStore } from '@/stores/standards'

const proc = useProcessStore()
const lab = useLabStore()
const std = useStandardsStore()

const orderId = ref('')
const sn = ref('')
const lineId = ref('')
// const severity = ref<'all'|'low'|'medium'|'high'>('all') // 预留（当前未使用）

// 仅显示超限或未录入（持久化）
const ONLY_ISSUE_KEY = 'thqms.trace.onlyIssue.v1'
const onlyIssue = ref<boolean>(JSON.parse(localStorage.getItem(ONLY_ISSUE_KEY) ?? 'false'))
watch(onlyIssue, v => localStorage.setItem(ONLY_ISSUE_KEY, JSON.stringify(!!v)))

// 实时值开关（持久化）：勾选时“当前值”使用最新测量，取消时按工序时间点取最近测量
const REALTIME_KEY = 'thqms.trace.realtime.v1'
const realtime = ref<boolean>(JSON.parse(localStorage.getItem(REALTIME_KEY) ?? 'true'))
watch(realtime, v => localStorage.setItem(REALTIME_KEY, JSON.stringify(!!v)))

// 模拟控制（间隔持久化）
const LAB_INTERVAL_KEY = 'thqms.trace.labInterval.v1'
const PROC_INTERVAL_KEY = 'thqms.trace.procInterval.v1'
const labIntervalMs = ref<number>(Number(localStorage.getItem(LAB_INTERVAL_KEY) ?? '3000'))
const procIntervalMs = ref<number>(Number(localStorage.getItem(PROC_INTERVAL_KEY) ?? '4000'))
watch(labIntervalMs, v => localStorage.setItem(LAB_INTERVAL_KEY, String(Math.max(100, Number(v)||3000))))
watch(procIntervalMs, v => localStorage.setItem(PROC_INTERVAL_KEY, String(Math.max(200, Number(v)||4000))))
const simRunningLab = computed(() => !!lab.simTimer)
const simRunningProc = computed(() => !!proc.simTimer)
const simRunning = computed(() => simRunningLab.value && simRunningProc.value)

function pauseSimulation() {
  lab.stopSimulation();
  proc.stopSimulation();
}
function resumeSimulation() {
  proc.startSimulation(Math.max(200, Number(procIntervalMs.value)||4000))
  lab.startSimulation(Math.max(100, Number(labIntervalMs.value)||3000))
}
function refreshNow() {
  // 立即刷新一次（不改变定时器状态）
  lab.simulateTick();
  proc.simulateTick();
}

// 注入异常（联动模拟）控件
const injParam = ref<string>('')
const injType = ref<'UCL'|'LCL'>('UCL')
const injSev = ref<'low'|'medium'|'high'>('medium')
const injCount = ref(1)
const injIntervalMs = ref(0)
const injRefreshKpi = ref(true)

onMounted(() => {
  // 默认联动：启动仿真（若未启动）
  proc.initIfNeeded()
  std.load()
  if (!proc.simTimer) proc.startSimulation(Math.max(200, Number(procIntervalMs.value)||4000))
  if (!lab.simTimer) lab.startSimulation(Math.max(100, Number(labIntervalMs.value)||3000))
  // 自动填入最近 SN/工单
  setTimeout(() => {
    const latest = proc.latestSnAndOrder()
    if (latest.sn) sn.value = latest.sn
    else if (latest.orderId) orderId.value = latest.orderId
  scrollToCurrentProcess()
  }, 10)
  // 初始化注入参数默认值
  injParam.value = lab.params[0]?.id || ''
  // 实时：任何异常到来时，节流推进一次 KPI 刷新，确保追溯页即时联动
  window.addEventListener('lab-anomaly', onLabAnomaly as EventListener)
})

onBeforeUnmount(() => {
  window.removeEventListener('lab-anomaly', onLabAnomaly as EventListener)
})

const processes = computed(() => proc.processes)

function latestKpiForProcess(processId: string) {
  const arr = proc.kpi[processId] || []
  if (!arr.length) return undefined
  // 优先按工单过滤，其次按产线过滤，否则取最新
  if (sn.value) {
    for (let i = arr.length - 1; i >= 0; i--) if (arr[i].sn === sn.value) return arr[i]
  }
  if (orderId.value) {
    for (let i = arr.length - 1; i >= 0; i--) if (arr[i].orderId === orderId.value) return arr[i]
  }
  if (lineId.value) {
    for (let i = arr.length - 1; i >= 0; i--) if (arr[i].lineId === lineId.value) return arr[i]
  }
  return arr[arr.length - 1]
}

function latestValueFor(paramId: string, processId: string): { ts: number, value: number, inStd: boolean | undefined } | undefined {
  // 取最近一次 lab 测量作为该工序的代表值（实际可根据工序采集点映射）
  const series = lab.series[paramId]
  if (!series || !series.length) return undefined
  const value = series[series.length - 1]
  const s = std.get(processId, paramId)
  const inStd = s ? value >= s.lcl && value <= s.ucl : undefined
  return { ts: Date.now(), value, inStd }
}

function judgeTextOf(processId: string, paramId: string, value?: number): { text: string; inStd?: boolean; dir?: 'up'|'down'; ratio?: number } {
  if (value === undefined) return { text: '—', inStd: undefined }
  const s = std.get(processId, paramId)
  if (!s) return { text: '未录入', inStd: undefined }
  const span = Math.max(1e-6, s.ucl - s.lcl)
  if (value > s.ucl) {
    const ratio = Math.max(0, Math.min(1.5, (value - s.ucl) / span))
    return { text: '超过上限', inStd: false, dir: 'up', ratio }
  }
  if (value < s.lcl) {
    const ratio = Math.max(0, Math.min(1.5, (s.lcl - value) / span))
    return { text: '低于下线', inStd: false, dir: 'down', ratio }
  }
  return { text: '合格', inStd: true, dir: undefined, ratio: 0 }
}

const traceRows = computed(() => {
  const rows: Array<{ processId: string; processName: string; param: LabParam; value?: number; inStd?: boolean; judgeText: string; judgeDir?: 'up'|'down'; judgeRatio?: number; kpiTs?: number; orderId?: string; lineId?: string }>
    = []
  for (const p of processes.value) {
    const kpi = latestKpiForProcess(p.id)
    for (const pid of p.relatedParams) {
      const param = lab.getParamById(pid)
      if (!param) continue
      // 更精准取值：按工序流转时间点，近邻寻找该参数测量
      let lv = latestValueFor(pid, p.id)
      if (!realtime.value && kpi?.ts) {
        const near = lab.nearestMeasurement(pid, kpi.ts)
        if (near) lv = { ts: near.ts, value: near.value, inStd: std.isWithin(p.id, pid, near.value) }
      }
  const judge = judgeTextOf(p.id, pid, lv?.value)
      // 若 lv.inStd 已存在，以 lv 为准；否则使用 judge 推断
      const inStdFinal = lv?.inStd !== undefined ? lv.inStd : judge.inStd
  const row = { processId: p.id, processName: p.name, param, value: lv?.value, inStd: inStdFinal, judgeText: judge.text, judgeDir: judge.dir, judgeRatio: judge.ratio, kpiTs: kpi?.ts, orderId: kpi?.orderId, lineId: kpi?.lineId }
      if (onlyIssue.value) {
        const hasStd = !!std.get(p.id, pid)
        const isBad = (row.inStd === false) || !hasStd
        if (!isBad) continue
      }
      rows.push(row)
    }
  }
  return rows
})

const summary = computed(() => {
  const judged = traceRows.value.filter(r => r.inStd !== undefined)
  const pass = judged.filter(r => r.inStd).length
  return { total: judged.length, pass, rate: judged.length ? Math.round(pass / judged.length * 100) : undefined }
})

const groups = computed(() => {
  return processes.value.map(p => ({
    processId: p.id,
    processName: p.name,
    rows: traceRows.value.filter(r => r.processId === p.id),
  })).filter(g => g.rows.length > 0)
})

async function scrollToCurrentProcess() {
  let targetId: string | undefined
  if (sn.value) {
    for (const p of processes.value) {
      const k = latestKpiForProcess(p.id)
      if (k?.sn === sn.value) { targetId = p.id; break }
    }
  } else if (orderId.value) {
    for (const p of processes.value) {
      const k = latestKpiForProcess(p.id)
      if (k?.orderId === orderId.value) { targetId = p.id; break }
    }
  }
  if (!targetId) {
    const g = groups.value.find(x => x.rows.length)
    targetId = g?.processId
  }
  if (targetId) {
    await nextTick()
    const el = document.getElementById('proc-' + targetId)
    el?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }
}

function exportCsv() {
  const header = ['工序','参数','客户下限','客户上限','当前值','单位','工单','产线','判定']
  const lines = [header.join(',')]
  for (const r of traceRows.value) {
  const stdRow = std.get(r.processId, r.param.id)
  const judge = r.judgeText
    const unit = r.param.unit || ''
    lines.push([
      r.processName,
      r.param.name,
      stdRow?.lcl ?? '',
      stdRow?.ucl ?? '',
      r.value ?? '',
      unit,
      r.orderId ?? orderId.value ?? '',
      r.lineId ?? '',
      judge
    ].map(v => {
      if (typeof v !== 'string') return v
  const s = v.includes(',') || v.includes('"') ? '"' + v.replace(/"/g, '""') + '"' : v
      return s
  }).join(','))
  }
  const blob = new Blob(["\uFEFF" + lines.join('\n')], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `trace-${sn.value || orderId.value || 'all'}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

function exportExcel() {
  // 采用 HTML 表 + Excel MIME，避免引入第三方包
  const rows = traceRows.value
  let html = '<table><tr><th>工序</th><th>参数</th><th>客户下限</th><th>客户上限</th><th>当前值</th><th>单位</th><th>工单</th><th>产线</th><th>判定</th></tr>'
  for (const r of rows) {
  const stdRow = std.get(r.processId, r.param.id)
  const judge = r.judgeText
    html += `<tr><td>${r.processName}</td><td>${r.param.name}</td><td>${stdRow?.lcl ?? ''}</td><td>${stdRow?.ucl ?? ''}</td><td>${r.value ?? ''}</td><td>${r.param.unit || ''}</td><td>${r.orderId ?? orderId.value ?? ''}</td><td>${r.lineId ?? ''}</td><td>${judge}</td></tr>`
  }
  html += '</table>'
  const blob = new Blob([`\ufeff${html}`], { type: 'application/vnd.ms-excel' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `trace-${sn.value || orderId.value || 'all'}.xls`
  a.click()
  URL.revokeObjectURL(url)
}

// 时间轴（简易甘特）：以各工序的 kpiTs 为点，渲染相对位置条
type TimelineItem = { id: string; label: string; leftPct: number; widthPct: number; ts?: number }
const timeline = computed(() => {
  const points = processes.value.map(p => ({ id: p.id, name: p.name, kpi: latestKpiForProcess(p.id) }))
  const tsList = points.map(x => x.kpi?.ts).filter(Boolean) as number[]
  if (!tsList.length) return { min: 0, max: 0, items: [] as TimelineItem[] }
  const min = Math.min(...tsList)
  const max = Math.max(...tsList)
  const span = Math.max(1, max - min)
  const items = points.map(x => {
    const ts = x.kpi?.ts
    const leftPct = ts ? ((ts - min) / span) * 100 : 0
    const widthPct = 6 // 固定宽度 6%
    const label = x.name
    return { id: x.id, label, leftPct, widthPct, ts } as unknown as TimelineItem
  })
  return { min, max, items }
})

const currentProcId = computed(() => {
  if (sn.value) {
    for (const p of processes.value) {
      const k = latestKpiForProcess(p.id)
      if (k?.sn === sn.value) return p.id
    }
  }
  if (orderId.value) {
    for (const p of processes.value) {
      const k = latestKpiForProcess(p.id)
      if (k?.orderId === orderId.value) return p.id
    }
  }
  const g = groups.value.find(x => x.rows.length)
  return g?.processId
})

function judgeColor(row: { inStd?: boolean; judgeDir?: 'up'|'down'; judgeRatio?: number }) {
  if (row.inStd) return '#16a34a'
  if (row.inStd === undefined) return 'var(--vt-c-text-2)'
  const ratio = Math.max(0, Math.min(1.5, Number(row.judgeRatio ?? 0)))
  // 方向配色：上限↑ 红色系；下限↓ 蓝色系；按偏离比例加深（亮度降低）
  const hue = row.judgeDir === 'down' ? 210 : 0
  const sat = 75
  const light = Math.max(30, 55 - Math.round(ratio * 20))
  return `hsl(${hue} ${sat}% ${light}%)`
}

// 实时联动：当前工序变化时自动滚动到对应锚点
watch(currentProcId, async (n, o) => {
  if (n && n !== o) await scrollToCurrentProcess()
})

// 实时响应：异常到达时触发一次 KPI tick（节流）
let lastAnomTick = 0
const minAnomGap = 500 // ms
function onLabAnomaly() {
  const now = Date.now()
  if (now - lastAnomTick < minAnomGap) return
  lastAnomTick = now
  proc.simulateTick()
}

// 运行中变更间隔时，自动套用新的间隔（重启相应计时器）
watch(labIntervalMs, (v) => {
  const iv = Math.max(100, Number(v)||3000)
  if (lab.simTimer) { lab.stopSimulation(); lab.startSimulation(iv) }
})
watch(procIntervalMs, (v) => {
  const iv = Math.max(200, Number(v)||4000)
  if (proc.simTimer) { proc.stopSimulation(); proc.startSimulation(iv) }
})

// 注入异常：向 Lab 写入一条越界测量，触发全局异常链路；可多次注入并可选立即刷新一次工序KPI
function injectOnce() {
  const pid = injParam.value
  if (!pid) return
  const p = lab.getParamById(pid)
  if (!p) return
  const span = Math.max(1e-6, p.ucl - p.lcl)
  const sevK = injSev.value === 'high' ? 0.2 : injSev.value === 'medium' ? 0.1 : 0.05
  const jitter = (Math.random() - 0.5) * 0.02 * span
  const base = injType.value === 'UCL' ? p.ucl : p.lcl
  const value = injType.value === 'UCL' ? base + sevK * span + jitter : base - sevK * span - jitter
  lab.addMeasurement({ ts: Date.now(), paramId: pid, value: Number(value.toFixed(2)) })
  if (injRefreshKpi.value) {
    // 立即推进一次 KPI 刷新以观察联动（仍然保留定时仿真）
    proc.simulateTick()
  }
}
function injectAnomaly() {
  const n = Math.max(1, Math.min(50, Number(injCount.value || 1)))
  const gap = Math.max(0, Math.min(60000, Number(injIntervalMs.value || 0)))
  if (gap === 0 || n === 1) {
    for (let i = 0; i < n; i++) injectOnce()
    return
  }
  for (let i = 0; i < n; i++) {
    setTimeout(() => injectOnce(), i * gap)
  }
}

</script>

<template>
  <div class="page">
    <header class="hdr">
      <h2>质量追溯看板</h2>
      <div class="filters">
  <label><input type="checkbox" v-model="onlyIssue" /> 仅超限/未录入</label>
  <label class="muted"><input type="checkbox" v-model="realtime" /> 当前值实时</label>
        <label>PCB编号
          <input v-model="sn" placeholder="PCB-YYYYMMDD-XXXX" />
        </label>
        <label>工单号
          <input v-model="orderId" placeholder="WO-..." />
        </label>
        <label>产线
          <select v-model="lineId">
            <option value="">全部</option>
            <option v-for="l in proc.lines" :key="l" :value="l">{{ l }}</option>
          </select>
        </label>
        <div class="inj">
          <span class="muted">注入异常：</span>
          <select v-model="injParam">
            <option v-for="p in lab.params" :key="p.id" :value="p.id">{{ p.name }}</option>
          </select>
          <select v-model="injType">
            <option value="UCL">高于上限</option>
            <option value="LCL">低于下限</option>
          </select>
          <select v-model="injSev">
            <option value="low">低</option>
            <option value="medium">中</option>
            <option value="high">高</option>
          </select>
          <input type="number" v-model.number="injCount" min="1" max="50" style="width:64px" title="注入次数" />
          <input type="number" v-model.number="injIntervalMs" min="0" max="60000" step="100" style="width:86px" title="间隔(ms)" />
          <label class="muted"><input type="checkbox" v-model="injRefreshKpi" /> 注入后刷新KPI</label>
          <button @click="injectAnomaly">注入</button>
        </div>
      </div>
      <div class="sim">
        <span class="muted">模拟：</span>
        <span :class="{ badge: true, on: simRunning, off: !simRunning }">{{ simRunning ? '运行中' : '已暂停' }}</span>
        <label class="muted">Lab间隔(ms)
          <input type="number" v-model.number="labIntervalMs" min="100" step="100" style="width:90px" />
        </label>
        <label class="muted">KPI间隔(ms)
          <input type="number" v-model.number="procIntervalMs" min="200" step="200" style="width:90px" />
        </label>
        <button @click="refreshNow">立即刷新</button>
        <button v-if="simRunning" @click="pauseSimulation">暂停</button>
        <button v-else @click="resumeSimulation">继续</button>
      </div>
    </header>

    <section class="table">
    <div class="timeline" v-if="timeline.items.length">
        <div class="timeline-track">
      <div v-for="it in timeline.items" :key="it.label" class="bar" :class="{ current: it.id === currentProcId }" :style="{ left: it.leftPct + '%', width: it.widthPct + '%'}" :title="it.label"></div>
        </div>
        <div class="timeline-legend">
      <span v-for="it in timeline.items" :key="it.label" :class="{ current: it.id === currentProcId }">■ {{ it.label }}</span>
        </div>
      </div>
      <div class="summary">
        <span>合格判定：
          <b v-if="summary.rate !== undefined">{{ summary.pass }}/{{ summary.total }}（{{ summary.rate }}%）</b>
          <span v-else class="muted">暂无标准或数据不足</span>
        </span>
        <div class="ops">
          <RouterLink class="to-std" to="/standards">去维护客户标准 →</RouterLink>
          <button @click="exportCsv">导出 CSV</button>
          <button @click="exportExcel">导出 Excel</button>
        </div>
      </div>
      <div class="thead">
        <div>工序</div>
        <div>参数</div>
        <div>客户标准</div>
        <div>当前值</div>
        <div>工单/产线</div>
        <div>判定</div>
      </div>
      <div class="tbody">
        <template v-for="g in groups" :key="g.processId">
          <div class="row head" :id="'proc-' + g.processId" :class="{ current: g.processId === currentProcId }">
            <div class="proc"><b>{{ g.processName }}</b></div>
            <div class="param muted">关联参数</div>
            <div></div><div></div><div></div><div></div>
          </div>
          <div class="row" v-for="r in g.rows" :key="r.processId + '-' + r.param.id">
            <div class="proc">—</div>
            <div class="param">{{ r.param.name }}</div>
            <div class="std">
              <span v-if="useStandardsStore().get(r.processId, r.param.id)">
                {{ useStandardsStore().get(r.processId, r.param.id)?.lcl }} - {{ useStandardsStore().get(r.processId, r.param.id)?.ucl }} {{ r.param.unit || '' }}
              </span>
              <span v-else class="muted">未录入</span>
            </div>
            <div class="val">
              <span>{{ r.value ?? '-' }} {{ r.param.unit || '' }}</span>
              <span v-if="r.judgeDir && r.judgeRatio!==undefined" class="dev" :style="{ color: judgeColor(r) }">
                {{ r.judgeDir==='down' ? '-' : '+' }}{{ Math.round((r.judgeRatio||0)*100) }}%
              </span>
              <div v-if="r.judgeDir && r.judgeRatio!==undefined" class="devbar">
                <div class="fill" :style="{ width: Math.min(100, Math.round((r.judgeRatio||0)*100)) + '%', background: judgeColor(r) }"></div>
              </div>
            </div>
            <div class="flow">
              <span v-if="sn">{{ sn }}</span>
              <span v-else>{{ r.orderId || orderId || '—' }}</span>
              <span class="muted" v-if="r.lineId"> / {{ r.lineId }}</span>
            </div>
            <div class="judge">
              <span v-if="r.judgeDir==='up'" class="arrow up" :style="{ color: judgeColor(r) }">↑</span>
              <span v-else-if="r.judgeDir==='down'" class="arrow down" :style="{ color: judgeColor(r) }">↓</span>
              <span class="text" :style="{ color: judgeColor(r) }">{{ r.judgeText }}</span>
            </div>
          </div>
        </template>
      </div>
    </section>
  </div>
</template>

<style scoped>
.page { padding: 16px; display: grid; gap: 16px; }
.hdr { position: sticky; top: var(--topnav-h, 48px); z-index: 10; display:flex; align-items: center; justify-content: space-between; gap: 12px; padding: 10px 0; background: color-mix(in oklab, var(--color-background) 92%, transparent); backdrop-filter: saturate(120%) blur(6px); border-bottom: 1px solid var(--color-border); }
.filters { display:flex; gap: 12px; align-items:center; }
.filters .inj { display:flex; gap: 8px; align-items:center; border-left: 1px dashed var(--color-border); padding-left: 12px; }
.sim { display:flex; gap: 8px; align-items:center; }
.badge { padding: 2px 8px; border-radius: 999px; font-size: 12px; border: 1px solid var(--color-border); }
.badge.on { background: color-mix(in oklab, #10b981 20%, transparent); color:#065f46; border-color: #10b981; }
.badge.off { background: color-mix(in oklab, #ef4444 15%, transparent); color:#7f1d1d; border-color: #ef4444; }
label { display:flex; gap:6px; align-items:center; }
.table { border: 1px solid var(--color-border); border-radius: 8px; overflow: hidden; }
.timeline { padding: 12px; border-bottom: 1px dashed var(--color-border); display: grid; gap: 8px; }
.timeline-track { position: relative; height: 12px; background: var(--color-background-soft); border-radius: 6px; }
.bar { position: absolute; top: 0; bottom: 0; background: color-mix(in oklab, #0ea5e9 70%, transparent); border-radius: 6px; }
.bar.current { background: color-mix(in oklab, #f59e0b 80%, transparent); box-shadow: 0 0 0 2px color-mix(in oklab, #f59e0b 50%, transparent); }
.timeline-legend { display:flex; gap: 12px; font-size: 12px; color: var(--vt-c-text-2); }
.timeline-legend .current { color: #f59e0b; font-weight: 700; }
.row.head.current { background: color-mix(in oklab, #f59e0b 12%, transparent); box-shadow: inset 0 0 0 1px color-mix(in oklab, #f59e0b 40%, transparent); }
.summary { display:flex; justify-content: space-between; align-items:center; padding: 8px 12px; border-bottom: 1px dashed var(--color-border); }
.ops { display:flex; gap: 8px; align-items:center; }
.to-std { font-size: 12px; }
.thead, .row { display:grid; grid-template-columns: 1fr 1fr 1.5fr 1fr 1.2fr 0.8fr; gap: 8px; }
.thead { background: var(--color-background-soft); padding: 8px 12px; font-weight: 600; }
.tbody .row { padding: 10px 12px; border-top: 1px solid var(--color-border); }
.muted { color: var(--vt-c-text-2); }
.judge { font-weight: 700; }
.val { display:flex; align-items:center; gap:8px; }
.val .dev { font-size: 12px; }
.val .devbar { position: relative; width: 70px; height: 6px; background: var(--color-background-soft); border-radius: 999px; overflow: hidden; border: 1px solid var(--color-border); }
.val .devbar .fill { position: absolute; left: 0; top: 0; bottom: 0; border-radius: 999px; }
.judge .arrow { font-weight: 900; margin-right: 2px; }

/* Mobile/tablet tweaks */
@media (max-width: 1200px) {
  .filters { flex-wrap: wrap; }
  .sim { flex-wrap: wrap; }
}
@media (max-width: 960px) {
  .page { padding: 12px; }
  .thead, .row { grid-template-columns: 1.2fr 1fr 1.2fr 0.9fr 1fr 0.8fr; }
}
@media (max-width: 720px) {
  .thead, .row { grid-template-columns: 1fr 1fr; }
  .thead > :nth-child(n+3), .row > :nth-child(n+3) { display:none; }
  .tbody .row { padding: 10px; }
  .summary { flex-direction: column; align-items: flex-start; gap: 8px; }
  .ops { flex-wrap: wrap; }
}
@supports (-webkit-touch-callout: none) {
  .hdr { backdrop-filter: none; background: color-mix(in oklab, var(--color-background) 96%, transparent); }
}
</style>
