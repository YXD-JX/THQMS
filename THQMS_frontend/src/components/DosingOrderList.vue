<template>
  <div class="list">
    <DosingOrderCard v-for="o in toShow" :key="o.id" :order="o"
      @approve-qc="approveQc(o.id)" @approve-prod="approveProd(o.id)" @reject="reject(o.id)" />
    <div v-if="toShow.length===0" class="empty">暂无补加单据</div>
  </div>

</template>

<script lang="ts" setup>
import { storeToRefs } from 'pinia'
import { computed } from 'vue'
import { useDosingStore } from '@/stores/dosing'
import DosingOrderCard from './DosingOrderCard.vue'
import type { DosingOrder } from '@/stores/dosing'

const dosing = useDosingStore()
const { orders } = storeToRefs(dosing)
const props = defineProps<{ items?: DosingOrder[] }>()
const toShow = computed(() => props.items ?? orders.value)

function approveQc(id: string) { dosing.approveQc(id, '品质加料员') }
function approveProd(id: string) { dosing.approveProd(id, '生产主管') }
function reject(id: string) { dosing.reject(id) }
</script>

<style scoped>
.list { display: grid; gap: 10px; }
.empty { font-size: 12px; color: #94a3b8; }
</style>
