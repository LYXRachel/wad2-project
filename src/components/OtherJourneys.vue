<template>
  <!-- Transport → Other journeys: trips that aren't between two stops on the plan
       (airport → hotel, a day trip to another city). Between-stop travel lives in the itinerary. -->
  <section class="oj" aria-labelledby="oj-title">
    <header class="oj-head">
      <h2 id="oj-title" class="oj-title">Plan journeys</h2>
    </header>

    <!-- Plan a journey (or change a saved one) -->
    <p v-if="editing" class="oj-editing" role="status">
      <AppIcon name="pencil" :size="15" /> Changing <strong>{{ editing.from }} → {{ editing.to }}</strong>
      <button type="button" class="oj-link" @click="cancelEdit">Cancel</button>
    </p>
    <!-- The planner is a ticket: From and To on the main part, the day and "Find ways" on the tear-off stub -->
    <form ref="formEl" class="oj-form oj-ticket" :class="{ editing: !!editing }" @submit.prevent="findWays">
      <div class="oj-ticket-main">
        <p class="oj-ticket-kicker" aria-hidden="true"><AppIcon name="plane" :size="14" /> {{ editing ? 'Changing a journey' : 'Plan a journey' }}</p>
        <div class="oj-route">
          <PlaceInput id="oj-from" v-model="fromText" v-model:place="fromPlace" label="From" :placeholder="fromHint" :groups="placeGroups" :near="centre" pin />
          <!-- the swap button sits on the dotted flight path between the two places -->
          <div class="oj-path">
            <button type="button" class="oj-swap" aria-label="Swap from and to" title="Swap" @click="swap"><AppIcon name="swap" :size="16" /></button>
          </div>
          <PlaceInput id="oj-to" v-model="toText" v-model:place="toPlace" label="To" :placeholder="toHint" :groups="placeGroups" :near="centre" pin />
        </div>
      </div>
      <div class="oj-ticket-stub">
        <div v-if="dayOptions.length" class="oj-field small">
          <label for="oj-day">Day</label>
          <CustomDropdown id="oj-day" v-model="day" :options="[{ value: '', label: 'Any day' }].concat(dayOptions)" block aria-label="Day" />
        </div>
        <button type="submit" class="oj-go" :disabled="!fromPlace || !toPlace">Find ways <span aria-hidden="true">→</span></button>
      </div>
    </form>

    <p v-if="error" class="oj-error" role="alert">{{ error }}</p>

    <!-- Ways to make this journey -->
    <div v-if="result" class="oj-result">
      <p class="oj-why">
        <strong>{{ result.fromName }} → {{ result.toName }}</strong><br>
        <template v-if="result.recommended">We suggest <strong>{{ label(result.recommended) }}</strong>: {{ result.reason }}.</template>
        <span v-if="result.checking"> Checking live routes…</span>
        <template v-else-if="!result.options.length">No route data for this journey.</template>
      </p>
      <TravelChoices :options="result.options" :recommended="result.recommended" :group="group" :maps-url="mapsUrl"
        :chosen="editing ? editing.mode : ''" :chosen-by="editing ? editing.by : ''"
        action-label="Save" :mark-in-use="false" @choose="saveJourney" />
      <p class="oj-note">{{ editing ? 'Save replaces the saved journey.' : 'Save the way you\'ll go, so everyone on the trip can see it.' }}</p>
    </div>

    <!-- Flights between cities, added on itinerary days (read-only here: change them on their day) -->
    <template v-if="flights.length">
      <h3 class="oj-h">Flights on the plan <span class="oj-count">{{ flights.length }}</span></h3>
      <ul class="oj-list">
        <li v-for="f in flights" :key="f.id" class="oj-item">
          <span class="oj-item-icon sun" aria-hidden="true"><AppIcon name="plane" :size="18" /></span>
          <span class="oj-item-main">
            <strong>{{ shortAirport(f.from.name) }} → {{ shortAirport(f.to.name) }}</strong>
            <small>{{ dayLabel(f.date) }} · takes off {{ f.dep }} · lands {{ f.arr }}<template v-if="f.number"> · {{ f.number }}</template> · on the itinerary</small>
          </span>
        </li>
      </ul>
    </template>

    <!-- Saved journeys -->
    <h3 class="oj-h">Saved journeys <span class="oj-count">{{ journeys.length }}</span></h3>
    <!-- Nothing saved: a blank ticket saying so -->
    <div v-if="!journeys.length" class="oj-empty">
      <strong class="oj-empty-title">No journeys yet</strong>
      <p>Nothing saved yet. Airport transfers and day trips you plan above appear here.</p>
    </div>
    <ul v-else class="oj-list">
      <li v-for="j in journeys" :key="j.id" class="oj-item" :class="{ editing: editing && editing.id === j.id }">
        <!-- Tap a saved journey to change it (it opens in the form above) -->
        <button type="button" class="oj-item-open" :aria-label="'Change ' + j.from + ' to ' + j.to" @click="editJourney(j)">
          <span class="oj-item-icon" aria-hidden="true"><AppIcon :name="MODES[j.mode].icon" :size="18" /></span>
          <span class="oj-item-main">
            <strong>{{ j.from }} → {{ j.to }}</strong>
            <small>{{ MODES[j.mode].label }} · {{ durationText(j.min) }}<template v-if="j.date"> · {{ dayLabel(j.date) }}</template><template v-if="j.by"> · added by {{ j.by }}</template></small>
          </span>
          <span class="oj-item-edit" aria-hidden="true"><AppIcon name="pencil" :size="14" /> Change</span>
        </button>
        <button type="button" class="oj-del" :aria-label="'Delete ' + j.from + ' to ' + j.to" @click="removeJourney(j)"><AppIcon name="trash" :size="16" /></button>
      </li>
    </ul>
  </section>
</template>

<script setup>
import { ref, computed, watch } from 'vue'
import axios from 'axios'
import AppIcon from './AppIcon.vue'
import TravelChoices from './TravelChoices.vue'
import PlaceInput from './PlaceInput.vue'
import CustomDropdown from './CustomDropdown.vue'
import { TRAVEL_MODES as MODES, travelOptions, recommendTravel, legKey, DEFAULT_TRAVEL, haversineKm } from '../dayOptimizer.js'
import { notify, errorText } from '../notify.js'
import { cityCentre } from '../services/cityCentre.js'

const props = defineProps({
  tripId: { type: String, default: '' },
  isDemo: { type: Boolean, default: false },
  destinations: { type: Array, default: () => [] },
  stops: { type: Array, default: () => [] },          // the itinerary's stops (names + addresses as suggestions)
  stays: { type: Array, default: () => [] },         // hotels (set in the itinerary): { from: date, name, ... } (older ones: { city, ... })
  myAirports: { type: Array, default: () => [] },    // my arrival / departure airports (set in the itinerary)
  travellers: { type: Array, default: () => [] },
  me: { type: String, default: '' },
  startDate: { type: String, default: '' },
  endDate: { type: String, default: '' },
  initialJourneys: { type: Array, default: () => [] },
  prefs: { type: Object, default: () => ({}) },
  flights: { type: Array, default: () => [] }, // flights on itinerary days: [{ id, date, from, to, dep, arr, number }]
  wishlist: { type: Array, default: () => [] }
})
function shortAirport(name) {
  return name.replace(/ (International )?Airport.*$/i, '').split(',')[0]
}

const fromText = ref('')
const toText = ref('')
const fromPlace = ref(null) // the real places picked: { name, address, lat, lon }
const toPlace = ref(null)
// Search for places around the trip's first city
const centre = ref(null)
cityCentre(props.destinations[0]).then((c) => (centre.value = c))
const day = ref('')
const error = ref('')
const result = ref(null)
const journeys = ref(props.initialJourneys.slice())
const editing = ref(null) // the saved journey being changed, or null
const formEl = ref(null)
const group = computed(() => Math.max(1, props.travellers.length))

function label(mode) {
  return MODES[mode] ? MODES[mode].label.toLowerCase() : mode
}
function durationText(min) {
  if (min < 60) return min + ' min'
  return Math.floor(min / 60) + ' h' + (min % 60 ? ' ' + (min % 60) + ' min' : '')
}

// Places to pick from, in groups: your hotel, the stops on your plan, the trip's cities and their airports
const placeGroups = computed(() => {
  const groups = []
  // hotels
  const hotels = []
  for (const st of props.stays) {
    if (hotels.some((h) => h.label === st.name)) continue
    hotels.push({ label: st.name, sub: st.from ? 'From ' + dayLabel(st.from) : st.city ? st.city.split(', ')[0] : '', place: pointOf(st) })
  }
  if (hotels.length) groups.push({ label: hotels.length === 1 ? 'Your hotel' : 'Your hotels', icon: 'door', items: hotels })
  // wishlist places (excludes places already on the plan)
  const wishlistItems = []
  for (const w of props.wishlist) {
    if (!w.name) continue
    
    // check if place is already listed on the itinerary stops
    const isOnPlan = props.stops.some((s) => s.name && s.name.trim().toLowerCase() === w.name.trim().toLowerCase())
    
    if (!isOnPlan && !wishlistItems.some((x) => x.label === w.name)) {
      wishlistItems.push({
        label: w.name,
        sub: w.city ? w.city.split(', ')[0] + ' · Wishlist' : 'Wishlist item',
        place: pointOf(w)
      })
    }
  }
  if (wishlistItems.length) {
    groups.push({ label: 'Wishlist', icon: 'heart', items: wishlistItems })
  }
  // plan stops
  const stops = []
  for (const s of props.stops) {
    if (!s.name || stops.some((x) => x.label === s.name)) continue
    stops.push({ label: s.name, sub: s.date ? dayLabel(s.date) : '', place: pointOf(s) })
  }
  if (stops.length) groups.push({ label: 'On your plan', icon: 'map-pin', items: stops })
  // airports & cities
  // (other airports: type the airport's name to search for it)
  const airports = []
  for (const a of props.myAirports) airports.push({ label: a.name, sub: 'Your flight', place: pointOf(a) })
  if (airports.length) groups.push({ label: 'Airports', icon: 'plane', items: airports })
  return groups
})
// A trip place as a picked place (null when it has no map point)
function pointOf(p) {
  return p && p.lat != null && p.lon != null ? { name: p.name, address: p.address || '', lat: p.lat, lon: p.lon } : null
}
// Example text in the empty boxes, from this trip
const fromHint = computed(() => (props.destinations[0] ? 'e.g. ' + props.destinations[0].split(', ')[0] + ' Airport' : 'e.g. the airport'))
const toHint = computed(() => (props.stays.length ? 'e.g. ' + props.stays[0].name : 'e.g. your hotel'))
const dayOptions = computed(() => {
  const list = []
  if (!props.startDate || !props.endDate) return list
  const d = new Date(props.startDate + 'T00:00:00')
  const end = new Date(props.endDate + 'T00:00:00')
  let n = 1
  while (d <= end && list.length < 60) {
    const value = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0')
    list.push({ value, label: 'Day ' + n + ' · ' + d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' }) })
    d.setDate(d.getDate() + 1)
    n++
  }
  return list
})
function dayLabel(date) {
  const o = dayOptions.value.find((x) => x.value === date)
  return o ? o.label : new Date(date + 'T00:00:00').toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })
}

function swap() {
  const t = fromText.value
  fromText.value = toText.value
  toText.value = t
  const p = fromPlace.value
  fromPlace.value = toPlace.value
  toPlace.value = p
}

const travelPrefs = computed(() => ({
  modes: props.prefs.travelModes && props.prefs.travelModes.length ? props.prefs.travelModes : DEFAULT_TRAVEL.modes,
  maxWalk: props.prefs.maxWalk || 20,
  priority: props.prefs.travelPriority || 'balanced',
  group: group.value,
  real: {}
}))

function build(from, to, real, checking) {
  const tp = { ...travelPrefs.value, real }
  const options = travelOptions(from, to, tp)
  const rec = recommendTravel(options, tp)
  return { fromName: fromText.value.trim(), toName: toText.value.trim(), from, to, options, recommended: rec ? rec.option.mode : '', reason: rec ? rec.reason : '', checking }
}

const SAME_PLACE = 'From and To are the same place. Choose two different places.'
async function findWays() {
  error.value = ''
  result.value = null
  const from = fromPlace.value
  const to = toPlace.value
  if (!from || !to) {
    error.value = 'Pick both places from the suggestions, paste a Google Maps link, or drop a pin.'
    return
  }
  // Two names for the same spot (under 100 m apart): nothing to travel
  if (haversineKm(from, to) < 0.1) {
    error.value = SAME_PLACE
    return
  }
  // "Checking" straight away, then the real routes when they arrive
  result.value = build(from, to, {}, true)
  try {
    const res = await axios.get('/api/travel/leg', { params: { from: from.lat + ',' + from.lon, to: to.lat + ',' + to.lon }, timeout: 20000 })
    result.value = build(from, to, { [legKey(from, to)]: res.data }, false)
  } catch (err) {
    if (result.value) result.value.checking = false // no route data
  }
}
// A different place picked: the ways shown were for the old ones
watch([fromPlace, toPlace], () => {
  if (result.value && (result.value.from !== fromPlace.value || result.value.to !== toPlace.value)) result.value = null
})
function mapsUrl(mode) {
  const r = result.value
  return 'https://www.google.com/maps/dir/?api=1&origin=' + r.from.lat + ',' + r.from.lon + '&destination=' + r.to.lat + ',' + r.to.lon + '&travelmode=' + MODES[mode].maps
}

async function store(list, done) {
  const before = journeys.value
  journeys.value = list
  if (props.isDemo) return done && done()
  try {
    const res = await axios.put('/api/trips/' + props.tripId + '/journeys', list)
    journeys.value = res.data
    if (done) done()
  } catch (err) {
    journeys.value = before
    notify(errorText(err, 'Could not save the journey.'), () => store(list, done))
  }
}

function saveJourney(mode) {
  const r = result.value
  const opt = r.options.find((o) => o.mode === mode)
  const old = editing.value
  // Changing a saved journey keeps its place in the list (and its id); a new one goes first
  const j = { id: old ? old.id : 'j-' + Date.now().toString(36), from: r.fromName, to: r.toName, mode, min: opt.min, date: day.value, by: props.me,
    fromPoint: { lat: r.from.lat, lon: r.from.lon }, toPoint: { lat: r.to.lat, lon: r.to.lon } }
  let list = [j].concat(journeys.value)
  if (old) {
    list = []
    for (const x of journeys.value) list.push(x.id === old.id ? j : x)
  }
  store(list, () => {
    result.value = null
    editing.value = null
    clearPlaces()
    notify((old ? 'Journey updated: ' : 'Journey saved: ') + j.from + ' → ' + j.to + ' by ' + label(mode) + '.', null, 'ok')
  })
}
// Open a saved journey in the form, with its ways to go already looked up
function editJourney(j) {
  editing.value = j
  fromText.value = j.from
  toText.value = j.to
  // Journeys saved before places had map points: pick the places again
  fromPlace.value = j.fromPoint ? { name: j.from, address: '', ...j.fromPoint } : null
  toPlace.value = j.toPoint ? { name: j.to, address: '', ...j.toPoint } : null
  day.value = j.date || ''
  if (formEl.value) formEl.value.scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'center' })
  if (fromPlace.value && toPlace.value) findWays()
  else error.value = 'This journey was saved without map points. Pick From and To again, then Save.'
}
function clearPlaces() {
  fromText.value = ''
  toText.value = ''
  fromPlace.value = null
  toPlace.value = null
}
function cancelEdit() {
  editing.value = null
  result.value = null
  error.value = ''
  clearPlaces()
  day.value = ''
}
function removeJourney(j) {
  if (editing.value && editing.value.id === j.id) cancelEdit()
  store(journeys.value.filter((x) => x.id !== j.id))
}
</script>

<style scoped>
/* ===== Transport → Other journeys, as travel tickets (scrapbook look; colours from src/assets/scrapbook.css) =====
   The planner is a ticket with a tear-off stub; each saved journey is a ticket stub. */
.oj {
  color: var(--sb-ink);
}
.oj-title {
  margin: 0 0 12px;
  font-family: var(--sb-display);
  font-weight: 400;
  font-size: 1.7rem;
  color: var(--sb-ink);
}

/* ----- The planner ticket ----- */
.oj-ticket {
  position: relative;
  display: grid;
  grid-template-columns: minmax(0, 1fr) 230px;
  border: var(--sb-line);
  border-radius: 20px;
  background:
    radial-gradient(circle, rgba(18, 50, 74, 0.06) 1px, transparent 1.3px) 0 0 / 18px 18px,
    var(--sb-card);
  box-shadow: var(--sb-pop);
}
.oj-ticket.editing {
  box-shadow: var(--sb-pop), 0 0 0 5px rgba(255, 191, 60, 0.45);
}
.oj-ticket-main {
  min-width: 0;
  padding: 16px 22px 20px;
}
.oj-ticket-kicker {
  display: flex;
  align-items: center;
  gap: 6px;
  margin: 0 0 12px;
  font-size: 11.5px;
  font-weight: 800;
  letter-spacing: 0.16em;
  text-transform: uppercase;
  color: var(--sb-ink-soft);
}
.oj-ticket-kicker::after {
  content: '';
  flex: 1;
  border-bottom: 2px dotted var(--sb-stitch);
}
/* From — swap — To */
.oj-route {
  display: flex;
  align-items: flex-start;
  gap: 10px;
}
.oj-field {
  flex: 1 1 200px;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.oj-field label,
.oj-route :deep(.pi-label) {
  font-size: 11.5px;
  font-weight: 800;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: var(--sb-ink-soft);
}
/* (PlaceInput's own root can't take our class, so it's styled from .oj-route) */
.oj-route > :deep(.pi) {
  flex: 1 1 200px;
  min-width: 0;
  gap: 6px;
}
/* the place fields stay plain white boxes, so it's clear where to type */
.oj-route :deep(.pi-input) {
  min-height: 48px;
  border: 2px solid var(--sb-ink);
  border-radius: 14px;
  background: #fbf5ea;
  color: var(--sb-ink);
  font-size: 15px;
  font-weight: 600;
  box-shadow: inset 0 2px 0 rgba(18, 50, 74, 0.06);
}
.oj-route :deep(.pi-input:focus) {
  border-color: var(--sb-ink);
  box-shadow: 0 0 0 4px rgba(255, 191, 60, 0.45);
}
.oj-route :deep(.pi-pin) {
  z-index: 1;
  color: var(--sb-amber-lo);
}
/* the dotted flight path with the swap button on it */
.oj-path {
  position: relative;
  flex: 0 0 64px;
  height: 48px;
  margin-top: 23px; /* below the From / To labels: level with the place boxes */
  display: grid;
  place-items: center;
}
.oj-path::before {
  content: '';
  position: absolute;
  left: 0;
  right: 0;
  top: 50%;
  border-top: 3px dotted var(--sb-ink);
  opacity: 0.45;
}
.oj-swap {
  position: relative;
  width: 40px;
  height: 40px;
  border: 2px solid var(--sb-ink);
  border-radius: 50%;
  background: var(--sb-amber);
  color: var(--sb-ink);
  box-shadow: var(--sb-pop-sm);
  transition: transform 0.35s var(--sb-spring), box-shadow 0.12s;
}
.oj-swap:hover {
  transform: rotate(180deg);
}
.oj-swap:active {
  transform: rotate(180deg) translateY(-3px);
  box-shadow: 0 0 0 var(--sb-ink);
}

/* the tear-off stub: a perforated line with a notch cut out at each end */
.oj-ticket-stub {
  position: relative;
  display: flex;
  flex-direction: column;
  justify-content: flex-end;
  gap: 12px;
  padding: 16px 18px 20px;
  border-left: 2.5px dashed var(--sb-ink);
  border-radius: 0 17px 17px 0;
  background: #fff1cf;
}
.oj-ticket-stub::before,
.oj-ticket-stub::after {
  content: '';
  position: absolute;
  left: -15px;
  width: 28px;
  height: 28px;
  border: var(--sb-line);
  border-radius: 50%;
  background: var(--sb-cream);
}
.oj-ticket-stub::before {
  top: -15px;
  clip-path: inset(50% 0 0 0); /* only the lower half: a notch bitten out of the top edge */
}
.oj-ticket-stub::after {
  bottom: -15px;
  clip-path: inset(0 0 50% 0);
}
.oj-field.small {
  flex: none;
}
.oj-field.small :deep(.dd-trigger) {
  min-height: 46px;
  border: 2px solid var(--sb-ink);
  border-radius: 14px;
  background: #fbf5ea;
  color: var(--sb-ink);
  font-weight: 700;
  box-shadow: none;
}
.oj-field.small :deep(.dd-chevron) {
  color: var(--sb-ink);
}
.oj-go {
  min-height: 50px;
  border: var(--sb-line);
  border-radius: 14px;
  background: linear-gradient(180deg, var(--sb-amber-hi), var(--sb-amber) 55%, var(--sb-amber-lo));
  color: var(--sb-ink);
  font-family: var(--sb-display);
  font-size: 1.15rem;
  letter-spacing: 0.01em;
  box-shadow: inset 0 2px 0 rgba(255, 255, 255, 0.6), var(--sb-pop-sm);
  transition: transform 0.12s, box-shadow 0.12s;
}
.oj-go:hover:not(:disabled) {
  transform: translateY(-2px);
  box-shadow: inset 0 2px 0 rgba(255, 255, 255, 0.6), 0 5px 0 var(--sb-ink);
}
.oj-go:active:not(:disabled) {
  transform: translateY(3px);
  box-shadow: 0 0 0 var(--sb-ink);
}
.oj-go:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}

/* "Changing Airport → Hotel" note above the ticket */
.oj-editing {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 6px;
  margin: 0 0 12px;
  padding: 8px 14px;
  border: 2px dashed var(--sb-amber-lo);
  border-radius: 14px;
  background: #fff4dc;
  color: var(--sb-ink);
  font-size: 13.5px;
  font-weight: 600;
}
.oj-link {
  margin-left: auto;
  border: 0;
  background: none;
  padding: 0;
  color: var(--sb-ink);
  font-weight: 800;
  text-decoration: underline;
  text-decoration-color: var(--sb-amber);
  text-decoration-thickness: 3px;
}
.oj-error {
  margin: 12px 0 0;
  color: #b3263a;
  font-weight: 700;
  font-size: 14px;
}

/* ----- Ways found ----- */
.oj-result {
  margin-top: 18px;
}
.oj-why {
  margin: 0 0 12px;
  padding: 12px 16px;
  border: 2px dashed var(--sb-stitch);
  border-radius: 16px;
  background: var(--sb-card);
  font-size: 14px;
  line-height: 1.45;
}
.oj-note {
  margin: 10px 0 0;
  font-size: 12.5px;
  font-weight: 600;
  color: var(--sb-muted);
}

/* ----- Saved journeys and flights: ticket stubs ----- */
.oj-h {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 30px 0 12px;
  font-family: var(--sb-display);
  font-weight: 400;
  font-size: 1.4rem;
  color: var(--sb-ink);
}
.oj-count {
  display: inline-grid;
  place-items: center;
  min-width: 28px;
  height: 28px;
  padding: 0 7px;
  border: 2px solid var(--sb-ink);
  border-radius: 999px;
  background: var(--sb-amber);
  font-family: var(--font-body);
  font-size: 13px;
  font-weight: 800;
  transform: rotate(-6deg);
}
.oj-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.oj-item {
  position: relative;
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 14px;
  border: var(--sb-line);
  border-radius: 14px;
  background: var(--sb-card);
  box-shadow: var(--sb-pop-sm);
  transition: transform 0.2s var(--sb-spring), box-shadow 0.12s;
}
.oj-item:hover {
  transform: translateY(-2px) rotate(-0.4deg);
  box-shadow: 0 5px 0 var(--sb-ink);
}
.oj-item.editing {
  background: #fff1cf;
  box-shadow: var(--sb-pop-sm), 0 0 0 4px rgba(255, 191, 60, 0.45);
}
/* the mode of transport, stamped in an amber square */
.oj-item-icon {
  flex: none;
  width: 42px;
  height: 42px;
  display: grid;
  place-items: center;
  border: 2px solid var(--sb-ink);
  border-radius: 12px;
  background: var(--sb-amber);
  color: var(--sb-ink);
  box-shadow: 0 2px 0 var(--sb-ink);
  transform: rotate(-4deg);
}
.oj-item-icon.sun {
  background: var(--sb-teal-soft);
}
.oj-item-main {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 1px;
}
.oj-item-main strong {
  font-family: var(--sb-display);
  font-weight: 400;
  font-size: 1.1rem;
  letter-spacing: 0.01em;
}
.oj-item-main small {
  color: var(--sb-muted);
  font-weight: 600;
}
/* the whole stub opens the journey in the ticket above; the bin sits beyond the tear line */
.oj-item-open {
  flex: 1;
  min-width: 0;
  display: flex;
  align-items: center;
  gap: 12px;
  margin: -12px 0 -12px -14px;
  padding: 12px 14px 12px 14px;
  border: 0;
  border-right: 2.5px dashed var(--sb-ink);
  border-radius: 12px 0 0 12px;
  background: none;
  text-align: left;
  color: inherit;
  font: inherit;
  cursor: pointer;
}
.oj-item-edit {
  flex: none;
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 5px 10px;
  border: 2px solid var(--sb-ink);
  border-radius: 10px;
  background: var(--sb-cream);
  font-size: 12.5px;
  font-weight: 800;
  color: var(--sb-ink);
  box-shadow: 0 2px 0 var(--sb-ink);
}
.oj-item-open:hover .oj-item-edit {
  background: var(--sb-amber);
}
.oj-del {
  flex: none;
  width: 38px;
  height: 38px;
  display: grid;
  place-items: center;
  border: 2px solid var(--sb-ink);
  border-radius: 50%;
  background: var(--sb-cream);
  color: var(--sb-ink-soft);
  box-shadow: 0 2px 0 var(--sb-ink);
}
.oj-del:hover {
  background: #ffe1e5;
  color: var(--sb-red);
}

/* Nothing saved: a blank ticket */
.oj-empty {
  position: relative;
  padding: 18px 22px;
  border: 2.5px dashed var(--sb-stitch);
  border-radius: 14px;
  background: transparent;
  color: var(--sb-muted);
  text-align: center;
}
.oj-empty-title {
  display: block;
  font-family: var(--sb-display);
  font-weight: 400;
  font-size: 1.3rem;
  color: var(--sb-ink-soft);
}
.oj-empty p {
  margin: 2px 0 0;
  font-size: 14px;
  font-weight: 600;
}

.oj-swap:focus-visible,
.oj-go:focus-visible,
.oj-del:focus-visible,
.oj-link:focus-visible {
  outline: 3px solid var(--sb-teal);
  outline-offset: 3px;
}
.oj-item-open:focus-visible {
  outline: 3px solid var(--sb-teal);
  outline-offset: -3px;
}

/* Phones: the stub goes under the ticket, torn along a line across */
@media (max-width: 760px) {
  .oj-ticket {
    grid-template-columns: minmax(0, 1fr);
  }
  .oj-route {
    flex-direction: column;
    align-items: stretch;
  }
  .oj-route > :deep(.pi) {
    flex: none;
  }
  .oj-path {
    flex-basis: 40px;
    height: 40px;
    margin-top: 0;
  }
  .oj-path::before {
    left: 50%;
    right: auto;
    top: 0;
    bottom: 0;
    border-top: 0;
    border-left: 3px dotted var(--sb-ink);
  }
  .oj-swap {
    transform: rotate(90deg);
  }
  .oj-swap:hover {
    transform: rotate(270deg);
  }
  .oj-ticket-stub {
    border-left: 0;
    border-top: 2.5px dashed var(--sb-ink);
    border-radius: 0 0 17px 17px;
  }
  .oj-ticket-stub::before {
    top: -15px;
    left: -15px;
    clip-path: inset(0 0 0 50%);
  }
  .oj-ticket-stub::after {
    top: -15px;
    bottom: auto;
    left: auto;
    right: -15px;
    clip-path: inset(0 50% 0 0);
  }
  .oj-item-edit {
    display: none; /* the whole stub is the button; no room for the label */
  }
}
@media (prefers-reduced-motion: reduce) {
  .oj-swap, .oj-item, .oj-go { transition: none; }
}
</style>
