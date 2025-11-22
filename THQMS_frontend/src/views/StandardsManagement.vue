<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useProcessStore } from '@/stores/processQuality'
import { useLabStore } from '@/stores/lab'
import { useStandardsStore, type CustomerStandard } from '@/stores/standards'

const proc = useProcessStore()
const lab = useLabStore()
const std = useStandardsStore()

onMounted(() => std.load())

const processes = computed(() => proc.processes)
const allParams = computed(() => lab.params)

const editing = ref<CustomerStandard | null>(null)

function edit(processId: string, paramId: string) {
  const existing = std.get(processId, paramId)
  editing.value = existing ? { ...existing } : { processId, paramId, target: undefined, lcl: 0, ucl: 0 }
}

function save() {
  if (!editing.value) return
  std.setStandard(editing.value)
  editing.value = null
}

function remove(processId: string, paramId: string) {
  if (confirm('确定删除该标准吗？')) std.removeStandard(processId, paramId)
}

function importJson(ev: Event) {
  const input = ev.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return
  file.text().then(txt => std.importJson(txt))
}

function exportJson() {
  const blob = new Blob([std.exportJson()], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = 'standards.json'
  a.click()
  URL.revokeObjectURL(url)
}
</script>

<template>
  <div class="page">
    <header class="hdr">
      <h2>客户标准管理</h2>
      <div class="ops">
        <input type="file" accept="application/json" @change="importJson" />
        <button @click="exportJson">导出JSON</button>
      </div>
    </header>

    <section class="grid">
      <div class="card" v-for="p in processes" :key="p.id">
        <h3>{{ p.name }}</h3>
        <div class="smallops">
          <button @click="p.relatedParams.forEach(pid => { const prm = allParams.find(x=>x.id===pid); if (prm) std.setStandard({ processId: p.id, paramId: pid, lcl: prm.lcl, ucl: prm.ucl, target: prm.target }) })">一键填充（按实验室参数）</button>
        </div>
        <table>
          <thead>
            <tr>
              <th>参数</th>
              <th>下限</th>
              <th>上限</th>
              <th>目标</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="pid in p.relatedParams" :key="pid">
              <td>{{ allParams.find(x=>x.id===pid)?.name || pid }}</td>
              <td>{{ std.get(p.id, pid)?.lcl ?? '—' }}</td>
              <td>{{ std.get(p.id, pid)?.ucl ?? '—' }}</td>
              <td>{{ std.get(p.id, pid)?.target ?? '—' }}</td>
              <td>
                <button @click="edit(p.id, pid)">编辑</button>
                <button class="danger" @click="remove(p.id, pid)" v-if="std.get(p.id, pid)">删除</button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>

    <dialog v-if="editing" open>
      <form @submit.prevent="save">
        <h4>编辑标准</h4>
        <div class="row"><label>工序</label><span>{{ processes.find(x=>x.id===editing!.processId)?.name }}</span></div>
        <div class="row"><label>参数</label><span>{{ allParams.find(x=>x.id===editing!.paramId)?.name }}</span></div>
        <div class="row"><label>下限</label><input type="number" step="0.01" v-model.number="editing!.lcl" required /></div>
        <div class="row"><label>上限</label><input type="number" step="0.01" v-model.number="editing!.ucl" required /></div>
        <div class="row"><label>目标</label><input type="number" step="0.01" v-model.number="editing!.target" /></div>
        <div class="actions">
          <button type="button" @click="editing=null">取消</button>
          <button type="submit">保存</button>
        </div>
      </form>
    </dialog>
  </div>
</template>

<style scoped>
.page { padding: 16px; display: grid; gap: 16px; }
.hdr { position: sticky; top: var(--topnav-h, 56px); z-index: 20; display:flex; align-items:center; justify-content: space-between; padding: 10px 4px; backdrop-filter: saturate(120%) blur(4px); background: color-mix(in oklab, var(--color-background) 86%, transparent); border-bottom: 1px solid var(--color-border); }
.ops { display:flex; gap: 8px; flex-wrap: wrap; }
.grid { display:grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 12px; }
.card { border: 1px solid var(--color-border); border-radius: 8px; padding: 12px; display: grid; gap: 8px; min-width:0; }
.card table-wrapper { overflow-x: auto; }
table { width: 100%; border-collapse: collapse; overflow-x: auto; display: block; }
thead, tbody, tr { display: table; width: 100%; table-layout: fixed; }
th, td { border-top: 1px solid var(--color-border); padding: 6px 4px; text-align: left; }
dialog { border: 1px solid var(--color-border); border-radius: 8px; padding: 12px; }
.row { display:grid; grid-template-columns: 80px 1fr; gap: 8px; align-items:center; margin: 6px 0; }
.actions { display:flex; justify-content: flex-end; gap: 8px; margin-top: 8px; }
.danger { color: #dc2626; }

@media (max-width: 960px) {
  .page { padding: 12px; }
  .grid { grid-template-columns: 1fr; }
}
@supports (-webkit-touch-callout: none) {
  .hdr { backdrop-filter: none; background: color-mix(in oklab, var(--color-background) 92%, transparent); }
}
</style>
