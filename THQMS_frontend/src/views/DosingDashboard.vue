<template>
  <div class="page">
    <header class="page-header">
      <h1>补加药水单据 · 审批与执行</h1>
      <div class="actions">
        <button class="link" @click="undoBatch">撤销最近批量</button>
      </div>
    </header>
    <main class="page-main">
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
          <select v-model="sortBy">
            <option value="time-desc">时间 新→旧</option>
            <option value="time-asc">时间 旧→新</option>
            <option value="sev-desc">严重度 高→低</option>
            <option value="sev-asc">严重度 低→高</option>
          </select>
        </label>
      </div>
      <div class="cols">
        <section class="card">
          <h2 class="card-title">待处理</h2>
          <DosingOrderList :items="pendingFiltered" />
        </section>
        <section class="card">
          <h2 class="card-title">已完成</h2>
          <DosingOrderList :items="completedFiltered" />
        </section>
        <section class="card">
          <h2 class="card-title">已驳回</h2>
          <DosingOrderList :items="rejectedFiltered" />
        </section>
      </div>
    </main>
  </div>

</template>

<script lang="ts" setup>
import { computed, onMounted, ref } from 'vue'
import { storeToRefs } from 'pinia'
import DosingOrderList from '@/components/DosingOrderList.vue'
import { useDosingStore } from '@/stores/dosing'
import { useLabStore } from '@/stores/lab'
import { useNotiStore } from '@/stores/notifications'

const dosing = useDosingStore()
onMounted(() => dosing.initIfNeeded())
const { orders } = storeToRefs(dosing)
const pending = computed(() => orders.value.filter(o => o.status==='pending' || o.status==='approved-qc' || o.status==='approved-prod'))
const completed = computed(() => orders.value.filter(o => o.status==='completed'))
const rejected = computed(() => orders.value.filter(o => o.status==='rejected'))

// 过滤与排序控件
const store = useLabStore();
store.initIfNeeded();
const params = computed(() => store.params);
const filterParam = ref<string>('');
const filterMinutes = ref<number>(0);
const filterSeverity = ref<string>('');
const sortBy = ref<'time-desc'|'time-asc'|'sev-desc'|'sev-asc'>('time-desc');

function sortOrders(arr: typeof orders.value) {
  const pid = filterParam.value;
  const minAgo = filterMinutes.value;
  const sev = filterSeverity.value as '' | 'low' | 'medium' | 'high';
  const since = minAgo > 0 ? Date.now() - minAgo * 60_000 : 0;
  const list = arr.filter(o => (!pid || o.paramId === pid)
    && (!since || o.ts >= since)
    && (!sev || o.severity === sev));
  list.sort((a, b) => {
    if (sortBy.value === 'time-asc') return a.ts - b.ts;
    if (sortBy.value === 'time-desc') return b.ts - a.ts;
    const score = (s: 'low'|'medium'|'high') => s === 'high' ? 3 : s === 'medium' ? 2 : 1;
    const da = score(a.severity), db = score(b.severity);
    return sortBy.value === 'sev-asc' ? (da - db) : (db - da);
  });
  return list;
}

const pendingFiltered = computed(() => sortOrders(pending.value))
const completedFiltered = computed(() => sortOrders(completed.value))
const rejectedFiltered = computed(() => sortOrders(rejected.value))

const ns = useNotiStore();
function undoBatch() {
  const b = dosing.lastBatch;
  if (!b) {
    ns.push({ id: `no-undo-${Date.now()}`, title: '没有可撤销的批量操作', ts: Date.now(), severity: 'low' }, 2200);
    return;
  }
  const cnt = b.items.length;
  dosing.undoLastBatch();
  ns.push({ id: `undone-${Date.now()}`, title: `已撤销最近批量（${cnt} 条）`, ts: Date.now(), severity: 'low' }, 3000);
}
</script>

<style scoped>
.page { min-height: 100vh; }
.page-header { position: sticky; top: 0; z-index: 10; padding: 12px 24px; border-bottom: 1px solid var(--color-border); backdrop-filter: saturate(120%) blur(6px); background: color-mix(in oklab, var(--color-background) 80%, transparent); display:flex; align-items:center; justify-content:space-between; gap:12px; }
.page-header h1 { font-size: 18px; font-weight: 600; }
.page-main { padding: 16px; }
.actions .link { appearance: none; border: 1px solid rgba(148,163,184,.35); background: transparent; color: #93c5fd; padding: 4px 8px; border-radius: 8px; font-size: 12px; }
.filters { display:flex; align-items:center; gap:10px; flex-wrap: wrap; margin-bottom: 12px; }
.filters label { font-size: 12px; color:#475569; display:flex; align-items:center; gap:6px; }
.filters select { border:1px solid #cbd5e1; border-radius:8px; padding:4px 8px; background:#fff; font-size:12px; }
.cols { display: grid; grid-template-columns: repeat(1, minmax(0, 1fr)); gap: 14px; }
.card { border: 1px solid var(--color-border); border-radius: 14px; background: color-mix(in oklab, var(--color-background) 92%, transparent); box-shadow: 0 1px 0 rgba(0,0,0,.05), 0 10px 30px rgba(0,0,0,.05); padding: 16px; }
.card-title { font-size: 16px; font-weight: 700; margin: 0 0 12px; }

@media (min-width: 960px) {
  .cols { grid-template-columns: repeat(3, minmax(0, 1fr)); }
}
</style>
