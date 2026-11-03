<template>
  <form class="cd" @submit.prevent="submit" @keydown.esc="onEsc">
    <header class="cd-head">
      <strong>{{ title }}</strong>
      <span><AppIcon name="lock" :size="13" /> Only the crew sees this</span>
    </header>

    <!-- Crew title: one input, four quick picks -->
    <label class="cd-label" :for="uid + '-persona'">Crew title</label>
    <input :id="uid + '-persona'" v-model="form.persona" class="cd-input" maxlength="40" placeholder="Give yourself a title" autocomplete="off">
    <div class="cd-picks">
      <button v-for="s in PERSONAS" :key="s" type="button" class="cd-pick" :class="{ on: form.persona === s }"
        :aria-pressed="form.persona === s" @click="form.persona = form.persona === s ? '' : s">{{ s }}</button>
    </div>

    <!-- Flight: your own, or the same one as someone else (stored once, on their card) -->
    <span class="cd-label">Flight</span>
    <div v-if="flightBuddies.length" class="cd-seg" role="radiogroup" aria-label="Flight">
      <button type="button" role="radio" :aria-checked="!form.sameFlightAs" :class="{ on: !form.sameFlightAs }"
        @click="form.sameFlightAs = ''">My own</button>
      <button v-for="b in flightBuddies" :key="b.name" type="button" role="radio" :aria-checked="form.sameFlightAs === b.name"
        :class="{ on: form.sameFlightAs === b.name }" @click="form.sameFlightAs = b.name">
        Same as {{ b.name }}<span v-if="b.flight" class="cd-seg-sub"> · {{ b.flight }}</span>
      </button>
    </div>

    <p v-if="buddy" class="cd-buddy">
      <AppIcon name="plane" :size="14" /> {{ buddy.flight || 'Same arrival' }}<template v-if="buddy.arrival"> · lands {{ landText(buddy.arrival) }}</template>
      <span>Updates when {{ buddy.name }} changes it</span>
    </p>
    <div v-else class="cd-grid">
      <span>
        <label class="cd-mini" :for="uid + '-flight'">Flight number</label>
        <input :id="uid + '-flight'" v-model="form.flight" class="cd-input upper" maxlength="12" placeholder="SQ618" autocomplete="off">
      </span>
      <span>
        <label class="cd-mini" :for="uid + '-arr'">Lands (local time)</label>
        <input :id="uid + '-arr'" v-model="form.arrival" type="datetime-local" class="cd-input">
      </span>
    </div>

    <!-- Food needs + WhatsApp: people without an account fill these in here;
         everyone else sets them once in Settings and they show on every trip -->
    <template v-if="showContact">
      <label class="cd-label" :for="uid + '-diet'">Food needs</label>
      <DietTagsInput :id="uid + '-diet'" v-model="form.diet" />
      <label class="cd-label" :for="uid + '-phone'">WhatsApp</label>
      <PhoneInput :id="uid + '-phone'" v-model="form.phone" />
    </template>
    <p v-else-if="settingsNote" class="cd-note">
      <AppIcon name="utensils" :size="14" /> Food needs and <AppIcon name="message" :size="14" /> WhatsApp come from your <router-link to="/settings">Settings</router-link>, so you only fill them in once.
    </p>

    <p v-if="error" class="cd-err" role="alert">{{ error }}</p>
    <div class="cd-btns">
      <button type="button" class="cd-cancel" @click="emit('cancel')">Cancel</button>
      <button type="submit" class="cd-save" :disabled="saving">{{ saving ? 'Saving…' : 'Save' }}</button>
    </div>
  </form>
</template>

<script setup>
import { ref, reactive, computed } from 'vue'
import { PERSONAS } from '../crewOptions.js'
import DietTagsInput from './DietTagsInput.vue'
import PhoneInput from './PhoneInput.vue'
import AppIcon from './AppIcon.vue'

const props = defineProps({
  title: { type: String, default: 'Your details' },
  profile: { type: Object, default: () => ({}) },
  // Other travellers with their own flight: [{ name, flight, arrival }]
  flightBuddies: { type: Array, default: () => [] },
  showContact: { type: Boolean, default: true },   // food needs + WhatsApp fields (people without an account)
  settingsNote: { type: Boolean, default: false }, // "these come from your Settings" line (your own card)
  saving: { type: Boolean, default: false },
  error: { type: String, default: '' }
})
const emit = defineEmits(['save', 'cancel'])

const uid = 'cd' + Math.random().toString(36).slice(2, 8)
const p = props.profile

// Old cards kept extra food notes in dietNote: turn that into a tag
const startDiet = (p.diet || []).slice()
if (p.dietNote && !startDiet.includes(p.dietNote)) startDiet.push(p.dietNote)

const form = reactive({
  persona: p.persona || '',
  sameFlightAs: p.sameFlightAs || '',
  flight: p.flight || '',
  arrival: p.arrival || '',
  diet: startDiet,
  phone: p.phone || ''
})

// ----- Flight -----
const buddy = computed(() => {
  for (const b of props.flightBuddies) {
    if (b.name === form.sameFlightAs) return b
  }
  return null
})

function landText(value) {
  const d = new Date(value)
  return d.toLocaleDateString('en-SG', { day: 'numeric', month: 'short' }) + ', ' + value.slice(11, 16)
}

function onEsc(e) {
  emit('cancel')
  e.stopPropagation()
}

function submit() {
  const result = {
    persona: form.persona.trim(),
    sameFlightAs: form.sameFlightAs,
    flight: form.sameFlightAs ? '' : form.flight.trim().toUpperCase(),
    arrival: form.sameFlightAs ? '' : form.arrival
  }
  if (props.showContact) {
    result.diet = form.diet.slice()
    result.phone = form.phone
  }
  emit('save', result)
}
</script>

<style scoped>
/* Editing a crew card (scrapbook look; colours from src/assets/scrapbook.css) */
.cd {
  display: flex;
  flex-direction: column;
  color: var(--sb-ink);
}
.cd-head {
  display: flex;
  flex-wrap: wrap;
  justify-content: space-between;
  align-items: baseline;
  gap: 8px;
  margin-bottom: 4px;
}
.cd-head strong {
  font-family: var(--sb-display);
  font-weight: 400;
  font-size: 1.35rem;
}
.cd-head span {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 12px;
  font-weight: 700;
  color: var(--sb-muted);
}
.cd-label {
  margin: 14px 0 6px;
  font-size: 11px;
  font-weight: 800;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: var(--sb-ink-soft);
}
.cd-mini {
  display: block;
  margin-bottom: 4px;
  font-size: 12px;
  font-weight: 700;
  color: var(--sb-ink-soft);
}
.cd-input {
  width: 100%;
  min-height: 44px;
  padding: 8px 12px;
  border: 2px solid var(--sb-ink);
  border-radius: 12px;
  background: #fbf5ea;
  color: var(--sb-ink);
  font-size: 15px;
  font-weight: 600;
  color-scheme: light;
  transition: box-shadow 0.15s;
}
.cd-input.upper {
  text-transform: uppercase;
}
.cd-input::placeholder {
  color: #8a9aa6;
  font-weight: 500;
  text-transform: none;
}
.cd-input:focus {
  outline: none;
  box-shadow: 0 0 0 4px rgba(255, 191, 60, 0.45);
}

/* Quick picks */
.cd-picks {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-top: 8px;
}
.cd-pick {
  flex: none;
  padding: 4px 12px;
  border: 2px solid var(--sb-ink);
  border-radius: 10px;
  background: var(--sb-cream);
  color: var(--sb-ink);
  font-size: 13px;
  font-weight: 700;
  box-shadow: 0 2px 0 var(--sb-ink);
  transition: transform 0.1s, box-shadow 0.1s;
}
.cd-pick:hover {
  background: #fbf5ea;
}
.cd-pick.on {
  background: var(--sb-amber);
  transform: translateY(2px);
  box-shadow: 0 0 0 var(--sb-ink);
}

/* Own flight / same as someone */
.cd-seg {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  margin-bottom: 8px;
  padding: 4px;
  border: 2px solid var(--sb-ink);
  border-radius: 12px;
  background: var(--sb-cream);
}
.cd-seg button {
  border: 0;
  border-radius: 8px;
  background: transparent;
  color: var(--sb-ink-soft);
  padding: 6px 12px;
  font-size: 13px;
  font-weight: 700;
}
.cd-seg button:hover {
  color: var(--sb-ink);
}
.cd-seg button.on {
  background: var(--sb-amber);
  color: var(--sb-ink);
  box-shadow: inset 0 0 0 2px var(--sb-ink);
}
.cd-seg-sub {
  font-weight: 500;
}
.cd-buddy {
  margin: 0;
  padding: 10px 12px;
  border: 2px dashed var(--sb-amber-lo);
  border-radius: 12px;
  background: #fff4dc;
  font-size: 14px;
  font-weight: 700;
}
.cd-buddy span {
  display: block;
  font-size: 12px;
  font-weight: 600;
  color: var(--sb-muted);
}
.cd-grid {
  display: grid;
  grid-template-columns: 1fr 1.3fr;
  gap: 10px;
}

/* Food needs and WhatsApp fields (shared components): plain white boxes like the rest */
.cd :deep(.dt),
.cd :deep(.pi) {
  border: 2px solid var(--sb-ink);
  border-radius: 12px;
  background: #fbf5ea;
}
.cd :deep(.dt-input),
.cd :deep(.pi-number) {
  color: var(--sb-ink);
  font-weight: 600;
  color-scheme: light;
}
.cd :deep(.dt-tag) {
  border: 1.5px solid var(--sb-ink);
  border-radius: 8px;
  background: var(--sb-cream);
  color: var(--sb-ink);
}
.cd :deep(.dt-tag.allergy) {
  border-color: #b3263a;
  background: #ffe8e4;
  color: #8f1d2c;
}
.cd :deep(.pi-code .dd-trigger) {
  border: 0;
  border-right: 2px solid var(--sb-ink);
  border-radius: 0;
  background: var(--sb-cream);
  color: var(--sb-ink);
  box-shadow: none;
}

.cd-note {
  margin: 14px 0 0;
  padding: 10px 12px;
  border: 2px dashed var(--sb-stitch);
  border-radius: 12px;
  background: var(--sb-cream);
  font-size: 13px;
  font-weight: 600;
  color: var(--sb-ink-soft);
}
.cd-note a {
  color: var(--sb-ink);
  font-weight: 800;
  text-decoration-color: var(--sb-amber);
  text-decoration-thickness: 3px;
}
.cd-err {
  margin: 10px 0 0;
  color: #b3263a;
  font-size: 13px;
  font-weight: 700;
}
.cd-btns {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  margin-top: 16px;
}
.cd-cancel,
.cd-save {
  min-height: 44px;
  padding: 0 20px;
  border: var(--sb-line);
  border-radius: 14px;
  color: var(--sb-ink);
  font-weight: 800;
  box-shadow: var(--sb-pop-sm);
  transition: transform 0.12s, box-shadow 0.12s;
}
.cd-cancel {
  background: var(--sb-cream);
}
.cd-save {
  background: linear-gradient(180deg, var(--sb-amber-hi), var(--sb-amber) 55%, var(--sb-amber-lo));
  font-family: var(--sb-display);
  font-weight: 400;
  font-size: 1.05rem;
}
.cd-cancel:hover,
.cd-save:hover:not(:disabled) {
  transform: translateY(-2px);
  box-shadow: 0 5px 0 var(--sb-ink);
}
.cd-cancel:active,
.cd-save:active:not(:disabled) {
  transform: translateY(3px);
  box-shadow: 0 0 0 var(--sb-ink);
}
.cd-save:disabled {
  opacity: 0.6;
}
.cd button:focus-visible {
  outline: 3px solid var(--sb-teal);
  outline-offset: 2px;
}

@media (max-width: 420px) {
  .cd-grid {
    grid-template-columns: 1fr;
  }
}
@media (prefers-reduced-motion: reduce) {
  .cd-pick, .cd-cancel, .cd-save { transition: none; }
}
</style>
