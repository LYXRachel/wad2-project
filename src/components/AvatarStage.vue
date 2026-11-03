<template>
  <!-- The 3D Travel Twin. Drag (or arrow keys) to turn it; the camera glides to whatever you're changing.
       play('celebrate') / play('hop') for the unlock pop-up and after saving. Click the twin and it waves, hops, spins or cheers. -->
  <div ref="wrap" class="av-stage" :class="{ dragging }" tabindex="0" role="group" aria-roledescription="3D preview"
    aria-label="Your travel twin. Drag, or use the left and right arrow keys, to turn it. Click it, or press Enter, and it does a little move."
    @pointerdown="onDown" @pointermove="onMove" @pointerup="onUp" @pointercancel="onCancel" @lostpointercapture="onCancel"
    @keydown="onKey">
    <canvas ref="canvas" class="av-canvas"></canvas>
    <div v-if="state === 'loading'" class="av-msg" role="status">
      <span class="av-spinner" aria-hidden="true"></span>
      Getting your twin ready…
    </div>
    <div v-else-if="state === 'error'" class="av-msg" role="alert">
      <AppIcon name="alert" :size="18" />
      The 3D preview couldn't load. You can still pick and save your look.
    </div>
  </div>
</template>

<script setup>
import { ref, watch, onMounted, onBeforeUnmount } from 'vue'
import { loadThree } from '../services/three.js'
import { buildAvatar } from '../avatarModel.js'
import AppIcon from './AppIcon.vue'

const props = defineProps({
  look: { type: Object, required: true },
  focus: { type: String, default: 'full' },   // full | face | body | legs | feet | back
  countries: { type: Number, default: 0 }    // souvenir pins
})
const emit = defineEmits(['ready'])

const wrap = ref(null)
const canvas = ref(null)
const state = ref('loading') // loading | ready | error
const dragging = ref(false)

// Where the camera looks, how far away it is, and which way the twin faces for each focus
const VIEWS = {
  full: { y: 1.0, dist: 4.7, yaw: 0.35 },
  face: { y: 1.8, dist: 1.75, yaw: 0.25 },
  body: { y: 1.15, dist: 2.7, yaw: 0.35 },
  legs: { y: 0.55, dist: 2.5, yaw: 0.35 },
  feet: { y: 0.22, dist: 1.9, yaw: 0.6 },
  back: { y: 1.15, dist: 2.9, yaw: Math.PI + 0.45 }
}
// Little moves (seconds): a celebration for new unlocks, a hop after saving
const MOVES = {
  celebrate: { name: 'celebrate', dur: 2.4 },
  hop: { name: 'hop', dur: 0.8 },
  wave: { name: 'wave', dur: 1.6 },
  spin: { name: 'spin', dur: 1.1 }
}
// Click (or tap) the twin and it does one of these, taking turns
const TAP_MOVES = ['wave', 'hop', 'spin', 'celebrate']
let tapTurn = 0

const still = window.matchMedia('(prefers-reduced-motion: reduce)').matches
// Slower phones/laptops: no shadows, fewer pixels
const lowPower = (navigator.hardwareConcurrency || 8) <= 4 || (navigator.deviceMemory || 8) <= 4 || !!(navigator.connection && navigator.connection.saveData)

let THREE = null
let renderer = null
let scene = null
let camera = null
let avatarParts = null
let avatarRoot = null
let platform = null
let frame = 0
let observer = null
let lastTime = 0
let nextBlink = 2
let move = null      // { m, start } while a move plays

// Springs: each value glides to its target (a little bounce, like the Sims camera)
const cam = { y: spring(1.05), dist: spring(4.4) }
const yaw = spring(0.35)
const pop = spring(1) // the twin squashes and springs back when something changes
function spring(v) {
  return { v, target: v, vel: 0 }
}
function step(s, dt, stiff = 80, damp = 0.82) {
  if (still) {
    s.v = s.target
    s.vel = 0
    return
  }
  const force = stiff * (s.target - s.v) - 2 * Math.sqrt(stiff) * damp * s.vel
  s.vel += force * dt
  s.v += s.vel * dt
}

// ---------- set up ----------
onMounted(async () => {
  try {
    THREE = await loadThree()
    renderer = new THREE.WebGLRenderer({ canvas: canvas.value, antialias: !lowPower, alpha: true, preserveDrawingBuffer: true })
  } catch (err) {
    state.value = 'error'
    return
  }
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, lowPower ? 1 : 2))
  renderer.shadowMap.enabled = !lowPower
  renderer.shadowMap.type = THREE.PCFSoftShadowMap
  renderer.toneMapping = THREE.ACESFilmicToneMapping
  renderer.toneMappingExposure = 1.05

  scene = new THREE.Scene()
  camera = new THREE.PerspectiveCamera(32, 1, 0.1, 60)

  // Lights: soft sky fill, a warm key light that casts the shadow, and two rim lights (amber + teal) from behind
  scene.add(new THREE.HemisphereLight('#fff6e6', '#d9c7a4', 1.0))
  const key = new THREE.DirectionalLight('#fff4e3', 2.4)
  key.position.set(2.2, 4, 3)
  key.castShadow = !lowPower
  key.shadow.mapSize.set(1024, 1024)
  key.shadow.camera.left = -1.5
  key.shadow.camera.right = 1.5
  key.shadow.camera.top = 3.2
  key.shadow.camera.bottom = -0.5
  key.shadow.bias = -0.0008
  key.shadow.radius = 4
  scene.add(key)
  const rimWarm = new THREE.DirectionalLight('#edae49', 2.6)
  rimWarm.position.set(-3, 2.5, -2.5)
  scene.add(rimWarm)
  const rimCool = new THREE.DirectionalLight('#5fc4d6', 1.6)
  rimCool.position.set(3, 1.5, -3)
  scene.add(rimCool)

  // The round platform it stands on: a cream compass rug with a navy rim (matches the app's paper look)
  platform = new THREE.Group()
  const rugMat = new THREE.MeshStandardMaterial({ color: '#f6ead2', roughness: 0.9 })
  const rugTop = new THREE.MeshStandardMaterial({ map: compassTexture(), roughness: 0.9 })
  const disc = new THREE.Mesh(new THREE.CylinderGeometry(0.85, 0.9, 0.1, 64), [rugMat, rugTop, rugMat])
  disc.position.y = -0.05
  disc.receiveShadow = true
  platform.add(disc)
  const edge = new THREE.Mesh(new THREE.TorusGeometry(0.86, 0.018, 8, 96), new THREE.MeshStandardMaterial({ color: '#12324a', roughness: 0.6 }))
  edge.rotation.x = Math.PI / 2
  platform.add(edge)
  scene.add(platform)

  rebuild()
  applyFocus(props.focus, true)
  resize()
  observer = new ResizeObserver(resize)
  observer.observe(wrap.value)
  state.value = 'ready'
  emit('ready')
  lastTime = performance.now()
  frame = requestAnimationFrame(tick)
})

// Free what this stage made (shared shapes stay: the next stage reuses them)
function disposeTree(obj) {
  obj.traverse((o) => {
    if (o.geometry && !o.geometry.userData.shared) o.geometry.dispose()
    if (o.material) {
      if (o.material.map) o.material.map.dispose()
      o.material.dispose()
    }
  })
}
onBeforeUnmount(() => {
  cancelAnimationFrame(frame)
  if (observer) observer.disconnect()
  if (scene) disposeTree(scene)
  if (renderer) renderer.dispose()
})

function resize() {
  if (!renderer || !wrap.value) return
  const w = wrap.value.clientWidth
  const h = wrap.value.clientHeight
  if (!w || !h) return
  renderer.setSize(w, h, false)
  camera.aspect = w / h
  camera.updateProjectionMatrix()
}

// ---------- the character ----------
function rebuild() {
  if (!scene) return
  if (avatarRoot) {
    scene.remove(avatarRoot)
    disposeTree(avatarRoot)
  }
  const built = buildAvatar(THREE, props.look, { countries: props.countries })
  avatarRoot = built.root
  avatarParts = built.parts
  avatarRoot.rotation.y = yaw.v
  scene.add(avatarRoot)
}
watch(() => JSON.stringify(props.look) + props.countries, () => {
  rebuild()
  pop.v = 0.94 // squash, then spring back
  pop.vel = 0
})

function applyFocus(name, now) {
  const v = VIEWS[name] || VIEWS.full
  cam.y.target = v.y
  cam.dist.target = v.dist
  // Turn to the view's angle the shortest way round (keeps any extra spins the user made)
  const turns = Math.round((yaw.target - v.yaw) / (Math.PI * 2))
  yaw.target = v.yaw + turns * Math.PI * 2
  if (now) {
    cam.y.v = v.y
    cam.dist.v = v.dist
    yaw.v = yaw.target
  }
}
watch(() => props.focus, (f) => applyFocus(f, false))

// ---------- moves ----------
function play(name) {
  if (state.value !== 'ready' || still || !MOVES[name]) return
  move = { m: MOVES[name], start: performance.now() / 1000 }
}
// 0 -> 1 -> 0 over a move (eased in and out), for "raise the arm, hold, lower it"
function envelope(p, inEnd = 0.2, outStart = 0.8) {
  if (p < inEnd) return ease(p / inEnd)
  if (p > outStart) return ease(1 - (p - outStart) / (1 - outStart))
  return 1
}
function ease(x) {
  return x < 0.5 ? 2 * x * x : 1 - Math.pow(-2 * x + 2, 2) / 2
}
// Height of a jump at p (0..1) of the airborne part
function hopHeight(p, h) {
  return 4 * h * p * (1 - p)
}

function applyMove(t) {
  const P = avatarParts
  const m = move.m
  const p = (t - move.start) / m.dur
  if (p >= 1) {
    for (const th of P.thumbs) th.visible = false
    move = null
    return
  }
  const e = envelope(p)
  const right = P.arms[1]
  const left = P.arms[0]
  if (m.name === 'hop') {
    const h = 0.22
    let y = 0
    if (p < 0.2) y = -0.06 * ease(p / 0.2) // crouch
    else if (p < 0.75) y = hopHeight((p - 0.2) / 0.55, h)
    else if (pop.v > 0.97 && move.landed !== true) {
      move.landed = true
      pop.v = 0.9 // squash on landing
      pop.vel = 0
    }
    P.body.position.y += y
    const arms = p > 0.2 && p < 0.75 ? 1 : 0
    left.rotation.z = -0.14 - arms * 2.2 * e
    right.rotation.z = 0.14 + arms * 2.2 * e
    for (const leg of P.legs) leg.rotation.x = p > 0.2 && p < 0.75 ? -0.25 : 0
  }
  if (m.name === 'wave') {
    // Right arm up, hand waving side to side
    right.rotation.z = 0.14 + e * 2.7
    right.rotation.x = -Math.sin(t * 14) * 0.35 * e
    P.head.rotation.z += 0.12 * e
  }
  if (m.name === 'spin') {
    // A little hop with a full twirl
    P.body.position.y += hopHeight(p, 0.18)
    avatarRoot.rotation.y = yaw.v + ease(p) * Math.PI * 2
    left.rotation.z = -0.14 - e * 0.9
    right.rotation.z = 0.14 + e * 0.9
  }
  if (m.name === 'celebrate') {
    // Two jumps with arms up, spinning on the second
    const q = p < 0.5 ? p / 0.5 : (p - 0.5) / 0.5
    P.body.position.y += hopHeight(q, p < 0.5 ? 0.35 : 0.55)
    left.rotation.z = -0.14 - e * 2.6 + Math.sin(t * 18) * 0.15 * e
    right.rotation.z = 0.14 + e * 2.6 - Math.sin(t * 18) * 0.15 * e
    if (p >= 0.5) avatarRoot.rotation.y = yaw.v + ease(q) * Math.PI * 2
  }
}

// ---------- animation loop ----------
function tick(now) {
  frame = requestAnimationFrame(tick)
  const dt = Math.min((now - lastTime) / 1000, 1 / 30)
  lastTime = now
  if (document.hidden || !avatarParts) return
  const t = now / 1000

  step(cam.y, dt, 60, 0.9)
  step(cam.dist, dt, 60, 0.9)
  step(yaw, dt, 70, 0.75)
  step(pop, dt, 220, 0.35)
  avatarRoot.rotation.y = yaw.v
  platform.rotation.y = yaw.v
  avatarRoot.scale.set(2 - pop.v, pop.v, 2 - pop.v)

  // Idle: breathing, a gentle sway, arms swinging a touch, blinking now and then
  const p = avatarParts
  if (!still) {
    p.body.position.y = Math.sin(t * 1.6) * 0.012
    p.chest.scale.set(1 + Math.sin(t * 1.6) * 0.012, 1, 1 + Math.sin(t * 1.6) * 0.018)
    p.head.rotation.set(0, Math.sin(t * 0.5) * 0.12, Math.sin(t * 0.7) * 0.03)
    p.arms[0].rotation.set(Math.sin(t * 0.8) * 0.05, 0, -0.14 - Math.sin(t * 1.6) * 0.03)
    p.arms[1].rotation.set(-Math.sin(t * 0.8) * 0.05, 0, 0.14 + Math.sin(t * 1.6) * 0.03)
    for (const leg of p.legs) leg.rotation.x = 0
    let blink = 1
    if (t > nextBlink) {
      const k = (t - nextBlink) / 0.14
      blink = k < 1 ? Math.abs(1 - 2 * k) : 1
      if (k >= 1) nextBlink = t + 2.5 + Math.random() * 3
    }
    for (const e of p.eyes) e.scale.y = 1.15 * Math.max(0.1, blink)
    if (move) applyMove(t)
  }

  camera.position.set(0, cam.y.v + cam.dist.v * 0.16, cam.dist.v)
  camera.lookAt(0, cam.y.v, 0)
  renderer.render(scene, camera)
}

// ---------- turning it ----------
let lastX = 0
let lastMoveT = 0
let speed = 0
let downX = 0
let downY = 0
let downT = 0
function onDown(e) {
  if (state.value !== 'ready') return
  dragging.value = true
  downX = e.clientX
  downY = e.clientY
  downT = performance.now()
  lastX = e.clientX
  lastMoveT = performance.now()
  speed = 0
  wrap.value.setPointerCapture(e.pointerId)
}
function onMove(e) {
  if (!dragging.value) return
  const dx = e.clientX - lastX
  const nowT = performance.now()
  lastX = e.clientX
  yaw.target += dx * 0.012
  speed = (dx * 0.012) / Math.max(1, nowT - lastMoveT) // radians per ms
  lastMoveT = nowT
}
function onUp(e) {
  if (!dragging.value) return
  dragging.value = false
  // A quick click that barely moved, on the twin itself: it does a little move
  const moved = Math.abs(e.clientX - downX) + Math.abs(e.clientY - downY)
  if (moved < 6 && performance.now() - downT < 400) {
    if (hitsTwin(e)) {
      play(TAP_MOVES[tapTurn % TAP_MOVES.length])
      tapTurn++
    }
    return
  }
  yaw.target += speed * 180 // a flick keeps it spinning a little further
}
// Is the pointer over the twin (not just the empty room)?
function hitsTwin(e) {
  if (!avatarRoot || !camera) return false
  const rect = canvas.value.getBoundingClientRect()
  const pointer = new THREE.Vector2(((e.clientX - rect.left) / rect.width) * 2 - 1, -((e.clientY - rect.top) / rect.height) * 2 + 1)
  const ray = new THREE.Raycaster()
  ray.setFromCamera(pointer, camera)
  return ray.intersectObject(avatarRoot, true).length > 0
}
function onCancel() {
  dragging.value = false
}
function onKey(e) {
  if (e.key === 'Enter') { e.preventDefault(); play(TAP_MOVES[tapTurn % TAP_MOVES.length]); tapTurn++ }
  if (e.key === 'ArrowLeft') { e.preventDefault(); yaw.target -= 0.5 }
  if (e.key === 'ArrowRight') { e.preventDefault(); yaw.target += 0.5 }
}

// ---------- a small picture of the face (for the nav bar, Crew tab, etc.) ----------
function snapshot() {
  if (state.value !== 'ready') return ''
  const size = 160
  const shot = new THREE.PerspectiveCamera(30, 1, 0.1, 20)
  shot.position.set(0, 1.86, 1.75)
  shot.lookAt(0, 1.72, 0)
  // Stand still for the photo
  const keepYaw = avatarRoot.rotation.y
  const keepY = avatarParts.body.position.y
  const keepRatio = renderer.getPixelRatio()
  const keepSize = new THREE.Vector2()
  renderer.getSize(keepSize)
  avatarRoot.rotation.y = 0.3
  avatarRoot.scale.set(1, 1, 1)
  avatarParts.body.position.y = 0
  avatarParts.head.rotation.set(0, 0, 0)
  for (const e of avatarParts.eyes) e.scale.y = 1.15
  platform.visible = false
  renderer.setPixelRatio(1)
  renderer.setSize(size * 2, size * 2, false)
  renderer.render(scene, shot)

  // Onto a navy circle background, then shrunk (sharper than drawing small)
  const out = document.createElement('canvas')
  out.width = size
  out.height = size
  const ctx = out.getContext('2d')
  const bg = ctx.createRadialGradient(size / 2, size * 0.4, 10, size / 2, size / 2, size * 0.7)
  bg.addColorStop(0, '#1d5b7a')
  bg.addColorStop(1, '#001d2c')
  ctx.fillStyle = bg
  ctx.fillRect(0, 0, size, size)
  ctx.drawImage(renderer.domElement, 0, 0, size * 2, size * 2, 0, 0, size, size)

  platform.visible = true
  avatarRoot.rotation.y = keepYaw
  avatarParts.body.position.y = keepY
  renderer.setPixelRatio(keepRatio)
  renderer.setSize(keepSize.x, keepSize.y, false)
  let url = out.toDataURL('image/webp', 0.85)
  if (!url.startsWith('data:image/webp')) url = out.toDataURL('image/jpeg', 0.85)
  return url
}
// The rug's top: cream with a dashed stitched ring and a simple navy compass rose
function compassTexture() {
  const c = document.createElement('canvas')
  c.width = c.height = 512
  const ctx = c.getContext('2d')
  ctx.fillStyle = '#f6ead2'
  ctx.fillRect(0, 0, 512, 512)
  ctx.translate(256, 256)
  ctx.strokeStyle = 'rgba(18, 50, 74, 0.55)'
  ctx.lineWidth = 6
  ctx.setLineDash([18, 14])
  ctx.beginPath()
  ctx.arc(0, 0, 222, 0, Math.PI * 2)
  ctx.stroke()
  ctx.setLineDash([])
  ctx.lineWidth = 4
  ctx.beginPath()
  ctx.arc(0, 0, 150, 0, Math.PI * 2)
  ctx.stroke()
  // Four long points (amber north) and four short ones
  for (let i = 0; i < 8; i++) {
    const long = i % 2 === 0
    const len = long ? 200 : 110
    ctx.save()
    ctx.rotate((i * Math.PI) / 4)
    ctx.beginPath()
    ctx.moveTo(0, -len)
    ctx.lineTo(long ? 26 : 16, 0)
    ctx.lineTo(0, 0)
    ctx.closePath()
    ctx.fillStyle = i === 0 ? '#ffbf3c' : 'rgba(18, 50, 74, 0.75)'
    ctx.fill()
    ctx.beginPath()
    ctx.moveTo(0, -len)
    ctx.lineTo(long ? -26 : -16, 0)
    ctx.lineTo(0, 0)
    ctx.closePath()
    ctx.fillStyle = i === 0 ? '#e09a12' : 'rgba(18, 50, 74, 0.4)'
    ctx.fill()
    ctx.restore()
  }
  const tex = new THREE.CanvasTexture(c)
  tex.colorSpace = THREE.SRGBColorSpace
  return tex
}
defineExpose({ snapshot, play })
</script>

<style scoped>
.av-stage {
  position: relative;
  width: 100%;
  height: 100%;
  min-height: 260px;
  cursor: grab;
  touch-action: pan-y; /* sideways drags turn the twin; scrolling the page still works */
  outline: none;
  background:
    radial-gradient(55% 45% at 50% 40%, rgba(255, 191, 60, 0.22), transparent 70%),
    radial-gradient(circle, rgba(18, 50, 74, 0.07) 1.2px, transparent 1.5px) 0 0 / 22px 22px,
    linear-gradient(180deg, #fff6e4 0%, #f6ead2 100%);
}
.av-stage.dragging {
  cursor: grabbing;
}
.av-stage:focus-visible {
  box-shadow: inset 0 0 0 3px var(--sb-teal, #2fa7b8);
}
.av-canvas {
  display: block;
  width: 100%;
  height: 100%;
}
.av-msg {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  padding: 24px;
  text-align: center;
  color: var(--sb-ink, #12324a);
  font-size: 14px;
  font-weight: 600;
}
.av-spinner {
  width: 18px;
  height: 18px;
  border-radius: 50%;
  border: 2px solid rgba(237, 174, 73, 0.25);
  border-top-color: #edae49;
  animation: av-spin 0.8s linear infinite;
}
@keyframes av-spin {
  to { transform: rotate(360deg); }
}
@media (prefers-reduced-motion: reduce) {
  .av-spinner { animation: none; }
}
</style>
