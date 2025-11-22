<template>
  <div class="page">
    <header class="page-header">
      <h1>3D 热力图 · 实验参数动态可视化</h1>
      <div class="actions">
        <label class="hint">
          列数
          <input type="number" v-model.number="cols" min="16" max="200" step="4" style="width:80px" />
        </label>
        <label class="hint" style="display:flex;align-items:center;gap:6px;">
          <input type="checkbox" v-model="autoRotate" /> 自动旋转
        </label>
        <label class="hint" style="display:flex;align-items:center;gap:6px;">
          <input type="checkbox" v-model="followSim" /> 跟随实验室仿真
        </label>
        <button class="link" @click="toggleSim">{{ labRunning ? '停止' : '启动' }}仿真</button>
      </div>
    </header>
    <main class="page-main">
      <div ref="container" class="viewport"></div>
      <div v-if="hover.visible" class="tooltip" ref="tt" :style="{ left: hover.x + 'px', top: hover.y + 'px', position: 'fixed' }">
        <div class="tt-name">{{ hover.paramName }}</div>
        <div class="tt-line">值：{{ hover.valueText }}</div>
        <div class="tt-line">状态：{{ hover.stateText }}</div>
        <div class="tt-line">偏差：{{ hover.deviationText }}</div>
        <div class="tt-line">裕度：{{ hover.marginText }}</div>
        <div class="tt-line">时间：{{ hover.timeText }}</div>
      </div>
      <div class="legend">
        <div class="row" v-for="p in params" :key="p.id">
          <span class="name">{{ p.name }}</span>
          <span class="range">{{ p.lcl }} - {{ p.target }} - {{ p.ucl }} {{ p.unit || '' }}</span>
        </div>
        <div class="row">
          <span class="name">颜色含义</span>
          <span class="range">
            <i class="chip" style="--c:#3b82f6"></i> 低于下限
            <i class="chip" style="--c:#10b981"></i> 接近目标
            <i class="chip" style="--c:#ef4444"></i> 高于上限
          </span>
        </div>
      </div>
    </main>
  </div>

</template>

<script setup lang="ts">
import * as THREE from 'three'
import { onMounted, onBeforeUnmount, ref, watch, computed } from 'vue'
import { storeToRefs } from 'pinia'
import { useLabStore, type LabParam } from '@/stores/lab'

const lab = useLabStore()
lab.initIfNeeded()
const { params } = storeToRefs(lab)

const container = ref<HTMLDivElement | null>(null)
const tt = ref<HTMLDivElement | null>(null)
let renderer: THREE.WebGLRenderer | null = null
let scene: THREE.Scene | null = null
let camera: THREE.PerspectiveCamera | null = null
let animationId = 0
let gridGroup: THREE.Group | null = null
const raycaster = new THREE.Raycaster()
const mouse = new THREE.Vector2()

// env flags
function getMaxTouchPoints(): number {
  // Most modern browsers expose navigator.maxTouchPoints; fallback to 0
  return (navigator as Navigator & { maxTouchPoints?: number }).maxTouchPoints ?? 0
}
const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) ||
  (navigator.platform === 'MacIntel' && getMaxTouchPoints() > 1)

// controls
const cols = ref<number>(48)
const cellSize = ref<number>(0.35)
const gap = 0.06
const autoRotate = ref<boolean>(true)
const followSim = ref<boolean>(true)

const labRunning = computed(() => !!lab.simTimer)
function toggleSim() {
  if (lab.simTimer) lab.stopSimulation();
  else lab.startSimulation(2000)
}

// helpers: color mapping by value-vs-spec
function colorFor(p: LabParam, v?: number): THREE.Color {
  const c = new THREE.Color('#94a3b8') // neutral slate
  if (typeof v !== 'number') return c
  if (v < p.lcl) {
    // map to blue range by distance below LCL
    const t = Math.min(1, (p.lcl - v) / ((p.ucl - p.lcl) / 3))
    return c.setHSL(0.58, 0.8, 0.45 + 0.2 * (1 - t)) // blue-ish
  }
  if (v > p.ucl) {
    const t = Math.min(1, (v - p.ucl) / ((p.ucl - p.lcl) / 3))
    return c.setHSL(0.0, 0.8, 0.45 + 0.2 * (1 - t)) // red-ish
  }
  // within limits → green towards target proximity
  // closer to target → brighter green
  const span = (p.ucl - p.lcl)
  const mid = p.target
  const t = 1 - Math.min(1, Math.abs(v - mid) / (span / 2))
  return c.setHSL(0.35, 0.8, 0.35 + 0.3 * t) // green-ish
}

// build grid meshes
type Cell = { mesh: THREE.Mesh<THREE.PlaneGeometry, THREE.MeshStandardMaterial>; paramId: string; index: number }
let cells: Cell[] = []

function buildScene() {
  if (!container.value) return
  const w = container.value.clientWidth
  const h = container.value.clientHeight
  renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' })
  // Cap DPR to improve mobile performance
  const dprCap = window.innerWidth < 768 ? (isIOS ? 1.5 : 2) : 2
  renderer.setPixelRatio(Math.min(dprCap, window.devicePixelRatio || 1))
  renderer.setSize(w, h)
  container.value.appendChild(renderer.domElement)

  scene = new THREE.Scene()
  scene.background = new THREE.Color('#0b1220')

  camera = new THREE.PerspectiveCamera(55, w / h, 0.1, 100)
  camera.position.set(0, 6, 6)
  camera.lookAt(0, 0, 0)

  const hemi = new THREE.HemisphereLight(0xffffff, 0x334155, 0.8)
  scene.add(hemi)
  const dir = new THREE.DirectionalLight(0xffffff, 0.6)
  dir.position.set(5, 10, 4)
  scene.add(dir)

  gridGroup = new THREE.Group()
  scene.add(gridGroup)

  rebuildGrid()

  window.addEventListener('resize', onResize)
  window.addEventListener('lab-anomaly', onAnomaly as EventListener)
  container.value?.addEventListener('mousemove', onMouseMove)
  container.value?.addEventListener('mouseleave', onMouseLeave)
  // touch support for hover on mobile
  container.value?.addEventListener('touchstart', onTouchMove, { passive: true })
  container.value?.addEventListener('touchmove', onTouchMove, { passive: true })
  container.value?.addEventListener('touchend', () => { hover.value.visible = false }, { passive: true })
  loop()
}

function clearScene() {
  window.removeEventListener('resize', onResize)
  window.removeEventListener('lab-anomaly', onAnomaly as EventListener)
  if (animationId) cancelAnimationFrame(animationId)
  if (gridGroup) {
    gridGroup.traverse((obj: THREE.Object3D) => {
      if (obj instanceof THREE.Mesh) {
        obj.geometry.dispose()
        if (Array.isArray(obj.material)) obj.material.forEach(m => m.dispose())
        else obj.material.dispose()
      } else if (obj instanceof THREE.Line) {
        obj.geometry.dispose()
        if (Array.isArray(obj.material)) obj.material.forEach(m => m.dispose())
        else obj.material.dispose()
      } else if (obj instanceof THREE.Points) {
        obj.geometry.dispose()
        if (Array.isArray(obj.material)) obj.material.forEach(m => m.dispose())
        else obj.material.dispose()
      }
    })
  }
  if (renderer) { renderer.dispose(); if (renderer.domElement.parentElement) renderer.domElement.parentElement.removeChild(renderer.domElement) }
  renderer = null; scene = null; camera = null; gridGroup = null; cells = []
}

function onResize() {
  if (!container.value || !renderer || !camera) return
  const w = container.value.clientWidth
  const h = container.value.clientHeight
  renderer.setSize(w, h)
  camera.aspect = w / h
  camera.updateProjectionMatrix()
}

function rebuildGrid() {
  if (!scene || !gridGroup) return
  // remove old
  while (gridGroup.children.length) gridGroup.remove(gridGroup.children[0])
  cells = []

  const rows = params.value.length
  const totalW = cols.value * (cellSize.value + gap) - gap
  const totalH = rows * (cellSize.value + gap) - gap
  const x0 = -totalW / 2 + cellSize.value / 2
  const z0 = -totalH / 2 + cellSize.value / 2

  for (let r = 0; r < rows; r++) {
    const p = params.value[r]
    for (let c = 0; c < cols.value; c++) {
      const geom = new THREE.PlaneGeometry(cellSize.value, cellSize.value)
      const mat = new THREE.MeshStandardMaterial({ color: '#1f2937', metalness: 0.1, roughness: 0.8, side: THREE.DoubleSide })
      const mesh = new THREE.Mesh(geom, mat)
      mesh.rotation.x = -Math.PI / 2
      mesh.position.x = x0 + c * (cellSize.value + gap)
      mesh.position.z = z0 + r * (cellSize.value + gap)
      gridGroup.add(mesh)
      cells.push({ mesh, paramId: p.id, index: c })
    }
  }

  // ground grid
  const gg = new THREE.GridHelper(Math.max(totalW, totalH) + 2, 20, 0x1f2937, 0x111827)
  gridGroup.add(gg)
}

// get value for param at column index (from newest to oldest)
function valueAt(paramId: string, c: number): number | undefined {
  const arr = lab.meas[paramId] || []
  if (!arr.length) return undefined
  const idxFromNewest = cols.value - 1 - c
  const i = Math.max(0, arr.length - 1 - idxFromNewest)
  return arr[i]?.value
}

let lastUpdate = 0
function updateColors() {
  const totalCount = Object.values(lab.meas).reduce((sum, a) => sum + (a?.length || 0), 0)
  if (totalCount === lastUpdate) return
  lastUpdate = totalCount
  // update cell colors
  for (const cell of cells) {
    const p = params.value.find(x => x.id === cell.paramId)
    if (!p) continue
    const v = valueAt(cell.paramId, cell.index)
    const col = colorFor(p, v)
    cell.mesh.material.color.copy(col)
    // small height/tilt for effect
    const amp = v == null ? 0 : Math.max(0, Math.min(1, Math.abs(v - p.target) / ((p.ucl - p.lcl) / 2)))
    cell.mesh.position.y = 0.02 + amp * 0.12
  }
}

// pulse on anomaly
const pulses: Array<{ mesh: THREE.Mesh, t: number }> = []
function onAnomaly(e: Event) {
  const detail = (e as CustomEvent).detail as { paramId: string }
  for (const cell of cells) {
    if (cell.paramId === detail.paramId && cell.index > cols.value - 6) {
      pulses.push({ mesh: cell.mesh, t: 0 })
    }
  }
}

function loop() {
  if (!renderer || !scene || !camera) return
  animationId = requestAnimationFrame(loop)
  updateColors()
  // animate pulses
  const dt = 0.016
  for (let i = pulses.length - 1; i >= 0; i--) {
    const p = pulses[i]
    p.t += dt
    const s = 1 + 0.6 * Math.sin(p.t * Math.PI * 2) * Math.exp(-p.t * 2)
    const mat = p.mesh.material as THREE.MeshStandardMaterial
    mat.emissive.setHex(0x000000)
    p.mesh.scale.set(s, 1, s)
    if (p.t > 1.2) {
      p.mesh.scale.set(1, 1, 1)
      pulses.splice(i, 1)
    }
  }
  if (autoRotate.value && camera) {
    const t = performance.now() * 0.0001
    camera.position.x = Math.sin(t) * 6
    camera.position.z = Math.cos(t) * 6
    camera.lookAt(0, 0, 0)
  }
  renderer.render(scene, camera)
}

// hover tooltip
type Hover = { visible: boolean; x: number; y: number; paramName?: string; valueText?: string; stateText?: string; deviationText?: string; marginText?: string; timeText?: string }
const hover = ref<Hover>({ visible: false, x: 0, y: 0 })
function placeTooltip(px: number, py: number) {
  const margin = 12
  const w = tt.value?.offsetWidth ?? 240
  const h = tt.value?.offsetHeight ?? 120
  let x = px + margin
  let y = py + margin
  if (x + w > window.innerWidth - 8) x = px - w - margin
  if (x < 8) x = 8
  if (y + h > window.innerHeight - 8) y = py - h - margin
  if (y < 8) y = 8
  return { x, y }
}
function classify(p: LabParam, v?: number) {
  if (typeof v !== 'number') return '无数据'
  if (v < p.lcl) return '低于下限'
  if (v > p.ucl) return '高于上限'
  return '合格'
}
function handlePointerMove(clientX: number, clientY: number) {
  if (!container.value || !camera || !scene) return
  const rect = container.value.getBoundingClientRect()
  mouse.x = ((clientX - rect.left) / rect.width) * 2 - 1
  mouse.y = -((clientY - rect.top) / rect.height) * 2 + 1
  raycaster.setFromCamera(mouse, camera)
  const intersects = raycaster.intersectObjects(gridGroup?.children || [], true)
  const hit = intersects.find(i => i.object instanceof THREE.Mesh) as THREE.Intersection | undefined
  if (!hit) { hover.value.visible = false; return }
  const mesh = hit.object as THREE.Mesh
  const cell = cells.find(c => c.mesh === mesh)
  if (!cell) { hover.value.visible = false; return }
  const p = params.value.find(x => x.id === cell.paramId)
  if (!p) { hover.value.visible = false; return }
  const v = valueAt(cell.paramId, cell.index)
  const arr = lab.meas[cell.paramId] || []
  const idxFromNewest = cols.value - 1 - cell.index
  const i = Math.max(0, arr.length - 1 - idxFromNewest)
  const item = arr[i]
  const ts = item?.ts
  const timeText = ts ? new Date(ts).toLocaleTimeString('zh-CN', { hour12: false }) : '-'
  const span = p.ucl - p.lcl
  const dev = (v != null ? v - p.target : 0)
  const devPct = span>0 ? Math.abs(dev) / span * 100 : 0
  const toLimit = v == null ? 0 : (v > p.target ? (p.ucl - v) : (v - p.lcl))
  const marginPct = span>0 ? Math.max(0, toLimit) / span * 100 : 0
  const pos = placeTooltip(clientX, clientY)
  hover.value = {
    visible: true,
    x: pos.x,
    y: pos.y,
    paramName: p.name,
    valueText: (v != null ? v : '-') + (p.unit || ''),
    stateText: classify(p, v),
    deviationText: v==null? '-' : `${dev>=0?'+':''}${dev.toFixed(2)}${p.unit||''} · 约 ${devPct.toFixed(1)}% 带宽`,
    marginText: v==null? '-' : `距最近控制限 ${Math.max(0,toLimit).toFixed(2)}${p.unit||''} · ${marginPct.toFixed(1)}% 裕度`,
    timeText
  }
}
function onMouseMove(ev: MouseEvent) { handlePointerMove(ev.clientX, ev.clientY) }
function onTouchMove(ev: TouchEvent) {
  const t = ev.touches && ev.touches[0]
  if (!t) return
  handlePointerMove(t.clientX, t.clientY)
}
function onMouseLeave() { hover.value.visible = false }

watch(cols, () => {
  rebuildGrid()
  lastUpdate = 0
})

watch(followSim, (v) => {
  if (v && !lab.simTimer) lab.startSimulation(2000)
})

onMounted(() => {
  // reduce work for small screens by default
  if (window.innerWidth < 720) {
    cols.value = Math.min(cols.value, 36)
    if (isIOS) autoRotate.value = false
  }
  buildScene()
  if (followSim.value && !lab.simTimer) lab.startSimulation(2000)
})
onBeforeUnmount(() => {
  clearScene()
})
</script>

<style scoped>
.page-header { position: sticky; top: var(--topnav-h, 56px); z-index: 10; padding: 12px 16px; border-bottom: 1px solid var(--color-border); backdrop-filter: saturate(120%) blur(4px); background: color-mix(in oklab, var(--color-background) 84%, transparent); display:flex; align-items:center; justify-content:space-between; gap:12px; }
.page-header h1 { font-size: 18px; font-weight: 600; }
.actions .link { appearance:none; border:1px solid rgba(148,163,184,.35); background:transparent; color:#93c5fd; padding:4px 8px; border-radius:8px; font-size:12px; }
.hint { font-size: 12px; color:#64748b; }
.page-main { position: relative; height: calc(100vh - var(--topnav-h, 56px) - 54px); }
.viewport { position:absolute; inset:0; }
.legend { position: absolute; right: 10px; bottom: 10px; background: color-mix(in oklab, var(--color-background) 86%, transparent); border: 1px solid var(--color-border); border-radius: 10px; padding: 8px 10px; font-size: 12px; color:#94a3b8; display:flex; flex-direction:column; gap:6px; max-width: 46vw; }
.legend .row { display:flex; gap: 10px; align-items:center; justify-content: space-between; }
.legend .name { color:#e2e8f0; font-weight:600; }
.chip { display:inline-block; width:12px; height:12px; border-radius:3px; background:var(--c); margin:0 6px; vertical-align: middle; }
.tooltip { position:absolute; pointer-events:none; background: rgba(15,23,42,.95); color:#e2e8f0; border:1px solid #334155; padding:6px 8px; border-radius:8px; font-size:12px; box-shadow: 0 8px 20px rgba(0,0,0,.25); max-width: 50ch; }
.tt-name { font-weight: 700; margin-bottom: 2px; }
.tt-line { color:#cbd5e1; }

/* mobile tweaks */
@media (max-width: 960px) {
  .page-header h1 { font-size: 16px; }
  .page-main { height: calc(100vh - var(--topnav-h, 56px) - 50px); }
  .legend { max-width: 70vw; font-size: 11px; padding: 6px 8px; right: 8px; bottom: 8px; }
  .actions { display:flex; flex-wrap: wrap; gap: 8px; }
}
@media (max-width: 720px) {
  .page-header { padding: 10px 12px; }
  .page-header h1 { font-size: 15px; }
}
</style>
