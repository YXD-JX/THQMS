<template>
  <svg :width="width" :height="height" :viewBox="`0 0 ${width} ${height}`">
    <path :d="path" fill="none" :stroke="color" :stroke-width="2" />
  </svg>
</template>

<script setup lang="ts">
import { computed } from 'vue'

interface Props {
  points: number[]
  color?: string
  width?: number
  height?: number
}
const props = withDefaults(defineProps<Props>(), {
  color: '#22c55e',
  width: 120,
  height: 28,
})

const path = computed(() => {
  const pts = props.points
  if (!pts || pts.length === 0) return ''
  const w = props.width, h = props.height
  const min = Math.min(...pts), max = Math.max(...pts)
  const span = max - min || 1
  const step = Math.max(1, Math.floor(w / Math.max(pts.length - 1, 1)))
  return pts.map((v, idx) => {
    const x = idx * step
    const y = h - ((v - min) / span) * h
    return `${idx === 0 ? 'M' : 'L'}${x},${y}`
  }).join(' ')
})
defineOptions({ name: 'ProcSparkline' })
</script>

<style scoped>
svg { display: block; }
</style>
