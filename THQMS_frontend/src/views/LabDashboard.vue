<template>
  <div class="page">
    <header class="page-header">
      <h1>PCB 化验室 · 实时SPC与异常闭环</h1>
      <div class="actions">
        <button class="open-drawer" @click="openAnomalyDrawer = (openDosingDrawer = false, true)">异常列表 ({{ anomalyCount }})</button>
        <button class="open-drawer" @click="openDosingDrawer = (openAnomalyDrawer = false, true)">补加单据·待处理 ({{ pendingOrders.length }})</button>
      </div>
    </header>
    <main class="page-main">
      <div class="layout">
        <!-- 左侧 录入 -->
        <section class="card card--left sticky-col">
          <h2 class="card-title accent-green">化验单录入</h2>
          <LabEntry />
        </section>
        <!-- 中间 图表 -->
        <section class="card card--center">
          <h2 class="card-title accent-blue">SPC 实时图表</h2>
          <div class="charts">
            <div v-for="p in params" :key="p.id" :id="'chart-card-' + p.id" :class="['chart-card', { 'is-highlight': highlighted===p.id, 'is-anomaly-ryb': !!alarmFlags[p.id], 'is-traffic': !!alarmFlags[p.id] }]">
              <SpcChart
                :title="p.name + (p.unit ? ' ('+p.unit+')' : '')"
                :labels="times"
                :values="series[p.id] || []"
                :lcl="p.lcl"
                :ucl="p.ucl"
                :height="chartHeight"
              />
            </div>
          </div>
        </section>
        <!-- 右侧 看板入口（两个抽屉分开） -->
        <section class="card card--right sticky-col">
          <h2 class="card-title accent-rose">看板入口</h2>
          <p class="hint">数据较多，请点击下方按钮分别打开抽屉查看。</p>
          <div class="stack gap-8">
            <button class="open-drawer" @click="openAnomalyDrawer = (openDosingDrawer = false, true)">打开异常列表 ({{ anomalyCount }})</button>
            <button class="open-drawer" @click="openDosingDrawer = (openAnomalyDrawer = false, true)">打开补加单据·待处理 ({{ pendingOrders.length }})</button>
          </div>
        </section>
      </div>
    </main>
    <!-- Drawer A: 异常列表 -->
    <div v-if="openAnomalyDrawer" class="drawer" @click.self="openAnomalyDrawer = false">
      <aside class="drawer-panel">
        <div class="drawer-header">
          <h3>异常列表</h3>
          <button class="ghost" @click="openAnomalyDrawer = false">关闭</button>
        </div>
        <div class="drawer-body">
          <div class="filters">
            <label>
              参数：
              <select v-model="filterParam">
                <option value="">全部</option>
                <option v-for="p in params" :key="p.id" :value="p.id">{{ p.name }}</option>
              </select>
            </label>
            <label>
              最近：
              <select v-model.number="filterMinutes">
                <option :value="0">不限</option>
                <option :value="5">5 分钟</option>
                <option :value="15">15 分钟</option>
                <option :value="30">30 分钟</option>
                <option :value="60">1 小时</option>
              </select>
            </label>
            <label>
              严重度：
              <select v-model="filterSeverity">
                <option value="">全部</option>
                <option value="high">high</option>
                <option value="medium">medium</option>
                <option value="low">low</option>
              </select>
            </label>
            <label>
              排序：
              <select v-model="sortAnomalyBy">
                <option value="time-desc">时间 新→旧</option>
                <option value="time-asc">时间 旧→新</option>
                <option value="sev-desc">严重度 高→低</option>
                <option value="sev-asc">严重度 低→高</option>
              </select>
            </label>
          </div>
          <AnomalyBoard :items="filteredAnomalies" />
        </div>
      </aside>
    </div>

    <!-- Drawer B: 补加单据（待处理） -->
    <div v-if="openDosingDrawer" class="drawer" @click.self="openDosingDrawer = false">
      <aside class="drawer-panel">
        <div class="drawer-header">
          <h3>补加单据（待处理）</h3>
          <button class="ghost" @click="openDosingDrawer = false">关闭</button>
        </div>
        <div class="drawer-body">
          <div class="filters">
            <label>
              参数：
              <select v-model="filterParam">
                <option value="">全部</option>
                <option v-for="p in params" :key="p.id" :value="p.id">{{ p.name }}</option>
              </select>
            </label>
            <label>
              最近：
              <select v-model.number="filterMinutes">
                <option :value="0">不限</option>
                <option :value="5">5 分钟</option>
                <option :value="15">15 分钟</option>
                <option :value="30">30 分钟</option>
                <option :value="60">1 小时</option>
              </select>
            </label>
            <div class="spacer" />
            <button class="ghost" @click="batchApproveQc">批量通过（品质）</button>
            <button class="ghost" @click="batchApproveProd">批量通过（生产）</button>
            <button class="ghost" @click="batchReject">批量驳回</button>
          </div>
          <DosingOrderList :items="filteredPendingOrders" />
        </div>
      </aside>
    </div>
  </div>
</template>

<script lang="ts" setup>
import { computed, ref, onMounted, onBeforeUnmount, watch } from 'vue';
import { useRoute } from 'vue-router';
import { useLabStore } from '../stores/lab';
import { useDosingStore } from '@/stores/dosing';
import { useNotiStore } from '@/stores/notifications';
import { useRouter } from 'vue-router';
import LabEntry from '../components/LabEntry.vue';
import SpcChart from '../components/SpcChart.vue';
import AnomalyBoard from '../components/AnomalyBoard.vue';
import DosingOrderList from '@/components/DosingOrderList.vue';

const store = useLabStore();
store.initIfNeeded();
const dosing = useDosingStore();
// 本页也初始化以便首个打开的页面能写入/读取持久化
if (!('initIfNeeded' in dosing) || typeof dosing.initIfNeeded !== 'function') {
  // no-op for backward, should not happen
} else {
  dosing.initIfNeeded();
}

const params = computed(() => store.params);
const series = computed(() => store.series);
const times = computed(() => store.times);
const anomalyCount = computed(() => store.anomalies.length);
const pendingOrders = computed(() => dosing.orders.filter(o => o.status==='pending' || o.status==='approved-qc' || o.status==='approved-prod'));

// 抽屉开关（分离两个抽屉，互斥）
const openAnomalyDrawer = ref(false);
const openDosingDrawer = ref(false);

// 过滤控件：按参数、最近 N 分钟
const filterParam = ref<string>('');
const filterMinutes = ref<number>(0);
const filterSeverity = ref<string>('');
const sortAnomalyBy = ref<'time-desc'|'time-asc'|'sev-desc'|'sev-asc'>('time-desc');
const filteredAnomalies = computed(() => {
  const items = store.anomalies.slice();
  const pid = filterParam.value;
  const minAgo = filterMinutes.value;
  const sev = filterSeverity.value as '' | 'low' | 'medium' | 'high';
  const since = minAgo > 0 ? Date.now() - minAgo * 60_000 : 0;
  const arr = items.filter(a => (!pid || a.paramId === pid)
    && (!since || a.ts >= since)
    && (!sev || a.severity === sev));
  // 排序
  arr.sort((a, b) => {
    if (sortAnomalyBy.value === 'time-asc') return a.ts - b.ts;
    if (sortAnomalyBy.value === 'time-desc') return b.ts - a.ts;
    const score = (s: 'low'|'medium'|'high') => s === 'high' ? 3 : s === 'medium' ? 2 : 1;
    const da = score(a.severity), db = score(b.severity);
    return sortAnomalyBy.value === 'sev-asc' ? (da - db) : (db - da);
  });
  return arr;
});
const filteredPendingOrders = computed(() => {
  const pid = filterParam.value;
  const minAgo = filterMinutes.value;
  const since = minAgo > 0 ? Date.now() - minAgo * 60_000 : 0;
  return pendingOrders.value.filter(o => (!pid || o.paramId === pid) && (!since || o.ts >= since));
});

// 自适应图表高度（手机/平板/桌面）
const chartHeight = ref<string>('240px')
function recalcChartHeight(){
  const w = typeof window !== 'undefined' ? window.innerWidth : 1280
  let h = 240
  if (w < 380) h = 180
  else if (w < 600) h = 200
  else if (w < 900) h = 220
  else if (w > 1600) h = 280
  chartHeight.value = `${h}px`
}

// 批量操作（仅对当前过滤后的待处理集合）
const ns = useNotiStore();
const router = useRouter();
function confirmAndDo(title: string, body: string, fn: () => void) {
  const ok = window.confirm(body);
  if (!ok) return;
  fn();
  ns.push({ id: `toast-${Date.now()}`, title, body, ts: Date.now(), severity: 'low', targetRoute: '/dosing' }, 3000);
}
function batchApproveQc() {
  const snaps = filteredPendingOrders.value.map(o => ({ id: o.id, prevStatus: o.status, prevApproverQc: o.approverQc, prevApproverProd: o.approverProd }));
  dosing.setLastBatch({ action: 'approve-qc', items: snaps, ts: Date.now() });
  confirmAndDo('批量通过（品质）', `将处理 ${filteredPendingOrders.value.length} 条单据为 品质通过`, () => {
    filteredPendingOrders.value.forEach(o => dosing.approveQc(o.id, '品质加料员'))
    // 自动跳转到 DosingDashboard
    router.push('/dosing');
    // 推送含“撤销”提示的通知（点击查看即可跳转，撤销按钮在顶部栈没有；提供快速调用）
    ns.push({ id: `undo-qc-${Date.now()}`, title: '已批量通过（品质）', body: '点击查看，可在顶部“撤销最近批量”', ts: Date.now(), severity: 'low', targetRoute: '/dosing' }, 4000);
  });
}
function batchApproveProd() {
  const snaps = filteredPendingOrders.value.map(o => ({ id: o.id, prevStatus: o.status, prevApproverQc: o.approverQc, prevApproverProd: o.approverProd }));
  dosing.setLastBatch({ action: 'approve-prod', items: snaps, ts: Date.now() });
  confirmAndDo('批量通过（生产）', `将处理 ${filteredPendingOrders.value.length} 条单据为 生产通过`, () => {
    filteredPendingOrders.value.forEach(o => dosing.approveProd(o.id, '生产主管'))
    router.push('/dosing');
    ns.push({ id: `undo-prod-${Date.now()}`, title: '已批量通过（生产）', body: '点击查看，可在顶部“撤销最近批量”', ts: Date.now(), severity: 'low', targetRoute: '/dosing' }, 4000);
  });
}
function batchReject() {
  const snaps = filteredPendingOrders.value.map(o => ({ id: o.id, prevStatus: o.status, prevApproverQc: o.approverQc, prevApproverProd: o.approverProd }));
  dosing.setLastBatch({ action: 'reject', items: snaps, ts: Date.now() });
  confirmAndDo('批量驳回', `将驳回 ${filteredPendingOrders.value.length} 条单据`, () => {
    filteredPendingOrders.value.forEach(o => dosing.reject(o.id))
    router.push('/dosing');
    ns.push({ id: `undo-rej-${Date.now()}`, title: '已批量驳回', body: '点击查看，可在顶部“撤销最近批量”', ts: Date.now(), severity: 'low', targetRoute: '/dosing' }, 4000);
  });
}

// 路由参数定位与高亮 ?param=xxx
const highlighted = ref<string | null>(null);
const route = useRoute();
const alarmFlags = ref<Record<string, boolean>>({});
const alarmTimers: Record<string, number> = {};

function scrollToParam(pid: string) {
  const el = document.getElementById(`chart-card-${pid}`);
  if (!el) return;
  el.scrollIntoView({ behavior: 'smooth', block: 'center' });
  highlighted.value = pid;
  window.setTimeout(() => { if (highlighted.value === pid) highlighted.value = null; }, 2600);
}

function tryFromRoute() {
  const q = route.query?.param as string | string[] | undefined;
  const pid = Array.isArray(q) ? q[0] : q;
  if (pid && typeof pid === 'string') scrollToParam(pid);
}

function onScrollTo(ev: Event) {
  const d = (ev as CustomEvent<{ pid: string }>).detail;
  if (d?.pid) scrollToParam(d.pid);
}

const onAnomaly = (ev: Event) => {
  const detail = (ev as CustomEvent<{ paramId: string }>).detail;
  const pid = detail?.paramId;
  if (!pid) return;
  alarmFlags.value = { ...alarmFlags.value, [pid]: true };
  if (alarmTimers[pid]) clearTimeout(alarmTimers[pid]);
  alarmTimers[pid] = window.setTimeout(() => {
    const next = { ...alarmFlags.value };
    delete next[pid];
    alarmFlags.value = next;
  }, 4200);
};

// ESC 关闭抽屉
function onKeyDown(e: KeyboardEvent) {
  if (e.key === 'Escape') {
    if (openAnomalyDrawer.value) openAnomalyDrawer.value = false;
    if (openDosingDrawer.value) openDosingDrawer.value = false;
  }
}

onMounted(() => {
  setTimeout(tryFromRoute, 60);
  window.addEventListener('lab-scroll-to', onScrollTo as EventListener);
  window.addEventListener('lab-anomaly', onAnomaly as EventListener);
  window.addEventListener('keydown', onKeyDown);
  recalcChartHeight();
  window.addEventListener('resize', recalcChartHeight);
});
onBeforeUnmount(() => {
  window.removeEventListener('lab-scroll-to', onScrollTo as EventListener);
  window.removeEventListener('lab-anomaly', onAnomaly as EventListener);
  Object.values(alarmTimers).forEach((t) => clearTimeout(t));
  window.removeEventListener('keydown', onKeyDown);
  window.removeEventListener('resize', recalcChartHeight);
});
watch(() => route.query.param, () => setTimeout(tryFromRoute, 20));

</script>

<style scoped>
/* page shell */
.page {
  min-height: 100vh;
  background: var(--color-background);
  color: var(--color-heading);
}
.page-header {
  position: sticky;
  top: var(--topnav-h, 48px);
  z-index: 10;
  padding: 12px 24px;
  border-bottom: 1px solid var(--color-border);
  backdrop-filter: saturate(120%) blur(6px);
  background: color-mix(in oklab, var(--color-background) 80%, transparent);
  display: flex; align-items: center; justify-content: space-between; gap: 12px;
}
.page-header h1 { font-size: 18px; font-weight: 600; letter-spacing: 0.3px; }
.page-main { padding: 16px 16px; }
@media (min-width: 1024px) { .page-main { padding: 16px 24px; } }

/* 3-column layout */
.layout { display: grid; gap: 16px; grid-template-columns: 1fr; }
@media (min-width: 1024px) {
  .layout { grid-template-columns: 320px minmax(0, 1fr) 340px; align-items: start; }
}

/* cards */
.card {
  border: 1px solid var(--color-border);
  border-radius: 14px;
  background: color-mix(in oklab, var(--color-background) 92%, transparent);
  box-shadow: 0 1px 0 rgba(0,0,0,.05), 0 10px 30px rgba(0,0,0,.05);
  padding: 16px;
}
.card-title { font-size: 16px; font-weight: 700; margin: 0 0 12px; }
.accent-green { color: #34d399; }
.accent-blue { color: #60a5fa; }
.accent-rose { color: #fb7185; }
.divider { height: 1px; background: var(--color-border); margin: 12px -16px; }

.sticky-col { position: sticky; top: calc(var(--topnav-h, 48px) + 24px); height: fit-content; }

.actions { display:flex; align-items:center; gap:8px; }
.open-drawer { appearance:none; border:1px solid #cbd5e1; background:#f8fafc; padding:6px 10px; border-radius:8px; font-size:12px; }
.hint { font-size: 12px; color:#64748b; margin: 6px 0 10px; }
.stack { display:flex; flex-direction: column; }
.gap-8 { gap: 8px; }

/* charts area */
.charts { display: grid; gap: 12px; grid-template-columns: 1fr; }
@media (min-width: 768px) { .charts { grid-template-columns: 1fr 1fr; } }
@media (min-width: 1280px) { .charts { grid-template-columns: 1fr 1fr 1fr; } }
.chart-card {
  border: 1px solid var(--color-border);
  border-radius: 10px;
  background: color-mix(in oklab, var(--color-background) 96%, transparent);
  padding: 8px;
}
.chart-card.is-highlight { border-color: #ef4444; animation: policeCard 1s linear 2; box-shadow: 0 0 0 3px #ef444433, 0 10px 30px #ef444422; }
@keyframes policeCard {
  0%, 100% { box-shadow: 0 0 0 3px #ef444433, 0 10px 30px #ef444422; border-color: #ef4444; }
  25% { box-shadow: 0 0 0 3px #3b82f633, 0 10px 30px #3b82f622; border-color: #3b82f6; }
  50% { box-shadow: 0 0 0 3px #ef444433, 0 10px 30px #ef444422; border-color: #ef4444; }
  75% { box-shadow: 0 0 0 3px #3b82f633, 0 10px 30px #3b82f622; border-color: #3b82f6; }
}

/* 异常时红黄蓝交替条纹背景 + 红绿灯闪烁环 */
.chart-card.is-anomaly-ryb {
  position: relative;
  background-image: repeating-linear-gradient(45deg,
    rgba(239, 68, 68, .18) 0, rgba(239, 68, 68, .18) 12px,
    rgba(234, 179, 8, .18) 12px, rgba(234, 179, 8, .18) 24px,
    rgba(59, 130, 246, .18) 24px, rgba(59, 130, 246, .18) 36px);
  animation: rybShift 1.2s linear infinite;
}
@keyframes rybShift {
  to { background-position: 36px 0; }
}
.chart-card.is-traffic::after {
  content: "";
  position: absolute; inset: -2px; border-radius: 12px;
  border: 2px solid transparent;
  animation: trafficBlink 1.2s ease-in-out infinite;
}
@keyframes trafficBlink {
  0%   { box-shadow: 0 0 0 3px rgba(239,68,68,.40); border-color: rgba(239,68,68,.65); }
  33%  { box-shadow: 0 0 0 3px rgba(234,179,8,.40);  border-color: rgba(234,179,8,.65); }
  66%  { box-shadow: 0 0 0 3px rgba(34,197,94,.40);  border-color: rgba(34,197,94,.65); }
  100% { box-shadow: 0 0 0 3px rgba(239,68,68,.40); border-color: rgba(239,68,68,.65); }
}

/* Drawer */
.drawer { position: fixed; inset: 0; background: rgba(15,23,42,.45); display:flex; justify-content:flex-end; z-index: 1000; }
.drawer-panel { width: min(520px, 96vw); height: 100%; background: color-mix(in oklab, var(--color-background) 96%, transparent); border-left: 1px solid var(--color-border); box-shadow: -10px 0 30px rgba(0,0,0,.2); display:flex; flex-direction:column; }
.drawer-header { display:flex; align-items:center; justify-content: space-between; padding: 12px 16px; border-bottom: 1px solid var(--color-border); }
.drawer-body { padding: 12px 16px; overflow:auto; }
.sub { font-weight: 700; margin: 0 0 8px; }
.ghost { appearance:none; border:1px solid #cbd5e1; background:transparent; padding:6px 10px; border-radius:8px; font-size:12px; }
.filters { display:flex; align-items:center; gap:10px; flex-wrap: wrap; margin-bottom: 10px; }
.filters label { font-size: 12px; color:#475569; display:flex; align-items:center; gap:6px; }
.filters select { border:1px solid #cbd5e1; border-radius:8px; padding:4px 8px; background:#fff; font-size:12px; }
.filters .spacer { flex: 1 1 auto; }

/* Mobile / Tablet tweaks */
@media (max-width: 1023.98px) {
  .sticky-col { position: static; top: auto; }
  .page-main { padding: 12px; }
  .page-header { padding: 10px 12px; }
}
@supports (-webkit-touch-callout: none) {
  /* iOS Safari: 减少滤镜避免覆盖问题 */
  .page-header { backdrop-filter: none; background: color-mix(in oklab, var(--color-background) 92%, transparent); }
}
</style>
