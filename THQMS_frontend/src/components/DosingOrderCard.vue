<template>
  <div class="card" :class="cls">
    <div class="row">
      <strong>{{ order.paramName }}</strong>
      <span class="muted">#{{ order.id }}</span>
    </div>
    <div class="sub">异常: {{ order.type }} · 值 {{ order.value }} / 目标 {{ order.target }}</div>
    <div class="rec">建议: {{ order.recommendation.chemical }} {{ order.recommendation.amount }}{{ order.recommendation.unit }}</div>
    <div class="reason">{{ order.recommendation.reason }}</div>
    <div class="ops">
      <button @click="$emit('approve-qc')" :disabled="order.status==='approved-qc' || order.status==='completed'">品质确认</button>
      <button @click="$emit('approve-prod')" :disabled="order.status==='approved-prod' || order.status==='completed'">生产确认</button>
      <button class="ghost" @click="$emit('reject')" :disabled="order.status==='completed'">驳回</button>
    </div>
    <div class="status">状态：{{ humanStatus }}</div>
  </div>
</template>

<script lang="ts" setup>
import { computed } from 'vue'
import type { DosingOrder } from '@/stores/dosing'
const props = defineProps<{ order: DosingOrder }>()
defineEmits(['approve-qc','approve-prod','reject'])
const humanStatus = computed(() => ({
  'pending': '待确认', 'approved-qc': '已品质确认', 'approved-prod': '已生产确认', 'completed': '已完成', 'rejected': '已驳回'
} as const)[props.order.status])
const cls = computed(() => ({ 'sev-high': props.order.severity==='high', 'sev-med': props.order.severity==='medium' }))
</script>

<style scoped>
.card { border:1px solid var(--color-border); border-radius:12px; padding:10px; background: color-mix(in oklab, var(--color-background) 96%, transparent); display:flex; flex-direction:column; gap:6px; }
.row { display:flex; justify-content:space-between; align-items:center; }
.muted { color:#94a3b8; font-size:12px; }
.sub { font-size:12px; color:#64748b; }
.rec { font-weight:600; color:#0ea5e9; }
.reason { font-size:12px; color:#475569; }
.ops { display:flex; gap:8px; }
button { appearance:none; border:1px solid #cbd5e1; background:#f8fafc; padding:6px 10px; border-radius:8px; font-size:12px; }
.ghost { background:transparent; }
.status { font-size:12px; color:#64748b; }
.sev-high { box-shadow: 0 0 0 2px rgba(239,68,68,.2) inset }
.sev-med { box-shadow: 0 0 0 2px rgba(245,158,11,.2) inset }
</style>
