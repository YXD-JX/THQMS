<template>
  <!-- Collapsed tab -->
  <button v-if="!panelOpen && items && items.length" class="panel-tab" :class="{ pulse: pulseTab }" :style="{ left: pos.x + 'px', top: pos.y + 'px' }" @click="setPanelOpen(true)" @mousedown.prevent="onTabDragStart" @touchstart.passive="onTabTouchStart">
    通知
    <span v-if="items && items.length" class="badge">{{ items.length }}</span>
  </button>
  <!-- Draggable panel -->
  <div v-else class="stack panel" ref="panelRef" :class="{ 'hidden-left': hiddenEdge==='left', 'hidden-right': hiddenEdge==='right' }" :style="[{ left: pos.x + 'px', top: pos.y + 'px' }, panelStyle]" aria-live="polite" aria-atomic="true" @mouseenter="onPanelEnter" @mouseleave="onPanelLeave">
    <div class="panel-head" @mousedown.prevent="onDragStart" @touchstart.passive="onTouchStart">
      <span>通知面板</span>
      <div class="head-actions">
        <button class="link" @click.stop="setPanelOpen(false)">折叠</button>
      </div>
    </div>
  <div class="panel-body" :style="bodyStyle">
      <div v-for="n in items" :key="n.id" class="banner" :class="sevClass(n.severity)" @click="close(n.id)">
      <div class="row">
        <div class="title">{{ n.title }}</div>
        <button class="x" aria-label="关闭" @click.stop="close(n.id)">×</button>
      </div>
      <div v-if="n.body" class="body">
        <span>{{ n.body }}</span>
        <button v-if="n.targetRoute" class="link" @click.stop="go(n)">查看</button>
      </div>
      </div>
    </div>
  </div>
</template>

<script lang="ts" setup>
import { computed, ref, onMounted, onBeforeUnmount, watch } from 'vue';
import { storeToRefs } from 'pinia';
import { useNotiStore, type NotiSeverity } from '@/stores/notifications';
import { useRouter } from 'vue-router';

const ns = useNotiStore();
const { items } = storeToRefs(ns);
const router = useRouter();

const notiEnabled = computed({ get: () => ns.enabled, set: (v: boolean) => ns.setEnabled(v) });
// 控制项已移至全局控制面板，此处不再展示


function sevClass(sev?: NotiSeverity) {
  if (sev === 'high') return 'sev-high';
  if (sev === 'medium') return 'sev-med';
  return 'sev-low';
}
function close(id: string) {
  ns.remove(id);
}
function go(n: { targetRoute?: string; targetParamId?: string }) {
  if (n.targetRoute) {
    router.push({ path: n.targetRoute, query: n.targetParamId ? { param: n.targetParamId } : undefined });
  }
}

// undo 操作移至全局控制面板

// Draggable 2D panel with collapse
const NOTI_POS_KEY = 'thqms.ui.noti.pos.v1'
const NOTI_OPEN_KEY = 'thqms.ui.noti.open.v1'
const HIDDEN_EDGE_KEY = 'thqms.ui.noti.hiddenEdge.v1'
const LOCK_OPEN_KEY = 'thqms.ui.noti.lockOpen.v1'
const AUTO_HIDE_ENABLED_KEY = 'thqms.ui.noti.autoHide.enabled.v1'
const AUTO_HIDE_MS_KEY = 'thqms.ui.noti.autoHide.ms.v1'
const CLEAR_COLLAPSE_MS_KEY = 'thqms.ui.noti.clearCollapse.ms.v1'
const PANEL_HEIGHT_KEY = 'thqms.ui.noti.height.v1'
const NOTI_FW_MOBILE_KEY = 'thqms.ui.noti.fullwidth.mobile.v1'
// Safe localStorage helpers (avoid Safari private mode errors)
function lsGetJSON<T>(key: string, fallback: T): T {
  try { const s = localStorage.getItem(key); return s==null ? fallback : JSON.parse(s) as T } catch { return fallback }
}
function lsGetNum(key: string, fallback: number): number {
  try { const s = localStorage.getItem(key); const n = Number(s); return Number.isFinite(n) ? n : fallback } catch { return fallback }
}
const panelRef = ref<HTMLElement | null>(null)
const panelOpen = ref<boolean>(lsGetJSON<boolean>(NOTI_OPEN_KEY, true))
function setPanelOpen(v: boolean){
  panelOpen.value = v
  if (v) { setHiddenEdge(null) }
  try { localStorage.setItem(NOTI_OPEN_KEY, JSON.stringify(v)) } catch {}
}

const pos = ref<{ x:number; y:number }>({ x: 12, y: 60 })
const initialHiddenEdge = (() => {
  try {
    const s = localStorage.getItem(HIDDEN_EDGE_KEY)
    return s === 'left' || s === 'right' ? (s as 'left'|'right') : null
  } catch { return null }
})()
const hiddenEdge = ref<'left'|'right'|null>(initialHiddenEdge)

// Settings state
const lockOpen = ref<boolean>(lsGetJSON<boolean>(LOCK_OPEN_KEY, false))
watch(lockOpen, v => { try { localStorage.setItem(LOCK_OPEN_KEY, JSON.stringify(!!v)) } catch {} })
const autoHideEnabled = ref<boolean>(lsGetJSON<boolean>(AUTO_HIDE_ENABLED_KEY, true))
watch(autoHideEnabled, v => { try { localStorage.setItem(AUTO_HIDE_ENABLED_KEY, JSON.stringify(!!v)) } catch {} })
const autoHideMs = ref<number>(lsGetNum(AUTO_HIDE_MS_KEY, 1500))
watch(autoHideMs, v => { try { localStorage.setItem(AUTO_HIDE_MS_KEY, String(Math.max(500, Math.min(20000, Number(v)||1500)))) } catch {} })
const clearCollapseMs = ref<number>(lsGetNum(CLEAR_COLLAPSE_MS_KEY, 2000))
watch(clearCollapseMs, v => { try { localStorage.setItem(CLEAR_COLLAPSE_MS_KEY, String(Math.max(0, Math.min(20000, Number(v)||2000)))) } catch {} })
const minPanelH = 180
const maxPanelH = Math.max(320, Math.round((window.innerHeight||800)*0.8))
const panelHeight = ref<number>(lsGetNum(PANEL_HEIGHT_KEY, 320))
watch(panelHeight, v => { try { localStorage.setItem(PANEL_HEIGHT_KEY, String(Math.max(minPanelH, Math.min(maxPanelH, Number(v)||320)))) } catch {} })
// small screen detection for responsive height
const isSmallScreen = ref<boolean>((window.innerWidth||1280) <= 720)
// Mobile full-width mode (persisted) and external toggle event
const fullWidthMobile = ref<boolean>(lsGetJSON<boolean>(NOTI_FW_MOBILE_KEY, true))
function setFullWidthMobile(v: boolean){
  fullWidthMobile.value = !!v
  try { localStorage.setItem(NOTI_FW_MOBILE_KEY, JSON.stringify(!!v)) } catch {}
}
function onFWMEvent(ev: Event){
  const v = (ev as CustomEvent<{ enabled: boolean }>).detail?.enabled
  if (typeof v === 'boolean') {
    setFullWidthMobile(v)
    if (v && isSmallScreen.value) snapToLeft()
  }
}
function onWinResize(){
  isSmallScreen.value = (window.innerWidth||1280) <= 720
  if (isSmallScreen.value && fullWidthMobile.value) snapToLeft()
}
let dragging = false
let start = { x:0, y:0 }
let startPos = { x:0, y:0 }
function getTopnavH(){ try { return Number(getComputedStyle(document.documentElement).getPropertyValue('--topnav-h').replace('px','')) || 48 } catch { return 48 } }
function bound(nx:number, ny:number){
  const pad = 8
  const nav = getTopnavH()
  const vw = window.innerWidth || 1280
  const vh = window.innerHeight || 800
  const w = panelRef.value?.offsetWidth ?? 320
  const h = (panelRef.value?.offsetHeight ?? 180)
  const minX = pad
  const maxX = Math.max(pad, vw - w - pad)
  const minY = nav + pad
  const maxY = Math.max(minY, vh - Math.min(h, vh*0.6) - pad)
  return { x: Math.min(maxX, Math.max(minX, nx)), y: Math.min(maxY, Math.max(minY, ny)) }
}
function loadPos(){
  try {
    const saved = JSON.parse(localStorage.getItem(NOTI_POS_KEY) || 'null')
    if (saved && typeof saved.x==='number' && typeof saved.y==='number') { pos.value = bound(saved.x, saved.y); return }
  } catch {}
  // default: right-top below nav
  const vw = window.innerWidth || 1280
  const w = panelRef.value?.offsetWidth ?? 320
  pos.value = bound(vw - w - 12, getTopnavH() + 10)
}
function savePos(){ try { localStorage.setItem(NOTI_POS_KEY, JSON.stringify(pos.value)) } catch {} }
function setHiddenEdge(edge: 'left'|'right'|null){ hiddenEdge.value = edge; try { localStorage.setItem(HIDDEN_EDGE_KEY, edge??'') } catch {} }
let hideTimer: number | undefined
function clearHideTimer(){ if (hideTimer) { window.clearTimeout(hideTimer); hideTimer = undefined } }
function nearestEdge(): 'left'|'right' {
  const vw = window.innerWidth || 1280
  const w = panelRef.value?.offsetWidth ?? 320
  const centerX = pos.value.x + w/2
  return centerX < vw/2 ? 'left' : 'right'
}
function snapToEdge(){
  const pad = 8
  const vw = window.innerWidth || 1280
  const w = panelRef.value?.offsetWidth ?? 320
  if (nearestEdge()==='left') pos.value.x = pad; else pos.value.x = Math.max(pad, vw - w - pad)
}
function snapToLeft(){
  const pad = 8
  pos.value.x = pad
  const nav = getTopnavH()
  pos.value.y = Math.max(nav + pad, pos.value.y)
}
function scheduleAutoHide(){
  clearHideTimer()
  // Disable auto-hide on small screens/touch-heavy environments
  if (window.innerWidth <= 960) return
  // If there are active messages, keep panel visible
  if (items.value && items.value.length > 0) return
  if (!autoHideEnabled.value) return
  if (lockOpen.value) return
  hideTimer = window.setTimeout(()=>{ setHiddenEdge(nearestEdge()) }, Math.max(500, Math.min(20000, Number(autoHideMs.value)||1500)))
}
function onDragStart(e: MouseEvent){ clearHideTimer(); if (hiddenEdge.value) setHiddenEdge(null); dragging = true; start={x:e.clientX,y:e.clientY}; startPos={...pos.value}; window.addEventListener('mousemove', onDragMove); window.addEventListener('mouseup', onDragEnd) }
function onDragMove(e: MouseEvent){ if(!dragging) return; pos.value = bound(startPos.x + (e.clientX - start.x), startPos.y + (e.clientY - start.y)) }
function onDragEnd(){ if(!dragging) return; dragging=false; snapToEdge(); savePos(); scheduleAutoHide(); window.removeEventListener('mousemove', onDragMove); window.removeEventListener('mouseup', onDragEnd) }
function onTouchStart(e: TouchEvent){ const t=e.touches[0]; clearHideTimer(); if (hiddenEdge.value) setHiddenEdge(null); dragging=true; start={x:t.clientX,y:t.clientY}; startPos={...pos.value}; window.addEventListener('touchmove', onTouchMove as EventListener, { passive:false } as AddEventListenerOptions); window.addEventListener('touchend', onTouchEnd) }
function onTouchMove(e: TouchEvent){ if(!dragging) return; const t=e.touches[0]; pos.value = bound(startPos.x + (t.clientX - start.x), startPos.y + (t.clientY - start.y)); e.preventDefault() }
function onTouchEnd(){ if(!dragging) return; dragging=false; snapToEdge(); savePos(); scheduleAutoHide(); window.removeEventListener('touchmove', onTouchMove as EventListener); window.removeEventListener('touchend', onTouchEnd) }

function onPanelEnter(){ clearHideTimer(); if (hiddenEdge.value) setHiddenEdge(null) }
function onPanelLeave(){
  // only auto-hide if snapped near edges
  const pad = 8
  const vw = window.innerWidth || 1280
  const w = panelRef.value?.offsetWidth ?? 320
  if (pos.value.x <= pad + 1 || pos.value.x >= vw - w - pad - 1) scheduleAutoHide()
}

onMounted(()=>{ loadPos(); window.addEventListener('resize', loadPos); window.addEventListener('resize', onWinResize); // reapply hidden edge on load
  if (hiddenEdge.value) scheduleAutoHide()
  window.addEventListener('ui:noti-fw-mobile', onFWMEvent as EventListener)
  if (isSmallScreen.value && fullWidthMobile.value) snapToLeft()
})
onBeforeUnmount(()=>{ clearHideTimer(); clearPulse(); window.removeEventListener('mousemove', onDragMove); window.removeEventListener('mouseup', onDragEnd); window.removeEventListener('touchmove', onTouchMove as EventListener); window.removeEventListener('touchend', onTouchEnd); window.removeEventListener('resize', loadPos); window.removeEventListener('resize', onWinResize); window.removeEventListener('ui:noti-fw-mobile', onFWMEvent as EventListener) })

// Dragging when collapsed (tab)
function boundTab(nx:number, ny:number){
  const pad = 8
  const nav = getTopnavH()
  const vw = window.innerWidth || 1280
  const vh = window.innerHeight || 800
  const w = 56, h = 36
  const minX = pad
  const maxX = Math.max(pad, vw - w - pad)
  const minY = nav + pad
  const maxY = Math.max(minY, vh - h - pad)
  return { x: Math.min(maxX, Math.max(minX, nx)), y: Math.min(maxY, Math.max(minY, ny)) }
}
function onTabDragStart(e: MouseEvent){ dragging = true; start={x:e.clientX,y:e.clientY}; startPos={...pos.value}; window.addEventListener('mousemove', onTabDragMove); window.addEventListener('mouseup', onTabDragEnd) }
function onTabDragMove(e: MouseEvent){ if(!dragging) return; pos.value = boundTab(startPos.x + (e.clientX - start.x), startPos.y + (e.clientY - start.y)) }
function onTabDragEnd(){ if(!dragging) return; dragging=false; // snap
  const pad = 8
  const vw = window.innerWidth || 1280
  const w = 56
  pos.value.x = (pos.value.x + w/2) < vw/2 ? pad : Math.max(pad, vw - w - pad)
  savePos(); window.removeEventListener('mousemove', onTabDragMove); window.removeEventListener('mouseup', onTabDragEnd) }
function onTabTouchStart(e: TouchEvent){ const t=e.touches[0]; dragging=true; start={x:t.clientX,y:t.clientY}; startPos={...pos.value}; window.addEventListener('touchmove', onTabTouchMove as EventListener, { passive:false } as AddEventListenerOptions); window.addEventListener('touchend', onTabTouchEnd) }
function onTabTouchMove(e: TouchEvent){ if(!dragging) return; const t=e.touches[0]; pos.value = boundTab(startPos.x + (t.clientX - start.x), startPos.y + (t.clientY - start.y)); e.preventDefault() }
function onTabTouchEnd(){ if(!dragging) return; dragging=false; const pad=8, vw=window.innerWidth||1280, w=56; pos.value.x = (pos.value.x + w/2) < vw/2 ? pad : Math.max(pad, vw - w - pad); savePos(); window.removeEventListener('touchmove', onTabTouchMove as EventListener); window.removeEventListener('touchend', onTabTouchEnd) }

// Badge pulse on new messages when collapsed
const pulseTab = ref<boolean>(false)
let pulseTimer: number | undefined
// Declare collapse timer BEFORE any watcher that might reference it (immediate watchers run during setup)
let collapseTimer: number | undefined
function clearPulse(){ if (pulseTimer) { window.clearTimeout(pulseTimer); pulseTimer=undefined } pulseTab.value=false }
let lastCount = 0
watch(items, (arr)=>{
  const count = (arr?.length)||0
  // Auto expand/collapse
  const enabled = !!notiEnabled.value
  if (enabled && count>0) {
    setPanelOpen(true)
  } else if (count===0 && !lockOpen.value) {
    // delayed collapse
    if (collapseTimer) { window.clearTimeout(collapseTimer); collapseTimer = undefined }
    collapseTimer = window.setTimeout(()=> setPanelOpen(false), Math.max(0, Math.min(20000, Number(clearCollapseMs.value)||2000)))
  }
  // Pulse when new messages arrive and panel is collapsed
  if (!panelOpen.value && count>lastCount) {
    pulseTab.value = true
    clearPulse()
    pulseTimer = window.setTimeout(()=>{ pulseTab.value=false; pulseTimer=undefined }, 1800)
  }
  lastCount = count
}, { immediate: true })

// Also watch the toggle; if turned off, allow collapse; if turned on with messages, open
watch(notiEnabled, (en)=>{
  const count = (items.value?.length)||0
  if (en && count>0) setPanelOpen(true)
  if (!en && !lockOpen.value) setPanelOpen(false)
})

// Auto open/close based on messages and toggle
// 由上面的细粒度 watchers 统一处理自动展开/折叠

// computed style for panel body
const bodyStyle = computed(() => {
  if (isSmallScreen.value) return { maxHeight: '80vh' }
  const h = Math.max(minPanelH, Math.min(maxPanelH, Number(panelHeight.value)||minPanelH))
  return { height: h + 'px', maxHeight: '80vh' }
})
// width style for panel on mobile full-width mode
const panelStyle = computed(() => {
  if (isSmallScreen.value && fullWidthMobile.value) {
    return { width: 'calc(100vw - 16px)', maxWidth: 'calc(100vw - 16px)' }
  }
  return {}
})
</script>

<style scoped>
.stack { position: fixed; z-index: 110; display: flex; flex-direction: column; gap: 8px; padding: 0; pointer-events: none; }
.panel { width: 340px; max-width: min(92vw, 420px); border: 1px solid rgba(148,163,184,.35); border-radius: 12px; background: color-mix(in oklab, var(--color-background) 96%, transparent); box-shadow: 0 10px 30px rgba(0,0,0,.15); overflow: hidden; transition: transform .18s ease-out; pointer-events: auto; }
.panel.hidden-left { transform: translateX(calc(-100% + 18px)); }
.panel.hidden-right { transform: translateX(calc(100% - 18px)); }
.panel-head { pointer-events: auto; display:flex; align-items:center; justify-content:space-between; gap:8px; padding: 6px 8px; border-bottom: 1px solid var(--color-border); cursor: move; user-select: none; }
.panel-body { pointer-events: auto; display:flex; flex-direction: column; gap: 8px; padding: 8px; max-height: min(calc(100vh - 120px), 80vh); overflow: auto; }
.panel-tab { position: fixed; z-index: 110; padding: 6px 10px; border: 1px solid var(--color-border); border-radius: 10px; background: color-mix(in oklab, var(--color-background) 94%, transparent); color:#334155; cursor: move; display:inline-flex; align-items:center; gap:6px; }
.panel-tab .badge { min-width: 18px; height: 18px; padding: 0 6px; border-radius: 9px; background: #ef4444; color: white; font-size: 11px; line-height: 18px; text-align: center; }
.panel-tab.pulse { animation: pulse 1.2s ease-out 2; }
@keyframes pulse { 0% { transform: scale(1); box-shadow: 0 0 0 0 rgba(239,68,68,.4) } 70% { transform: scale(1.06); box-shadow: 0 0 0 10px rgba(239,68,68,0) } 100% { transform: scale(1); box-shadow: 0 0 0 0 rgba(239,68,68,0) } }
.toolbar { display: flex; gap: 12px; align-items: center; justify-content: flex-end; flex-wrap: wrap; }
.ctl { font-size: 12px; color: #94a3b8; display: inline-flex; gap: 6px; align-items: center; }
.banner { pointer-events: auto; width: 100%; background: rgba(30, 41, 59, .96); color: #e5e7eb; border: 1px solid rgba(148,163,184,.35); border-radius: 12px; box-shadow: 0 10px 30px rgba(0,0,0,.15); padding: 10px 12px; transform: translateY(-16px); opacity: 0; animation: drop .2s ease-out forwards; }
.row { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
.title { font-weight: 700; font-size: 15px; }
.body { margin-top: 2px; font-size: 13px; color: #cbd5e1; display: flex; align-items: center; gap: 10px; justify-content: space-between; }
.link { appearance: none; border: 1px solid rgba(148,163,184,.35); background: transparent; color: #93c5fd; padding: 4px 8px; border-radius: 8px; font-size: 12px; }
.x { appearance: none; border: none; background: transparent; color: #94a3b8; font-size: 20px; line-height: 16px; padding: 2px 6px; border-radius: 8px; cursor: pointer; }
.x:hover { background: rgba(148,163,184,.12); }

.sev-high { border-color: #ef4444aa; box-shadow: 0 10px 30px #ef444433; }
.sev-med { border-color: #f59e0baa; box-shadow: 0 10px 30px #f59e0b33; }
.sev-low { border-color: #22c55eaa; box-shadow: 0 10px 30px #22c55e33; }

@keyframes drop { to { transform: translateY(0); opacity: 1; } }

/* Mobile: hide toolbar to avoid duplicate controls with global dock */
@media (max-width: 960px) {
  .toolbar { display: none; }
}
@media (max-width: 720px) {
  .panel { max-width: min(96vw, 440px); }
  .panel-body { max-height: 80vh; }
  .title { font-size: 16px; }
  .body { font-size: 14px; gap: 8px; }
}
</style>
