<template>
  <!-- Smart Schedule: the itinerary's settings + what the scheduler just did -->
  <section class="sp" aria-labelledby="sp-title">
    <header class="sp-head">
      <div class="sp-titles">
        <h3 id="sp-title" class="sp-title"><span class="sp-spark" aria-hidden="true"><AppIcon name="sparkles" :size="18" /></span> Smart Schedule</h3>
        <p class="sp-sub">Automatically balances travel time, crowd levels and the weather.</p>
      </div>
      <div class="sp-head-right">
        <span v-if="saveText" class="sp-saved" :class="{ bad: saveText.startsWith('Could not') }" role="status">{{ saveText }}</span>
      </div>
    </header>

    <!-- Controls -->
    <div class="sp-controls">
      <div class="sp-control">
        <span class="sp-label" id="sp-hours">Active hours</span>
        <div class="sp-hours" role="group" aria-labelledby="sp-hours">
          <AppIcon name="clock" :size="16" />
          <CustomDropdown v-model="form.dayStart" :options="startChoices" size="sm" class="sp-time" header-text="Day starts" aria-label="Day starts" :searchable="false" />
          <span class="sp-dash" aria-hidden="true">–</span>
          <CustomDropdown v-model="form.dayEnd" :options="endChoices" size="sm" class="sp-time" header-text="Day ends" aria-label="Day ends" :searchable="false" />
        </div>
      </div>

      <div class="sp-control">
        <span class="sp-label" id="sp-crowd">Avoid peak crowds</span>
        <div class="sp-seg" role="radiogroup" aria-labelledby="sp-crowd">
          <button v-for="c in CROWD" :key="c.value" type="button" role="radio" :aria-checked="form.crowdSensitivity === c.value"
            :class="{ on: form.crowdSensitivity === c.value }" :title="c.hint" @click="form.crowdSensitivity = c.value">{{ c.label }}</button>
        </div>
      </div>

      <div class="sp-control">
        <span class="sp-label" id="sp-buffer">Transit buffer</span>
        <div class="sp-seg" role="radiogroup" aria-labelledby="sp-buffer">
          <button v-for="b in BUFFER" :key="b.value" type="button" role="radio" :aria-checked="form.travelBuffer === b.value"
            :class="{ on: form.travelBuffer === b.value }" @click="form.travelBuffer = b.value">{{ b.label }}</button>
        </div>
      </div>
    </div>

    <!-- What the scheduler is doing -->
    <p class="sp-status" :class="'is-' + (status.kind || 'idle')" role="status" aria-live="polite">
      <span class="sp-status-icon" aria-hidden="true">{{ ICONS[status.kind] || '•' }}</span>
      <span>{{ hoursError || status.text }}</span>
    </p>
  </section>
</template>

<script setup>
// Smart Schedule settings. Changes apply at once (the planner re-times the day) and are saved a moment later.
import { reactive, ref, computed, watch } from 'vue'
import { prefs, savePreferences } from '../preferences.js'
import CustomDropdown from './CustomDropdown.vue'
import AppIcon from './AppIcon.vue'

const props = defineProps({
  saveStatus: { type: String, default: '' },                                  // itinerary saving
  status: { type: Object, default: () => ({ kind: 'idle', text: '' }) }       // from the planner
})

const CROWD = [
  { value: 'low', label: 'Relaxed', hint: "Crowds don't bother me much" },
  { value: 'medium', label: 'Balanced', hint: 'Avoid the worst peaks' },
  { value: 'high', label: 'Strict', hint: 'Avoid busy times wherever possible' }
]
const BUFFER = [
  { value: 0, label: '0m' },
  { value: 0.25, label: '15m' },
  { value: 0.5, label: '30m' },
  { value: 1, label: '1h' }
]
const ICONS = { ok: '✓', fixed: '⚡', warn: '⚠', idle: '•', busy: '…' }

function hourLabel(h) {
  if (h === 24) return 'Midnight'
  const hour = h % 24
  return (hour % 12 === 0 ? 12 : hour % 12) + ':00 ' + (hour >= 12 ? 'PM' : 'AM')
}
const startChoices = []
for (let h = 5; h <= 12; h++) startChoices.push({ value: h, label: hourLabel(h) })
const endChoices = []
for (let h = 16; h <= 24; h++) endChoices.push({ value: h, label: hourLabel(h) })

// ----- the settings: apply now, save shortly after -----
const form = reactive({ ...prefs })
watch(prefs, (p) => {
  // Loaded from the server (or changed elsewhere): show it
  for (const key in p) if (form[key] !== p[key]) form[key] = p[key]
})

const hoursError = computed(() => (form.dayEnd - form.dayStart < 4 ? 'Your day needs to be at least 4 hours long.' : ''))
const saving = ref('')
let timer = null

watch(form, () => {
  let changed = false
  for (const key in form) if (form[key] !== prefs[key]) changed = true
  if (!changed || hoursError.value) return
  Object.assign(prefs, form) // the planner re-times the open day straight away
  saving.value = 'Saving…'
  clearTimeout(timer)
  timer = setTimeout(async () => {
    try {
      await savePreferences({ ...form })
      saving.value = 'Saved'
      setTimeout(() => { if (saving.value === 'Saved') saving.value = '' }, 2000)
    } catch (err) {
      saving.value = 'Could not save settings'
    }
  }, 600)
})

const saveText = computed(() => saving.value || props.saveStatus)
</script>

<style scoped>
/* Smart Schedule in the travel journal look (colours from src/assets/scrapbook.css) */
.sp {
  position: relative;
  background: #fffdf8;
  color: var(--sb-ink);
  border: 2.5px solid var(--sb-ink);
  border-radius: 18px;
  box-shadow: 0 5px 0 var(--sb-ink);
  padding: 18px 20px;
  margin-bottom: 22px;
}
.sp-head {
  display: flex;
  flex-wrap: wrap;
  justify-content: space-between;
  align-items: flex-start;
  gap: 12px;
}
.sp-title {
  display: flex;
  align-items: center;
  gap: 10px;
  margin: 0;
  font-family: var(--sb-display);
  font-weight: 400;
  font-size: 1.45rem;
  letter-spacing: 0.01em;
  color: var(--sb-ink);
}
.sp-spark {
  display: grid;
  place-items: center;
  width: 34px;
  height: 34px;
  border: 2px solid var(--sb-ink);
  border-radius: 10px;
  background: var(--sb-amber);
  color: var(--sb-ink);
  box-shadow: 0 2px 0 var(--sb-ink);
  transform: rotate(-6deg);
}
.sp-sub {
  margin: 4px 0 0;
  font-size: 13.5px;
  font-weight: 600;
  color: var(--sb-ink-soft);
}
.sp-head-right {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-left: auto;
}
.sp-saved {
  padding: 3px 10px;
  border: 2px solid var(--sb-ink);
  border-radius: 6px;
  background: #d9f2e4;
  color: #17603f;
  font-size: 12px;
  font-weight: 800;
  transform: rotate(2deg);
}
.sp-saved.bad {
  background: #fde0dc;
  color: #a3262a;
}

/* Controls: one cream strip, three settings */
.sp-controls {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, auto));
  justify-content: start;
  gap: 14px 28px;
  margin-top: 16px;
  padding: 14px 16px;
  background: var(--sb-cream);
  border: 2px dashed rgba(18, 50, 74, 0.3);
  border-radius: 14px;
}
.sp-control {
  display: flex;
  flex-direction: column;
  gap: 7px;
  min-width: 0;
}
.sp-label {
  font-size: 11px;
  font-weight: 800;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: var(--sb-ink-soft);
}
.sp-hours {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 3px 6px 3px 12px;
  border: 2px solid var(--sb-ink);
  border-radius: 999px;
  background: #fffdf8;
  color: var(--sb-ink);
  box-shadow: 0 3px 0 var(--sb-ink);
}
.sp-time :deep(.dd-trigger) {
  border: 0;
  border-radius: 999px;
  background: transparent;
  box-shadow: none;
  padding: 2px 8px;
  color: var(--sb-ink);
  font-weight: 800;
}
.sp-time :deep(.dd-trigger:hover),
.sp-time.open :deep(.dd-trigger) {
  background: rgba(255, 191, 60, 0.35);
}
.sp-dash {
  color: var(--sb-ink-soft);
  font-weight: 800;
}

/* Segmented controls: the picked one is an amber button */
.sp-seg {
  display: inline-flex;
  gap: 3px;
  padding: 3px;
  border: 2px solid var(--sb-ink);
  border-radius: 999px;
  background: #fffdf8;
  box-shadow: 0 3px 0 var(--sb-ink);
}
.sp-seg button {
  border: 0;
  border-radius: 999px;
  background: transparent;
  color: var(--sb-ink-soft);
  padding: 5px 13px;
  font-size: 13px;
  font-weight: 700;
  white-space: nowrap;
  transition: background 0.15s, color 0.15s, transform 0.15s var(--sb-spring);
}
.sp-seg button:hover {
  color: var(--sb-ink);
  background: var(--sb-cream);
}
.sp-seg button.on {
  background: var(--sb-amber);
  color: var(--sb-ink);
  font-weight: 800;
  box-shadow: inset 0 0 0 2px var(--sb-ink);
}

/* Status strip: a note from the scheduler */
.sp-status {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  margin: 14px 0 0;
  padding: 9px 12px;
  border: 2px solid rgba(18, 50, 74, 0.2);
  border-radius: 12px;
  font-size: 13.5px;
  font-weight: 600;
  background: #fffdf8;
  color: var(--sb-ink);
}
.sp-status-icon {
  flex: none;
  display: grid;
  place-items: center;
  width: 22px;
  height: 22px;
  border: 2px solid var(--sb-ink);
  border-radius: 50%;
  background: var(--sb-cream);
  font-size: 12px;
  font-weight: 800;
  line-height: 1;
}
.sp-status.is-ok {
  border-color: var(--sb-ink);
  background: #e6f6ec;
}
.sp-status.is-ok .sp-status-icon {
  background: #8fd6a8;
}
.sp-status.is-fixed {
  border-color: var(--sb-ink);
  background: #e3f4f7;
}
.sp-status.is-fixed .sp-status-icon {
  background: var(--sb-teal);
  color: #fff;
}
.sp-status.is-warn {
  border-color: var(--sb-ink);
  background: #fff1cf;
}
.sp-status.is-warn .sp-status-icon {
  background: var(--sb-amber);
}
.sp button:focus-visible {
  outline: 3px solid var(--sb-teal);
  outline-offset: 2px;
}

@media (max-width: 760px) {
  .sp-controls {
    grid-template-columns: 1fr;
  }
  .sp-hours,
  .sp-seg {
    align-self: flex-start;
  }
  .sp-head-right {
    margin-left: 0;
    width: 100%;
    justify-content: space-between;
  }
}
@media (max-width: 420px) {
  .sp {
    padding: 16px 14px;
  }
  .sp-controls {
    padding: 12px;
  }
  .sp-hours {
    max-width: 100%;
    padding-left: 10px;
  }
  .sp-time :deep(.dd-trigger) {
    padding: 2px 4px;
  }
}
@media (prefers-reduced-motion: reduce) {
  .sp-seg button {
    transition: none;
  }
}

/* Phones and touch screens: every control is at least 40px to tap (WCAG / Apple guidance) */
@media (pointer: coarse), (max-width: 560px) {
  .sp-seg button {
    min-height: 40px;
  }
}
</style>
