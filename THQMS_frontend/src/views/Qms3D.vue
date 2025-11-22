<script setup lang="ts">
import { onMounted, onBeforeUnmount, ref } from 'vue'
import * as THREE from 'three'

const container = ref<HTMLDivElement | null>(null)

let renderer: THREE.WebGLRenderer | null = null
let scene: THREE.Scene | null = null
let camera: THREE.PerspectiveCamera | null = null
let raf = 0

// objects
let ringGroup: THREE.Group | null = null
const pulseTimers: number[] = []
const spheres: THREE.Mesh[] = []

function init() {
  if (!container.value) return

  const width = container.value.clientWidth
  const height = container.value.clientHeight

  renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
  renderer.setSize(width, height)
  container.value.appendChild(renderer.domElement)

  scene = new THREE.Scene()
  scene.background = new THREE.Color('#07090f')

  camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 100)
  camera.position.set(0, 2.2, 6.5)
  camera.lookAt(0, 0, 0)

  // lights
  const ambient = new THREE.AmbientLight(0x5577aa, 1.2)
  scene.add(ambient)
  const key = new THREE.DirectionalLight(0x88ccff, 2.0)
  key.position.set(3, 5, 4)
  scene.add(key)
  const rim = new THREE.PointLight(0x00e0ff, 2.2, 20)
  rim.position.set(-4, -1, -3)
  scene.add(rim)

  // base grid (hex-like via two rotated grids)
  const grid1 = new THREE.GridHelper(30, 30, 0x0a2a55, 0x0a2a55)
  grid1.rotation.x = Math.PI / 2
  grid1.position.y = -1.25
  scene.add(grid1)
  const grid2 = grid1.clone()
  grid2.rotation.z = Math.PI / 3
  scene.add(grid2)

  // central torus (Sigma aura)
  const torusGeo = new THREE.TorusGeometry(1.2, 0.08, 32, 200)
  const torusMat = new THREE.MeshStandardMaterial({ color: 0x00bcd4, emissive: 0x003344, metalness: 0.6, roughness: 0.25 })
  const torus = new THREE.Mesh(torusGeo, torusMat)
  torus.position.y = 0.15
  scene.add(torus)

  // six-sigma orbit ring
  ringGroup = new THREE.Group()
  scene.add(ringGroup)

  const sphereGeo = new THREE.SphereGeometry(0.16, 32, 32)
  const baseColor = new THREE.Color('#4af5ff')
  const dangerColor = new THREE.Color('#ff3366')

  const orbitRadius = 2.1
  for (let i = 0; i < 6; i++) {
    const mat = new THREE.MeshStandardMaterial({ color: baseColor.clone(), emissive: new THREE.Color('#062833'), metalness: 0.7, roughness: 0.3 })
    const m = new THREE.Mesh(sphereGeo, mat)
    const angle = (i / 6) * Math.PI * 2
    m.position.set(Math.cos(angle) * orbitRadius, 0.25, Math.sin(angle) * orbitRadius)
    m.userData = { baseColor: baseColor.clone(), dangerColor: dangerColor.clone(), pulse: 0 }
    ringGroup.add(m)
    spheres.push(m)
    pulseTimers.push(0)
  }

  // connectors
  const lineMat = new THREE.LineBasicMaterial({ color: 0x0b84a5, transparent: true, opacity: 0.7 })
  const ringPath = new THREE.BufferGeometry()
  const ringPts: THREE.Vector3[] = []
  for (let i = 0; i <= 60; i++) {
    const t = (i / 60) * Math.PI * 2
    ringPts.push(new THREE.Vector3(Math.cos(t) * orbitRadius, 0.25, Math.sin(t) * orbitRadius))
  }
  ringPath.setFromPoints(ringPts)
  const ringLine = new THREE.Line(ringPath, lineMat)
  ringGroup.add(ringLine)

  // subtle floating particles
  const pGeo = new THREE.BufferGeometry()
  const pCount = 500
  const positions = new Float32Array(pCount * 3)
  for (let i = 0; i < pCount; i++) {
    positions[i * 3 + 0] = (Math.random() - 0.5) * 16
    positions[i * 3 + 1] = Math.random() * 6 - 1
    positions[i * 3 + 2] = (Math.random() - 0.5) * 16
  }
  pGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3))
  const pMat = new THREE.PointsMaterial({ color: 0x0bd7ff, size: 0.02, transparent: true, opacity: 0.6 })
  const points = new THREE.Points(pGeo, pMat)
  scene.add(points)

  // animate
  const clock = new THREE.Clock()
  const tmpColor = new THREE.Color()
  const animate = () => {
    raf = requestAnimationFrame(animate)
    const t = clock.getElapsedTime()
    if (ringGroup) {
      ringGroup.rotation.y = t * 0.15
    }
    torus.rotation.y = -t * 0.1
    points.rotation.y = t * 0.02

    // pulse decay and orbit wobble
    spheres.forEach((s, idx) => {
      const data = s.userData as { baseColor: THREE.Color; dangerColor: THREE.Color; pulse: number }
      // wobble
      const r = orbitRadius + Math.sin(t * 1.2 + idx) * 0.05
      const ang = (idx / 6) * Math.PI * 2 + t * 0.4
      s.position.x = Math.cos(ang) * r
      s.position.z = Math.sin(ang) * r

      // pulse color
      if (data.pulse > 0) {
        const k = Math.min(1, data.pulse)
        tmpColor.copy(data.baseColor).lerp(data.dangerColor, 0.6 * k + 0.2)
        ;(s.material as THREE.MeshStandardMaterial).color.copy(tmpColor)
        ;(s.material as THREE.MeshStandardMaterial).emissive.setHex(0x330014)
        data.pulse -= 0.01
      } else {
        ;(s.material as THREE.MeshStandardMaterial).color.copy(data.baseColor)
        ;(s.material as THREE.MeshStandardMaterial).emissive.setHex(0x062833)
      }
    })

    renderer!.render(scene!, camera!)
  }
  animate()

  // resize
  const onResize = () => {
    if (!container.value || !renderer || !camera) return
    const w = container.value.clientWidth
    const h = container.value.clientHeight
    camera.aspect = w / h
    camera.updateProjectionMatrix()
    renderer.setSize(w, h)
  }
  window.addEventListener('resize', onResize)
  type Ctx = HTMLDivElement & { _onResize?: () => void; _onAnomaly?: (e: Event) => void }
  ;(container.value as Ctx)._onResize = onResize

  // anomaly linkage: pulse random sphere
  const onAnomaly = () => {
    if (spheres.length === 0) return
    const idx = Math.floor(Math.random() * spheres.length)
    const data = spheres[idx].userData as { pulse: number }
    data.pulse = 1.0
  }
  window.addEventListener('lab-anomaly', onAnomaly as EventListener)
  ;(container.value as Ctx)._onAnomaly = onAnomaly
}

onMounted(() => init())

onBeforeUnmount(() => {
  type Ctx = HTMLDivElement & { _onResize?: () => void; _onAnomaly?: (e: Event) => void }
  if (container.value && (container.value as Ctx)._onResize) {
    window.removeEventListener('resize', (container.value as Ctx)._onResize!)
  }
  if (container.value && (container.value as Ctx)._onAnomaly) {
    window.removeEventListener('lab-anomaly', (container.value as Ctx)._onAnomaly as EventListener)
  }
  if (raf) cancelAnimationFrame(raf)
  spheres.length = 0
  pulseTimers.length = 0
  if (renderer) {
    renderer.dispose()
    renderer.forceContextLoss?.()
  }
  scene = null
  camera = null
  renderer = null
})
</script>

<template>
  <div class="qms3d">
    <div class="hud">
      <div class="title">QMS · 六西格玛 3D 仿真</div>
      <div class="sub">DMAIC 环 · 实时联动异常（收到异常时会脉冲高亮）</div>
    </div>
    <div ref="container" class="viewport" />
    <div class="legend">
      <span class="dot ok"></span> 稳定 · <span class="dot warn"></span> 异常脉冲 · <span class="dot link"></span> 过程联动
    </div>
  </div>
</template>

<style scoped>
.qms3d { position: relative; width: 100%; height: calc(100vh - 48px); background: radial-gradient(1200px 600px at 50% 0%, rgba(0, 200, 255, 0.08), transparent 60%), #07090f; overflow: hidden; }
.viewport { position: absolute; inset: 0; }
.hud { position: absolute; left: 16px; top: 12px; z-index: 2; color: #e6f6ff; text-shadow: 0 1px 0 rgba(0,0,0,0.4); }
.title { font-size: 18px; font-weight: 800; letter-spacing: 0.5px; }
.sub { font-size: 12px; opacity: 0.8; }
.legend { position: absolute; right: 16px; bottom: 12px; font-size: 12px; color: #9feaff; opacity: 0.9; display: flex; align-items: center; gap: 8px; }
.dot { display: inline-block; width: 10px; height: 10px; border-radius: 50%; margin: 0 4px; }
.dot.ok { background: #4af5ff; box-shadow: 0 0 10px #4af5ff66; }
.dot.warn { background: #ff3366; box-shadow: 0 0 10px #ff336666; }
.dot.link { background: #0bd7ff; box-shadow: 0 0 10px #0bd7ff66; }
</style>
