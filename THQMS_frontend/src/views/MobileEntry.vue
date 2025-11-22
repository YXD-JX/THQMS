<template>
  <div class="m-page">
    <header class="m-topbar">
      <button class="back" @click="$router.back()">◀</button>
      <div class="title">移动端 · 异常录入</div>
    </header>
    <main class="m-body">
      <MobileAnomalyForm />
    </main>
  </div>

</template>

<script lang="ts" setup>
import MobileAnomalyForm from '@/components/MobileAnomalyForm.vue';
</script>

<style scoped>
.m-page { min-height: 100vh; background: var(--color-background); color: var(--color-text); }
.m-topbar { position: sticky; top: 0; display: flex; align-items: center; gap: 8px; padding: 10px 12px; border-bottom: 1px solid var(--color-border); background: color-mix(in oklab, var(--color-background) 85%, transparent); backdrop-filter: blur(6px); z-index: 10; }
.back { border: 1px solid var(--color-border); background: transparent; border-radius: 8px; padding: 6px 8px; font-size: 16px; }
.title { font-weight: 700; }
.m-body { padding: 8px 8px 20px; }
</style>
