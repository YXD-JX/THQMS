<template>
  <div class="page">
    <header class="page-header"><h1>补加规则配置</h1></header>
    <main class="page-main">
      <section class="card">
        <h2 class="card-title">参数规则</h2>
        <div class="tbl">
          <div class="head row">
            <div>参数ID</div><div>低值药品</div><div>高值药品</div><div>系数</div><div>单位</div><div>最小</div><div>最大</div><div>步进</div><div></div>
          </div>
          <div class="row" v-for="(r, k) in localRules" :key="k">
            <div>{{ k }}</div>
            <input v-model="r.chemLow" />
            <input v-model="r.chemHigh" />
            <input type="number" step="0.01" v-model.number="r.coef" />
            <input v-model="r.unit" />
            <input type="number" step="0.01" v-model.number="r.min" />
            <input type="number" step="0.01" v-model.number="r.max" />
            <input type="number" step="0.01" v-model.number="r.round" />
            <button class="ghost" @click="removeKey(k)">删除</button>
          </div>
        </div>
        <div class="ops">
          <input placeholder="新增参数ID" v-model="newKey" />
          <button @click="addKey">添加参数</button>
          <span class="spacer"></span>
          <button @click="reset">重置为默认</button>
          <button class="primary" @click="save">保存</button>
        </div>
      </section>
    </main>
  </div>
</template>

<script lang="ts" setup>
import { reactive, toRefs } from 'vue'
import { loadRules, saveRules, getDefaultRules, type RulesMap, type RuleEntry } from '@/services/dosingRules'

const state = reactive({
  localRules: structuredClone(loadRules()) as RulesMap,
  newKey: '' as string,
})
const { localRules, newKey } = toRefs(state)

function addKey() {
  const k = newKey.value.trim()
  if (!k || localRules.value[k]) return
  localRules.value[k] = { chemLow: '药剂A', chemHigh: '纯水', coef: 0.6, unit: 'L', min: 0.1, max: 10, round: 0.1 } as RuleEntry
  newKey.value = ''
}
function removeKey(k: string) { delete localRules.value[k] }
function reset() { state.localRules = Object.assign(state.localRules, getDefaultRules()) }
function save() { saveRules(localRules.value) }
</script>

<style scoped>
.page-header { position: sticky; top: 0; z-index: 10; padding: 12px 24px; border-bottom: 1px solid var(--color-border); backdrop-filter: saturate(120%) blur(6px); background: color-mix(in oklab, var(--color-background) 80%, transparent); }
.page-main { padding: 16px; }
.card { border: 1px solid var(--color-border); border-radius: 14px; padding: 16px; background: color-mix(in oklab, var(--color-background) 92%, transparent); }
.card-title { font-size: 16px; font-weight: 700; margin: 0 0 12px; }
.tbl { display: grid; gap: 6px; }
.row { display: grid; grid-template-columns: 100px 120px 120px 80px 80px 80px 80px 80px 80px; gap: 6px; align-items: center; }
.head { font-weight: 600; color: #475569; }
input { border: 1px solid #cbd5e1; border-radius: 8px; padding: 6px 8px; background: #f8fafc; }
.ops { display:flex; gap:8px; align-items:center; margin-top: 10px; }
.spacer { flex:1 }
button { appearance:none; border:1px solid #cbd5e1; background:#f8fafc; padding:6px 10px; border-radius:8px; font-size:12px; }
.primary { background:#0ea5e9; color:white; border-color:#0284c7 }
.ghost { background:transparent }
</style>
