<template>
  <!-- Recap tab: the last page of the travel journal. A polaroid of the route, the trip's numbers as
       postage stamps, and what the group spent as a till receipt. -->
  <section class="tr" aria-labelledby="tr-title">
    <div class="tr-head">
      <div>
        <p class="tr-kicker"><span class="tr-stampmark">{{ kicker }}</span></p>
        <h2 id="tr-title" class="tr-title">{{ name }}</h2>
      </div>
      <span v-if="dateText" class="tr-dates"><AppIcon name="calendar" :size="15" /> {{ dateText }}</span>
    </div>

    <div class="tr-body">
      <!-- The route, as a taped-in polaroid -->
      <figure class="tr-polaroid">
        <span class="tr-tape left" aria-hidden="true"></span>
        <span class="tr-tape right" aria-hidden="true"></span>
        <TravelMap class="tr-map" :trips="mapTrips" :active-id="'this'" />
        <figcaption class="tr-caption">{{ caption }}</figcaption>
      </figure>

      <div class="tr-side">
        <!-- The numbers, as postage stamps -->
        <ul class="tr-stamps">
          <li v-for="(st, i) in smallStats" :key="st.label" class="tr-stamp" :style="{ '--tilt': TILTS[i % TILTS.length], '--ink-bg': STAMP_COLOURS[i % STAMP_COLOURS.length] }">
            <div class="tr-perf">
              <div class="tr-stamp-in">
                <AppIcon :name="st.icon" :size="18" class="tr-stamp-icon" />
                <b>{{ st.value }}</b>
                <span>{{ st.label }}</span>
              </div>
            </div>
          </li>
        </ul>

        <!-- What the group spent, as a till receipt -->
        <div v-if="spendStat" class="tr-receipt">
          <p class="tr-receipt-top"><AppIcon name="receipt" :size="15" /> Spent together</p>
          <p class="tr-receipt-total">{{ spendStat.value }}</p>
          <p v-if="spendStat.note" class="tr-receipt-note">{{ spendStat.note }}</p>
          <p class="tr-receipt-bye">Thanks for travelling together ✈</p>
        </div>
      </div>
    </div>
  </section>
</template>

<script>
import axios from 'axios'
import TravelMap from './TravelMap.vue'
import AppIcon from './AppIcon.vue'
import { codeForDestination } from '../destinations.js'

// Straight-line distance between two { lat, lon } points, in km
function kmBetween(a, b) {
  const r = Math.PI / 180
  const h = Math.sin((b.lat - a.lat) * r / 2) ** 2 + Math.cos(a.lat * r) * Math.cos(b.lat * r) * Math.sin((b.lon - a.lon) * r / 2) ** 2
  return 12742 * Math.asin(Math.sqrt(h))
}

export default {
  components: { TravelMap, AppIcon },
  props: {
    tripId: { type: String, required: true },
    name: { type: String, default: '' },
    destinations: { type: Array, default: () => [] },
    startDate: { type: String, default: '' },
    endDate: { type: String, default: '' },
    travellers: { type: Array, default: () => [] },
    stopCount: { type: Number, default: 0 },
    phase: { type: String, default: 'during' } // 'before', 'during' or 'after' the trip
  },
  data() {
    return {
      TILTS: ['-2deg', '1.5deg', '-1deg', '2deg', '-1.5deg', '1deg', '-2.5deg'],
      STAMP_COLOURS: ['#ffe3a3', '#d6f0f3', '#fde0dc', '#e3f1d4', '#ebe2fb', '#fff1cf', '#d6f0f3'],
      places: {},     // destination -> { lat, lon }
      photoCount: null,
      spend: null     // { total, currency, other }
    }
  },
  computed: {
    kicker() {
      if (this.phase === 'before') return 'Your trip at a glance'
      if (this.phase === 'after') return 'Trip wrapped'
      return 'Your trip so far'
    },
    dateText() {
      if (!this.startDate) return ''
      const fmt = (s) => new Date(s + 'T00:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
      return this.endDate ? fmt(this.startDate) + ' – ' + fmt(this.endDate) : fmt(this.startDate)
    },
    smallStats() {
      return this.stats.filter((st) => !st.big)
    },
    spendStat() {
      return this.stats.find((st) => st.big) || null
    },
    // Under the polaroid: the cities, like a handwritten caption
    caption() {
      const cities = []
      for (const d of this.destinations) cities.push(d.split(', ')[0])
      return cities.length ? cities.join(' → ') : this.name
    },
    // The route, in travel order, for the map
    mapTrips() {
      const points = []
      for (const d of this.destinations) {
        if (this.places[d]) points.push({ label: d, lat: this.places[d].lat, lon: this.places[d].lon })
      }
      return [{ id: 'this', name: this.name, done: false, points }]
    },
    stats() {
      let days = 0
      if (this.startDate && this.endDate) {
        // During the trip: only the days up to today. Before or after it: the whole trip.
        let end = new Date(this.endDate)
        if (this.phase === 'during') end = new Date(Math.min(Date.now(), end.getTime()))
        days = Math.max(1, Math.round((end - new Date(this.startDate)) / 86400000) + 1)
      }
      const countries = []
      for (const d of this.destinations) {
        const c = codeForDestination(d) || d.split(', ').pop()
        if (!countries.includes(c)) countries.push(c)
      }
      let km = 0
      for (let i = 1; i < this.destinations.length; i++) {
        const a = this.places[this.destinations[i - 1]]
        const b = this.places[this.destinations[i]]
        if (a && b) km += kmBetween(a, b)
      }
      const list = [
        { icon: 'calendar', value: days || '–', label: days === 1 ? 'Day' : 'Days' },
        { icon: 'map-pin', value: this.stopCount, label: this.stopCount === 1 ? 'Stop' : 'Stops planned' },
        { icon: 'landmark', value: this.destinations.length, label: this.destinations.length === 1 ? 'City' : 'Cities' },
        { icon: 'flag', value: countries.length, label: countries.length === 1 ? 'Country' : 'Countries' },
        { icon: 'users', value: this.travellers.length, label: this.travellers.length === 1 ? 'Traveller' : 'Travellers' },
        { icon: 'camera', value: this.photoCount === null ? '…' : this.photoCount, label: this.photoCount === 1 ? 'Photo' : 'Photos' }
      ]
      if (km >= 1) list.push({ icon: 'plane', value: Math.round(km).toLocaleString(), label: 'km between cities' })
      if (this.spend && this.spend.total > 0) {
        list.push({
          value: this.spend.currency + ' ' + Math.round(this.spend.total).toLocaleString(),
          label: 'spent together',
          note: this.spend.other ? '+ ' + this.spend.other + ' expense' + (this.spend.other === 1 ? '' : 's') + ' in other currencies' : '',
          big: true
        })
      }
      return list
    }
  },
  mounted() {
    this.loadPlaces()
    this.loadCounts()
  },
  methods: {
    async loadPlaces() {
      const names = this.destinations.slice(0, 20)
      if (!names.length) return
      const codes = []
      for (const n of names) codes.push(codeForDestination(n) || '')
      try {
        const res = await axios.get('/api/discover/cities', { params: { names: names.join('|'), codes: codes.join('|') }, background: true })
        const found = {}
        for (const c of res.data) found[c.label] = { lat: c.lat, lon: c.lon }
        this.places = found
      } catch (err) {
        // the map and distance just stay empty
      }
    },
    async loadCounts() {
      try {
        const res = await axios.get('/api/trips/' + this.tripId + '/photos')
        this.photoCount = Array.isArray(res.data) ? res.data.length : 0
      } catch (err) {
        this.photoCount = 0
      }
      try {
        const res = await axios.get('/api/trips/' + this.tripId + '/expenses')
        const home = res.data.homeCurrency || 'SGD'
        let total = 0
        let other = 0
        for (const e of res.data.items || []) {
          if (!e.currency || e.currency === home) total += Number(e.amount) || 0
          else other++
        }
        this.spend = { total, currency: home === 'SGD' ? 'S$' : home, other }
      } catch (err) {
        this.spend = null
      }
    }
  }
}
</script>

<style scoped>
/* The last page of the travel journal (colours from src/assets/scrapbook.css) */
.tr {
  position: relative;
  z-index: 1;
  margin: 0;
  padding: 24px;
  border: 2.5px solid var(--sb-ink, #12324a);
  border-radius: 20px;
  background:
    radial-gradient(rgba(18, 50, 74, 0.07) 1px, transparent 1.5px) 0 0 / 16px 16px,
    var(--sb-cream, #fffaf0);
  box-shadow: 0 6px 0 var(--sb-ink, #12324a);
  color: var(--sb-ink, #12324a);
}
.tr::after { /* stitching just inside the edge */
  content: '';
  position: absolute;
  inset: 8px;
  border: 2px dashed rgba(18, 50, 74, 0.15);
  border-radius: 14px;
  pointer-events: none;
}

/* ----- heading ----- */
.tr-head {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-end;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 20px;
}
.tr-kicker {
  margin: 0 0 8px;
}
.tr-stampmark { /* a rubber stamp */
  display: inline-block;
  padding: 3px 12px;
  border: 3px solid var(--sb-red, #d1495b);
  border-radius: 8px;
  color: var(--sb-red, #d1495b);
  font-family: var(--sb-display, 'Lilita One', sans-serif);
  font-size: 0.95rem;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  transform: rotate(-4deg);
  opacity: 0.9;
}
.tr-title {
  margin: 0;
  font-family: var(--sb-display, 'Lilita One', sans-serif);
  font-size: clamp(1.7rem, 3vw, 2.3rem);
  font-weight: 400;
  letter-spacing: 0.01em;
  line-height: 1.1;
}
.tr-dates { /* a luggage tag */
  position: relative;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 14px 6px 22px;
  border: 2px solid var(--sb-ink, #12324a);
  border-radius: 6px 999px 999px 6px;
  background: var(--sb-amber, #ffbf3c);
  box-shadow: 0 3px 0 var(--sb-ink, #12324a);
  font-weight: 800;
  font-size: 14px;
  transform: rotate(2deg);
}
.tr-dates::before { /* the tag's hole */
  content: '';
  position: absolute;
  left: 7px;
  top: 50%;
  width: 8px;
  height: 8px;
  margin-top: -4px;
  border: 2px solid var(--sb-ink, #12324a);
  border-radius: 50%;
  background: var(--sb-cream, #fffaf0);
}

.tr-body {
  position: relative;
  z-index: 1;
  display: grid;
  grid-template-columns: minmax(0, 1.1fr) minmax(0, 1fr);
  gap: 26px;
  align-items: start;
}

/* ----- the route: a taped-in polaroid ----- */
.tr-polaroid {
  position: relative;
  margin: 6px 4px 0;
  padding: 12px 12px 0;
  border: 2px solid var(--sb-ink, #12324a);
  border-radius: 6px;
  background: #fff;
  box-shadow: 0 5px 0 var(--sb-ink, #12324a);
  transform: rotate(-1.2deg);
}
.tr-map {
  min-height: 260px;
  border-radius: 4px;
  overflow: hidden;
}
.tr-caption {
  padding: 12px 6px 14px;
  text-align: center;
  font-family: var(--sb-display, 'Lilita One', sans-serif);
  font-size: 1.15rem;
  letter-spacing: 0.02em;
}
.tr-tape { /* washi tape on the corners */
  position: absolute;
  z-index: 2;
  top: -12px;
  width: 92px;
  height: 26px;
  background: repeating-linear-gradient(135deg, rgba(255, 191, 60, 0.85) 0 8px, rgba(255, 214, 120, 0.85) 8px 16px);
  border: 1px solid rgba(18, 50, 74, 0.15);
}
.tr-tape.left {
  left: -14px;
  transform: rotate(-24deg);
}
.tr-tape.right {
  right: -14px;
  transform: rotate(22deg);
  background: repeating-linear-gradient(135deg, rgba(47, 167, 184, 0.75) 0 8px, rgba(150, 214, 222, 0.8) 8px 16px);
}

/* ----- the numbers: postage stamps ----- */
.tr-side {
  display: flex;
  flex-direction: column;
  gap: 18px;
}
.tr-stamps {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 20px 16px;
  margin: 0;
  padding: 0;
  list-style: none;
}
/* A stamp: a white frame with a punched (perforated) edge, outlined in navy */
.tr-stamp {
  filter:
    drop-shadow(1.5px 0 0 var(--sb-ink, #12324a)) drop-shadow(-1.5px 0 0 var(--sb-ink, #12324a))
    drop-shadow(0 1.5px 0 var(--sb-ink, #12324a)) drop-shadow(0 -1.5px 0 var(--sb-ink, #12324a))
    drop-shadow(0 3px 0 rgba(18, 50, 74, 0.35));
  transform: rotate(var(--tilt));
  transition: transform 0.2s;
}
.tr-stamp:hover {
  transform: rotate(0deg) translateY(-3px) scale(1.03);
}
.tr-perf {
  height: 100%;
  padding: 7px;
  background: #fff;
  /* holes every 12px along the white frame (the middle stays solid) */
  -webkit-mask:
    radial-gradient(circle 4px at 6px 6px, transparent 96%, #000) -6px -6px / 12px 12px,
    linear-gradient(#000 0 0) content-box;
  mask:
    radial-gradient(circle 4px at 6px 6px, transparent 96%, #000) -6px -6px / 12px 12px,
    linear-gradient(#000 0 0) content-box;
}
.tr-stamp-in {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 2px;
  height: 100%;
  padding: 10px 12px 12px;
  border: 1.5px solid rgba(18, 50, 74, 0.5);
  background: var(--ink-bg);
}
.tr-stamp-icon {
  margin-bottom: 4px;
  opacity: 0.75;
}
.tr-stamp b {
  font-family: var(--sb-display, 'Lilita One', sans-serif);
  font-size: 1.9rem;
  font-weight: 400;
  line-height: 1;
}
.tr-stamp span {
  font-size: 12px;
  font-weight: 800;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: var(--sb-ink-soft, #3a5266);
}

/* ----- the spending: a till receipt with a torn bottom ----- */
.tr-receipt {
  position: relative;
  margin: 0 8px 14px;
  padding: 16px 18px 20px;
  background: #fff;
  /* outlined like the stamps, so the torn zigzag bottom gets the navy line too */
  filter:
    drop-shadow(1.5px 0 0 var(--sb-ink, #12324a)) drop-shadow(-1.5px 0 0 var(--sb-ink, #12324a))
    drop-shadow(0 1.5px 0 var(--sb-ink, #12324a)) drop-shadow(0 -1.5px 0 var(--sb-ink, #12324a))
    drop-shadow(0 4px 0 rgba(18, 50, 74, 0.3));
  transform: rotate(0.8deg);
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  text-align: center;
}
.tr-receipt::after { /* zigzag torn edge */
  content: '';
  position: absolute;
  left: 0;
  right: 0;
  bottom: -11px;
  height: 12px;
  background:
    linear-gradient(135deg, #fff 6px, transparent 0) 0 0 / 12px 12px repeat-x,
    linear-gradient(225deg, #fff 6px, transparent 0) 0 0 / 12px 12px repeat-x;
}
.tr-receipt p {
  margin: 0;
}
.tr-receipt-top {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding-bottom: 8px;
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.16em;
  text-transform: uppercase;
}
.tr-receipt-total {
  padding: 8px 0;
  border-top: 2px dashed rgba(18, 50, 74, 0.35);
  border-bottom: 2px dashed rgba(18, 50, 74, 0.35);
  font-family: var(--sb-display, 'Lilita One', sans-serif);
  font-size: 2.3rem;
  line-height: 1.1;
  color: var(--sb-ink, #12324a);
}
.tr-receipt-note {
  padding-top: 8px;
  font-size: 12px;
  color: var(--sb-ink-soft, #3a5266);
}
.tr-receipt-bye {
  padding-top: 6px;
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.08em;
}

@media (max-width: 760px) {
  .tr { margin: 20px 0 0; padding: 18px; }
  .tr-body { grid-template-columns: minmax(0, 1fr); }
  .tr-map { min-height: 210px; }
  .tr-stamps { grid-template-columns: repeat(2, 1fr); }
  .tr-stamp b { font-size: 1.5rem; }
}
@media (prefers-reduced-motion: reduce) {
  .tr-stamp { transition: none; }
}
</style>
