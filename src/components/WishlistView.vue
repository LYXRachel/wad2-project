<template>
  <div>
    <!-- Indoor / outdoor filter (the "Find a place" box below is the only search) -->
    <div class="wl-filters" role="group" aria-label="Show">
      <button v-for="f in filterOptions" :key="f.value" type="button" class="wl-chip" :class="{ active: filter === f.value }"
        :aria-pressed="filter === f.value" @click="filter = f.value">{{ f.label }}</button>
    </div>

    <!-- ===== Your wishlist ===== -->
    <h3 class="wl-heading">Your wishlist <span class="wl-count">{{ wishlist.length }}</span></h3>

    <transition-group v-if="shownWishlist.length" name="card" tag="div" class="wl-grid" data-testid="wishlist">
      <article v-for="w in shownWishlist" :key="w.id" :data-wish="w.id" class="wl-card mine" :class="{ 'has-photo': photoOf(w), editing: editId === w.id }" :style="{ '--tint': tintFor(w.type) }">
        <!-- A real photo of the place when Wikipedia has one, otherwise a simple icon -->
        <!-- The kind of place sits on the photo's bottom edge: the top row is for the buttons -->
        <div class="wl-photo" :class="{ loading: photos[photoTitle(w)] === '' }" :style="photoOf(w) ? { backgroundImage: 'url(' + photoOf(w) + ')' } : null">
          <AppIcon v-if="!photoOf(w)" :name="iconFor(w.type)" :size="44" class="wl-ph-icon" />
          <span class="wl-type"><AppIcon :name="iconFor(w.type)" :size="13" />
            <span class="wl-type-text"><template v-if="w.type === 'tour'">{{ w.bookedVia ? 'Booked · ' + w.bookedVia : 'Tour' }}<template v-if="w.duration"> · {{ lengthText(w.duration) }}</template></template><template v-else>{{ placeStyle(w.type).label }}<template v-if="!w.outdoor"> · Indoor</template></template></span>
          </span>
        </div>
        <div class="wl-actions">
          <a v-if="w.link" :href="w.link" target="_blank" rel="noopener" class="wl-round" :aria-label="'Open booking for ' + w.name" title="Open booking">↗</a>
          <button type="button" class="wl-round" :aria-label="'Edit ' + w.name" title="Edit" @click="startEdit(w)"><AppIcon name="pencil" :size="14" /></button>
          <button type="button" class="wl-heart filled" :aria-label="'Remove ' + w.name + ' from wishlist'" title="Remove" @click="remove(w)"><AppIcon name="heart" :size="17" filled /></button>
        </div>
        <div class="wl-info">
          <h4 class="wl-name" :title="w.name">{{ w.name }}</h4>
          <span class="wl-sub" :title="w.address || ''">
            <template v-if="w.city">{{ flagFor(w.city) }} {{ w.city.split(', ')[0] }}</template><template v-if="w.city && streetOf(w)"> · </template>{{ streetOf(w) }}
          </span>
          <button v-if="needsPoint(w)" type="button" class="wl-setloc" @click="startEdit(w)"><AppIcon name="map-pin" :size="12" /> Set location</button>
          <span v-if="w.votes && w.votes.length" class="wl-votes" :title="w.votes.join(', ') + ' want to go'"><AppIcon name="thumbs-up" :size="12" /> {{ w.votes.length }} want to go</span>
        </div>
      </article>
    </transition-group>
    <p v-else class="wl-empty">
      {{ wishlist.length ? 'No saved places match this filter.' : 'No places yet. Tap the heart on a popular place below, or add your own.' }}
    </p>

    <!-- Edit panel -->
    <transition name="fade">
      <!-- Opening it scrolls here; Save or Cancel scrolls back to the card -->
      <form v-if="editId" ref="editPanel" class="wl-panel" aria-labelledby="wl-edit-title" @submit.prevent="saveEdit" @keydown.esc="cancelEdit">
        <strong id="wl-edit-title" class="d-block mb-2">Edit place</strong>
        <div class="row g-2">
          <!-- The name is a label: rename freely. Picking a suggestion (or a pin / Maps link) moves the place. -->
          <div class="col-md-10">
            <PlaceInput id="wl-edit-name" v-model="editForm.name" v-model:place="editForm.place" label="Name" keep-place pin
              :near="centres[editCity]" hint="No location yet: pick a suggestion, paste a Google Maps link, or drop a pin." />
            <p class="small text-muted mb-0 mt-1">Rename it freely. Pick a suggestion only if you want to move it to that place.</p>
          </div>
          <div v-if="editForm.isTour" class="col-md-10">
            <label for="wl-edit-link" class="form-label small">Booking link</label>
            <input id="wl-edit-link" v-model="editForm.link" type="url" class="form-control wl-input" maxlength="500" placeholder="https://">
          </div>
          <div class="col-md-2 d-flex align-items-end gap-1">
            <button type="submit" class="btn btn-primary wl-pill-btn flex-fill">Save</button>
            <button type="button" class="btn btn-outline-secondary wl-pill-btn flex-fill" @click="cancelEdit">Cancel</button>
          </div>
        </div>
      </form>
    </transition>

    <!-- Find a place (any shop, restaurant, temple...) or add your own -->
    <!-- Find a real place (any shop, restaurant, temple...): pick a suggestion, paste a Google Maps link, or drop a pin -->
    <form class="wl-add" @submit.prevent="addPicked">
      <CustomDropdown v-if="destinations.length > 1" v-model="searchIn" :options="cityOptions" class="wl-in"
        header-text="Search in" aria-label="Search in" />
      <div class="wl-add-name">
        <label for="wish-name" class="visually-hidden">Find a place</label>
        <PlaceInput id="wish-name" v-model="form.name" v-model:place="form.place" :groups="popularGroups" :near="centres[searchIn]" pin
          :placeholder="'Find a place in ' + (searchIn ? searchIn.split(', ')[0] : 'your destination')" />
      </div>
      <button type="submit" class="btn btn-primary wl-pill-btn" :disabled="!form.place" data-testid="wish-add">+ Add</button>
      <button type="button" class="btn wl-pill-btn wl-tour-btn" :class="{ on: tourOpen }" :aria-expanded="tourOpen"
        title="Add a tour or activity you booked, e.g. on GetYourGuide" @click="tourOpen ? (tourOpen = false) : openTour()"><AppIcon name="ticket" :size="16" /> Add a tour</button>
    </form>

    <!-- A tour or activity that isn't on the map (eagle hunting, a GetYourGuide day trip...):
         the same travel-notebook pop-up as "Plan a new trip", with Pip giving tips as you go -->
    <NotebookModal :open="tourOpen" title="Add a tour or activity" :tip="tourTip" @close="tourOpen = false">
      <template #kicker>Booking diary</template>
      <form class="nbf" novalidate aria-label="Add a tour or activity" @submit.prevent="saveTour" @focusin="onTourFocus">
        <div class="nbf-row">
          <label for="wl-tour-name" class="nbf-label"><DoodleIcon name="ticket" :size="24" anim="" /> What is it?</label>
          <input id="wl-tour-name" ref="tourName" v-model="tour.name" class="nbf-input" maxlength="120"
            placeholder="e.g. Eagle hunting show at Bokonbaevo" data-tip="name" required>
        </div>

        <div class="nbf-pair">
          <div class="nbf-row" data-tip="booked">
            <span class="nbf-label"><DoodleIcon name="wallet" :size="24" anim="" /> Booked on</span>
            <CustomDropdown v-model="tour.bookedVia" :options="providerOptions" block aria-label="Booked on" class="nbf-dd" />
          </div>
          <div class="nbf-row">
            <label for="wl-tour-link" class="nbf-label"><DoodleIcon name="chat" :size="24" anim="" /> Booking link <small>(optional)</small></label>
            <input id="wl-tour-link" v-model="tour.link" type="url" class="nbf-input" maxlength="500"
              placeholder="Paste the confirmation or tour page" data-tip="booked" @input="guessProvider">
          </div>
        </div>

        <div class="nbf-row">
          <label for="wl-tour-where" class="nbf-label"><DoodleIcon name="pin" :size="24" anim="" /> Meeting point <small>(optional)</small></label>
          <PlaceInput id="wl-tour-where" v-model="tour.address" v-model:place="tour.place" pin :near="centres[searchIn]" data-tip="where"
            placeholder="Where it starts" hint="Leave empty for hotel pickup, or pick a suggestion, paste a Google Maps link, or drop a pin." />
        </div>

        <div class="nbf-row">
          <span class="nbf-label" id="wl-tour-len"><DoodleIcon name="boot" :size="24" anim="" /> How long?</span>
          <div class="nbf-choices" role="group" aria-labelledby="wl-tour-len">
            <button v-for="d in lengthOptions" :key="d.value" type="button" class="nbf-choice" :class="{ on: tour.duration === d.value }"
              :aria-pressed="tour.duration === d.value" data-tip="length" @click="tour.duration = d.value">{{ d.label }}</button>
          </div>
        </div>

        <div class="nbf-row">
          <span class="nbf-label" id="wl-tour-mostly"><DoodleIcon name="compass" :size="24" anim="" /> Mostly</span>
          <div class="nbf-vibes two" role="group" aria-labelledby="wl-tour-mostly">
            <button type="button" class="nbf-vibe" :class="{ on: tour.outdoor }" :aria-pressed="tour.outdoor" data-tip="mostly" @click="tour.outdoor = true">
              <DoodleIcon name="mountain" :size="38" anim="bounce" /><span>Outdoor</span>
            </button>
            <button type="button" class="nbf-vibe" :class="{ on: !tour.outdoor }" :aria-pressed="!tour.outdoor" data-tip="mostly" @click="tour.outdoor = false">
              <DoodleIcon name="pillar" :size="38" anim="bounce" /><span>Indoor</span>
            </button>
          </div>
        </div>

        <div v-if="tripDays.length" class="nbf-pair">
          <div class="nbf-row" data-tip="date">
            <span class="nbf-label"><DoodleIcon name="calendar" :size="24" anim="" /> Already have a date? <small>(optional)</small></span>
            <CustomDropdown v-model="tour.date" :options="dayOptions" block aria-label="Day" class="nbf-dd" />
          </div>
          <div class="nbf-row">
            <label for="wl-tour-time" class="nbf-label"><DoodleIcon name="sun" :size="24" anim="" /> Starts at</label>
            <input id="wl-tour-time" v-model="tour.time" type="time" class="nbf-input" :disabled="!tour.date" data-tip="date">
          </div>
        </div>

        <p class="nbf-note">
          <template v-if="tour.date && tour.time">It goes straight into your itinerary as a fixed booking, so the optimizer plans around it.</template>
          <template v-else>It goes into your wishlist, ready to drop into any day.</template>
        </p>
        <p v-if="tourError" class="nbf-msg is-error" role="alert">{{ tourError }}</p>

        <div class="nbf-actions">
          <button type="button" class="nbf-later" @click="tourOpen = false">Maybe later</button>
          <button type="submit" class="nbf-go" :disabled="!tour.name.trim()">
            <DoodleIcon name="ticket" :size="24" tint="cream" anim="" />
            {{ tour.date && tour.time ? 'Add to Day ' + dayNumber(tour.date) : 'Add to wishlist' }}
          </button>
        </div>
      </form>
    </NotebookModal>

    <!-- ===== Popular places: one section per destination ===== -->
    <section v-for="sec in sections" :key="sec.dest" class="mt-5" :aria-label="'Popular in ' + sec.city">
      <div class="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-3">
        <h3 class="wl-heading mb-0">{{ sec.flag }} Popular in {{ sec.city }}</h3>
        <span v-if="sec.list.length" class="small text-muted">
          {{ sec.list.length }} {{ sec.list.length === 1 ? 'place' : 'places' }} ·
          <template v-if="sec.google">from Google Maps</template>
          <template v-else-if="sec.partial">top picks</template>
          <!-- Geoapify's terms: a "Powered by Geoapify" link next to what it found -->
          <template v-else-if="sec.geoapify"><a href="https://www.geoapify.com/" target="_blank" rel="noopener" class="wl-credit">Powered by Geoapify</a> · © OpenStreetMap</template>
          <template v-else>from OpenStreetMap</template>
        </span>
      </div>
      <!-- The map service was busy: only the hand-picked (and Wikipedia) places for now -->
      <p v-if="sec.partial && !sec.loading" class="wl-partial" role="status">
        <span class="wl-partial-dot" aria-hidden="true"></span>
        Showing top picks for now: the map service was busy. Refresh in a minute for the full list.
        <button type="button" class="wl-partial-btn" @click="loadPopular(sec.dest)">Refresh</button>
      </p>

      <!-- Loaded only when asked for -->
      <div v-if="sec.idle" class="wl-load">
        <button type="button" class="btn btn-outline-primary wl-pill-btn" @click="loadPopular(sec.dest)">
          <AppIcon name="star" :size="15" /> Show popular places in {{ sec.city }}
        </button>
      </div>
      <div v-else-if="sec.loading" aria-busy="true">
        <p class="small text-muted">Finding popular places… the first time for a whole country can take up to a minute.</p>
        <div class="wl-grid"><div v-for="n in 6" :key="n" class="wl-card skeleton"></div></div>
      </div>
      <div v-else-if="sec.error" class="alert alert-warning d-flex justify-content-between align-items-center" role="alert">
        <span>{{ sec.error }}</span>
        <button class="btn btn-sm btn-outline-secondary" @click="loadPopular(sec.dest)">Try again</button>
      </div>
      <p v-else-if="!sec.list.length" class="wl-empty">No popular places found in {{ sec.city }}. You can still add your own above.</p>

      <template v-else>
        <!-- Narrow down by kind: Museums, Parks, Theme parks... (with how many of each) -->
        <div v-if="kindsOf(sec.dest).length > 1" class="wl-kinds">
          <span class="wl-kinds-label">Show</span>
          <CustomDropdown :model-value="kindFilter[sec.dest] || ''" :options="kindOptions(sec.dest)" header-text="Kind of place"
            :aria-label="'Kind of places to show in ' + sec.city" @update:model-value="kindFilter[sec.dest] = $event" />
        </div>
        <transition-group name="card" tag="div" class="wl-grid" data-testid="popular-list">
          <!-- The whole card is the button: tap to save, tap again to un-save -->
          <article v-for="p in sec.list.slice(0, sec.shown)" :key="p.name" class="wl-card wl-tap" :class="{ saved: isAdded(p), 'has-photo': photoOf(p) }" :style="{ '--tint': tintFor(p.type) }"
            role="button" tabindex="0" :aria-pressed="isAdded(p)" :aria-label="(isAdded(p) ? 'Remove ' : 'Add ') + p.name + (isAdded(p) ? ' from' : ' to') + ' wishlist'"
            @click="togglePopular(p)" @keydown.enter.prevent="togglePopular(p)" @keydown.space.prevent="togglePopular(p)" data-testid="popular-add">
            <div class="wl-photo" :class="{ loading: photos[photoTitle(p)] === '' }" :style="photoOf(p) ? { backgroundImage: 'url(' + photoOf(p) + ')' } : null">
              <AppIcon v-if="!photoOf(p)" :name="iconFor(p.type)" :size="44" class="wl-ph-icon" />
              <span class="wl-type"><AppIcon :name="iconFor(p.type)" :size="13" /> <span class="wl-type-text">{{ placeStyle(p.type).label }}<template v-if="p.indoor"> · Indoor</template></span></span>
            </div>
            <span class="wl-heart" :class="{ filled: isAdded(p) }" aria-hidden="true"><AppIcon name="heart" :size="17" :filled="isAdded(p)" /></span>
            <div class="wl-info">
              <h4 class="wl-name" :title="p.name">{{ p.name }}</h4>
              <span class="wl-sub">{{ isAdded(p) ? '✓ In your wishlist' : 'Tap to save' }}</span>
            </div>
          </article>
        </transition-group>
        <div v-if="sec.shown < sec.list.length" class="text-end mt-3">
          <button type="button" class="btn btn-sm btn-outline-secondary wl-pill-btn" @click="showMore(sec.dest)">
            Show more in {{ sec.city }}
          </button>
        </div>
      </template>
    </section>
  </div>
</template>

<script>
import axios from 'axios'
import { trip, newId, runtimeStop } from '../itineraryStore.js'
import { codeForDestination, flagEmoji } from '../destinations.js'
import { placeStyle } from '../placeStyle.js'
import CustomDropdown from './CustomDropdown.vue'
import AppIcon from './AppIcon.vue'
import DoodleIcon from './DoodleIcon.vue'
import NotebookModal from './NotebookModal.vue'
import PlaceInput from './PlaceInput.vue'
import { cityCentre } from '../services/cityCentre.js'

// Geoapify's kind of place ('catering.cafe', 'entertainment.museum'...) -> our card types
const INDOOR_TYPES = ['museum', 'gallery', 'aquarium', 'food', 'shop']
function typeForKind(kind) {
  const k = String(kind || '')
  if (k.includes('museum')) return 'museum'
  if (k.includes('gallery')) return 'gallery'
  if (k.includes('aquarium')) return 'aquarium'
  if (k.includes('zoo')) return 'zoo'
  if (k.includes('theme_park')) return 'theme_park'
  if (k.startsWith('catering')) return 'food'
  if (k.startsWith('commercial')) return 'shop'
  if (k.includes('park') || k.startsWith('natural') || k.startsWith('beach')) return 'park'
  if (k.includes('heritage') || k.startsWith('religion') || k.includes('sights')) return 'heritage'
  if (k.includes('viewpoint')) return 'viewpoint'
  return 'attraction'
}

function emptyTour() {
  return { name: '', bookedVia: '', link: '', address: '', place: null, duration: 3, outdoor: true, date: '', time: '' }
}

export default {
  components: { AppIcon, CustomDropdown, DoodleIcon, NotebookModal, PlaceInput },
  props: {
    // All of the trip's destinations, e.g. ['Tokyo, Japan', 'Kyoto, Japan']
    destinations: { type: Array, default: () => [] },
    startDate: { type: String, default: '' },
    endDate: { type: String, default: '' }
  },

  data() {
    return {
      popularByDest: {}, // destination -> list from the server
      photos: {},        // 'Juche Tower, Pyongyang' -> photo URL ('' = looking, null = none)
      kindFilter: {},    // destination -> place type shown ('' = all)
      status: {}, // destination -> { loading, error, shown }
      filter: 'all',
      filterOptions: [
        { value: 'all', label: 'All' },
        { value: 'indoor', label: '🏛 Indoor' },
        { value: 'outdoor', label: '🌳 Outdoor' }
      ],
      form: { name: '', place: null }, // "Find a place": the text, and the real place picked
      searchIn: '',      // which destination "Find a place" searches in
      centres: {},       // destination -> { lat, lon }, so search looks around that city
      editId: null,
      editForm: { name: '', place: null, link: '', isTour: false },
      tourOpen: false,
      tour: emptyTour(),
      tourError: '',
      tourFocus: '', // which part of the tour form you're on, for Pip's tip
      providerOptions: [
        { value: '', label: 'Not booked yet' },
        { value: 'GetYourGuide', label: 'GetYourGuide' },
        { value: 'Tripadvisor', label: 'Tripadvisor' },
        { value: 'Viator', label: 'Viator' },
        { value: 'Klook', label: 'Klook' },
        { value: 'Airbnb Experiences', label: 'Airbnb Experiences' },
        { value: 'Local operator', label: 'Directly with a local operator' },
        { value: 'Other', label: 'Somewhere else' }
      ],
      lengthOptions: [
        { value: 1, label: '1 h' },
        { value: 2, label: '2 h' },
        { value: 3, label: '3 h' },
        { value: 4, label: 'Half day' },
        { value: 8, label: 'Full day' }
      ]
    }
  },

  watch: {
    // New saved places (or a different kind chip) need their photos
    'wishlist.length'() {
      this.loadPhotos()
    },
    kindFilter: {
      deep: true,
      handler() {
        this.$nextTick(this.loadPhotos)
      }
    },
    // Load every destination's popular places when the trip's destinations arrive
    destinations: {
      immediate: true,
      handler(list) {
        if (!list.includes(this.searchIn)) this.searchIn = list[0] || ''
        for (const d of list) {
          cityCentre(d).then((c) => {
            if (c) this.centres[d] = c
          })
        }
      }
    }
  },

  computed: {
    // What Pip says in the "Add a tour" notebook, for the part you're filling in
    tourTip() {
      const t = this.tourFocus
      if (t === 'name') return 'Ooh, something fun! What are we doing?'
      if (t === 'booked') return 'Booked it already? Paste the link and I\'ll spot the site!'
      if (t === 'where') return 'Where do we meet? A hotel pickup works too.'
      if (t === 'length') return 'How long will the fun last?'
      if (t === 'mostly') return 'Outdoors? Then I\'ll keep an eye on the weather for you!'
      if (t === 'date') return this.tour.date ? 'Add a start time and it locks into that day.' : 'Got a date? Pick it and it goes straight into the plan.'
      return 'Booked a tour or activity? Let\'s jot it down!'
    },
    // Every date of the trip, e.g. ['2026-10-12', '2026-10-13', ...]
    tripDays() {
      const days = []
      if (!this.startDate || !this.endDate) return days
      const d = new Date(this.startDate + 'T00:00:00')
      const end = new Date(this.endDate + 'T00:00:00')
      while (d <= end && days.length < 60) {
        days.push(d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'))
        d.setDate(d.getDate() + 1)
      }
      return days
    },
    dayOptions() {
      const list = [{ value: '', label: 'Not yet' }]
      for (let i = 0; i < this.tripDays.length; i++) {
        const d = new Date(this.tripDays[i] + 'T00:00:00')
        list.push({ value: this.tripDays[i], label: 'Day ' + (i + 1) + ' · ' + d.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' }) })
      }
      return list
    },
    cityOptions() {
      const list = []
      for (const d of this.destinations) list.push({ value: d, label: d.split(', ')[0], icon: this.flagFor(d), description: d.split(', ').slice(1).join(', ') })
      return list
    },
    // The shared wishlist (saved together with the itinerary)
    wishlist() {
      return trip.wishlist
    },

    shownWishlist() {
      const list = []
      for (const w of this.wishlist) {
        if (this.matches(w.name, !w.outdoor)) list.push(w)
      }
      return list
    },

    // One section per destination, with the search + filter applied
    sections() {
      const result = []
      for (const d of this.destinations) {
        const st = this.status[d] || { idle: true, loading: false, error: '', shown: 12 }
        const list = []
        for (const p of this.popularByDest[d] || []) {
          if (this.kindFilter[d] && p.type !== this.kindFilter[d]) continue
          if (this.matches(p.name, p.indoor)) list.push(p)
        }
        result.push({
          dest: d,
          city: d.split(', ')[0],
          flag: this.flagFor(d),
          list,
          idle: !!st.idle,
          loading: st.loading,
          error: st.error,
          shown: st.shown,
          partial: !!st.partial,
          google: (this.popularByDest[d] || []).some((p) => p.src === 'google'),
          geoapify: (this.popularByDest[d] || []).some((p) => p.src === 'geoapify')
        })
      }
      return result
    },

    // Popular places in the city being searched, offered first in "Find a place" (they have map points)
    popularGroups() {
      const items = []
      for (const p of this.popularByDest[this.searchIn] || []) {
        if (p.lat == null || this.isAdded(p)) continue
        items.push({ label: p.name, sub: placeStyle(p.type).label, place: { name: p.name, address: p.address, lat: p.lat, lon: p.lon } })
      }
      return items.length ? [{ label: 'Popular in ' + this.searchIn.split(', ')[0], icon: 'star', items }] : []
    },
    // The city of the place being edited (to search around it)
    editCity() {
      const w = this.wishlist.find((x) => x.id === this.editId)
      return (w && w.city) || this.searchIn
    }
  },

  methods: {
    placeStyle,

    lengthText(h) {
      if (h >= 8) return 'Full day'
      if (h >= 4) return 'Half day'
      return h + ' h'
    },
    dayNumber(date) {
      return this.tripDays.indexOf(date) + 1
    },

    openTour() {
      this.tour = emptyTour()
      this.tourFocus = ''
      this.tour.name = this.form.name.trim() // carry over whatever was typed in "Find a place"
      this.tourError = ''
      this.tourOpen = true
      this.$nextTick(() => this.$refs.tourName && this.$refs.tourName.focus())
    },
    // Pip's tip follows the part of the form you're on
    onTourFocus(e) {
      const el = e.target.closest('[data-tip]')
      if (el) this.tourFocus = el.dataset.tip
    },
    // Pasting a GetYourGuide / Klook... link picks the site for you
    guessProvider() {
      const link = this.tour.link.toLowerCase()
      const sites = [['getyourguide', 'GetYourGuide'], ['tripadvisor', 'Tripadvisor'], ['viator', 'Viator'], ['klook', 'Klook'], ['airbnb', 'Airbnb Experiences']]
      for (const site of sites) {
        if (link.includes(site[0])) this.tour.bookedVia = site[1]
      }
    },
    saveTour() {
      const t = this.tour
      const name = t.name.trim()
      if (!name) return
      let link = t.link.trim()
      if (link && !/^https?:\/\//i.test(link)) link = 'https://' + link
      if (link && !/^https?:\/\/[^\s.]+\.[^\s]+$/i.test(link)) {
        this.tourError = 'That booking link doesn\'t look right. Check it or leave it empty.'
        return
      }
      const item = {
        id: newId('w'), name, address: t.place ? t.place.address || t.place.name : null, lat: t.place ? t.place.lat : null, lon: t.place ? t.place.lon : null,
        outdoor: t.outdoor, type: 'tour',
        city: this.searchIn || null, votes: [], duration: t.duration, bookedVia: t.bookedVia || null, link: link || null
      }
      trip.wishlist.push(item)
      // A booked date + time: put it straight on that day, locked so nothing moves it
      if (t.date && t.time) {
        const parts = t.time.split(':')
        const hour = Math.min(23.75, Number(parts[0]) + Number(parts[1]) / 60)
        trip.stops.push(runtimeStop({ id: newId('s'), name, address: item.address, lat: item.lat, lon: item.lon, date: t.date, hour, duration: t.duration, outdoor: t.outdoor, locked: true }))
      }
      this.form.name = ''
      this.tourOpen = false
    },

    // Indoor/Outdoor filter
    matches(name, indoor) {
      if (this.filter === 'indoor' && !indoor) return false
      if (this.filter === 'outdoor' && indoor) return false
      return true
    },

    // First part of the address, e.g. "13 Okazaki Park" (skipped if it is just the place's name)
    streetOf(w) {
      if (!w.address) return ''
      const first = w.address.split(',')[0].trim()
      if (first.toLowerCase() === w.name.toLowerCase()) return ''
      if (w.city && first.toLowerCase() === w.city.split(', ')[0].toLowerCase()) return '' // just the city again
      return first
    },

    showMore(dest) {
      this.status[dest].shown += 12
      this.$nextTick(this.loadPhotos)
    },

    // ---------- photos and icons ----------
    // Photos come from /api/places/photos (Wikipedia, Wikidata and Wikimedia Commons), asked per city
    cityOf(place) {
      return place.city || this.destinations[0] || ''
    },
    photoTitle(place) {
      return place.name + '|' + this.cityOf(place)
    },
    photoOf(place) {
      return this.photos[this.photoTitle(place)] || null
    },
    // Ask for photos of everything on screen that we haven't asked about yet (up to 40 per request)
    async loadPhotos() {
      const places = this.wishlist.slice()
      for (const sec of this.sections) {
        for (const p of sec.list.slice(0, sec.shown)) places.push(p)
      }
      const byCity = {} // city -> names still to ask about
      for (const p of places) {
        const key = this.photoTitle(p)
        if (key in this.photos) continue
        this.photos[key] = '' // looking
        const city = this.cityOf(p)
        if (!byCity[city]) byCity[city] = []
        byCity[city].push(p.name)
      }
      for (const city in byCity) {
        const names = byCity[city]
        for (let i = 0; i < names.length; i += 40) {
          const batch = names.slice(i, i + 40)
          try {
            const res = await axios.get('/api/places/photos', { params: { city, names: batch.join('|') }, background: true })
            for (const n of batch) this.photos[n + '|' + city] = res.data[n] || null
          } catch (err) {
            for (const n of batch) delete this.photos[n + '|' + city] // try again next time
          }
        }
      }
    },
    // No photo: the card glows in a colour from the palette that fits the kind of place
    tintFor(type) {
      const tints = { museum: '#00798c', gallery: '#00798c', heritage: '#d1495b', park: '#66a182', zoo: '#66a182', aquarium: '#00798c',
        viewpoint: '#edae49', theme_park: '#edae49', food: '#edae49', shop: '#d1495b', tour: '#edae49' }
      return tints[type] || '#edae49'
    },
    // A simple line icon for each kind of place
    iconFor(type) {
      const icons = { museum: 'landmark', gallery: 'image', heritage: 'landmark', viewpoint: 'camera', park: 'trees', zoo: 'leaf', aquarium: 'leaf',
        theme_park: 'sparkles', food: 'utensils', shop: 'tag', transport: 'train', tour: 'ticket', attraction: 'map-pin' }
      return icons[type] || 'map-pin'
    },
    // For the dropdown: "All places (77)", then "Museum (47)", "Attraction (21)"...
    kindOptions(dest) {
      const options = [{ value: '', label: 'All places', description: (this.popularByDest[dest] || []).length + ' places' }]
      for (const k of this.kindsOf(dest)) {
        options.push({ value: k.type, label: k.label, description: k.count + (k.count === 1 ? ' place' : ' places'), icon: placeStyle(k.type).icon })
      }
      return options
    },
    // The kinds of places in a destination, most common first, e.g. [{ type: 'museum', label: 'Museum', count: 5 }]
    kindsOf(dest) {
      const kinds = []
      for (const p of this.popularByDest[dest] || []) {
        let k = kinds.find((x) => x.type === p.type)
        if (!k) {
          k = { type: p.type, label: placeStyle(p.type).label, count: 0 }
          kinds.push(k)
        }
        k.count++
      }
      kinds.sort((a, b) => b.count - a.count)
      return kinds
    },

    async loadPopular(dest) {
      const shown = (this.status[dest] && this.status[dest].shown) || 12
      this.status[dest] = { loading: true, error: '', shown }
      try {
        const res = await axios.get('/api/places/attractions', { params: { destination: dest }, timeout: 40000 })
        // Remember which city each place is in
        const list = []
        for (const p of res.data) list.push({ ...p, city: dest })
        this.popularByDest[dest] = list
        this.$nextTick(this.loadPhotos)
        // Only part of the list (the map service was busy): the Refresh button asks again
        this.status[dest].partial = res.headers['x-places-partial'] === '1'
      } catch (err) {
        this.status[dest].error = (err.response && err.response.data && err.response.data.message) || 'Could not load popular places. Is the server running?'
      }
      this.status[dest].loading = false
    },

    togglePopular(p) {
      if (!this.isAdded(p)) {
        this.addPopular(p)
        return
      }
      const w = this.wishlist.find((x) => x.name.toLowerCase() === p.name.toLowerCase())
      if (w) this.remove(w)
    },
    isAdded(p) {
      for (const w of this.wishlist) {
        if (w.name.toLowerCase() === p.name.toLowerCase()) return true
      }
      return false
    },

    addPopular(p) {
      if (this.isAdded(p)) return
      trip.wishlist.push({ id: newId('w'), name: p.name, address: p.address || null, outdoor: !p.indoor, type: p.type, city: p.city || null, votes: [], lat: p.lat ?? null, lon: p.lon ?? null })
      this.clearForm()
    },

    // "+ Add": the place picked in "Find a place" (a popular one keeps its card details)
    addPicked() {
      const pl = this.form.place
      if (!pl) return
      const same = (p) => p.lat != null && Math.abs(p.lat - pl.lat) < 1e-4 && Math.abs(p.lon - pl.lon) < 1e-4
      const popular = (this.popularByDest[this.searchIn] || []).find(same)
      if (popular) return this.addPopular(popular)
      const type = typeForKind(pl.kind)
      trip.wishlist.push({ id: newId('w'), name: pl.name, address: pl.address || null, outdoor: !INDOOR_TYPES.includes(type), type,
        city: this.searchIn || null, votes: [], lat: pl.lat, lon: pl.lon })
      this.clearForm()
    },

    clearForm() {
      this.form = { name: '', place: null }
    },

    // A place (not a tour) that isn't on the map yet: saved before places had map points
    needsPoint(w) {
      return w.lat == null && w.type !== 'tour'
    },

    remove(w) {
      trip.wishlist = trip.wishlist.filter((x) => x.id !== w.id)
      if (this.editId === w.id) this.editId = null
    },

    startEdit(w) {
      this.editId = w.id
      this.editForm = { name: w.name, place: w.lat != null ? { name: w.name, address: w.address || '', lat: w.lat, lon: w.lon } : null, link: w.link || '', isTour: w.type === 'tour' }
      // The form sits under all the cards: bring it into view and put the cursor in Name
      this.$nextTick(() => {
        const panel = this.$refs.editPanel
        if (!panel) return
        panel.scrollIntoView({ behavior: this.smoothScroll(), block: 'center' })
        const box = panel.querySelector('#wl-edit-name')
        if (box) box.focus({ preventScroll: true })
      })
    },

    cancelEdit() {
      this.backToCard(this.editId)
      this.editId = null
    },

    // After Save or Cancel: scroll back up to the card that was being edited
    backToCard(id) {
      this.$nextTick(() => {
        const card = this.$el.querySelector('[data-wish="' + id + '"]')
        if (!card) return
        card.scrollIntoView({ behavior: this.smoothScroll(), block: 'center' })
        const pencil = card.querySelector('.wl-round[title="Edit"]')
        if (pencil) pencil.focus({ preventScroll: true })
      })
    },

    smoothScroll() {
      return window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth'
    },

    saveEdit() {
      const name = this.editForm.name.trim()
      if (!name) return
      for (const w of trip.wishlist) {
        if (w.id === this.editId) {
          w.name = name
          // A new place was picked: it moves there. Otherwise only the name changed.
          const pl = this.editForm.place
          if (pl && (pl.lat !== w.lat || pl.lon !== w.lon)) {
            w.lat = pl.lat
            w.lon = pl.lon
            w.address = pl.address || null
          }
          if (this.editForm.isTour) {
            let link = this.editForm.link.trim()
            if (link && !/^https?:\/\//i.test(link)) link = 'https://' + link
            w.link = link || null
          }
        }
      }
      this.backToCard(this.editId)
      this.editId = null
    },

    flagFor(d) {
      return flagEmoji(codeForDestination(d))
    }
  }
}
</script>

<style scoped>
/* ---------- Toolbar ---------- */
.wl-toolbar {
  margin-bottom: 24px;
}
.wl-search {
  position: relative;
  display: flex;
  align-items: center;
  background: #fbf5ea;
  border: 1.5px solid #e2dacb;
  border-radius: 999px;
  height: 52px;
  padding: 0 8px 0 18px;
}
.wl-search:focus-within {
  border-color: var(--app-primary, #00798c);
  box-shadow: 0 0 0 4px rgba(0, 121, 140, 0.12);
}
.wl-search-icon {
  opacity: 0.6;
  margin-right: 10px;
}
.wl-search input {
  flex: 1;
  border: 0;
  outline: none;
  background: transparent;
  font-size: 16px;
}
.wl-filters {
  display: flex;
  gap: 8px;
  margin-bottom: 20px;
}
.wl-chip {
  border: 1px solid #e2dacb;
  background: #fbf5ea;
  border-radius: 999px;
  padding: 7px 16px;
  font-size: 14px;
  transition: background 0.15s, color 0.15s;
}
.wl-chip.active {
  background: var(--app-ink, #003d5b);
  border-color: var(--app-ink, #003d5b);
  color: #fff;
}

.wl-heading {
  font-family: var(--font-display);
  font-size: 1.4rem;
  margin-bottom: 14px;
}
.wl-count {
  font-family: var(--font-body);
  font-size: 0.85rem;
  background: #fbefd9;
  color: #004e5a;
  border-radius: 999px;
  padding: 2px 10px;
  vertical-align: middle;
}
.wl-empty {
  color: var(--app-muted, #5a6b78);
  background: #fbf5ea;
  border: 1px dashed #e2dacb;
  border-radius: 20px;
  padding: 24px;
  text-align: center;
}

/* ---------- Cards: a photo (or a simple icon on navy), the name over it, and quick actions ---------- */
.wl-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(190px, 1fr));
  gap: 16px;
}
.wl-card {
  --tint: #edae49;
  position: relative;
  aspect-ratio: 4 / 5;
  border-radius: 22px;
  overflow: hidden;
  /* Without a photo: a soft glow in the place's colour, faint contour lines, on navy */
  background:
    radial-gradient(circle at 50% 32%, color-mix(in srgb, var(--tint) 45%, transparent), transparent 58%),
    repeating-radial-gradient(circle at 50% 32%, rgba(255, 255, 255, 0.06) 0 1px, transparent 1px 16px),
    linear-gradient(160deg, #0b3550, #001d2c);
  color: #fff;
  box-shadow: 0 6px 18px rgba(0, 29, 44, 0.12);
  transition: transform 0.25s cubic-bezier(.2, .8, .2, 1), box-shadow 0.25s;
}
.wl-card:hover {
  transform: translateY(-4px);
  box-shadow: 0 18px 34px rgba(0, 29, 44, 0.22);
}
.wl-photo {
  position: absolute;
  inset: 0;
  display: grid;
  place-items: center;
  background: center / cover no-repeat;
  transition: transform 0.6s cubic-bezier(.2, .8, .2, 1);
}
.wl-card:hover .wl-photo {
  transform: scale(1.07);
}
/* Loading placeholders: a light shimmer, without the photo shading */
.wl-card.skeleton {
  background: linear-gradient(90deg, #efe8dc 25%, #f7f2ea 50%, #efe8dc 75%);
  background-size: 200% 100%;
  box-shadow: none;
}
.wl-card.skeleton::after {
  display: none;
}
/* Darkens the bottom so the name always reads */
.wl-card::after {
  content: '';
  position: absolute;
  inset: 0;
  background: linear-gradient(180deg, rgba(0, 29, 44, 0.35) 0%, rgba(0, 29, 44, 0) 30%, rgba(0, 29, 44, 0) 45%, rgba(0, 29, 44, 0.88) 100%);
  pointer-events: none;
}
.wl-ph-icon {
  margin-bottom: 30%;
  padding: 18px;
  box-sizing: content-box;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.08);
  border: 1px solid rgba(255, 255, 255, 0.14);
  color: #fff;
}
/* Still looking for a photo: a gentle shimmer */
.wl-photo.loading {
  background-image: linear-gradient(100deg, transparent 30%, rgba(255, 255, 255, 0.12) 50%, transparent 70%);
  background-size: 200% 100%;
  animation: wl-shimmer 1.3s linear infinite;
}
.wl-photo.loading .wl-ph-icon {
  opacity: 0.4;
}
@keyframes wl-shimmer {
  to { background-position: -200% 0; }
}
.wl-type,
.wl-actions,
.wl-heart,
.wl-info {
  z-index: 1;
}
.wl-type {
  position: absolute;
  top: 12px;
  left: 12px;
  max-width: calc(100% - 70px);
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 4px 10px;
  border-radius: 999px;
  background: rgba(0, 29, 44, 0.55);
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
  font-size: 11.5px;
  font-weight: 600;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.wl-card.mine .wl-type {
  max-width: calc(100% - 100px); /* leave room for the edit and heart buttons */
}
.wl-info {
  position: absolute;
  left: 14px;
  right: 14px;
  bottom: 14px;
}
.wl-name {
  margin: 0 0 2px;
  font-size: 1.05rem;
  font-weight: 700;
  line-height: 1.2;
  color: #fff;
  overflow: hidden;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
}
.wl-sub {
  display: block;
  font-size: 12px;
  color: rgba(255, 255, 255, 0.78);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.wl-votes {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  margin-top: 6px;
  padding: 2px 9px;
  border-radius: 999px;
  background: #edae49;
  color: #001d2c;
  font-size: 11px;
  font-weight: 700;
}
.wl-actions {
  position: absolute;
  top: 10px;
  right: 10px;
  display: flex;
  gap: 6px;
}
.wl-heart,
.wl-round {
  width: 34px;
  height: 34px;
  display: inline-grid;
  place-items: center;
  border: 0;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.92);
  color: #d1495b;
  text-decoration: none;
  transition: transform 0.15s, background 0.15s;
}
.wl-round {
  color: #001d2c;
  font-size: 14px;
  font-weight: 700;
}
.wl-heart:hover,
.wl-round:hover {
  transform: scale(1.1);
}
.wl-tap .wl-heart {
  position: absolute;
  top: 10px;
  right: 10px;
  color: #8a959c;
}
.wl-heart.filled {
  color: #d1495b;
}
/* Saving: the heart pops and the card gets a gold ring */
.wl-tap .wl-heart.filled {
  color: #d1495b;
  animation: wl-pop 0.4s cubic-bezier(.2, .8, .2, 1);
}
@keyframes wl-pop {
  40% { transform: scale(1.35); }
}
.wl-card.saved {
  box-shadow: 0 0 0 3px #edae49, 0 12px 26px rgba(0, 29, 44, 0.2);
}
.wl-card.saved .wl-sub {
  color: #ffe1a1;
  font-weight: 700;
}
.wl-tap {
  cursor: pointer;
}
.wl-tap:active {
  transform: scale(0.98);
}
.wl-tap:focus-visible {
  outline: 3px solid rgba(237, 174, 73, 0.7);
  outline-offset: 3px;
}
/* "Show [All places ▾]" above the popular places */
.wl-kinds {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 16px;
}
.wl-kinds-label {
  font-size: 14px;
  font-weight: 600;
  color: #5b6b75;
}
.wl-heart:focus-visible,
.wl-round:focus-visible,
.wl-chip:focus-visible {
  outline: 3px solid rgba(0, 121, 140, 0.45);
  outline-offset: 2px;
}

/* ---------- Add + edit ---------- */
.wl-add {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  align-items: flex-start;
  margin-top: 18px;
}
.wl-add-name {
  flex: 2 1 240px;
  min-width: 0;
}
.wl-input {
  border-radius: 999px;
  height: 46px;
  padding: 0 18px;
}
.wl-pill-btn {
  border-radius: 999px;
  padding: 0 22px;
  height: 46px;
  font-weight: 600;
}
.btn-sm.wl-pill-btn {
  height: auto;
  padding: 6px 16px;
}
.wl-credit {
  color: inherit;
  text-decoration: underline;
}
.wl-partial {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  margin: -4px 0 14px;
  padding: 8px 14px;
  border-radius: 999px;
  background: #fbefd9;
  color: #7a4b00;
  font-size: 13px;
}
.wl-partial-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #edae49;
  animation: wl-blink 1.2s ease-in-out infinite alternate;
}
@keyframes wl-blink {
  from { opacity: 0.35; }
}
.wl-load {
  padding: 8px 0 4px;
}
.wl-partial-btn {
  margin-left: auto;
  border: 0;
  background: none;
  padding: 0;
  color: #003d5b;
  font-weight: 700;
  text-decoration: underline;
}
@media (prefers-reduced-motion: reduce) {
  .wl-partial-dot { animation: none; }
}
.wl-card.editing {
  outline: 3px solid #edae49;
  outline-offset: 3px;
}
.wl-panel {
  background: #fbf5ea;
  border: 1px solid #e2dacb;
  border-radius: 20px;
  padding: 16px 18px;
  margin-top: 16px;
}
.wl-in {
  flex: 0 0 150px;
}
.skeleton {
  background: linear-gradient(90deg, #efe9df 25%, #f9f6f0 50%, #efe9df 75%);
  background-size: 200% 100%;
  animation: shimmer 1.2s infinite;
}
@keyframes shimmer {
  to { background-position: -200% 0; }
}
.card-enter-active,
.card-leave-active,
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.25s ease, transform 0.25s ease;
}
.card-enter-from,
.card-leave-to {
  opacity: 0;
  transform: scale(0.94);
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

/* ---------- Tour / activity ---------- */
.wl-link {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  text-decoration: none;
  margin-right: 6px;
}
.wl-tour-btn {
  border: 1.5px solid #003d5b;
  color: #003d5b;
  background: #fbf5ea;
}
.wl-tour-btn:hover,
.wl-tour-btn.on {
  background: #003d5b;
  color: #fff;
}
@media (max-width: 576px) {
  .wl-grid { grid-template-columns: repeat(2, 1fr); gap: 12px; }
  .wl-name { font-size: 0.95rem; }
}
@media (prefers-reduced-motion: reduce) {
  .wl-card,
  .card-enter-active,
  .card-leave-active,
  .fade-enter-active,
  .fade-leave-active { transition: none; }
  .wl-card:hover, .wl-card:hover .wl-photo { transform: none; }
  .wl-photo, .wl-photo.loading, .wl-tap .wl-heart.filled { transition: none; animation: none; }
  .skeleton { animation: none; }
}

/* =====================================================================
   Scrapbook look (matches Home and Login; colours from src/assets/scrapbook.css).
   Place cards become polaroids: the photo in a cream frame, the name written underneath.
   These rules come last, so they replace the dark card styles above.
   ===================================================================== */
/* All / Indoor / Outdoor: little tags; the picked one is amber */
.wl-filters {
  gap: 10px;
}
.wl-chip {
  border: 2px solid var(--sb-ink);
  border-radius: 12px;
  background: var(--sb-card);
  color: var(--sb-ink);
  font-weight: 700;
  box-shadow: var(--sb-pop-sm);
  transition: transform 0.12s, box-shadow 0.12s, background 0.15s;
}
.wl-chip:hover {
  transform: translateY(-2px);
  box-shadow: 0 5px 0 var(--sb-ink);
}
.wl-chip.active {
  background: var(--sb-amber);
  border-color: var(--sb-ink);
  color: var(--sb-ink);
  font-weight: 800;
  transform: translateY(2px);
  box-shadow: 0 1px 0 var(--sb-ink);
}

.wl-heading {
  font-family: var(--sb-display);
  font-weight: 400;
  font-size: 1.7rem;
  color: var(--sb-ink);
}
.wl-count {
  display: inline-grid;
  place-items: center;
  min-width: 30px;
  height: 30px;
  padding: 0 8px;
  border: 2px solid var(--sb-ink);
  border-radius: 999px;
  background: var(--sb-amber);
  color: var(--sb-ink);
  font-family: var(--sb-display);
  font-size: 1rem;
  transform: rotate(-6deg);
}
.wl-empty {
  border: 2px dashed var(--sb-stitch);
  background: var(--sb-card);
  color: var(--sb-muted);
  font-weight: 600;
}

/* ----- Polaroid cards ----- */
.wl-grid {
  gap: 22px 18px;
}
.wl-card {
  aspect-ratio: auto;
  overflow: visible;
  padding: 9px 9px 0;
  border: var(--sb-line);
  border-radius: 10px;
  background: var(--sb-cream);
  color: var(--sb-ink);
  box-shadow: var(--sb-pop);
  transition: transform 0.3s var(--sb-spring), box-shadow 0.15s;
}
/* every other card leans a little, like photos stuck in a scrapbook */
.wl-grid > .wl-card:nth-child(odd) { transform: rotate(-1deg); }
.wl-grid > .wl-card:nth-child(even) { transform: rotate(0.8deg); }
.wl-grid > .wl-card:hover {
  transform: translateY(-5px) rotate(0deg);
  box-shadow: 0 9px 0 var(--sb-ink);
}
.wl-card::after {
  display: none; /* no dark shading: the name sits on the cream strip */
}
.wl-photo {
  position: relative;
  inset: auto;
  aspect-ratio: 1 / 1;
  overflow: hidden;
  border: 2px solid var(--sb-ink);
  border-radius: 5px;
  /* no photo: a soft wash in the place's colour behind its icon */
  background-color: color-mix(in srgb, var(--tint) 22%, var(--sb-card));
  background-position: center;
  background-size: cover;
}
.wl-card:hover .wl-photo {
  transform: none;
}
.wl-ph-icon {
  margin-bottom: 0;
  padding: 16px;
  border: 2px solid var(--sb-ink);
  background: var(--sb-cream);
  color: var(--sb-ink);
  box-shadow: var(--sb-pop-sm);
}
.wl-photo.loading {
  background-image: linear-gradient(100deg, transparent 30%, rgba(255, 255, 255, 0.5) 50%, transparent 70%);
}
/* the kind of place: a little stamp on the photo */
.wl-type {
  top: 16px;
  left: 16px;
  padding: 3px 8px;
  border: 1.5px solid var(--sb-ink);
  border-radius: 6px;
  background: var(--sb-cream);
  backdrop-filter: none;
  -webkit-backdrop-filter: none;
  color: var(--sb-ink);
  font-size: 10.5px;
  font-weight: 800;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  box-shadow: 0 2px 0 var(--sb-ink);
  transform: rotate(-3deg);
}
.wl-type,
.wl-card.mine .wl-type {
  top: auto;
  bottom: 8px;
  left: 8px;
  max-width: calc(100% - 16px);
}
.wl-type-text {
  min-width: 0;
  white-space: normal; /* a long kind wraps to a second line instead of being cut */
  line-height: 1.25;
}
.wl-ph-icon {
  margin-bottom: 14px; /* (clear of the tag) */
}
.wl-info {
  position: static;
  padding: 10px 4px 12px;
}
.wl-name {
  color: var(--sb-ink);
  font-family: var(--sb-display);
  font-weight: 400;
  font-size: 1.1rem;
  letter-spacing: 0.01em;
}
.wl-sub {
  color: var(--sb-muted);
  font-weight: 600;
}
.wl-votes {
  border: 1.5px solid var(--sb-ink);
  background: var(--sb-amber);
  color: var(--sb-ink);
  font-weight: 800;
}
/* heart and edit: chunky round buttons that press down */
.wl-actions {
  top: 15px;
  right: 15px;
}
.wl-heart,
.wl-round {
  border: 2px solid var(--sb-ink);
  background: var(--sb-cream);
  box-shadow: var(--sb-pop-sm);
  transition: transform 0.15s var(--sb-spring), box-shadow 0.12s;
}
.wl-round {
  color: var(--sb-ink);
}
.wl-heart:hover,
.wl-round:hover {
  transform: translateY(-2px) scale(1.06);
  box-shadow: 0 5px 0 var(--sb-ink);
}
.wl-heart:active,
.wl-round:active {
  transform: translateY(3px);
  box-shadow: 0 0 0 var(--sb-ink);
}
.wl-tap .wl-heart {
  top: 15px;
  right: 15px;
  color: var(--sb-muted);
}
.wl-heart.filled,
.wl-tap .wl-heart.filled {
  background: #ffe1e5;
  color: var(--sb-red);
}
/* saved popular places: the frame turns amber */
.wl-card.saved {
  background: linear-gradient(180deg, #ffe7ad, var(--sb-amber));
  box-shadow: var(--sb-pop);
}
.wl-card.saved .wl-sub {
  color: var(--sb-ink);
  font-weight: 800;
}
.wl-card.editing {
  outline: 3px dashed var(--sb-amber-lo);
  outline-offset: 5px;
}
.wl-tap:active {
  transform: translateY(3px);
}
.wl-tap:focus-visible {
  outline: 3px solid var(--sb-teal);
  outline-offset: 4px;
}
.wl-card.skeleton {
  border-color: var(--sb-stitch);
  border-style: dashed;
  box-shadow: none;
  min-height: 250px;
}
.wl-heart:focus-visible,
.wl-round:focus-visible,
.wl-chip:focus-visible {
  outline: 3px solid var(--sb-teal);
  outline-offset: 2px;
}

/* ----- "Show [All places]" ----- */
.wl-kinds-label {
  color: var(--sb-ink-soft);
  font-weight: 800;
}
.wl-kinds :deep(.dd-trigger) {
  border: 2px solid var(--sb-ink);
  border-radius: 12px;
  background: var(--sb-card);
  color: var(--sb-ink);
  font-weight: 800;
  box-shadow: var(--sb-pop-sm);
}
.wl-kinds :deep(.dd-chevron) {
  color: var(--sb-ink);
}

/* ----- Fields and buttons, like the login page ----- */
.wl-input {
  height: 48px;
  border: 2px solid var(--sb-ink);
  border-radius: 14px;
  background: var(--sb-card);
  color: var(--sb-ink);
  font-weight: 600;
  box-shadow: inset 0 2px 0 rgba(18, 50, 74, 0.06);
}
.wl-input::placeholder {
  color: #8a99a5;
}
.wl-input:focus {
  border-color: var(--sb-ink);
  background: #fbf5ea;
  box-shadow: 0 0 0 4px rgba(255, 191, 60, 0.45);
}
.wl-pill-btn,
.btn-sm.wl-pill-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  height: 48px;
  padding: 0 20px;
  border: var(--sb-line);
  border-radius: 14px;
  font-family: var(--sb-display);
  font-weight: 400;
  font-size: 1.05rem;
  letter-spacing: 0.01em;
  color: var(--sb-ink);
  box-shadow: var(--sb-pop-sm);
  transition: transform 0.12s, box-shadow 0.12s;
}
.btn-sm.wl-pill-btn {
  height: 38px;
  font-size: 0.95rem;
}
.wl-pill-btn.btn-primary,
.wl-pill-btn.btn-primary:disabled {
  border-color: var(--sb-ink);
  background: linear-gradient(180deg, var(--sb-amber-hi), var(--sb-amber) 55%, var(--sb-amber-lo));
  color: var(--sb-ink);
}
.wl-pill-btn.btn-outline-secondary,
.wl-tour-btn {
  border-color: var(--sb-ink);
  background: var(--sb-cream);
  color: var(--sb-ink);
}
.wl-pill-btn:hover:not(:disabled),
.wl-tour-btn:hover {
  border-color: var(--sb-ink);
  color: var(--sb-ink);
  transform: translateY(-2px);
  box-shadow: 0 5px 0 var(--sb-ink);
}
.wl-pill-btn.btn-primary:hover:not(:disabled) {
  background: linear-gradient(180deg, var(--sb-amber-hi), var(--sb-amber) 55%, var(--sb-amber-lo));
}
.wl-pill-btn.btn-outline-secondary:hover,
.wl-tour-btn:hover {
  background: var(--sb-cream);
}
.wl-pill-btn:active:not(:disabled),
.wl-tour-btn:active {
  transform: translateY(3px);
  box-shadow: 0 0 0 var(--sb-ink);
}
.wl-tour-btn.on {
  background: var(--sb-amber);
  color: var(--sb-ink);
}

/* ----- Panels and the search list ----- */
.wl-panel {
  border: var(--sb-line);
  border-radius: 20px;
  background: var(--sb-card);
  box-shadow: var(--sb-pop);
}
.wl-suggest,
.wl-search-msg {
  border: 2px solid var(--sb-ink);
  border-radius: 16px;
  background: var(--sb-card);
  color: var(--sb-ink);
  box-shadow: var(--sb-pop);
}
.wl-suggest li.active {
  background: rgba(255, 191, 60, 0.25);
}
.wl-suggest li.wl-row-own {
  border-top: 2px dashed var(--sb-stitch);
  color: var(--sb-ink);
  font-weight: 700;
}
.wl-search-retry {
  border: 2px solid var(--sb-ink);
  color: var(--sb-ink);
}
.wl-search-retry:hover {
  background: var(--sb-amber);
  color: var(--sb-ink);
}
.wl-partial {
  border: 2px dashed var(--sb-amber-lo);
  background: #fff4dc;
  color: var(--sb-ink);
  font-weight: 600;
}
.wl-partial-btn {
  color: var(--sb-ink);
}

@media (max-width: 576px) {
  .wl-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 16px 12px; }
  .wl-card { padding: 7px 7px 0; }
  .wl-actions, .wl-tap .wl-heart { top: 11px; right: 11px; }
}
@media (prefers-reduced-motion: reduce) {
  .wl-grid > .wl-card:hover { transform: none; }
  .wl-chip, .wl-heart, .wl-round, .wl-pill-btn { transition: none; }
}
.wl-setloc {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  margin-top: 4px;
  border: 0;
  border-radius: 999px;
  padding: 2px 10px;
  background: #fbefd9;
  color: #8a5a00;
  font-size: 12px;
  font-weight: 700;
}
.wl-setloc:hover {
  background: #f6dfb3;
}
</style>
