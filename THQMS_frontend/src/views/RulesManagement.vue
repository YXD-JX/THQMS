<template>
  <div class="page">
    <header class="page-header"><h1>规则管理</h1></header>
    <main class="page-main">
      <!-- 参数配置 -->
      <section class="card">
        <h2 class="card-title">实验参数配置（名称/单位/目标/上下限）</h2>
        <div class="tbl">
          <div class="row head">
            <div>ID</div><div>名称</div><div>单位</div><div>目标</div><div>下限</div><div>上限</div><div></div>
          </div>
          <div class="row" v-for="(p, idx) in params" :key="p.id + '-' + idx">
            <input v-model="p.id" class="mono" />
            <input v-model="p.name" />
            <input v-model="p.unit" />
            <input type="number" step="0.01" v-model.number="p.target" />
            <input type="number" step="0.01" v-model.number="p.lcl" />
            <input type="number" step="0.01" v-model.number="p.ucl" />
            <button class="ghost" @click="removeParam(idx)">删除</button>
          </div>
        </div>
        <div class="ops">
          <button @click="addParam">添加参数</button>
          <span class="spacer"></span>
          <button @click="exportParams">导出参数JSON</button>
          <button @click="triggerImportParams">导入参数JSON</button>
          <input ref="paramsFileInput" type="file" accept="application/json" @change="onParamsFileChange" style="display:none" />
          <button @click="resetParams">重置默认参数</button>
          <button @click="saveParams">保存参数</button>
          <button class="primary" @click="applyParams">应用到实验</button>
        </div>
      </section>

      <!-- 参数导入预览（弹窗） -->
      <div v-if="paramsImportPreview" class="modal" role="dialog" aria-modal="true" aria-label="参数导入预览">
        <div class="modal-box warn">
          <h3 class="card-title">参数导入预览</h3>
          <div class="preview">
            <div>新增：{{ paramsImportPreview.added.length }}，删除：{{ paramsImportPreview.removed.length }}，更新：{{ paramsImportPreview.updated.length }}</div>
            <div class="diff-list" v-if="paramsImportPreview.added.length">
              <strong>将新增</strong>
              <ul>
                <li v-for="p in paramsImportPreview.added" :key="'add-'+p.id">+ {{ p.id }} ({{ p.name }})</li>
              </ul>
            </div>
            <div class="diff-list" v-if="paramsImportPreview.removed.length">
              <strong>将删除</strong>
              <ul>
                <li v-for="p in paramsImportPreview.removed" :key="'del-'+p.id">- {{ p.id }} ({{ p.name }})</li>
              </ul>
            </div>
            <div class="diff-list" v-if="paramsImportPreview.updated.length">
              <strong>将更新</strong>
              <ul>
                <li v-for="u in paramsImportPreview.updated" :key="'upd-'+u.id">* {{ u.id }}：
                  <span v-for="c in u.changes" :key="c.field" class="chip">{{ c.field }}: {{ c.from }} → {{ c.to }}</span>
                </li>
              </ul>
            </div>
          </div>
          <div class="ops">
            <button @click="confirmParamsImport('edit')">仅导入到编辑区</button>
            <button @click="confirmParamsImport('save')">导入并保存</button>
            <button class="primary" @click="confirmParamsImport('save-apply')">导入、保存并应用</button>
            <span class="spacer"></span>
            <button class="ghost" @click="cancelParamsImport">取消</button>
          </div>
        </div>
      </div>

      <!-- 补加规则配置（每参数：药品、系数、量上下限、步进、单位） -->
      <section class="card">
        <h2 class="card-title">补加规则配置（工艺/品质）</h2>
        <div class="tips">建议与上方参数 ID 对齐；可为每个参数设置低/高值补加药品、计算系数、最小/最大量与取整步进。</div>
        <div class="tbl">
          <div class="row head">
            <div>参数ID</div><div>低值药品</div><div>高值药品</div><div>系数</div><div>单位</div><div>最小</div><div>最大</div><div>步进</div><div></div>
          </div>
          <div class="row" v-for="(r, k) in rules" :key="k">
            <input v-model="keyBind[k]" @change="onKeyEdit(k, keyBind[k])" class="mono" />
            <input v-model="r.chemLow" />
            <input v-model="r.chemHigh" />
            <input type="number" step="0.01" v-model.number="r.coef" />
            <input v-model="r.unit" />
            <input type="number" step="0.01" v-model.number="r.min" />
            <input type="number" step="0.01" v-model.number="r.max" />
            <input type="number" step="0.01" v-model.number="r.round" />
            <button class="ghost" @click="removeRule(k)">删除</button>
          </div>
        </div>
        <div class="ops">
          <input placeholder="新增参数ID" v-model="newRuleKey" />
          <button @click="addRule">添加规则</button>
          <span class="spacer"></span>
          <button @click="exportRules">导出规则JSON</button>
          <button @click="triggerImportRules">导入规则JSON</button>
          <input ref="rulesFileInput" type="file" accept="application/json" @change="onRulesFileChange" style="display:none" />
          <button @click="resetRules">重置默认规则</button>
          <button class="primary" @click="saveRulesCfg">保存规则</button>
        </div>
      </section>

      <!-- 规则导入预览（弹窗） -->
      <div v-if="rulesImportPreview" class="modal" role="dialog" aria-modal="true" aria-label="规则导入预览">
        <div class="modal-box warn">
          <h3 class="card-title">规则导入预览</h3>
          <div class="preview">
            <div>新增：{{ rulesImportPreview.added.length }}，删除：{{ rulesImportPreview.removed.length }}，更新：{{ rulesImportPreview.updated.length }}</div>
            <div class="diff-list" v-if="rulesImportPreview.added.length">
              <strong>将新增</strong>
              <ul>
                <li v-for="id in rulesImportPreview.added" :key="'radd-'+id">+ {{ id }}</li>
              </ul>
            </div>
            <div class="diff-list" v-if="rulesImportPreview.removed.length">
              <strong>将删除</strong>
              <ul>
                <li v-for="id in rulesImportPreview.removed" :key="'rdel-'+id">- {{ id }}</li>
              </ul>
            </div>
            <div class="diff-list" v-if="rulesImportPreview.updated.length">
              <strong>将更新</strong>
              <ul>
                <li v-for="u in rulesImportPreview.updated" :key="'rupd-'+u.id">* {{ u.id }}：
                  <span v-for="c in u.changes" :key="c.field" class="chip">{{ c.field }}: {{ c.from }} → {{ c.to }}</span>
                </li>
              </ul>
            </div>
          </div>
          <div class="ops">
            <button @click="confirmRulesImport('edit')">仅导入到编辑区</button>
            <button class="primary" @click="confirmRulesImport('save')">导入并保存</button>
            <span class="spacer"></span>
            <button class="ghost" @click="cancelRulesImport">取消</button>
          </div>
        </div>
      </div>

      <!-- 备份/恢复全部配置 -->
      <section class="card">
        <h2 class="card-title">备份 / 恢复全部配置</h2>
        <div class="ops">
          <button @click="exportAll">导出全部配置（参数+规则）</button>
          <button @click="triggerImportAll">导入全部配置</button>
          <input ref="allFileInput" type="file" accept="application/json" @change="onAllFileChange" style="display:none" />
        </div>
        <div class="tips">导入后将生成预览，你可以选择仅写入编辑区、保存，或保存并应用参数。</div>
      </section>
    </main>
  </div>
</template>

<script lang="ts" setup>
import { reactive, toRefs, ref } from 'vue'
import { useLabStore } from '@/stores/lab'
import { loadLabParams, saveLabParams, getDefaultLabParams, type LabParamCfg } from '@/services/labParams'
import { loadRules, saveRules, getDefaultRules, type RulesMap, type RuleEntry } from '@/services/dosingRules'

const lab = useLabStore()

// state
const state = reactive({
  params: structuredClone(loadLabParams()) as LabParamCfg[],
  rules: structuredClone(loadRules()) as RulesMap,
  keyBind: {} as Record<string, string>,
  newRuleKey: '' as string,
  pendingParamsImport: null as LabParamCfg[] | null,
  paramsImportPreview: null as null | { added: LabParamCfg[]; removed: LabParamCfg[]; updated: Array<{ id: string; changes: Array<{ field: keyof LabParamCfg; from: unknown; to: unknown }> }> },
  pendingRulesImport: null as RulesMap | null,
  rulesImportPreview: null as null | { added: string[]; removed: string[]; updated: Array<{ id: string; changes: Array<{ field: keyof RuleEntry; from: unknown; to: unknown }> }> },
})
const { params, rules, keyBind, newRuleKey, paramsImportPreview, rulesImportPreview } = toRefs(state)

// 初始化 keyBind
Object.keys(state.rules).forEach(k => state.keyBind[k] = k)

// 导出/导入（参数）
const paramsFileInput = ref<HTMLInputElement | null>(null)
function exportParams() {
  const blob = new Blob([JSON.stringify(state.params, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url; a.download = 'lab-params.json'; a.click()
  URL.revokeObjectURL(url)
}
function triggerImportParams() { paramsFileInput.value?.click() }
function onParamsFileChange(e: Event) {
  const input = e.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return
  const reader = new FileReader()
  reader.onload = () => {
    try {
      const data = JSON.parse(String(reader.result)) as unknown
      const res = validateParams(data)
      if (res.ok) {
  state.pendingParamsImport = data as LabParamCfg[]
  state.paramsImportPreview = diffParams(state.params, state.pendingParamsImport)
      } else {
        alert(`导入参数失败：\n- ${res.errors.join('\n- ')}`)
      }
    } catch { /* ignore */ }
    input.value = ''
  }
  reader.readAsText(file)
}

// 参数操作
function addParam() {
  state.params.push({ id: '', name: '', unit: '', target: 0, lcl: 0, ucl: 0 })
}
function removeParam(idx: number) { state.params.splice(idx, 1) }
function resetParams() { state.params = Object.assign(state.params, getDefaultLabParams()) }
function saveParams() { saveLabParams(state.params) }
function applyParams() {
  saveParams()
  // 应用到运行中的实验：停止模拟、用新参数重置序列
  lab.stopSimulation()
  lab.$patch({
    params: structuredClone(state.params),
    series: {},
    times: [],
    anomalies: []
  })
  lab.initIfNeeded()
}

// 规则操作
function addRule() {
  const k = state.newRuleKey.trim()
  if (!k || state.rules[k]) return
  state.rules[k] = { chemLow: '药剂A', chemHigh: '纯水', coef: 0.6, unit: 'L', min: 0.1, max: 10, round: 0.1 } as RuleEntry
  state.keyBind[k] = k
  state.newRuleKey = ''
}
function removeRule(k: string) { delete state.rules[k]; delete state.keyBind[k] }
function resetRules() { state.rules = Object.assign(state.rules, getDefaultRules()); state.keyBind = Object.fromEntries(Object.keys(state.rules).map(k=>[k,k])) as Record<string,string> }
function saveRulesCfg() { saveRules(state.rules) }
function onKeyEdit(oldKey: string, newKey: string) {
  const nk = newKey.trim(); if (!nk || nk === oldKey) return
  if (state.rules[nk]) return // 已存在
  state.rules[nk] = state.rules[oldKey]
  delete state.rules[oldKey]
  delete state.keyBind[oldKey]
  state.keyBind[nk] = nk
}

// 导出/导入（规则）
const rulesFileInput = ref<HTMLInputElement | null>(null)
function exportRules() {
  const blob = new Blob([JSON.stringify(state.rules, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url; a.download = 'dosing-rules.json'; a.click()
  URL.revokeObjectURL(url)
}
function triggerImportRules() { rulesFileInput.value?.click() }
function onRulesFileChange(e: Event) {
  const input = e.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return
  const reader = new FileReader()
  reader.onload = () => {
    try {
      const raw = JSON.parse(String(reader.result)) as unknown
      const res = validateRules(raw)
      if (res.ok) {
        state.pendingRulesImport = raw as RulesMap
        state.rulesImportPreview = diffRules(state.rules, state.pendingRulesImport)
      } else {
        alert(`导入规则失败：\n- ${res.errors.join('\n- ')}`)
      }
    } catch { /* ignore */ }
    input.value = ''
  }
  reader.readAsText(file)
}

// 预览差异 - 参数
function diffParams(cur: LabParamCfg[], incoming: LabParamCfg[]) {
  const curMap = new Map(cur.map(x => [x.id, x]))
  const incMap = new Map(incoming.map(x => [x.id, x]))
  const added: LabParamCfg[] = []
  const removed: LabParamCfg[] = []
  const updated: Array<{ id: string; changes: Array<{ field: keyof LabParamCfg; from: unknown; to: unknown }> }> = []
  incMap.forEach((v, id) => { if (!curMap.has(id)) added.push(v) })
  curMap.forEach((v, id) => { if (!incMap.has(id)) removed.push(v) })
  curMap.forEach((v, id) => {
    const nv = incMap.get(id); if (!nv) return
    const fields: (keyof LabParamCfg)[] = ['name','unit','target','lcl','ucl']
    const changes: Array<{ field: keyof LabParamCfg; from: unknown; to: unknown }> = []
    fields.forEach(f => { if (v[f] !== nv[f]) changes.push({ field: f, from: v[f], to: nv[f] }) })
    if (changes.length) updated.push({ id, changes })
  })
  return { added, removed, updated }
}

// 预览差异 - 规则
function diffRules(cur: RulesMap, incoming: RulesMap) {
  const curKeys = new Set(Object.keys(cur))
  const incKeys = new Set(Object.keys(incoming))
  const added = [...incKeys].filter(k => !curKeys.has(k))
  const removed = [...curKeys].filter(k => !incKeys.has(k))
  const updated: Array<{ id: string; changes: Array<{ field: keyof RuleEntry; from: unknown; to: unknown }> }> = []
  const fields: (keyof RuleEntry)[] = ['chemLow','chemHigh','coef','unit','min','max','round']
  ;[...curKeys].forEach(id => {
    if (!incKeys.has(id)) return
    const a = cur[id] as RuleEntry, b = incoming[id] as RuleEntry
    const changes: Array<{ field: keyof RuleEntry; from: unknown; to: unknown }> = []
    fields.forEach(f => { if (a[f] !== b[f]) changes.push({ field: f, from: a[f], to: b[f] }) })
    if (changes.length) updated.push({ id, changes })
  })
  return { added, removed, updated }
}

// 确认/取消 - 参数导入
function confirmParamsImport(mode: 'edit' | 'save' | 'save-apply') {
  if (!state.pendingParamsImport) return
  state.params = structuredClone(state.pendingParamsImport)
  if (mode === 'save' || mode === 'save-apply') saveParams()
  if (mode === 'save-apply') applyParams()
  cancelParamsImport()
}
function cancelParamsImport() { state.pendingParamsImport = null; state.paramsImportPreview = null }

// 确认/取消 - 规则导入
function confirmRulesImport(mode: 'edit' | 'save') {
  if (!state.pendingRulesImport) return
  state.rules = structuredClone(state.pendingRulesImport)
  state.keyBind = Object.fromEntries(Object.keys(state.rules).map(k=>[k,k])) as Record<string,string>
  if (mode === 'save') saveRulesCfg()
  cancelRulesImport()
}
function cancelRulesImport() { state.pendingRulesImport = null; state.rulesImportPreview = null }

// 全量备份/恢复
const allFileInput = ref<HTMLInputElement | null>(null)
function exportAll() {
  const payload = { params: state.params, rules: state.rules }
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url; a.download = 'thqms-config-backup.json'; a.click()
  URL.revokeObjectURL(url)
}
function triggerImportAll() { allFileInput.value?.click() }
function onAllFileChange(e: Event) {
  const input = e.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return
  const reader = new FileReader()
  reader.onload = () => {
    try {
      const raw = JSON.parse(String(reader.result)) as unknown
      if (!raw || typeof raw !== 'object') { alert('备份文件格式不正确'); input.value=''; return }
      const o = raw as { params?: unknown; rules?: unknown }
      const pe = o.params ? validateParams(o.params) : { ok: true, errors: [] }
      const re = o.rules ? validateRules(o.rules) : { ok: true, errors: [] }
      if (!pe.ok || !re.ok) {
        const msgs = [...pe.errors, ...re.errors]
        alert(`导入失败：\n- ${msgs.join('\n- ')}`)
      } else {
        if (o.params) {
          state.pendingParamsImport = o.params as LabParamCfg[]
          state.paramsImportPreview = diffParams(state.params, state.pendingParamsImport)
        }
        if (o.rules) {
          state.pendingRulesImport = o.rules as RulesMap
          state.rulesImportPreview = diffRules(state.rules, state.pendingRulesImport)
        }
        alert('备份文件解析成功，已生成预览，请下滑查看并确认导入')
      }
    } catch { /* ignore */ }
    input.value = ''
  }
  reader.readAsText(file)
}

// 校验：参数
function validateParams(data: unknown): { ok: boolean; errors: string[] } {
  const errors: string[] = []
  if (!Array.isArray(data)) {
    return { ok: false, errors: ['JSON 顶层必须是数组'] }
  }
  data.forEach((p, i) => {
    if (typeof p !== 'object' || p === null) { errors.push(`#${i} 非对象`); return }
    const o = p as Partial<LabParamCfg>
    if (!o.id || typeof o.id !== 'string') errors.push(`#${i} 缺少/非法 id`)
    if (!o.name || typeof o.name !== 'string') errors.push(`#${i} 缺少/非法 name`)
    if (o.unit !== undefined && typeof o.unit !== 'string') errors.push(`#${i} unit 必须为字符串或省略`)
    ;(['target','lcl','ucl'] as const).forEach(k => {
      const val = o[k]
      if (typeof val !== 'number' || Number.isNaN(val)) errors.push(`#${i} ${k} 必须为数字`)
    })
    if (typeof o.lcl === 'number' && typeof o.ucl === 'number' && o.lcl > o.ucl) errors.push(`#${i} 下限不得大于上限`)
    if (typeof o.target === 'number' && typeof o.lcl === 'number' && typeof o.ucl === 'number') {
      if (o.target < o.lcl || o.target > o.ucl) errors.push(`#${i} 目标应在上下限范围内`)
    }
  })
  return { ok: errors.length === 0, errors }
}

// 校验：规则
function validateRules(data: unknown): { ok: boolean; errors: string[] } {
  const errors: string[] = []
  if (!data || typeof data !== 'object') return { ok: false, errors: ['JSON 顶层必须为对象（键为参数ID）'] }
  const obj = data as Record<string, unknown>
  Object.entries(obj).forEach(([k, v]) => {
    if (!v || typeof v !== 'object') { errors.push(`${k}: 规则必须为对象`); return }
    const r = v as { chemLow?: unknown; chemHigh?: unknown; coef?: unknown; unit?: unknown; min?: unknown; max?: unknown; round?: unknown }
    if (!r.chemLow || typeof r.chemLow !== 'string') errors.push(`${k}: chemLow 必须为字符串`)
    if (!r.chemHigh || typeof r.chemHigh !== 'string') errors.push(`${k}: chemHigh 必须为字符串`)
    if (typeof r.coef !== 'number' || !(r.coef > 0)) errors.push(`${k}: coef 必须为正数`)
    if (!r.unit || typeof r.unit !== 'string') errors.push(`${k}: unit 必须为字符串`)
    if (typeof r.min !== 'number' || Number.isNaN(r.min)) errors.push(`${k}: min 必须为数字`)
    if (typeof r.max !== 'number' || Number.isNaN(r.max)) errors.push(`${k}: max 必须为数字`)
    if (typeof r.round !== 'number' || !(r.round > 0)) errors.push(`${k}: round 必须为正数`)
    if (typeof r.min === 'number' && typeof r.max === 'number' && r.min > r.max) errors.push(`${k}: min 不得大于 max`)
  })
  return { ok: errors.length === 0, errors }
}
</script>

<style scoped>
.page-header { position: sticky; top: var(--topnav-h, 56px); z-index: 20; padding: 12px 16px; border-bottom: 1px solid var(--color-border); backdrop-filter: saturate(120%) blur(4px); background: color-mix(in oklab, var(--color-background) 84%, transparent); }
.page-main { padding: 16px; display: grid; gap: 16px; }
.card { border: 1px solid var(--color-border); border-radius: 14px; padding: 16px; background: color-mix(in oklab, var(--color-background) 92%, transparent); }
.card-title { font-size: 16px; font-weight: 700; margin: 0 0 12px; }
.tbl { display: grid; gap: 6px; overflow-x: auto; }
.row { display: grid; grid-template-columns: 120px 160px 100px 100px 100px 100px 80px; gap: 6px; align-items: center; min-width: 860px; }
.head { font-weight: 600; color: #475569; }
input { border: 1px solid #cbd5e1; border-radius: 8px; padding: 6px 8px; background: #f8fafc; }
.ops { display:flex; gap:8px; align-items:center; margin-top: 10px; }
.spacer { flex:1 }
button { appearance:none; border:1px solid #cbd5e1; background:#f8fafc; padding:6px 10px; border-radius:8px; font-size:12px; }
.primary { background:#0ea5e9; color:white; border-color:#0284c7 }
.ghost { background:transparent }
.mono { font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace; }
.warn { border-color: #f59e0b; background: color-mix(in oklab, #f59e0b 8%, var(--color-background)); }
.preview { display: grid; gap: 6px; font-size: 12px; color: #334155 }
.diff-list ul { margin: 4px 0 0 16px; padding: 0 }
.chip { display:inline-block; margin-right:6px; padding:2px 6px; border-radius:999px; background:#e2e8f0; }
.modal { position: fixed; inset: 0; background: rgba(15, 23, 42, .45); display:flex; align-items:center; justify-content:center; z-index: 1000; }
.modal-box { width: min(920px, 92vw); max-height: 86vh; overflow:auto; border-radius:14px; border:1px solid var(--color-border); background: color-mix(in oklab, var(--color-background) 96%, transparent); padding: 16px; box-shadow: 0 20px 60px rgba(0,0,0,.25); }

@media (max-width: 960px) {
  .page-main { padding: 12px; }
  .row { min-width: 780px; }
}
@supports (-webkit-touch-callout: none) {
  .page-header { backdrop-filter: none; background: color-mix(in oklab, var(--color-background) 92%, transparent); }
}
</style>
