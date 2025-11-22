<script setup lang="ts">
import { RouterLink } from 'vue-router'
import { ref, onMounted } from 'vue'

const mobileMenuOpen = ref(false)
function toggleMenu() { mobileMenuOpen.value = !mobileMenuOpen.value }
function closeMenu() { mobileMenuOpen.value = false }

onMounted(()=>{
  window.addEventListener('resize', ()=>{ if (window.innerWidth > 960) mobileMenuOpen.value = false })
})
</script>

<template>
  <header class="topnav">
  <nav class="nav">
      <div class="left">
        <button class="hamburger" aria-label="切换菜单" @click="toggleMenu">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M3 6h18M3 12h18M3 18h18" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
          </svg>
        </button>
        <RouterLink to="/qms" class="brand" @click="closeMenu">QMS</RouterLink>
      </div>
  <div class="links desktop">
        <RouterLink to="/lab">实验室</RouterLink>
        <RouterLink to="/heatmap">3D热力图</RouterLink>
        <RouterLink to="/heatmap2d">2D热力图</RouterLink>
        <RouterLink to="/dosing">补加单据</RouterLink>
        <RouterLink to="/rules">规则管理</RouterLink>
        <RouterLink to="/process-quality">工序质量看板</RouterLink>
        <RouterLink to="/six-sigma">六西格玛</RouterLink>
        <RouterLink to="/trace">质量追溯</RouterLink>
        <RouterLink to="/standards">客户标准</RouterLink>
      </div>
      <div class="right">
        <slot name="right"></slot>
      </div>
    </nav>
    <!-- mobile dropdown panel -->
    <div v-if="mobileMenuOpen" class="menu-panel" @click.self="closeMenu">
      <div class="menu-body">
        <RouterLink to="/lab" @click="closeMenu">实验室</RouterLink>
        <RouterLink to="/heatmap" @click="closeMenu">3D热力图</RouterLink>
        <RouterLink to="/heatmap2d" @click="closeMenu">2D热力图</RouterLink>
        <RouterLink to="/dosing" @click="closeMenu">补加单据</RouterLink>
        <RouterLink to="/rules" @click="closeMenu">规则管理</RouterLink>
        <RouterLink to="/process-quality" @click="closeMenu">工序质量看板</RouterLink>
        <RouterLink to="/six-sigma" @click="closeMenu">六西格玛</RouterLink>
        <RouterLink to="/trace" @click="closeMenu">质量追溯</RouterLink>
        <RouterLink to="/standards" @click="closeMenu">客户标准</RouterLink>
      </div>
    </div>
  </header>
</template>

<style scoped>
/* expose a global CSS var for other components */
:global(:root) { --topnav-h: 48px; }
.topnav { position: sticky; top: 0; z-index: 100; border-bottom: 1px solid var(--color-border); backdrop-filter: saturate(120%) blur(6px); background: color-mix(in oklab, var(--color-background) 88%, transparent); }
.nav { height: var(--topnav-h); display: flex; align-items: center; justify-content: space-between; padding: 0 16px; gap: 12px; }
.brand { font-weight: 800; }
.links { display:flex; gap: 12px; }
.links :deep(a.router-link-active) { text-decoration: underline; }

/* hamburger */
.left { display:flex; align-items:center; gap: 8px; }
.hamburger { display:none; border:1px solid rgba(148,163,184,.35); background: transparent; border-radius:8px; width:32px; height:32px; align-items:center; justify-content:center; color:#334155; }

/* mobile dropdown */
.menu-panel { position: static; }
.menu-body { border-top: 1px solid var(--color-border); border-bottom: 1px solid var(--color-border); background: color-mix(in oklab, var(--color-background) 96%, transparent); backdrop-filter: saturate(120%) blur(6px); display:flex; flex-direction:column; padding: 8px 12px; gap: 6px; max-height: calc(100vh - var(--topnav-h)); overflow:auto; }
.menu-body :deep(a) { padding: 8px 10px; border-radius: 8px; }
.menu-body :deep(a.router-link-active) { background: #0ea5ff14; }

/* style for right slot dock toggle */
:deep(.dock-toggle) { appearance:none; border:1px solid rgba(148,163,184,.35); background:transparent; color:#334155; padding:4px 8px; border-radius:8px; font-size:12px; }

/* responsive */
@media (max-width: 960px) {
  .hamburger { display:flex; }
  .links.desktop { display:none; }
}

/* iOS Safari quirk: avoid heavy filters creating stacking issues */
@supports (-webkit-touch-callout: none) {
  .topnav { backdrop-filter: none; background: color-mix(in oklab, var(--color-background) 94%, transparent); }
}
</style>
