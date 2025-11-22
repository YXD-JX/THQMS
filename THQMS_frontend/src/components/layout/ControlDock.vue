<script setup lang="ts">
import { RouterLink, useRoute } from 'vue-router'
import { ref, computed, watch, onBeforeUnmount } from 'vue'
import { useLabStore } from '@/stores/lab'
import { useNotiStore } from '@/stores/notifications'
import { useDosingStore } from '@/stores/dosing'
import { requestNotificationPermission, getNotificationSupportInfo } from '@/services/notify'

// expose an API to parent if needed
const props = defineProps<{ open?: boolean }>()
const emit = defineEmits<{ (e:'update:open', v:boolean):void; (e:'layout', v:{ mode:'float'|'left'|'right'|'bottom'; open:boolean; w:number; h:number }):void }>()

// Persisted dock mode + sizes
const DOCK_MODE_KEY = 'thqms.ui.dock.mode.v1' // 'float' | 'left' | 'right' | 'bottom'
const DOCK_W_KEY = 'thqms.ui.dock.w.v1'
const DOCK_H_KEY = 'thqms.ui.dock.h.v1'
const savedMode = localStorage.getItem(DOCK_MODE_KEY)
const dockMode = ref<'float'|'left'|'right'|'bottom'>(savedMode==='left'||savedMode==='right'||savedMode==='bottom'||savedMode==='float' ? savedMode : 'right')
watch(dockMode, v=>{ try { localStorage.setItem(DOCK_MODE_KEY, v) } catch {} })
const dockW = ref<number>(Math.max(240, Math.min(700, Number(localStorage.getItem(DOCK_W_KEY) || '320'))))
const dockH = ref<number>(Math.max(180, Math.min(900, Number(localStorage.getItem(DOCK_H_KEY) || '300'))))
watch(dockW, v=>{ try { localStorage.setItem(DOCK_W_KEY, String(Math.max(240, Math.min(700, Number(v)||320)))) } catch {} })
watch(dockH, v=>{ try { localStorage.setItem(DOCK_H_KEY, String(Math.max(180, Math.min(900, Number(v)||300)))) } catch {} })

// Float mode position + open state
const DOCK_POS_KEY = 'thqms.ui.dock.pos.v1'
const DOCK_OPEN_KEY = 'thqms.ui.dock.open.v1'
const dockOpen = computed({
  get: ()=> !!(props.open ?? JSON.parse(localStorage.getItem(DOCK_OPEN_KEY) || 'false')),
  set: (v:boolean)=>{ emit('update:open', v); try { localStorage.setItem(DOCK_OPEN_KEY, JSON.stringify(v)) } catch {} }
})
const initialDockPos = (() => {
  try { const s = JSON.parse(localStorage.getItem(DOCK_POS_KEY) || 'null'); if (s && typeof s.x==='number' && typeof s.y==='number') return s } catch {}
  return { x: 12, y: 80 }
})()
const dockPos = ref<{ x:number; y:number }>(initialDockPos)
let dragging = false
let dragStart = { x:0, y:0 }
let dockStart = { x:0, y:0 }
function boundPos(nx:number, ny:number){ const pad=8; const w=240, h=44; const vw=window.innerWidth, vh=window.innerHeight; nx=Math.max(pad, Math.min(vw-w-pad, nx)); ny=Math.max(Number(getComputedStyle(document.documentElement).getPropertyValue('--topnav-h').replace('px',''))||48, Math.min(vh-h-pad, ny)); return { x:nx, y:ny } }
function onDockMove(e: MouseEvent){ if(!dragging) return; const nx=dockStart.x+(e.clientX-dragStart.x); const ny=dockStart.y+(e.clientY-dragStart.y); dockPos.value=boundPos(nx,ny) }
function onDockUp(){ if(!dragging) return; dragging=false; const mid=window.innerWidth/2; const toLeft=dockPos.value.x<mid; dockPos.value.x=toLeft?8:(window.innerWidth-56); try{ localStorage.setItem(DOCK_POS_KEY, JSON.stringify(dockPos.value)) }catch{}; window.removeEventListener('mousemove', onDockMove); window.removeEventListener('mouseup', onDockUp) }
function onDockDragStart(e: MouseEvent){ dragging=true; dragStart={x:e.clientX,y:e.clientY}; dockStart={...dockPos.value}; window.addEventListener('mousemove', onDockMove); window.addEventListener('mouseup', onDockUp) }

// Resizers for docked modes
let resizing=false
let resizeStart={ x:0, y:0, w:0, h:0 }
function onResizeStartX(e: MouseEvent){ resizing=true; resizeStart={ x:e.clientX, y:e.clientY, w:dockW.value, h:dockH.value }; window.addEventListener('mousemove', onResizeMoveX); window.addEventListener('mouseup', onResizeEnd) }
function onResizeMoveX(e: MouseEvent){ if(!resizing) return; const delta=e.clientX-resizeStart.x; const vw=window.innerWidth||1280; let w=resizeStart.w; if(dockMode.value==='left') w=Math.max(240,Math.min(vw-160,resizeStart.w+delta)); if(dockMode.value==='right') w=Math.max(240,Math.min(vw-160,resizeStart.w-delta)); dockW.value=w }
function onResizeStartY(e: MouseEvent){ resizing=true; resizeStart={ x:e.clientX, y:e.clientY, w:dockW.value, h:dockH.value }; window.addEventListener('mousemove', onResizeMoveY); window.addEventListener('mouseup', onResizeEnd) }
function onResizeMoveY(e: MouseEvent){ if(!resizing) return; const delta=e.clientY-resizeStart.y; const vh=window.innerHeight||800; const h=Math.max(180,Math.min(vh-160,resizeStart.h-delta)); dockH.value=h }
function onResizeEnd(){ if(!resizing) return; resizing=false; window.removeEventListener('mousemove', onResizeMoveX); window.removeEventListener('mousemove', onResizeMoveY); window.removeEventListener('mouseup', onResizeEnd) }
onBeforeUnmount(()=>{ window.removeEventListener('mousemove', onResizeMoveX); window.removeEventListener('mousemove', onResizeMoveY); window.removeEventListener('mouseup', onResizeEnd) })

// Emit layout changes to parent for optional push-layout
function emitLayout(){
  emit('layout', { mode: dockMode.value, open: dockOpen.value, w: dockW.value, h: dockH.value })
}
watch([dockMode, dockW, dockH, dockOpen], emitLayout, { immediate: true })

// Small screen default to bottom if no saved mode
if (!savedMode) {
  if (typeof window !== 'undefined' && window.innerWidth <= 960) {
    dockMode.value = 'bottom'
  }
}

// Content: Six Sigma & notifications controls
const route = useRoute()
const SIX_BINS_KEY = 'thqms.six.bins.v1'
const SIX_SPEC_KEY = 'thqms.six.spec.v1'
const SIX_CTL_KEY = 'thqms.six.ctl.v1'
const sixBins = ref<number>(Number(localStorage.getItem(SIX_BINS_KEY) || '20'))
const sixShowSpec = ref<boolean>(JSON.parse(localStorage.getItem(SIX_SPEC_KEY) || 'true'))
const sixShowCtl = ref<boolean>(JSON.parse(localStorage.getItem(SIX_CTL_KEY) || 'true'))
watch([sixBins, sixShowSpec, sixShowCtl], ([b, s1, s2])=>{
  try {
    localStorage.setItem(SIX_BINS_KEY, String(Math.max(5, Math.min(60, Number(b)||20))))
    localStorage.setItem(SIX_SPEC_KEY, JSON.stringify(!!s1))
    localStorage.setItem(SIX_CTL_KEY, JSON.stringify(!!s2))
  } catch {}
  window.dispatchEvent(new CustomEvent('six:controls', { detail: { bins: sixBins.value, showSpec: sixShowSpec.value, showCtl: sixShowCtl.value } }))
}, { deep: true })
function sixExport(kind: 'png'|'pdf') { window.dispatchEvent(new CustomEvent('six:export', { detail: { kind } })) }
const lab = useLabStore()
function toggleLabSim(){ if (lab.simTimer) lab.stopSimulation(); else lab.startSimulation(2000) }

const ns = useNotiStore()
const dosing = useDosingStore()
const notiEnabled = computed({ get: () => ns.enabled, set: (v: boolean) => ns.setEnabled(v) })
const soundEnabled = computed({ get: () => ns.soundEnabled, set: (v: boolean) => ns.setSoundEnabled(v) })
const sirenVolume = computed<number>({ get: () => ns.sirenVolume, set: (v: number) => ns.setSirenVolume(Number(v)) })
const sirenPattern = computed<'double' | 'quad'>({ get: () => ns.sirenPattern as 'double' | 'quad', set: (v) => ns.setSirenPattern(v) })
// Hide TopNotiStack (UI only, not affecting notification logic)
const NOTI_CENTER_HIDDEN_KEY = 'thqms.ui.noti.center.hidden.v1'
const NOTI_FW_MOBILE_KEY = 'thqms.ui.noti.fullwidth.mobile.v1'
const notiCenterHidden = computed<boolean>({
  get: () => !!JSON.parse(localStorage.getItem(NOTI_CENTER_HIDDEN_KEY) || 'false'),
  set: (v: boolean) => { try { localStorage.setItem(NOTI_CENTER_HIDDEN_KEY, JSON.stringify(!!v)) } catch {} ; window.dispatchEvent(new CustomEvent('ui:noti-center-hidden', { detail: { hidden: !!v } })) }
})
// Mobile full-width mode toggle (persisted) — affects TopNotiStack
const notiFWM = computed<boolean>({
  get: () => !!JSON.parse(localStorage.getItem(NOTI_FW_MOBILE_KEY) || 'true'),
  set: (v: boolean) => { try { localStorage.setItem(NOTI_FW_MOBILE_KEY, JSON.stringify(!!v)) } catch {}; window.dispatchEvent(new CustomEvent('ui:noti-fw-mobile', { detail: { enabled: !!v } })) }
})
const browserNotiEnabled = computed({
  get: () => ns.browserNotiEnabled,
  async set(v: boolean) {
    if (v) {
      const info = getNotificationSupportInfo()
      if (!info.ok) {
        ns.setBrowserNotiEnabled(false)
        const body = info.hint || (info.reason === 'no-api' ? '当前浏览器不支持 Notification API' : info.reason === 'insecure' ? '需 https 或 localhost 才能使用系统通知' : info.reason === 'ios-pwa-required' ? 'iOS 需添加到主屏幕(PWA)后再开启推送' : '系统通知不可用')
        ns.push({ id: 'noti-unsupported', title: '系统通知不可用', body, severity: 'low', ts: Date.now() })
        return
      }
      const perm = await requestNotificationPermission()
      if (perm !== 'granted') {
        ns.setBrowserNotiEnabled(false)
        ns.push({ id: 'noti-perm-deny', title: '系统通知未授权', body: '请在浏览器设置中开启通知权限', severity: 'medium', ts: Date.now() })
        return
      }
      ns.setBrowserNotiEnabled(true)
      ns.push({ id: 'noti-perm-ok', title: '系统通知已开启', ts: Date.now(), severity: 'low' })
    } else {
      ns.setBrowserNotiEnabled(false)
    }
  }
})
const emailEnabled = computed({ get: () => ns.emailEnabled, set: (v: boolean) => ns.setEmailEnabled(v) })
function undoBatch() {
  if (!dosing.lastBatch) {
    ns.push({ id: `no-undo-${Date.now()}`, title: '没有可撤销的批量操作', ts: Date.now(), severity: 'low' }, 2200)
    return
  }
  const cnt = dosing.lastBatch.items.length
  dosing.undoLastBatch()
  ns.push({ id: `undone-${Date.now()}`, title: `已撤销最近批量（${cnt} 条）`, ts: Date.now(), severity: 'low' }, 3000)
}

// Test siren (WebAudio) local impl
let testAudioCtx: AudioContext | null = null
function ensureTestAudioCtx(){
  if (!testAudioCtx) {
    const w = window as unknown as { AudioContext?: typeof AudioContext; webkitAudioContext?: typeof AudioContext }
    const Ctx = w.AudioContext || w.webkitAudioContext
    if (Ctx) testAudioCtx = new Ctx()
  }
}
function playOneBeep(freq=900, dur=0.18, volume=0.8){
  ensureTestAudioCtx(); if (!testAudioCtx) return
  if (testAudioCtx.state === 'suspended' && testAudioCtx.resume) { try { testAudioCtx.resume() } catch {} }
  const now = testAudioCtx.currentTime
  const osc = testAudioCtx.createOscillator()
  const gain = testAudioCtx.createGain()
  osc.type = 'sine'
  osc.frequency.setValueAtTime(freq, now)
  const vol = Math.max(0.02, Math.min(1, Number(volume||0.8)))
  gain.gain.setValueAtTime(0.0001, now)
  gain.gain.exponentialRampToValueAtTime(0.35*vol, now + 0.02)
  gain.gain.exponentialRampToValueAtTime(0.0001, now + dur)
  osc.connect(gain).connect(testAudioCtx.destination)
  osc.start(now); osc.stop(now + dur + 0.03)
}
function testSiren(){
  const count = ns.sirenPattern === 'quad' ? 4 : 2
  const gapMs = 300
  for (let i=0;i<count;i++) {
    setTimeout(()=> playOneBeep( ns.sirenPattern==='quad'? 1000 : 850, 0.18, ns.sirenVolume ), i*gapMs)
  }
}

</script>

<template>
  <!-- DevTools style docked panel -->
  <div v-if="dockOpen && dockMode!=='float'" class="dev-dock" :class="dockMode" :style="{ width: (dockMode==='left'||dockMode==='right') ? dockW + 'px' : undefined, height: (dockMode==='bottom') ? dockH + 'px' : undefined }">
    <div class="dock-head">
      <div class="left-area"><span>控制面板</span></div>
      <div class="ops">
        <select v-model="dockMode" class="mode">
          <option value="left">左侧</option>
          <option value="right">右侧</option>
          <option value="bottom">底部</option>
          <option value="float">浮动</option>
        </select>
        <button class="link small" @click="dockOpen=false">关闭</button>
      </div>
    </div>
    <div class="dock-body">
      <div class="group">
        <div class="g-title">快速导航</div>
        <div class="g-links">
          <RouterLink to="/lab">实验室</RouterLink>
          <RouterLink to="/six-sigma">六西格玛</RouterLink>
          <RouterLink to="/process-quality">工序质量</RouterLink>
          <RouterLink to="/heatmap">3D热力图</RouterLink>
          <RouterLink to="/heatmap2d">2D热力图</RouterLink>
          <RouterLink to="/dosing">补加单据</RouterLink>
          <RouterLink to="/rules">规则管理</RouterLink>
        </div>
      </div>
      <div class="group" v-if="route.path.startsWith('/six-sigma')">
        <div class="g-title">六西格玛</div>
        <div class="row">
          <label class="hint">分箱
            <input type="number" v-model.number="sixBins" min="5" max="60" step="1" style="width:70px" />
          </label>
          <label class="hint" style="display:flex;align-items:center;gap:6px;"><input type="checkbox" v-model="sixShowSpec" /> 规格线</label>
          <label class="hint" style="display:flex;align-items:center;gap:6px;"><input type="checkbox" v-model="sixShowCtl" /> 控制线</label>
        </div>
        <div class="row">
          <button class="link" @click="toggleLabSim">{{ lab.simTimer ? '停止' : '启动' }}仿真</button>
          <button class="link" @click="sixExport('png')">导出图片</button>
          <button class="link" @click="sixExport('pdf')">导出PDF</button>
        </div>
      </div>
      <div class="group">
        <div class="g-title">通知控制</div>
        <div class="row">
          <label class="hint"><input type="checkbox" v-model="notiEnabled" /> 显示通知</label>
          <label class="hint"><input type="checkbox" v-model="notiCenterHidden" /> 隐藏通知中心</label>
          <label class="hint" title="移动端将通知面板展开为贴边近全宽"><input type="checkbox" v-model="notiFWM" /> 移动端全宽模式</label>
          <label class="hint"><input type="checkbox" v-model="soundEnabled" /> 声音</label>
          <label class="hint">音量
            <input type="range" min="0" max="1" step="0.05" v-model.number="sirenVolume" style="width:120px" />
          </label>
          <label class="hint">模式
            <select v-model="sirenPattern">
              <option value="double">双连</option>
              <option value="quad">四连</option>
            </select>
          </label>
        </div>
        <div class="row">
          <label class="hint"><input type="checkbox" v-model="browserNotiEnabled" /> 系统通知</label>
          <label class="hint"><input type="checkbox" v-model="emailEnabled" /> 邮件通知</label>
          <button class="link" @click="testSiren">测试铃声</button>
          <button class="link" @click="undoBatch">撤销最近批量</button>
        </div>
      </div>
    </div>
    <div v-if="dockMode==='left' || dockMode==='right'" class="resizer x" @mousedown.prevent="onResizeStartX"></div>
    <div v-if="dockMode==='bottom'" class="resizer y" @mousedown.prevent="onResizeStartY"></div>
  </div>

  <!-- Global floating control dock -->
  <div v-else-if="dockOpen && dockMode==='float'" class="global-dock" :style="{ left: dockPos.x + 'px', top: dockPos.y + 'px' }">
    <div class="dock-head" @mousedown.prevent="onDockDragStart">
      <span>控制面板</span>
      <button class="link small" @click.stop="dockOpen=false">折叠</button>
    </div>
    <div class="dock-body">
      <!-- 内容同上 -->
      <div class="group">
        <div class="g-title">快速导航</div>
        <div class="g-links">
          <RouterLink to="/lab">实验室</RouterLink>
          <RouterLink to="/six-sigma">六西格玛</RouterLink>
          <RouterLink to="/process-quality">工序质量</RouterLink>
          <RouterLink to="/heatmap">3D热力图</RouterLink>
          <RouterLink to="/heatmap2d">2D热力图</RouterLink>
          <RouterLink to="/dosing">补加单据</RouterLink>
          <RouterLink to="/rules">规则管理</RouterLink>
        </div>
      </div>
      <div class="group" v-if="route.path.startsWith('/six-sigma')">
        <div class="g-title">六西格玛</div>
        <div class="row">
          <label class="hint">分箱
            <input type="number" v-model.number="sixBins" min="5" max="60" step="1" style="width:70px" />
          </label>
          <label class="hint" style="display:flex;align-items:center;gap:6px;"><input type="checkbox" v-model="sixShowSpec" /> 规格线</label>
          <label class="hint" style="display:flex;align-items:center;gap:6px;"><input type="checkbox" v-model="sixShowCtl" /> 控制线</label>
        </div>
        <div class="row">
          <button class="link" @click="toggleLabSim">{{ lab.simTimer ? '停止' : '启动' }}仿真</button>
          <button class="link" @click="sixExport('png')">导出图片</button>
          <button class="link" @click="sixExport('pdf')">导出PDF</button>
        </div>
      </div>
      <div class="group">
        <div class="g-title">通知控制</div>
        <div class="row">
          <label class="hint"><input type="checkbox" v-model="notiEnabled" /> 显示通知</label>
          <label class="hint"><input type="checkbox" v-model="notiCenterHidden" /> 隐藏通知中心</label>
          <label class="hint" title="移动端将通知面板展开为贴边近全宽"><input type="checkbox" v-model="notiFWM" /> 移动端全宽模式</label>
          <label class="hint"><input type="checkbox" v-model="soundEnabled" /> 声音</label>
          <label class="hint">音量
            <input type="range" min="0" max="1" step="0.05" v-model.number="sirenVolume" style="width:120px" />
          </label>
          <label class="hint">模式
            <select v-model="sirenPattern">
              <option value="double">双连</option>
              <option value="quad">四连</option>
            </select>
          </label>
        </div>
        <div class="row">
          <label class="hint"><input type="checkbox" v-model="browserNotiEnabled" /> 系统通知</label>
          <label class="hint"><input type="checkbox" v-model="emailEnabled" /> 邮件通知</label>
          <button class="link" @click="testSiren">测试铃声</button>
          <button class="link" @click="undoBatch">撤销最近批量</button>
        </div>
      </div>
    </div>
  </div>
  <button v-else class="global-dock-tab" :style="{ left: dockPos.x + 'px', top: dockPos.y + 'px' }" @click="dockOpen=true" @mousedown.prevent="onDockDragStart">控制</button>
</template>

<style scoped>
:root { --topnav-h: 48px; }

/* Floating dock */
.global-dock { position: fixed; z-index: 120; width: 260px; max-width: calc(100vw - 16px); border: 1px solid var(--color-border); border-radius: 12px; background: color-mix(in oklab, var(--color-background) 96%, transparent); box-shadow: 0 10px 30px rgba(0,0,0,.15); backdrop-filter: saturate(120%) blur(6px); }
.global-dock .dock-head { display:flex; align-items:center; justify-content:space-between; gap:8px; padding: 6px 8px; border-bottom: 1px solid var(--color-border); cursor: move; }
.global-dock .dock-body { display:flex; flex-direction: column; padding: 8px; gap: 6px; }
.global-dock .group { border:1px dashed rgba(148,163,184,.35); border-radius:8px; padding:6px; }
.global-dock .g-title { font-size:12px; color:#64748b; margin-bottom:4px; }
.global-dock .g-links { display:flex; flex-wrap:wrap; gap:6px; }
.global-dock .row { display:flex; align-items:center; gap:8px; flex-wrap:wrap; }
.global-dock .dock-body :deep(a) { padding:6px 8px; border-radius:8px; }
.global-dock .dock-body :deep(a.router-link-active) { background:#0ea5ff14; }
.global-dock .link.small { appearance:none; border:1px solid rgba(148,163,184,.35); background:transparent; color:#334155; padding:2px 6px; border-radius:6px; font-size:12px; }
.global-dock-tab { position: fixed; z-index: 120; width: 48px; height: 36px; border:1px solid var(--color-border); border-radius: 10px; background: color-mix(in oklab, var(--color-background) 94%, transparent); color:#334155; }

/* DevTools-style dock */
.dev-dock { position: fixed; z-index: 120; border: 1px solid var(--color-border); background: color-mix(in oklab, var(--color-background) 96%, transparent); box-shadow: 0 10px 30px rgba(0,0,0,.10); display:flex; flex-direction: column; }
.dev-dock.left { left: 0; top: var(--topnav-h); bottom: 0; border-radius: 0 12px 0 0; width: 320px; }
.dev-dock.right { right: 0; top: var(--topnav-h); bottom: 0; border-radius: 12px 0 0 0; width: 320px; }
.dev-dock.bottom { left: 0; right: 0; bottom: 0; border-radius: 12px 12px 0 0; height: 300px; }
.dev-dock .dock-head { display:flex; align-items:center; justify-content:space-between; gap:8px; padding: 6px 8px; border-bottom: 1px solid var(--color-border); }
.dev-dock .dock-body { flex:1; display:flex; flex-direction: column; padding: 8px; gap: 6px; overflow:auto; }
.dev-dock .group { border:1px dashed rgba(148,163,184,.35); border-radius:8px; padding:6px; }
.dev-dock .g-title { font-size:12px; color:#64748b; margin-bottom:4px; }
.dev-dock .g-links { display:flex; flex-wrap:wrap; gap:6px; }
.dev-dock .row { display:flex; align-items:center; gap:8px; flex-wrap:wrap; }
.dev-dock .link.small { appearance:none; border:1px solid rgba(148,163,184,.35); background:transparent; color:#334155; padding:2px 6px; border-radius:6px; font-size:12px; }
.dev-dock .ops { display:flex; align-items:center; gap:6px; }
.dev-dock .mode { font-size:12px; padding:2px 6px; border-radius:6px; }
.dev-dock .resizer { position:absolute; }
.dev-dock.left .resizer.x { right: -3px; top: 0; bottom: 0; width: 6px; cursor: ew-resize; }
.dev-dock.right .resizer.x { left: -3px; top: 0; bottom: 0; width: 6px; cursor: ew-resize; }
.dev-dock.bottom .resizer.y { left: 0; right: 0; top: -3px; height: 6px; cursor: ns-resize; }
</style>
