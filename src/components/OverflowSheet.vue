<template>
  <!-- "Day is too full": the stops that don't fit, each with its own day picker (set to our suggestion).
       Each day shows how much time it has left, and that updates as you choose. -->
  <Teleport to="body">
    <transition name="os-fade">
      <div v-if="open" class="os-overlay" @click.self="emit('close')" @keydown.esc="emit('close')">
        <aside ref="panel" class="os" role="dialog" aria-modal="true" aria-labelledby="os-title" tabindex="-1">
          <header class="os-head">
            <div>
              <p class="os-kicker">Day {{ dayNumber }} is too full</p>
              <h3 id="os-title" class="os-title">Where should these go?</h3>
              <p class="os-sub">{{ reason }}. We picked a day for each one. Change any of them.</p>
            </div>
            <button type="button" class="os-x" aria-label="Close" @click="emit('close')"><AppIcon name="x" :size="18" /></button>
          </header>

          <div class="os-body">
            <div v-if="noRoom" class="os-noroom">
              <span>No other day has room left.</span>
              <button v-if="canAddDay" type="button" class="os-outline" @click="emit('add-day')">+ Add a day</button>
            </div>

            <ul class="os-list">
              <li v-for="r in rows" :key="r.id" class="os-row">
                <div class="os-thumb" :style="r.photo ? { backgroundImage: 'url(' + r.photo + ')' } : null" aria-hidden="true">
                  <span v-if="!r.photo">{{ r.icon }}</span>
                </div>
                <div class="os-main">
                  <label :for="'os-' + r.id" class="os-name">{{ r.name }}</label>
                  <small class="os-dur">{{ hoursText(r.duration) }}</small>
                  <CustomDropdown :id="'os-' + r.id" v-model="choice[r.id]" :options="optionsFor(r)" block :aria-label="'Where ' + r.name + ' goes'" />
                  <small v-if="warnFor(r)" class="os-warn">{{ warnFor(r) }}</small>
                </div>
              </li>
            </ul>
          </div>

          <footer class="os-foot">
            <button type="button" class="os-outline" @click="emit('close')">Cancel</button>
            <button type="button" class="os-cta" :disabled="!moving" @click="apply">{{ moving ? 'Move ' + moving + ' stop' + (moving === 1 ? '' : 's') : 'Nothing to move' }}</button>
          </footer>
        </aside>
      </div>
    </transition>
  </Teleport>
</template>

<script setup>
import { ref, computed, watch, nextTick } from 'vue'
import AppIcon from './AppIcon.vue'
import CustomDropdown from './CustomDropdown.vue'

const props = defineProps({
  open: { type: Boolean, default: false },
  rows: { type: Array, default: () => [] },   // [{ id, name, duration, photo, icon, suggested }]
  days: { type: Array, default: () => [] },   // other days: [{ date, label, free, otherCity }]
  dayNumber: { type: Number, default: 1 },
  reason: { type: String, default: '' },
  canAddDay: { type: Boolean, default: false }
})
const emit = defineEmits(['close', 'apply', 'add-day'])
const panel = ref(null)
const choice = ref({}) // stop id -> a date, 'saved' or 'keep'

// Fresh choices (our suggestions) every time it opens
watch(() => props.open, (open) => {
  if (!open) return
  const c = {}
  for (const r of props.rows) c[r.id] = r.suggested || 'saved'
  choice.value = c
  nextTick(() => panel.value && panel.value.focus())
})

// Time left on a day after the stops you've sent there (not counting this one)
function freeOn(date, exceptId) {
  let free = 0
  for (const d of props.days) if (d.date === date) free = d.free
  for (const r of props.rows) {
    if (r.id !== exceptId && choice.value[r.id] === date) free -= r.duration || 1
  }
  return free
}
function hoursText(h) {
  const mins = Math.round(h * 60)
  if (mins < 60) return mins + ' min'
  return Math.floor(mins / 60) + ' h' + (mins % 60 ? ' ' + (mins % 60) + ' min' : '')
}
// Every other day (with the time it has left), then Saved places, then keeping it here
function optionsFor(r) {
  const list = []
  for (const d of props.days) {
    const free = freeOn(d.date, r.id)
    const room = free >= 0.25 ? hoursText(free) + ' free' : 'Full'
    list.push({ value: d.date, label: d.label, description: room + (d.otherCity ? ' · ' + d.otherCity : '') })
  }
  list.push({ value: 'saved', label: 'Back to Saved places', icon: '📌' })
  list.push({ value: 'keep', label: 'Keep on Day ' + props.dayNumber, description: 'Still runs past the end of the day' })
  return list
}
// A gentle note when a choice overfills a day (still allowed)
function warnFor(r) {
  const c = choice.value[r.id]
  if (c === 'keep') return 'It will still run past the end of the day.'
  if (c === 'saved') return ''
  if (freeOn(c, r.id) < (r.duration || 1) - 0.01) return "That day doesn't have time for it."
  return ''
}
const noRoom = computed(() => {
  for (const d of props.days) if (d.free >= 0.5) return false
  return true
})
const moving = computed(() => {
  let n = 0
  for (const r of props.rows) if (choice.value[r.id] && choice.value[r.id] !== 'keep') n++
  return n
})
function apply() {
  const moves = []
  for (const r of props.rows) {
    const c = choice.value[r.id]
    if (c && c !== 'keep') moves.push({ id: r.id, date: c })
  }
  emit('apply', moves)
}
</script>

<style scoped>
.os-overlay {
  position: fixed;
  inset: 0;
  z-index: 1290;
  background: rgba(0, 40, 62, 0.35);
}
.os {
  position: absolute;
  top: 0;
  right: 0;
  bottom: 0;
  width: min(480px, 100%);
  display: flex;
  flex-direction: column;
  background: #fbf5ea;
  color: #003d5b;
  box-shadow: -18px 0 40px rgba(0, 40, 62, 0.18);
  outline: none;
  animation: os-in 0.22s ease-out;
}
@keyframes os-in {
  from { transform: translateX(30px); opacity: 0; }
}
.os-head {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 10px;
  padding: 20px 20px 10px;
}
.os-kicker {
  margin: 0;
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: #d1495b;
}
.os-title {
  margin: 2px 0 0;
  font-family: var(--font-display);
  font-size: 1.3rem;
  font-weight: 800;
}
.os-sub {
  margin: 4px 0 0;
  font-size: 13px;
  color: #5a6b78;
}
.os-x {
  flex-shrink: 0;
  width: 36px;
  height: 36px;
  border: 0;
  border-radius: 50%;
  background: #f4efe6;
  color: #5a6b78;
}
.os-x:hover {
  background: #e6dfd2;
}
.os-body {
  flex: 1;
  overflow-y: auto;
  padding: 6px 20px 16px;
}
.os-noroom {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 8px;
  margin: 0 0 12px;
  padding: 10px 14px;
  border-radius: 16px;
  background: #fbefd9;
  border: 1px solid #f3d29a;
  font-size: 13.5px;
  font-weight: 600;
}
.os-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.os-row {
  display: flex;
  gap: 12px;
  padding: 12px;
  border-radius: 18px;
  background: #fbf5ea;
  border: 1.5px solid #ece4d6;
}
.os-thumb {
  flex: none;
  width: 56px;
  height: 56px;
  border-radius: 14px;
  display: grid;
  place-items: center;
  font-size: 22px;
  background: #f4efe6 center / cover no-repeat;
}
.os-main {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.os-name {
  font-size: 15px;
  font-weight: 700;
  color: #001d2c;
}
.os-dur {
  font-size: 12px;
  color: #5a6b78;
}
.os-warn {
  margin-top: 4px;
  font-size: 12px;
  font-weight: 600;
  color: #a33a48;
}
.os-foot {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  padding: 14px 20px 20px;
  border-top: 1px solid #ece4d6;
}
.os-cta,
.os-outline {
  border-radius: 999px;
  font-weight: 700;
  font-size: 14px;
  padding: 9px 18px;
}
.os-cta {
  border: 0;
  background: #003d5b;
  color: #fff;
}
.os-cta:disabled {
  opacity: 0.5;
}
.os-outline {
  border: 1.5px solid #003d5b;
  background: transparent;
  color: #003d5b;
}
.os-x:focus-visible,
.os-cta:focus-visible,
.os-outline:focus-visible {
  outline: 3px solid rgba(237, 174, 73, 0.7);
  outline-offset: 2px;
}
.os-fade-enter-active,
.os-fade-leave-active {
  transition: opacity 0.2s;
}
.os-fade-enter-from,
.os-fade-leave-to {
  opacity: 0;
}
@media (max-width: 640px) {
  .os {
    top: auto;
    left: 0;
    width: 100%;
    max-height: 88vh;
    border-radius: 24px 24px 0 0;
    animation-name: os-up;
  }
  @keyframes os-up {
    from { transform: translateY(40px); opacity: 0; }
  }
}
@media (prefers-reduced-motion: reduce) {
  .os { animation: none; }
}
/* =====================================================================
   Travel journal look for this side panel (colours from src/assets/scrapbook.css).
   These rules come last, so they replace the older styles above.
   ===================================================================== */
.os-overlay {
  background: rgba(18, 50, 74, 0.4);
}
.os {
  background:
    radial-gradient(rgba(18, 50, 74, 0.06) 1px, transparent 1.4px) 0 0 / 16px 16px,
    var(--sb-paper);
  color: var(--sb-ink);
  border-left: 3px solid var(--sb-ink);
  box-shadow: -6px 0 0 rgba(18, 50, 74, 0.18);
}
.os-head {
  border-bottom: 2px dashed rgba(18, 50, 74, 0.25);
  padding-bottom: 14px;
}
.os-title {
  font-family: var(--sb-display);
  font-weight: 400;
  font-size: 1.5rem;
  letter-spacing: 0.01em;
  line-height: 1.15;
  color: var(--sb-ink);
}
.os-sub {
  color: var(--sb-ink-soft);
  font-weight: 600;
}
.os-kicker {
  display: inline-block;
  margin-bottom: 6px;
  padding: 2px 9px;
  border: 2px solid var(--sb-ink);
  border-radius: 6px;
  background: var(--sb-amber);
  color: var(--sb-ink);
  font-size: 11px;
  font-weight: 800;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  transform: rotate(-2deg);
}
.os-x {
  display: grid;
  place-items: center;
  border: 2px solid var(--sb-ink);
  border-radius: 50%;
  background: #fffdf8;
  color: var(--sb-ink);
  box-shadow: 0 3px 0 var(--sb-ink);
  transition: transform 0.15s var(--sb-spring), box-shadow 0.15s;
}
.os-x:hover {
  background: var(--sb-amber);
  color: var(--sb-ink);
  transform: translateY(-1px);
}
.os-x:active {
  transform: translateY(2px);
  box-shadow: 0 1px 0 var(--sb-ink);
}
@media (max-width: 640px) {
  .os {
    border-left: 0;
    border-top: 3px solid var(--sb-ink);
    box-shadow: 0 -6px 0 rgba(18, 50, 74, 0.18);
  }
}
.os-noroom {
  border: 2px solid var(--sb-ink);
  border-radius: 12px;
  background: #fff1cf;
  color: var(--sb-ink);
}
.os-row {
  border: 2px solid var(--sb-ink);
  border-radius: 12px;
  background: #fffdf8;
  color: var(--sb-ink);
  box-shadow: 0 3px 0 var(--sb-ink);
}
.os-thumb {
  border: 2px solid var(--sb-ink);
}
.os-name {
  color: var(--sb-ink);
  font-weight: 800;
}
.os-dur {
  color: var(--sb-ink-soft);
}
.os-warn {
  color: var(--sb-red);
  font-weight: 700;
}
.os-foot {
  border-top: 2px dashed rgba(18, 50, 74, 0.25);
  background: var(--sb-paper);
}
.os-cta {
  border: 2.5px solid var(--sb-ink);
  border-radius: 999px;
  background: var(--sb-amber);
  color: var(--sb-ink);
  font-family: var(--sb-display);
  font-weight: 400;
  letter-spacing: 0.02em;
  box-shadow: 0 4px 0 var(--sb-ink);
  transition: transform 0.15s var(--sb-spring), box-shadow 0.15s;
}
.os-cta:hover:not(:disabled) {
  background: var(--sb-amber-hi);
  color: var(--sb-ink);
  transform: translateY(-1px);
  box-shadow: 0 5px 0 var(--sb-ink);
}
.os-cta:active:not(:disabled) {
  transform: translateY(3px);
  box-shadow: 0 1px 0 var(--sb-ink);
}
.os-cta:disabled {
  background: #efe6d2;
  color: rgba(18, 50, 74, 0.5);
  border-color: rgba(18, 50, 74, 0.35);
  box-shadow: none;
  opacity: 1;
}
.os-outline {
  border: 2px solid var(--sb-ink);
  border-radius: 999px;
  background: #fffdf8;
  color: var(--sb-ink);
  font-weight: 800;
  box-shadow: 0 3px 0 var(--sb-ink);
}
.os-outline:hover:not(:disabled) {
  background: var(--sb-cream);
  color: var(--sb-ink);
}
</style>
