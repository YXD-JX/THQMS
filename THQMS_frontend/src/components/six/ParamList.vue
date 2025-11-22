<template>
  <aside class="panel left">
    <h3 class="panel-title">参数</h3>
    <ul class="param-list">
      <li v-for="p in lab.params" :key="p.id"
          :class="['param-item', { active: p.id===pid }]"
          @click="$emit('update:pid', p.id)"
          @mousemove="onMove($event, p)" @mouseleave="onLeave">
        <span class="dot" :style="{ background: p.id===pid ? '#3b82f6' : '#94a3b8' }"></span>
        <span class="name">{{ p.name }}</span>
        <span class="spec">{{ p.lcl }}–{{ p.ucl }} {{ p.unit||'' }}</span>
      </li>
    </ul>
    <div v-if="hover.visible" class="tooltip" ref="tt" :style="{ left: hover.x + 'px', top: hover.y + 'px', position: 'fixed' }">
      <div class="tt-name">{{ hover.title }}</div>
      <div class="tt-line" v-for="(line,i) in hover.lines" :key="i">{{ line }}</div>
    </div>
  </aside>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useLabStore, type LabParam } from '@/stores/lab'

const props = defineProps<{ pid: string }>()
const emit = defineEmits<{ (e:'update:pid', v:string): void }>()
const lab = useLabStore()

const tt = ref<HTMLDivElement|null>(null)
const hover = ref<{ visible:boolean; x:number; y:number; title:string; lines:string[] }>({ visible:false, x:0, y:0, title:'', lines:[] })

function placeTooltipFor(el: HTMLElement|null, px: number, py: number) {
  const margin = 12
  const w = el?.offsetWidth ?? 240
  const h = el?.offsetHeight ?? 120
  let x = px + margin
  let y = py + margin
  if (x + w > window.innerWidth - 8) x = px - w - margin
  if (x < 8) x = 8
  if (y + h > window.innerHeight - 8) y = py - h - margin
  if (y < 8) y = 8
  return { x, y }
}

function onMove(ev: MouseEvent, p: LabParam) {
  const arr = lab.meas[p.id] || []
  const last = arr.length ? arr[arr.length-1] : undefined
  const delta = last ? (last.value - p.target) : undefined
  const margin = last ? Math.min(Math.abs(p.ucl - last.value), Math.abs(last.value - p.lcl)) : undefined
  const lines: string[] = []
  lines.push(`规格：LCL=${p.lcl}，Target=${p.target}，UCL=${p.ucl} ${p.unit||''}`)
  if (last) lines.push(`最近：${last.value}${p.unit||''} @ ${new Date(last.ts).toLocaleString('zh-CN',{hour12:false})}`)
  if (delta!=null && Number.isFinite(delta)) lines.push(`中心偏移：${delta>=0?'+':''}${delta.toFixed(3)}${p.unit||''}`)
  if (margin!=null && Number.isFinite(margin)) lines.push(`距最近规格：${margin.toFixed(3)}${p.unit||''}`)
  const pos = placeTooltipFor(tt.value, ev.clientX, ev.clientY)
  hover.value = { visible:true, x: pos.x, y: pos.y, title: p.name, lines }
}
function onLeave() { hover.value.visible=false }
</script>

<script lang="ts">
export default {
  name: 'ParamList',
}
</script>

<style scoped>
.panel { border:1px solid var(--color-border); border-radius:12px; padding:10px; background: color-mix(in oklab, var(--color-background) 92%, transparent); min-width:0; }
.panel-title { margin: 2px 0 8px; font-size: 14px; }
.param-list { list-style:none; margin:0; padding:0; display:flex; flex-direction:column; gap:4px; }
.param-item { display:flex; align-items:center; gap:8px; padding:6px 8px; border-radius:8px; cursor:pointer; }
.param-item:hover { background: #0f172a0a; }
.param-item.active { background:#0ea5ff14; border:1px solid #38bdf8; }
.param-item .dot { width:8px; height:8px; border-radius:999px; display:inline-block; }
.param-item .name { flex: 0 0 auto; font-size: 13px; color:#0f172a; }
.param-item .spec { margin-left:auto; font-size: 12px; color:#64748b; }
.tooltip { position:absolute; pointer-events:none; background: rgba(15,23,42,.95); color:#e2e8f0; border:1px solid #334155; padding:6px 8px; border-radius:8px; font-size:12px; box-shadow: 0 8px 20px rgba(0,0,0,.25); max-width: 50ch; z-index: 20; }
.tt-name { font-weight: 700; margin-bottom: 2px; }
.tt-line { color:#cbd5e1; }
</style>
