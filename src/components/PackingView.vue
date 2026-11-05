<template>
  <div class="pk">
    <!-- ===== Trip details the list is built from ===== -->
    <!-- An open suitcase: pick activities as travel stickers, the weather, and a few luggage tags -->
    <section v-if="editing" class="pk-setup" aria-labelledby="pk-setup-title">
      <span class="pk-handle" aria-hidden="true"></span>
      <h3 id="pk-setup-title" class="pk-setup-title">{{ hasProfile ? 'Edit trip details' : 'Tell us about your trip' }}</h3>

      <!-- What you'll do: vintage luggage stickers (picked ones get "stuck on") -->
      <fieldset class="pk-block">
        <legend class="pk-legend">What will you do?</legend>
        <div class="pk-tiles">
          <button v-for="o in ACTIVITIES" :key="o.key" type="button" class="pk-tile" :class="{ on: profile.activities.includes(o.key) }"
            :aria-pressed="profile.activities.includes(o.key)" :title="o.label" @click="toggleOption(profile.activities, o.key)">
            <Icon3D class="pk-tile-icon" :emoji="o.icon" :size="44" />
            <span class="pk-tile-label">{{ o.short || o.label }}</span>
          </button>
        </div>
      </fieldset>

      <!-- Weather and extras sit side by side on wide screens -->
      <div class="pk-pair">
      <!-- Weather: forecast cards (you can pick more than one) -->
      <fieldset class="pk-block">
        <legend class="pk-legend">Weather</legend>
        <div class="pk-seg">
          <button v-for="o in WEATHER" :key="o.key" type="button" :class="{ on: profile.weather.includes(o.key) }"
            :aria-pressed="profile.weather.includes(o.key)" @click="toggleOption(profile.weather, o.key)">
            <Icon3D :emoji="o.icon" :size="22" /> {{ o.label }}
          </button>
        </div>
      </fieldset>

      <!-- Extras: luggage tags with a switch each -->
      <fieldset class="pk-block">
        <legend class="pk-legend">Good to know</legend>
        <div class="pk-switches">
          <button v-for="o in EXTRAS" :key="o.key" type="button" role="switch" class="pk-switch-row"
            :aria-checked="profile.extras.includes(o.key)" @click="toggleOption(profile.extras, o.key)">
            <span class="pk-switch-text pk-switch-icon"><Icon3D :emoji="o.icon" :size="26" /> {{ o.label }}</span>
            <span class="pk-switch" aria-hidden="true"><span class="pk-knob"></span></span>
          </button>
        </div>
      </fieldset>
      </div>

      <div class="pk-setup-foot">
        <button type="button" class="pk-go" @click="editing = false" data-testid="packing-build">
          {{ hasProfile ? 'Update my list' : 'Build my list' }} →
        </button>
      </div>
    </section>

    <template v-else>
      <!-- Change the trip details (days, activities, weather): first thing you see -->
      <div class="pk-edit-row">
        <button type="button" class="pk-link" @click="editing = true"><span class="pk-link-icon" aria-hidden="true"><AppIcon name="pencil" :size="14" :stroke="2.4" /></span> Edit trip details</button>
      </div>

      <!-- ===== Progress ===== -->
      <div class="pk-top">
        <!-- a little suitcase that fills up as you pack -->
        <svg class="pk-case" viewBox="0 0 44 44" aria-hidden="true">
          <path d="M16 10V6.5A2.5 2.5 0 0 1 18.5 4h7A2.5 2.5 0 0 1 28 6.5V10" fill="none" stroke="#12324a" stroke-width="3" />
          <rect x="5" y="10" width="34" height="28" rx="6" fill="#fffaf0" stroke="#12324a" stroke-width="3" />
          <rect x="6.5" :y="36.5 - 25 * percent / 100" width="31" :height="25 * percent / 100" rx="4.5" fill="#ffbf3c" />
          <path d="M15 10v28M29 10v28" stroke="#12324a" stroke-width="2.5" opacity="0.5" />
          <rect x="5" y="10" width="34" height="28" rx="6" fill="none" stroke="#12324a" stroke-width="3" />
        </svg>
        <div class="flex-grow-1">
          <div class="d-flex justify-content-between align-items-baseline mb-2">
            <strong class="pk-progress-text" aria-live="polite" data-testid="packing-progress">
              {{ packedCount }} of {{ items.length }} packed
            </strong>
            <span v-if="packedCount === items.length && items.length" class="pk-done">All packed!</span>
          </div>
          <div class="pk-bar" role="progressbar" :aria-valuenow="packedCount" aria-valuemin="0" :aria-valuemax="items.length" aria-label="Packing progress">
            <div class="pk-bar-fill" :style="{ width: percent + '%' }"></div>
          </div>
          <p class="pk-own">Your own list: ticks and changes here are just for you. Everyone on the trip has their own.</p>
        </div>
      </div>

      <!-- What the list was built for (Edit trip details is above) -->
      <div class="pk-profile">
        <span class="pk-muted small">Built for {{ days }} day{{ days === 1 ? '' : 's' }}<span v-if="profileTags.length">:</span></span>
        <span v-for="t in profileTags" :key="t.key" class="pk-tag"><Icon3D :emoji="t.icon" :size="18" /> {{ t.label }}</span>
        <label class="pk-hide ms-auto">
          <input v-model="hidePacked" type="checkbox" role="switch"> Hide packed
        </label>
      </div>

      <!-- ===== Categories ===== -->
      <section v-for="cat in groups" :key="cat.key" class="pk-cat" :aria-labelledby="'pk-cat-' + cat.key">
        <button type="button" class="pk-cat-head" :aria-expanded="!collapsed[cat.key]" @click="collapsed[cat.key] = !collapsed[cat.key]">
          <span class="pk-cat-icon"><Icon3D :emoji="cat.icon" :size="30" /></span>
          <h3 :id="'pk-cat-' + cat.key" class="pk-cat-title">{{ cat.label }}</h3>
          <span v-if="cat.items.length && cat.packed === cat.items.length" class="pk-zipped">Zipped ✓</span>
          <span class="pk-cat-count" :class="{ full: cat.packed === cat.items.length }">{{ cat.packed }}/{{ cat.items.length }}</span>
          <span class="pk-chevron" aria-hidden="true">{{ collapsed[cat.key] ? '›' : '⌄' }}</span>
        </button>

        <div v-show="!collapsed[cat.key]">
          <ul class="pk-list">
            <li v-for="it in cat.shown" :key="it.id" class="pk-item" :class="{ packed: packing.checked[it.id] }">
              <label class="pk-check">
                <input type="checkbox" :checked="!!packing.checked[it.id]" @change="toggleChecked(it.id)" data-testid="packing-check">
                <span class="pk-box" aria-hidden="true">✓</span>
                <span class="pk-name">
                  {{ it.name }}
                  <small class="d-block pk-muted">{{ it.why }}</small>
                </span>
              </label>
              <div class="pk-qty" role="group" :aria-label="'Amount of ' + it.name">
                <button type="button" :aria-label="'Fewer ' + it.name" :disabled="it.qty <= 1" @click="changeQty(it, -1)">−</button>
                <span aria-live="polite">{{ it.qty }}</span>
                <button type="button" :aria-label="'More ' + it.name" :disabled="it.qty >= 99" @click="changeQty(it, 1)">+</button>
              </div>
              <button type="button" class="pk-remove" :aria-label="'Remove ' + it.name" title="Remove" @click="removeItem(it)"><AppIcon name="x" :size="15" /></button>
            </li>
          </ul>
          <p v-if="!cat.shown.length" class="pk-muted small px-3 mb-2">Everything here is packed ✓</p>

          <!-- Add an item to this category -->
          <form class="pk-add" @submit.prevent="addItem(cat.key)">
            <label :for="'pk-add-' + cat.key" class="visually-hidden">Add an item to {{ cat.label }}</label>
            <input :id="'pk-add-' + cat.key" v-model="newItem[cat.key]" class="pk-add-input" maxlength="80" :placeholder="'+ Tuck something into ' + cat.label.toLowerCase()">
            <button type="submit" class="pk-add-btn" :disabled="!(newItem[cat.key] || '').trim()">Add</button>
          </form>
        </div>
      </section>

      <div class="d-flex flex-wrap gap-3 align-items-center mt-3">
        <button v-if="packing.removed.length" type="button" class="pk-link" @click="packing.removed = []">
          ↺ Bring back {{ packing.removed.length }} removed item{{ packing.removed.length === 1 ? '' : 's' }}
        </button>
        <button v-if="packedCount" type="button" class="pk-link" @click="packing.checked = {}">Untick everything</button>
        <span class="pk-muted small ms-auto" role="status">{{ saveStatus }}</span>
      </div>
    </template>
  </div>
</template>

<script>
import axios from 'axios'
import { ACTIVITIES, WEATHER, EXTRAS } from '../tripOptions.js'
import { CATEGORIES, buildPackingList } from '../packingList.js'
import AppIcon from './AppIcon.vue'
import Icon3D from './Icon3D.vue'

export default {
  components: { AppIcon, Icon3D },
  props: {
    tripId: { type: String, default: '' },
    days: { type: Number, default: 3 },
    activities: { type: Array, default: () => [] },
    weather: { type: Array, default: () => [] },
    extras: { type: Array, default: () => [] },
    initialPacking: { type: Object, default: null },
    hasOutdoorActivity: { type: Boolean, default: false }
  },

  data() {
    const saved = this.initialPacking || {}
    const profile = { activities: this.activities.slice(), weather: this.weather.slice(), extras: this.extras.slice() }
    const collapsed = {}
    const newItem = {}
    for (const c of CATEGORIES) {
      collapsed[c.key] = false
      newItem[c.key] = ''
    }
    return {
      profile,
      packing: {
        checked: saved.checked || {},
        qty: saved.qty || {},
        removed: saved.removed || [],
        custom: saved.custom || []
      },
      // Nothing chosen when the trip was created? Ask first.
      editing: !profile.activities.length && !profile.weather.length && !profile.extras.length,
      hidePacked: false,
      collapsed,
      newItem,
      ACTIVITIES,
      WEATHER,
      EXTRAS,
      optionGroups: [
        { key: 'activities', label: 'Activities', options: ACTIVITIES },
        { key: 'weather', label: 'Expected weather', options: WEATHER },
        { key: 'extras', label: 'Anything else?', options: EXTRAS }
      ],
      saveTimer: null,
      saveStatus: '',
      lastSaved: ''
    }
  },

  computed: {
    hasProfile() {
      return this.profile.activities.length + this.profile.weather.length + this.profile.extras.length > 0
    },

    // The chosen options with their icons, for the "Built for" line
    profileTags() {
      const tags = []
      for (const g of this.optionGroups) {
        for (const o of g.options) {
          if (this.profile[g.key].includes(o.key)) tags.push(o)
        }
      }
      return tags
    },

    // Suggested items + your own, minus removed ones, with your amounts
    items() {
      const list = []
      const suggested = buildPackingList({ days: this.days, ...this.profile, outdoor: this.hasOutdoorActivity })
      for (const it of suggested.concat(this.packing.custom.map((c) => ({ ...c, why: 'Added by you' })))) {
        if (this.packing.removed.includes(it.id)) continue
        const qty = this.packing.qty[it.id] !== undefined ? this.packing.qty[it.id] : it.qty
        list.push({ ...it, qty })
      }
      return list
    },

    groups() {
      const groups = []
      for (const c of CATEGORIES) {
        const items = []
        const shown = []
        let packed = 0
        for (const it of this.items) {
          if (it.category !== c.key) continue
          items.push(it)
          if (this.packing.checked[it.id]) packed++
          if (!(this.hidePacked && this.packing.checked[it.id])) shown.push(it)
        }
        // Always show "Other" so there's somewhere to add your own things
        if (items.length || c.key === 'other') groups.push({ ...c, items, shown, packed })
      }
      return groups
    },

    packedCount() {
      let count = 0
      for (const it of this.items) {
        if (this.packing.checked[it.id]) count++
      }
      return count
    },

    percent() {
      return this.items.length ? Math.round((this.packedCount / this.items.length) * 100) : 0
    },

    // Everything worth saving, as text (changes whenever something changes)
    saveKey() {
      return JSON.stringify({ ...this.profile, packing: this.packing })
    }
  },

  watch: {
    saveKey(key) {
      if (!this.tripId || this.tripId === 'seoul' || key === this.lastSaved) return // the demo trip isn't saved
      this.saveStatus = 'Saving…'
      clearTimeout(this.saveTimer)
      this.saveTimer = setTimeout(this.save, 600)
    }
  },

  created() {
    this.lastSaved = this.saveKey
  },

  methods: {
    toggleOption(list, key) {
      const i = list.indexOf(key)
      if (i >= 0) list.splice(i, 1)
      else list.push(key)
    },

    toggleChecked(id) {
      if (this.packing.checked[id]) delete this.packing.checked[id]
      else this.packing.checked[id] = true
    },

    changeQty(it, step) {
      this.packing.qty[it.id] = Math.min(99, Math.max(1, it.qty + step))
    },

    removeItem(it) {
      if (it.id.startsWith('mine-')) {
        this.packing.custom = this.packing.custom.filter((c) => c.id !== it.id)
      } else {
        this.packing.removed.push(it.id)
      }
      delete this.packing.checked[it.id]
    },

    addItem(category) {
      const name = (this.newItem[category] || '').trim()
      if (!name) return
      this.packing.custom.push({ id: 'mine-' + Date.now(), category, name, qty: 1 })
      this.newItem[category] = ''
    },

    // Saves MY packing list (everyone on the trip has their own); the trip details are shared
    async save() {
      const key = this.saveKey
      try {
        await axios.put('/api/trips/' + this.tripId + '/packing', { ...this.profile, packing: this.packing })
        this.lastSaved = key
        this.saveStatus = 'Saved ✓'
      } catch (err) {
        this.saveStatus = (err.response && err.response.data && err.response.data.message) || 'Could not save. Check your connection.'
      }
    }
  }
}
</script>

<style scoped>
/* ===== Packing: an open suitcase with travel stickers, and the list as packing cubes
   (scrapbook look; colours from src/assets/scrapbook.css) ===== */
.pk {
  color: var(--sb-ink);
}
.pk-muted {
  color: var(--sb-muted);
}

/* ----- Setup: an open suitcase ----- */
.pk-setup {
  position: relative;
  margin-top: 26px; /* room for the handle */
  padding: 26px 30px 24px;
  border: var(--sb-line);
  border-radius: 24px;
  background:
    radial-gradient(circle, rgba(18, 50, 74, 0.06) 1px, transparent 1.3px) 0 0 / 20px 20px,
    var(--sb-card);
  box-shadow: var(--sb-pop);
}
/* the handle on top */
.pk-handle {
  position: absolute;
  top: -24px;
  left: 50%;
  width: 120px;
  height: 26px;
  margin-left: -60px;
  border: var(--sb-line);
  border-bottom: 0;
  border-radius: 16px 16px 0 0;
  background: #b9773f;
  box-shadow: inset 0 3px 0 rgba(255, 255, 255, 0.25);
}
/* leather corner caps on the four corners, like a suitcase */
.pk-setup::before,
.pk-setup::after {
  content: '';
  position: absolute;
  top: -2.5px;
  width: 30px;
  height: 30px;
  border: var(--sb-line);
  background: #c8874c;
  pointer-events: none;
}
.pk-setup::before {
  left: -2.5px;
  border-radius: 24px 0 14px 0;
}
.pk-setup::after {
  right: -2.5px;
  border-radius: 0 24px 0 14px;
}
.pk-setup > *:not(.pk-handle) {
  position: relative;
  z-index: 1;
}
.pk-setup-title {
  margin-bottom: 16px;
  font-family: var(--sb-display);
  font-weight: 400;
  font-size: 1.9rem;
  color: var(--sb-ink);
}
.pk-pair {
  display: grid;
  grid-template-columns: 1fr;
  gap: 0 24px;
}
.pk-block {
  margin-bottom: 20px;
}
.pk-block + .pk-pair,
.pk-pair .pk-block + .pk-block {
  border-top: 2px dashed var(--sb-stitch);
  padding-top: 18px;
}
.pk-legend {
  float: none;
  margin-bottom: 10px;
  font-size: 12px;
  font-weight: 800;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: var(--sb-ink-soft);
}

/* Activities: vintage luggage stickers */
.pk-tiles {
  display: grid;
  grid-template-columns: repeat(5, minmax(0, 1fr));
  gap: 12px;
}
.pk-tile {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 6px;
  min-height: 108px;
  padding: 10px 6px;
  border: 2px dashed rgba(18, 50, 74, 0.3);
  border-radius: 22px;
  background: #fbf5ea;
  color: var(--sb-ink-soft);
  transition: transform 0.25s var(--sb-spring), box-shadow 0.15s, background 0.15s, border-color 0.15s;
}
.pk-tile .pk-tile-icon {
  filter: grayscale(0.55);
  opacity: 0.75;
  transition: transform 0.25s var(--sb-spring), filter 0.2s, opacity 0.2s;
}
.pk-tile:hover {
  border-color: var(--sb-ink);
  transform: translateY(-2px);
}
.pk-tile:hover .pk-tile-icon {
  filter: none;
  opacity: 1;
}
/* picked: stuck on, in full colour, at a slight angle (each sticker leans its own way) */
.pk-tile.on {
  border: var(--sb-line);
  color: var(--sb-ink);
  box-shadow: var(--sb-pop-sm);
  animation: pk-stick 0.35s var(--sb-spring);
}
.pk-tile.on:nth-child(5n + 1) { background: var(--sb-peach); transform: rotate(-3deg); }
.pk-tile.on:nth-child(5n + 2) { background: var(--sb-teal-soft); transform: rotate(2.5deg); }
.pk-tile.on:nth-child(5n + 3) { background: #fff1cf; transform: rotate(-2deg); }
.pk-tile.on:nth-child(5n + 4) { background: #e4ecff; transform: rotate(3deg); }
.pk-tile.on:nth-child(5n) { background: #f3e6ff; transform: rotate(-2.5deg); }
.pk-tile.on .pk-tile-icon {
  filter: none;
  opacity: 1;
  transform: translateY(-3px) scale(1.08);
}
/* a small ✓ seal on picked stickers */
.pk-tile.on::after {
  content: '✓';
  position: absolute;
  top: -8px;
  right: -8px;
  width: 24px;
  height: 24px;
  display: grid;
  place-items: center;
  border: 2px solid var(--sb-ink);
  border-radius: 50%;
  background: var(--sb-amber);
  color: var(--sb-ink);
  font-size: 12px;
  font-weight: 900;
}
@keyframes pk-stick {
  0% { transform: scale(1.15) rotate(0deg); }
}
.pk-tile-label {
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 13px;
  font-weight: 800;
}

/* Weather: forecast cards (pick any) */
.pk-seg {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 10px;
}
.pk-seg button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  min-height: 52px;
  padding: 8px 6px;
  border: var(--sb-line);
  border-radius: 14px;
  background: #fbf5ea;
  color: var(--sb-ink);
  font-size: 15px;
  font-weight: 800;
  white-space: nowrap;
  box-shadow: 0 4px 0 var(--sb-ink);
  transition: transform 0.15s var(--sb-spring), box-shadow 0.12s, background 0.15s;
}
.pk-seg button:hover {
  transform: translateY(-2px);
}
.pk-seg button.on {
  background: var(--sb-amber);
  transform: translateY(3px);
  box-shadow: 0 1px 0 var(--sb-ink);
}

/* Good to know: luggage tags with a switch */
.pk-switches {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
}
.pk-switch-icon {
  display: inline-flex;
  align-items: center;
  gap: 10px;
}
.pk-switch-row {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  min-height: 54px;
  padding: 0 14px 0 34px;
  border: var(--sb-line);
  border-radius: 8px 16px 16px 8px;
  background: #fbf5ea;
  color: var(--sb-ink);
  font-size: 14px;
  font-weight: 700;
  text-align: left;
  box-shadow: var(--sb-pop-sm);
  transition: background 0.15s, transform 0.12s;
}
/* the tag's eyelet */
.pk-switch-row::before {
  content: '';
  position: absolute;
  left: 11px;
  top: 50%;
  width: 12px;
  height: 12px;
  margin-top: -6px;
  border: 2.5px solid var(--sb-ink);
  border-radius: 50%;
  background: var(--sb-cream);
}
.pk-switch-row:hover {
  transform: translateY(-1px);
}
.pk-switch-row[aria-checked='true'] {
  background: var(--sb-teal-soft);
}
/* the switch: navy outline, amber when on */
.pk-switch {
  position: relative;
  flex: none;
  width: 46px;
  height: 26px;
  border: 2px solid var(--sb-ink);
  border-radius: 999px;
  background: #e6ddcb;
  transition: background 0.2s;
}
.pk-knob {
  position: absolute;
  top: 1px;
  left: 1px;
  width: 20px;
  height: 20px;
  border: 2px solid var(--sb-ink);
  border-radius: 50%;
  background: #fbf5ea;
  transition: transform 0.22s var(--sb-spring);
}
.pk-switch-row[aria-checked='true'] .pk-switch {
  background: var(--sb-amber);
}
.pk-switch-row[aria-checked='true'] .pk-knob {
  transform: translateX(20px);
}
.pk-setup-foot {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 12px;
  padding-top: 18px;
  border-top: 2px dashed var(--sb-stitch);
}
/* the big 3D amber button (like "Confirm Trip") */
.pk-go {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 14px 28px;
  border: var(--sb-line);
  border-radius: 20px;
  background: linear-gradient(180deg, var(--sb-amber-hi), var(--sb-amber) 55%, var(--sb-amber-lo));
  color: var(--sb-ink);
  font-family: var(--sb-display);
  font-size: 1.2rem;
  letter-spacing: 0.01em;
  box-shadow: inset 0 2px 0 rgba(255, 255, 255, 0.6), 0 7px 0 var(--sb-ink), 0 16px 24px -10px rgba(18, 50, 74, 0.45);
  transition: transform 0.12s, box-shadow 0.12s;
}
.pk-go:hover {
  transform: translateY(-2px);
  box-shadow: inset 0 2px 0 rgba(255, 255, 255, 0.6), 0 9px 0 var(--sb-ink), 0 18px 26px -10px rgba(18, 50, 74, 0.45);
}
.pk-go:active {
  transform: translateY(6px);
  box-shadow: inset 0 3px 6px rgba(0, 0, 0, 0.15), 0 1px 0 var(--sb-ink);
}

/* ----- The list ----- */
/* Progress: the suitcase, the count and a striped bar */
.pk-top {
  display: flex;
  gap: 14px;
  align-items: center;
  margin-bottom: 16px;
}
.pk-case {
  flex: none;
  width: 52px;
  height: 52px;
}
.pk-progress-text {
  font-family: var(--sb-display);
  font-weight: 400;
  font-size: 1.6rem;
}
/* an inked stamp, only when every item is packed */
.pk-done {
  padding: 2px 12px;
  border: 2.5px solid #1d6b40;
  border-radius: 8px;
  color: #1d6b40;
  font-family: var(--sb-display);
  font-size: 1.1rem;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  transform: rotate(-4deg);
  animation: pk-stamp 0.4s var(--sb-spring);
}
@keyframes pk-stamp {
  0% { opacity: 0; transform: scale(1.6) rotate(-4deg); }
}
.pk-own {
  margin: 8px 0 0;
  font-size: 13px;
  font-weight: 600;
  color: #3d5266;
}
.pk-bar {
  height: 18px;
  border: var(--sb-line);
  border-radius: 999px;
  background: var(--sb-cream);
  overflow: hidden;
}
.pk-bar-fill {
  height: 100%;
  border-radius: 999px;
  background: repeating-linear-gradient(-45deg, var(--sb-amber) 0 10px, var(--sb-amber-hi) 10px 20px);
  transition: width 0.3s ease;
}
/* Built for N days: the activities as stickers */
.pk-edit-row {
  display: flex;
  justify-content: flex-end;
  margin-bottom: 14px;
}
.pk-profile {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  margin-bottom: 22px;
}
.pk-profile .pk-muted {
  font-weight: 700;
}
.pk-tag {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 4px 12px;
  border: 2px solid var(--sb-ink);
  border-radius: 14px;
  background: #fbf5ea;
  font-size: 13px;
  font-weight: 700;
  box-shadow: 0 2px 0 var(--sb-ink);
}
.pk-tag:nth-of-type(odd) { transform: rotate(-1.5deg); background: var(--sb-peach); }
.pk-tag:nth-of-type(even) { transform: rotate(1.5deg); background: var(--sb-teal-soft); }
.pk-link {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  min-height: 42px;
  padding: 0 18px 0 6px;
  border: 2.5px solid var(--sb-ink);
  border-radius: 999px;
  background: var(--sb-amber);
  color: var(--sb-ink);
  font-family: var(--sb-display);
  font-size: 1.05rem;
  font-weight: 400;
  letter-spacing: 0.02em;
  box-shadow: 0 4px 0 var(--sb-ink);
  transition: transform 0.15s var(--sb-spring), box-shadow 0.15s;
}
.pk-link-icon {
  display: grid;
  place-items: center;
  width: 30px;
  height: 30px;
  border: 2px solid var(--sb-ink);
  border-radius: 50%;
  background: #fffdf8;
  transition: transform 0.25s var(--sb-spring);
}
.pk-link:hover {
  background: var(--sb-amber-hi);
  transform: translateY(-2px);
  box-shadow: 0 6px 0 var(--sb-ink);
}
.pk-link:hover .pk-link-icon {
  transform: rotate(-15deg);
}
.pk-link:active {
  transform: translateY(3px);
  box-shadow: 0 1px 0 var(--sb-ink);
}
/* Hide packed: a switch */
.pk-hide {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 0;
  font-size: 14px;
  font-weight: 700;
  cursor: pointer;
}
.pk-hide input {
  appearance: none;
  -webkit-appearance: none;
  position: relative;
  width: 46px;
  height: 26px;
  margin: 0;
  border: 2px solid var(--sb-ink);
  border-radius: 999px;
  background: #e6ddcb;
  cursor: pointer;
  transition: background 0.2s;
}
.pk-hide input::after {
  content: '';
  position: absolute;
  top: 1px;
  left: 1px;
  width: 20px;
  height: 20px;
  border: 2px solid var(--sb-ink);
  border-radius: 50%;
  background: #fbf5ea;
  transition: transform 0.22s var(--sb-spring);
}
.pk-hide input:checked {
  background: var(--sb-amber);
}
.pk-hide input:checked::after {
  transform: translateX(20px);
}

/* Each category: a packing cube in its own colour */
.pk-cat {
  --cube: var(--sb-peach);
  margin-bottom: 16px;
  overflow: hidden;
  border: var(--sb-line);
  border-radius: 18px;
  background: #fbf5ea;
  box-shadow: var(--sb-pop-sm);
}
.pk-cat:nth-of-type(4n + 2) { --cube: var(--sb-teal-soft); }
.pk-cat:nth-of-type(4n + 3) { --cube: #e4ecff; }
.pk-cat:nth-of-type(4n) { --cube: #f3e6ff; }
.pk-cat-head {
  position: relative;
  width: 100%;
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 16px 16px;
  border: 0;
  background: var(--cube);
  color: var(--sb-ink);
  text-align: left;
}
/* the zip line along the bottom of the cube's top */
.pk-cat-head::after {
  content: '';
  position: absolute;
  left: 12px;
  right: 12px;
  bottom: 5px;
  border-bottom: 3px dashed rgba(18, 50, 74, 0.35);
}
.pk-cat-icon {
  display: grid;
  place-items: center;
  flex: none;
  width: 44px;
  height: 44px;
  border: 2px solid var(--sb-ink);
  border-radius: 12px;
  background: #fbf5ea;
  box-shadow: 0 2px 0 var(--sb-ink);
  transform: rotate(-4deg);
}
.pk-cat-title {
  flex: 1;
  margin: 0;
  font-family: var(--sb-display);
  font-weight: 400;
  font-size: 1.3rem;
}
/* every item packed: an inked "Zipped" stamp */
.pk-zipped {
  padding: 1px 10px;
  border: 2.5px solid #1d6b40;
  border-radius: 7px;
  color: #1d6b40;
  font-family: var(--sb-display);
  font-size: 0.95rem;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  transform: rotate(-5deg);
  animation: pk-stamp 0.4s var(--sb-spring);
}
.pk-cat-count {
  padding: 2px 10px;
  border: 2px solid var(--sb-ink);
  border-radius: 999px;
  background: #fbf5ea;
  font-size: 13px;
  font-weight: 800;
}
.pk-cat-count.full {
  border-color: var(--sb-ink);
  background: var(--sb-amber);
  color: var(--sb-ink);
}
.pk-chevron {
  width: 16px;
  color: var(--sb-ink);
  font-weight: 800;
}
.pk-list {
  margin: 0;
  padding: 8px 10px;
  list-style: none;
}
.pk-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px;
  border-radius: 12px;
  transition: opacity 0.2s;
}
.pk-item + .pk-item {
  border-top: 1px dashed rgba(18, 50, 74, 0.15);
}
.pk-item:hover {
  background: rgba(255, 191, 60, 0.1);
}
.pk-item.packed {
  opacity: 0.55;
}
/* a hand-drawn strike-through */
.pk-item.packed .pk-name {
  text-decoration: line-through;
  text-decoration-color: var(--sb-amber-lo);
  text-decoration-thickness: 3px;
}
.pk-check {
  display: flex;
  align-items: center;
  gap: 12px;
  flex: 1;
  min-width: 0;
  margin: 0;
  cursor: pointer;
}
.pk-check input {
  position: absolute;
  width: 1px;
  height: 1px;
  opacity: 0;
}
/* the tick box: chunky and square; ticking stamps an amber ✓ */
.pk-box {
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  width: 30px;
  height: 30px;
  border: var(--sb-line);
  border-radius: 8px;
  background: #fbf5ea;
  color: transparent;
  font-size: 17px;
  font-weight: 900;
  box-shadow: 0 2px 0 var(--sb-ink);
  transition: background 0.15s;
}
.pk-check input:checked + .pk-box {
  background: var(--sb-amber);
  border-color: var(--sb-ink);
  color: var(--sb-ink);
  animation: pk-tick 0.35s var(--sb-spring);
}
@keyframes pk-tick {
  40% { transform: scale(1.25) rotate(-8deg); }
}
.pk-check input:focus-visible + .pk-box {
  outline: 3px solid var(--sb-teal);
  outline-offset: 2px;
}
.pk-name {
  min-width: 0;
  font-size: 15px;
  font-weight: 700;
}
.pk-name small {
  font-weight: 600;
}
/* amount: a chunky stepper */
.pk-qty {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 0;
}
.pk-qty button {
  width: 30px;
  height: 30px;
  border: 2px solid var(--sb-ink);
  border-radius: 9px;
  background: var(--sb-cream);
  color: var(--sb-ink);
  font-weight: 900;
  line-height: 1;
  box-shadow: 0 2px 0 var(--sb-ink);
}
.pk-qty button:hover:not(:disabled) {
  background: var(--sb-amber);
}
.pk-qty button:active:not(:disabled) {
  transform: translateY(2px);
  box-shadow: 0 0 0 var(--sb-ink);
}
.pk-qty button:disabled {
  opacity: 0.35;
  box-shadow: none;
}
.pk-qty span {
  min-width: 30px;
  font-family: var(--sb-display);
  font-size: 1.2rem;
  text-align: center;
}
.pk-remove {
  display: grid;
  place-items: center;
  width: 32px;
  height: 32px;
  border: 2px solid rgba(18, 50, 74, 0.3);
  border-radius: 50%;
  background: var(--sb-cream);
  color: var(--sb-ink-soft);
}
.pk-remove:hover {
  border-color: var(--sb-red);
  background: #ffe1e5;
  color: var(--sb-red);
}
/* add an item: a dashed slot inside the cube */
.pk-add {
  display: flex;
  gap: 8px;
  padding: 6px 18px 16px;
}
.pk-add-input {
  flex: 1;
  min-width: 0;
  min-height: 44px;
  padding: 0 14px;
  border: 2px dashed rgba(18, 50, 74, 0.35);
  border-radius: 12px;
  background: var(--sb-cream);
  color: var(--sb-ink);
  font-weight: 600;
}
.pk-add-input:focus {
  outline: none;
  border-style: solid;
  border-color: var(--sb-ink);
  background: #fbf5ea;
  box-shadow: 0 0 0 4px rgba(255, 191, 60, 0.45);
}
.pk-add-btn {
  min-height: 44px;
  padding: 0 20px;
  border: var(--sb-line);
  border-radius: 12px;
  background: linear-gradient(180deg, var(--sb-amber-hi), var(--sb-amber) 55%, var(--sb-amber-lo));
  color: var(--sb-ink);
  font-family: var(--sb-display);
  font-size: 1.05rem;
  box-shadow: var(--sb-pop-sm);
}
.pk-add-btn:active:not(:disabled) {
  transform: translateY(3px);
  box-shadow: 0 0 0 var(--sb-ink);
}
.pk-add-btn:disabled {
  opacity: 0.5;
}

.pk-tile:focus-visible,
.pk-seg button:focus-visible,
.pk-switch-row:focus-visible,
.pk-go:focus-visible,
.pk-cat-head:focus-visible,
.pk-qty button:focus-visible,
.pk-remove:focus-visible,
.pk-link:focus-visible,
.pk-add-btn:focus-visible,
.pk-hide input:focus-visible {
  outline: 3px solid var(--sb-teal);
  outline-offset: 2px;
}
.pk-cat-head:focus-visible {
  outline-offset: -4px;
}

/* Wide screens: all 10 activities in one row; weather and extras side by side */
@media (min-width: 1200px) {
  .pk-tiles {
    grid-template-columns: repeat(10, minmax(0, 1fr));
  }
  .pk-pair {
    grid-template-columns: minmax(0, 1fr) minmax(0, 1.3fr);
    align-items: stretch;
  }
  .pk-pair .pk-block + .pk-block {
    border-top: 0;
    padding-top: 0;
    border-left: 2px dashed var(--sb-stitch);
    padding-left: 24px;
  }
  .pk-seg {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
@media (max-width: 640px) {
  .pk-setup {
    padding: 22px 16px 18px;
  }
  .pk-setup::before,
  .pk-setup::after {
    width: 22px;
    height: 22px;
  }
  .pk-tiles {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
  .pk-seg {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
  .pk-switches {
    grid-template-columns: 1fr;
  }
  .pk-go {
    width: 100%;
    justify-content: center;
  }
  .pk-add {
    padding: 6px 10px 14px;
  }
}
/* Phones and touch screens: every control is at least 40px to tap (WCAG / Apple guidance) */
@media (pointer: coarse), (max-width: 560px) {
  .pk-qty button,
  .pk-remove {
    min-width: 40px;
    min-height: 40px;
  }
  .pk-link {
    min-height: 40px;
  }
}
@media (prefers-reduced-motion: reduce) {
  .pk-tile, .pk-tile .pk-tile-icon, .pk-knob, .pk-bar-fill, .pk-item, .pk-seg button, .pk-go,
  .pk-hide input, .pk-hide input::after { transition: none; }
  .pk-tile.on, .pk-done, .pk-zipped, .pk-check input:checked + .pk-box { animation: none; }
  .pk-link, .pk-link-icon { transition: none; }
}
</style>
