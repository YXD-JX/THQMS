<script setup lang="ts">
import { RouterView } from 'vue-router'
import TopNav from '@/components/layout/TopNav.vue'
import ControlDock from '@/components/layout/ControlDock.vue'
import TopNotiStack from '@/components/TopNotiStack.vue'

// 控制抽屉开关（可持久化在 ControlDock 内部）
import { ref, onMounted, onBeforeUnmount } from 'vue'
const DOCK_OPEN_KEY = 'thqms.ui.dock.open.v1'
function lsGetJSON<T>(key: string, fallback: T): T {
  try { const s = localStorage.getItem(key); return s==null ? fallback : JSON.parse(s) as T } catch { return fallback }
}
const dockOpen = ref<boolean>(lsGetJSON<boolean>(DOCK_OPEN_KEY, false))
function setDockOpen(v:boolean){ dockOpen.value=v; try{ localStorage.setItem(DOCK_OPEN_KEY, JSON.stringify(v)) }catch{} }
function toggleDock(){ setDockOpen(!dockOpen.value) }

// 控制是否隐藏通知中心（仅 UI），来自 ControlDock 的设置
const NOTI_CENTER_HIDDEN_KEY = 'thqms.ui.noti.center.hidden.v1'
const notiCenterHidden = ref<boolean>(lsGetJSON<boolean>(NOTI_CENTER_HIDDEN_KEY, false))
function onNotiHiddenEvent(e: Event){ try { const det = (e as CustomEvent).detail; if (det && typeof det.hidden === 'boolean') notiCenterHidden.value = det.hidden } catch {} }
onMounted(()=>{ try { window.addEventListener('ui:noti-center-hidden', onNotiHiddenEvent as EventListener) } catch {} })
onBeforeUnmount(()=>{ try { window.removeEventListener('ui:noti-center-hidden', onNotiHiddenEvent as EventListener) } catch {} })
</script>

<template>
  <TopNav>
    <template #right>
      <button class="dock-toggle" aria-label="切换控制面板" @click="toggleDock">{{ dockOpen ? '隐藏控制' : '显示控制' }}</button>
    </template>
  </TopNav>
  <TopNotiStack v-if="!notiCenterHidden" />
  <div class="route-wrap">
    <RouterView />
  </div>

  <ControlDock v-model:open="dockOpen" />

</template>

<style scoped>
.route-wrap { padding-top: 0; }
/* 顶部已由 TopNav 提供全局样式变量 */
</style>
