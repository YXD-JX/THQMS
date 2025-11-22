<template>
  <div class="space-y-3">
    <div class="flex items-center gap-2">
      <label class="w-28">参数</label>
      <select v-model="paramId" class="border rounded px-2 py-1">
        <option v-for="p in params" :key="p.id" :value="p.id">{{ p.name }} ({{ p.unit || '-' }})</option>
      </select>
    </div>
    <div class="flex items-center gap-2">
      <label class="w-28">数值</label>
      <input v-model.number="value" type="number" step="any" class="border rounded px-2 py-1" />
    </div>
    <div class="flex gap-2">
      <button class="px-3 py-1 rounded bg-green-600 text-white" @click="submit">提交</button>
      <button class="px-3 py-1 rounded bg-blue-600 text-white" @click="startSim">启动仿真</button>
      <button class="px-3 py-1 rounded bg-gray-600 text-white" @click="stopSim">停止仿真</button>
      <button class="px-3 py-1 rounded bg-amber-600 text-white" @click="seedOutlier">注入异常</button>
    </div>
  </div>
</template>

<script lang="ts" setup>
import { ref, computed } from 'vue';
import { useLabStore } from '../stores/lab';

const store = useLabStore();
const params = computed(() => store.params);
const paramId = ref(params.value[0]?.id || 'cu');
const value = ref<number>(0);

function submit() {
  if (!paramId.value) return;
  store.addMeasurement({ ts: Date.now(), paramId: paramId.value, value: Number(value.value) });
}
function startSim() { store.startSimulation(); }
function stopSim() { store.stopSimulation(); }
function seedOutlier() {
  const p = store.getParamById(paramId.value);
  if (!p) return;
  const v = Math.random() < 0.5 ? p.lcl - (p.ucl - p.lcl) * 0.5 : p.ucl + (p.ucl - p.lcl) * 0.5;
  store.addMeasurement({ ts: Date.now(), paramId: paramId.value, value: Number(v.toFixed(2)) });
}
</script>

<style scoped>
</style>
