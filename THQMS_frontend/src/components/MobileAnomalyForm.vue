<template>
  <div class="mobile">
    <div class="section">
      <label class="label">检测项目</label>
      <div class="picker">
        <select v-model="paramId">
          <option v-for="p in params" :key="p.id" :value="p.id">{{ p.name }} {{ p.unit ? '('+p.unit+')' : '' }}</option>
        </select>
      </div>
    </div>

    <div class="section">
      <label class="label">测量值</label>
      <input class="number" v-model.number="value" type="number" step="any" inputmode="decimal" placeholder="请输入数值" />
      <div class="quick-row">
        <button class="chip" @click="fillNormal">正常</button>
        <button class="chip warn" @click="fillLcl">低于下限</button>
        <button class="chip danger" @click="fillUcl">高于上限</button>
      </div>
    </div>

    <div class="section">
      <button class="btn primary" @click="submit">提交记录</button>
    </div>

    <div class="section inline">
      <label class="switch">
        <input type="checkbox" v-model="autoOutlier" />
        <span class="slider" />
      </label>
      <span class="switch-text">连续异常仿真</span>
    </div>

    <div v-if="lastMsg" class="toast" :class="toastClass">{{ lastMsg }}</div>
  </div>
</template>

<script lang="ts" setup>
import { onMounted, onUnmounted, ref, computed, watchEffect } from 'vue';
import { useLabStore, type LabParam } from '@/stores/lab';

const store = useLabStore();
store.initIfNeeded();

const params = computed<LabParam[]>(() => store.params);
const paramId = ref<string>('');
const value = ref<number | null>(null);
const lastMsg = ref('');
const lastOk = ref(true);
const autoOutlier = ref(false);
let autoTimer: number | undefined;

onMounted(() => {
  if (!paramId.value && params.value.length) paramId.value = params.value[0].id;
});

onUnmounted(() => {
  if (autoTimer) clearInterval(autoTimer);
});

function withParam(cb: (p: LabParam) => void) {
  const p = params.value.find(x => x.id === paramId.value);
  if (!p) return;
  cb(p);
}

function fillNormal() {
  withParam(p => {
    const mid = p.target;
    const jitter = (Math.random() - 0.5) * (p.ucl - p.lcl) / 20;
    value.value = parseFloat((mid + jitter).toFixed(2));
  });
}

function fillLcl() {
  withParam(p => {
    const delta = (p.ucl - p.lcl) / 6 * (1 + Math.random());
    value.value = parseFloat((p.lcl - delta).toFixed(2));
  });
}

function fillUcl() {
  withParam(p => {
    const delta = (p.ucl - p.lcl) / 6 * (1 + Math.random());
    value.value = parseFloat((p.ucl + delta).toFixed(2));
  });
}

function submit() {
  if (!paramId.value || value.value === null || Number.isNaN(value.value)) {
    lastOk.value = false;
    lastMsg.value = '请输入有效数值';
    return;
  }
  store.addMeasurement({ ts: Date.now(), paramId: paramId.value, value: Number(value.value) });
  lastOk.value = true;
  lastMsg.value = '提交成功';
}

// auto outlier simulation
watchAuto();
function watchAuto() {
  watchEffect(() => {
    if (autoOutlier.value) {
      if (autoTimer) clearInterval(autoTimer);
      autoTimer = window.setInterval(() => {
        if (Math.random() < 0.5) fillLcl(); else fillUcl();
        submit();
      }, 2500);
    } else if (autoTimer) {
      clearInterval(autoTimer);
      autoTimer = undefined;
    }
  });
}

const toastClass = computed(() => lastOk.value ? 'ok' : 'err');
</script>

<style scoped>
.mobile { padding: 16px; }
.section { margin-bottom: 16px; }
.section.inline { display: flex; align-items: center; gap: 12px; }
.label { display: block; font-size: 14px; color: var(--color-text); margin-bottom: 8px; }
.picker select { width: 100%; padding: 12px; font-size: 16px; border: 1px solid var(--color-border); border-radius: 10px; background: var(--color-background-soft); }
.number { width: 100%; padding: 14px 12px; font-size: 20px; border: 1px solid var(--color-border); border-radius: 12px; background: var(--color-background-soft); }
.quick-row { display: flex; gap: 8px; margin-top: 10px; flex-wrap: wrap; }
.chip { padding: 8px 12px; font-size: 14px; border-radius: 999px; border: 1px solid var(--color-border); background: rgba(255,255,255,0.04); }
.chip.warn { background: #fff3; color: #c08400; }
.chip.danger { background: #fff2; color: #b91c1c; }
.btn { width: 100%; padding: 14px 12px; font-size: 18px; border-radius: 12px; border: none; }
.btn.primary { background: #2563eb; color: #fff; }

/* switch */
.switch { position: relative; display: inline-block; width: 46px; height: 26px; }
.switch input { opacity: 0; width: 0; height: 0; }
.slider { position: absolute; cursor: pointer; top: 0; left: 0; right: 0; bottom: 0; background-color: #cbd5e1; transition: .2s; border-radius: 999px; }
.slider:before { position: absolute; content: ""; height: 22px; width: 22px; left: 2px; bottom: 2px; background-color: white; transition: .2s; border-radius: 50%; }
.switch input:checked + .slider { background-color: #22c55e; }
.switch input:checked + .slider:before { transform: translateX(20px); }
.switch-text { font-size: 14px; color: var(--color-text); }

.toast { margin-top: 8px; padding: 10px 12px; border-radius: 10px; font-size: 14px; }
.toast.ok { background: #16a34a22; color: #16a34a; border: 1px solid #16a34a55; }
.toast.err { background: #b91c1c22; color: #b91c1c; border: 1px solid #b91c1c55; }
</style>
