<template>
  <!-- Trip Crew: everyone on the trip, their arrival and food needs, plus invites (money owed lives in Expenses) -->
  <div class="cw">
    <!-- ===== Header & quick invite ===== -->
    <header class="cw-head">
      <div>
        <p class="cw-kicker">Crew manifest</p>
        <h3 class="cw-title">{{ city }} Crew</h3>
        <p class="cw-sub">
          {{ people.length }} traveller{{ people.length === 1 ? '' : 's' }}
          · {{ activeCount }} active<template v-if="pending.length"> · {{ pending.length }} pending</template>
        </p>
      </div>
      <div class="cw-actions">
        <button type="button" class="cw-primary" :class="{ done: copied }" @click="copyLink" data-testid="crew-copy">
          <AppIcon :name="copied ? 'check' : 'link'" :size="15" /> {{ copied ? 'Link copied' : 'Copy invite link' }}
        </button>
      </div>
    </header>

    <!-- ===== Profile cards ===== -->
    <div class="cw-grid">
      <!-- The whole card opens its editor (the Edit button does the same, for keyboards and screen readers) -->
      <article v-for="p in people" :key="p.name" class="cw-card" :class="{ me: p.name === me, editing: editing === p.name, clickable: p.canEdit && editing !== p.name }"
        @click="cardClick(p, $event)">
        <template v-if="editing !== p.name">
          <div class="cw-id">
            <!-- Their Travel Twin (this trip's outfit if they made one), or their initial -->
            <TwinFace class="cw-avatar" :style="{ background: colorFor(p.name) }" :user-id="p.id" :version="p.avatarV" :name="p.name" :trip="tripId">
              <span v-if="p.kind !== 'guest'" class="cw-dot" :class="{ on: p.activeNow }"></span>
            </TwinFace>
            <!-- passport-style fields: a small label over each value -->
            <div class="cw-who">
              <span class="cw-field" aria-hidden="true">Name</span>
              <span class="cw-name">{{ p.name }}<span v-if="p.name === me" class="cw-you"> (you)</span></span>
              <span class="cw-field" aria-hidden="true">Status</span>
              <span class="cw-status">{{ p.statusText }}</span>
            </div>
            <span class="cw-role" :class="'r-' + p.kind" :title="roleHelp[p.kind]">{{ roleNames[p.kind] }}</span>
          </div>

          <div v-if="p.profile.persona || p.canEdit" class="cw-titlebox">
            <span class="cw-field" aria-hidden="true">Crew title</span>
            <p v-if="p.profile.persona" class="cw-persona"><AppIcon name="tag" :size="13" /> "{{ p.profile.persona }}"</p>
            <button v-else type="button" class="cw-persona add" @click="startEdit(p)"><AppIcon name="tag" :size="13" /> Add a crew title</button>
          </div>

          <div class="cw-pills">
            <span class="cw-pill" :class="{ empty: !p.flight.flight && !p.flight.arrival }">
              <AppIcon name="plane" :size="14" /> <template v-if="p.flight.flight || p.flight.arrival">{{ p.flight.flight || 'Arrives' }}<template v-if="p.flight.arrival"> · Lands {{ arrivalText(p.flight.arrival) }}</template><template v-if="p.flight.airport"> · {{ p.flight.airport }}</template></template>
              <template v-else>No flight added</template>
            </span>
            <!-- Flight home (added from the last day of the itinerary) -->
            <span v-if="p.profile.departure" class="cw-pill">
              <AppIcon name="plane" :size="14" /> Flies home {{ arrivalText(p.profile.departure) }}<template v-if="p.profile.departFlight"> · {{ p.profile.departFlight }}</template>
            </span>
            <span v-if="p.flightWith.length" class="cw-pill"><AppIcon name="users" :size="13" /> Same flight as {{ p.flightWith.join(', ') }}</span>
            <!-- Flights between cities on the itinerary (the whole group's plan) -->
            <span v-for="f in flights" :key="f.id" class="cw-pill" :title="'On the itinerary: ' + f.from.name + ' → ' + f.to.name">
              <AppIcon name="plane" :size="14" /> {{ shortAirport(f.from.name) }} → {{ shortAirport(f.to.name) }} · {{ flightDay(f) }}<template v-if="f.number"> · {{ f.number }}</template>
            </span>
            <template v-if="p.diets.length">
              <span v-for="d in p.diets" :key="d.key" class="cw-pill" :class="d.allergy ? 'allergy' : 'diet'">{{ d.icon }} {{ d.label }}</span>
            </template>
            <span v-else-if="p.hasProfile" class="cw-pill"><AppIcon name="check" :size="13" /> No restrictions</span>
            <span v-else class="cw-pill empty"><AppIcon name="utensils" :size="13" /> Food needs not added</span>
          </div>

          <div v-if="p.profile.phone || p.canEdit" class="cw-foot">
            <span class="cw-links">
              <a v-if="p.profile.phone" class="cw-link" :href="'https://wa.me/' + p.profile.phone.replace(/[^\d]/g, '')"
                target="_blank" rel="noopener" :aria-label="'WhatsApp ' + p.name">Message</a>
              <button v-if="p.canEdit" type="button" class="cw-link" :aria-label="'Edit ' + p.name" @click="startEdit(p)">Edit</button>
            </span>
          </div>
        </template>

        <!-- Editing a card -->
        <CrewDetailsForm v-else :title="p.name === me ? 'Your details' : 'Details for ' + p.name" :profile="p.profile"
          :flight-buddies="flightBuddies(p.name)" :show-contact="!p.fromSettings && (demo ? p.name !== me : true)"
          :settings-note="p.name === me" :saving="saving" :error="error"
          @save="saveEdit(p, $event)" @cancel="editing = null" />
      </article>

      <!-- Pending invites: ghost cards -->
      <article v-for="inv in pending" :key="'inv-' + inv.id" class="cw-card ghost">
        <div class="cw-id">
          <span class="cw-avatar ghost" aria-hidden="true">{{ (inv.name || '?').charAt(0).toUpperCase() }}</span>
          <div class="cw-who">
            <span class="cw-name">{{ inv.name }} <small class="cw-handle">@{{ inv.username }}</small></span>
            <span class="cw-status">Invited by {{ inv.invitedBy === me ? 'you' : inv.invitedBy }} · waiting to join</span>
          </div>
          <span class="cw-role r-pending">Pending</span>
        </div>
        <div v-if="canManage(inv)" class="cw-form-btns mt-3">
          <button type="button" class="cw-ghost" :disabled="busy === inv.id" @click="resend(inv)"><AppIcon :name="resent === inv.id ? 'check' : 'refresh'" :size="14" /> {{ resent === inv.id ? 'Sent again' : 'Resend invite' }}</button>
          <button type="button" class="cw-ghost danger" :disabled="busy === inv.id" @click="revoke(inv)">Revoke</button>
        </div>
      </article>
      <!-- An empty passport: the next crewmate's place (opens the invite dialog) -->
      <button v-if="!demo" type="button" class="cw-card cw-add" @click="$emit('invite')">
        <span class="cw-add-plus" aria-hidden="true">+</span>
        <span>Add a crewmate</span>
      </button>
    </div>

    <!-- ===== Group snapshot: two luggage tags ===== -->
    <section class="cw-summary" aria-label="Group snapshot">
      <div class="cw-sum-item">
        <span class="cw-sum-label"><AppIcon name="utensils" :size="14" /> Food needs</span>
        <span class="cw-sum-value">{{ dietSummary || 'No restrictions shared' }}</span>
      </div>
      <div class="cw-sum-item">
        <span class="cw-sum-label"><AppIcon name="plane" :size="14" /> Arrivals</span>
        <span class="cw-sum-value">
          <template v-if="arrivals.length">Earliest {{ arrivalText(arrivals[0]) }}<template v-if="arrivals.length > 1"> · Latest {{ arrivalText(arrivals[arrivals.length - 1]) }}</template></template>
          <template v-else>No flights added yet</template>
        </span>
      </div>
    </section>

    <div v-if="toast" class="cw-toast" role="status">{{ toast }}</div>
  </div>
</template>

<script>
import axios from 'axios'
import { dietTag } from '../crewOptions.js'
import CrewDetailsForm from './CrewDetailsForm.vue'
import AppIcon from './AppIcon.vue'
import TwinFace from './TwinFace.vue'

const COLORS = ['#00798c', '#30638e', '#d0662e', '#7a5bd6', '#c2477d', '#2b8c99']

// Example crew for the Seoul demo trip: 3 active travellers and 1 pending invite
const DEMO = {
  members: [
    { id: 'd1', name: 'Sarah', role: 'owner', lastSeenAt: new Date().toISOString() },
    { id: 'd2', name: 'John', role: 'member', lastSeenAt: new Date(Date.now() - 3 * 3600000).toISOString() },
    { id: 'd3', name: 'Amy', role: 'member', lastSeenAt: new Date(Date.now() - 20 * 60000).toISOString() }
  ],
  pending: [{ id: 'd4', name: 'Ben Lim', username: 'benlim', invitedBy: 'Sarah' }],
  crew: {
    Sarah: { persona: 'Chief Foodie', flight: 'SQ600', arrival: '2026-10-12T07:55', diet: ['shellfish-allergy'], phone: '+65 9123 4567' },
    John: { persona: 'Navigator', flight: 'KE644', arrival: '2026-10-12T14:00', diet: [], phone: '' },
    Amy: { persona: 'Photographer', sameFlightAs: 'Sarah', diet: ['vegetarian', 'No spicy food'], phone: '+65 9876 5432' }
  }
}

export default {
  components: { AppIcon, CrewDetailsForm, TwinFace },
  props: {
    tripId: { type: String, required: true },
    city: { type: String, default: 'Trip' },
    travellers: { type: Array, default: () => [] },
    members: { type: Array, default: () => [] },
    pendingInvites: { type: Array, default: () => [] },
    crew: { type: Object, default: () => ({}) },
    role: { type: String, default: 'member' },
    me: { type: String, default: '' },
    myId: { type: String, default: '' },
    flights: { type: Array, default: () => [] } // flights between cities on the itinerary: [{ id, date, from, to, dep, arr, number }]
  },
  emits: ['invite', 'go', 'changed'],

  data() {
    const demo = this.tripId === 'seoul'
    return {
      demo,
      profiles: demo ? { ...DEMO.crew } : { ...this.crew },
      pending: demo ? DEMO.pending.slice() : this.pendingInvites.slice(),
      copied: false,
      toast: '',
      editing: null,
      saving: false,
      error: '',
      busy: null,
      resent: null,
      roleNames: { owner: 'Organiser', member: 'Editor', guest: 'Guest' },
      roleHelp: {
        owner: 'Organiser: can invite, remove people and delete the trip',
        member: 'Joined with an account: can edit the plan, expenses and photos',
        guest: 'No account: the organiser adds their details'
      }
    }
  },

  computed: {
    memberList() {
      return this.demo ? DEMO.members : this.members
    },
    // One entry per traveller, with everything the card shows
    people() {
      const names = this.demo ? DEMO.members.map((m) => m.name) : this.travellers
      const list = []
      for (const name of names) {
        const m = this.memberList.find((x) => x.name === name)
        const kind = m ? (m.role === 'owner' ? 'owner' : 'member') : 'guest'
        const seen = m && m.lastSeenAt ? new Date(m.lastSeenAt).getTime() : 0
        const activeNow = !!seen && Date.now() - seen < 5 * 60 * 1000
        let statusText = 'No account yet'
        if (m) statusText = activeNow ? 'Active now' : seen ? 'Active ' + this.ago(seen) : 'Joined'
        let profile = this.profiles[name] || {}
        // People with an account: food needs + WhatsApp come from their Settings
        const fromSettings = !!m && Array.isArray(m.diet)
        if (fromSettings) profile = { ...profile, diet: m.diet, phone: m.phone || '', dietNote: '' }
        const diets = []
        for (const t of profile.diet || []) diets.push(dietTag(t))
        if (profile.dietNote) diets.push(dietTag(profile.dietNote)) // older cards
        diets.sort((a, b) => (b.allergy ? 1 : 0) - (a.allergy ? 1 : 0)) // allergies first
        const flight = this.flightOf(name)
        // Others on the same flight (linked with "Same as", or the same flight number and time)
        const flightWith = []
        if (flight.flight) {
          for (const other of names) {
            if (other === name) continue
            const f = this.flightOf(other)
            if (f.flight === flight.flight && f.arrival === flight.arrival) flightWith.push(other)
          }
        }
        list.push({
          name, kind, activeNow, statusText, profile, diets, flight, flightWith,
          id: m ? m.id : '', avatarV: m ? m.avatarV || 0 : 0,
          hasProfile: fromSettings ? !!m.contactSaved : !!this.profiles[name],
          fromSettings,
          canEdit: name === this.me || (kind === 'guest' && this.role === 'owner') || this.demo
        })
      }
      // You first, then active people, then the rest
      list.sort((a, b) => (b.name === this.me) - (a.name === this.me) || (b.activeNow - a.activeNow))
      return list
    },
    activeCount() {
      return this.memberList.length
    },
    // "1 shellfish allergy · 1 vegetarian"
    dietSummary() {
      const counts = {}
      for (const p of this.people) {
        for (const d of p.diets) counts[d.label] = (counts[d.label] || 0) + 1
      }
      const parts = []
      for (const label in counts) parts.push(counts[label] + ' ' + label.toLowerCase())
      return parts.join(' · ')
    },
    arrivals() {
      const list = []
      for (const p of this.people) if (p.flight.arrival) list.push(p.flight.arrival)
      return list.sort()
    }
  },

  watch: {
    crew(c) {
      if (!this.demo) this.profiles = { ...c }
    },
    pendingInvites(list) {
      if (!this.demo) this.pending = list.slice()
    }
  },

  methods: {
    // "Cape Town International Airport" -> "Cape Town"
    shortAirport(name) {
      return name.replace(/ (International )?Airport.*$/i, '').split(',')[0]
    },
    // "Mon 21 Dec, 12:30"
    flightDay(f) {
      return new Date(f.date + 'T00:00:00').toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' }) + ', ' + f.dep
    },
    colorFor(name) {
      const i = Math.max(0, this.travellers.indexOf(name))
      return COLORS[i % COLORS.length]
    },

    ago(ms) {
      const mins = Math.round((Date.now() - ms) / 60000)
      if (mins < 60) return mins + ' min ago'
      if (mins < 1440) return Math.round(mins / 60) + ' h ago'
      return Math.round(mins / 1440) + ' d ago'
    },

    // "2026-10-16T08:30" -> "16 Oct, 08:30"
    arrivalText(a) {
      const [date, time] = a.split('T')
      const d = new Date(date + 'T00:00:00')
      return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) + ', ' + time
    },

    showToast(text) {
      this.toast = text
      setTimeout(() => { this.toast = '' }, 2500)
    },

    async copyLink() {
      try {
        let link = window.location.origin + '/trip/seoul'
        if (!this.demo) {
          const res = await axios.post('/api/trips/' + this.tripId + '/invite', {})
          link = window.location.origin + '/join/' + res.data.code
        }
        await navigator.clipboard.writeText(link)
        this.copied = true
        this.showToast('Invite link copied. Paste it in your group chat.')
        setTimeout(() => { this.copied = false }, 2500)
      } catch (err) {
        this.showToast('Could not copy the link. Use "Add a crewmate" instead.')
      }
    },

    // Flight shown on a card: their own, or the one of the person they fly with
    flightOf(name) {
      const pr = this.profiles[name] || {}
      if (pr.sameFlightAs) {
        const other = this.profiles[pr.sameFlightAs] || {}
        if (!other.sameFlightAs) return { flight: other.flight || '', arrival: other.arrival || '', airport: other.arriveAt ? other.arriveAt.name : '' }
      }
      // (the airport is set from the first day of the itinerary)
      return { flight: pr.flight || '', arrival: pr.arrival || '', airport: pr.arriveAt ? pr.arriveAt.name : '' }
    },

    // People you can pick in "Same as …": others with their own flight details
    flightBuddies(name) {
      const list = []
      for (const p of this.people) {
        const pr = p.profile
        if (p.name !== name && !pr.sameFlightAs && (pr.flight || pr.arrival)) {
          list.push({ name: p.name, flight: pr.flight || '', arrival: pr.arrival || '' })
        }
      }
      return list
    },

    // A click anywhere on a card you can edit opens it (not on its own buttons/links, or while it's open)
    cardClick(p, event) {
      if (!p.canEdit || this.editing === p.name) return
      if (event.target.closest('a, button, input, select, textarea, label')) return
      this.startEdit(p)
    },

    startEdit(p) {
      this.error = ''
      this.editing = p.name
    },

    async saveEdit(p, form) {
      if (this.demo) {
        this.profiles = { ...this.profiles, [p.name]: { ...this.profiles[p.name], ...form } }
        this.editing = null
        return
      }
      this.saving = true
      this.error = ''
      try {
        const res = await axios.put('/api/trips/' + this.tripId + '/crew/' + encodeURIComponent(p.name), form)
        this.profiles = { ...res.data.crew }
        this.editing = null
        this.$emit('changed')
      } catch (err) {
        this.error = (err.response && err.response.data && err.response.data.message) || 'Could not save.'
      }
      this.saving = false
    },

    canManage(inv) {
      return this.demo || this.role === 'owner' || String(inv.invitedById) === String(this.myId)
    },

    async resend(inv) {
      if (this.demo) {
        this.resent = inv.id
        return
      }
      this.busy = inv.id
      try {
        await axios.post('/api/trips/' + this.tripId + '/invites/' + inv.id + '/resend')
        this.resent = inv.id
        this.showToast('Invite sent again: it is back at the top of ' + inv.name + "'s home page.")
      } catch (err) {
        this.showToast('Could not resend the invite.')
      }
      this.busy = null
    },

    async revoke(inv) {
      if (this.demo) {
        this.pending = this.pending.filter((x) => x !== inv)
        return
      }
      this.busy = inv.id
      try {
        const res = await axios.delete('/api/trips/' + this.tripId + '/invites/' + inv.id)
        this.pending = res.data
        this.$emit('changed')
      } catch (err) {
        this.showToast('Could not revoke the invite.')
      }
      this.busy = null
    }
  }
}
</script>

<style scoped>
/* ===== Trip crew: a crew manifest of passport cards (scrapbook look; colours from src/assets/scrapbook.css) ===== */
.cw {
  position: relative;
  color: var(--sb-ink);
}

/* Header */
.cw-head {
  display: flex;
  flex-wrap: wrap;
  justify-content: space-between;
  align-items: flex-end;
  gap: 12px;
  margin-bottom: 20px;
}
.cw-kicker {
  margin: 0 0 2px;
  font-size: 11.5px;
  font-weight: 800;
  letter-spacing: 0.16em;
  text-transform: uppercase;
  color: var(--sb-ink-soft);
}
.cw-title {
  margin: 0;
  font-family: var(--sb-display);
  font-weight: 400;
  font-size: 2rem;
  line-height: 1.05;
}
.cw-sub {
  margin: 2px 0 0;
  font-size: 14px;
  font-weight: 600;
  color: var(--sb-muted);
}
.cw-actions {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
}
.cw-primary,
.cw-ghost {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  min-height: 44px;
  padding: 0 18px;
  border: var(--sb-line);
  border-radius: 14px;
  color: var(--sb-ink);
  font-weight: 800;
  font-size: 14px;
  box-shadow: var(--sb-pop-sm);
  transition: transform 0.12s, box-shadow 0.12s;
}
.cw-primary {
  background: linear-gradient(180deg, var(--sb-amber-hi), var(--sb-amber) 55%, var(--sb-amber-lo));
  font-family: var(--sb-display);
  font-weight: 400;
  font-size: 1.05rem;
  letter-spacing: 0.01em;
}
.cw-primary.done {
  background: var(--sb-teal-soft);
}
.cw-ghost {
  background: var(--sb-cream);
}
.cw-ghost.danger {
  color: var(--sb-red);
}
.cw-primary:hover:not(:disabled),
.cw-ghost:hover:not(:disabled) {
  transform: translateY(-2px);
  box-shadow: 0 5px 0 var(--sb-ink);
}
.cw-primary:active:not(:disabled),
.cw-ghost:active:not(:disabled) {
  transform: translateY(3px);
  box-shadow: 0 0 0 var(--sb-ink);
}
.cw-primary:disabled,
.cw-ghost:disabled {
  opacity: 0.6;
}

/* ----- Passport cards ----- */
.cw-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 18px;
}
.cw-card {
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 16px 16px 14px 50px; /* room for the PASSPORT strip */
  border: var(--sb-line);
  border-radius: 14px;
  background:
    repeating-linear-gradient(135deg, rgba(47, 167, 184, 0.05) 0 2px, transparent 2px 9px),
    var(--sb-card);
  color: var(--sb-ink);
  box-shadow: var(--sb-pop);
  transition: transform 0.25s var(--sb-spring), box-shadow 0.15s;
}
/* the navy strip down the left edge, like a passport's spine */
.cw-card::before {
  content: 'Passport';
  position: absolute;
  top: 0;
  bottom: 0;
  left: 0;
  width: 34px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-right: var(--sb-line);
  border-radius: 11px 0 0 11px;
  background: #1d3b5c;
  color: #f3e3b8;
  font-size: 10.5px;
  font-weight: 800;
  letter-spacing: 0.3em;
  text-transform: uppercase;
  writing-mode: vertical-rl;
  transform: rotate(180deg);
}
.cw-card.clickable {
  cursor: pointer;
}
.cw-card:hover {
  transform: translateY(-3px);
  box-shadow: 0 8px 0 var(--sb-ink);
}
.cw-card.me {
  background:
    repeating-linear-gradient(135deg, rgba(255, 191, 60, 0.09) 0 2px, transparent 2px 9px),
    var(--sb-card);
}
.cw-card.editing {
  grid-column: 1 / -1;
  padding-left: 20px;
  transform: none;
  box-shadow: var(--sb-pop), 0 0 0 5px rgba(255, 191, 60, 0.4);
}
.cw-card.editing::before {
  display: none;
}
/* a pending invite: a passport still being issued */
.cw-card.ghost {
  border-style: dashed;
  background: transparent;
  box-shadow: none;
}
.cw-card.ghost::before {
  border-right-style: dashed;
  background: #e6ddcb;
  color: var(--sb-ink-soft);
}

.cw-id {
  display: flex;
  align-items: flex-start;
  gap: 14px;
}
/* the photo: a framed square, like a passport photo */
.cw-avatar {
  position: relative;
  width: 66px;
  height: 78px;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: visible;
  border: 2px solid var(--sb-ink);
  border-radius: 6px;
  color: #fff;
  font-weight: 800;
  font-size: 24px;
  box-shadow: 0 2px 0 var(--sb-ink);
}
.cw-avatar :deep(img) {
  border-radius: 4px;
}
.cw-avatar.ghost {
  border-style: dashed;
  background: var(--sb-cream);
  color: var(--sb-muted);
  box-shadow: none;
}
.cw-dot {
  position: absolute;
  right: -6px;
  bottom: -6px;
  width: 16px;
  height: 16px;
  border-radius: 50%;
  border: 2px solid var(--sb-ink);
  background: #b8c2ca;
}
.cw-dot.on {
  background: #3cbf6e;
}
.cw-who {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
}
/* small labels over each value, like the fields on a passport page */
.cw-field {
  font-size: 10px;
  font-weight: 800;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: var(--sb-muted);
}
.cw-who .cw-field + .cw-name,
.cw-who .cw-field + .cw-status {
  margin-bottom: 6px;
}
.cw-name {
  font-family: var(--sb-display);
  font-size: 1.25rem;
  line-height: 1.15;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.cw-you,
.cw-handle {
  font-family: var(--font-body);
  font-size: 0.9rem;
  font-weight: 600;
  color: var(--sb-muted);
}
.cw-status {
  font-size: 13px;
  font-weight: 700;
}
/* the role: an inked stamp in the corner */
.cw-role {
  flex: none;
  align-self: flex-start;
  padding: 2px 9px;
  border: 2px solid currentColor;
  border-radius: 6px;
  font-family: var(--sb-display);
  font-size: 0.9rem;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  background: rgba(255, 255, 255, 0.6);
  color: #1d6b8a;
  transform: rotate(6deg);
}
.cw-role.r-owner {
  color: var(--sb-red);
}
.cw-role.r-member {
  color: #1d6b8a;
}
.cw-role.r-guest {
  color: var(--sb-muted);
}
.cw-role.r-pending {
  color: #9a6400;
}
.cw-titlebox {
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.cw-persona {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  margin: 0;
  font-weight: 800;
  color: var(--sb-ink);
}
/* "Add a crew title": a blank line waiting to be filled in */
.cw-persona.add {
  align-self: flex-start;
  padding: 2px 0 4px;
  border: 0;
  border-bottom: 2px dashed var(--sb-stitch);
  background: none;
  color: var(--sb-ink-soft);
  font-weight: 700;
  text-align: left;
}
.cw-persona.add:hover {
  border-bottom-color: var(--sb-amber-lo);
  color: var(--sb-ink);
}
/* the details strip at the bottom of the page (real info only) */
.cw-pills {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin: 0 -2px;
  padding: 10px;
  border: 2px dashed rgba(18, 50, 74, 0.2);
  border-radius: 10px;
  background: rgba(255, 255, 255, 0.6);
}
.cw-pill {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 4px 10px;
  border: 1.5px solid var(--sb-ink);
  border-radius: 8px;
  background: #fbf5ea;
  color: var(--sb-ink);
  font-size: 12px;
  font-weight: 700;
}
.cw-pill.empty {
  border-style: dashed;
  border-color: rgba(18, 50, 74, 0.35);
  color: var(--sb-muted);
  font-weight: 600;
}
.cw-pill.allergy {
  border-color: #b3263a;
  background: #ffe8e4;
  color: #8f1d2c;
}
.cw-pill.diet {
  background: var(--sb-teal-soft);
}
.cw-foot {
  display: flex;
  justify-content: flex-end;
  margin-top: auto;
}
.cw-links {
  display: flex;
  gap: 8px;
}
.cw-link {
  display: inline-flex;
  align-items: center;
  min-height: 34px;
  padding: 0 14px;
  border: 2px solid var(--sb-ink);
  border-radius: 10px;
  background: var(--sb-cream);
  color: var(--sb-ink);
  font-size: 13px;
  font-weight: 800;
  text-decoration: none;
  box-shadow: 0 2px 0 var(--sb-ink);
  cursor: pointer;
}
.cw-link:hover {
  background: var(--sb-amber);
  color: var(--sb-ink);
}
.cw-link:active {
  transform: translateY(2px);
  box-shadow: 0 0 0 var(--sb-ink);
}

/* the next crewmate's place: an empty passport */
.cw-add {
  min-height: 210px;
  align-items: center;
  justify-content: center;
  gap: 8px;
  border-style: dashed;
  background: transparent;
  box-shadow: none;
  color: var(--sb-ink-soft);
  font: inherit;
  font-weight: 800;
  cursor: pointer;
}
.cw-add::before {
  border-right-style: dashed;
  background: #e6ddcb;
  color: var(--sb-ink-soft);
}
.cw-add:hover {
  background: rgba(255, 191, 60, 0.1);
  box-shadow: none;
  color: var(--sb-ink);
}
.cw-add-plus {
  display: grid;
  place-items: center;
  width: 54px;
  height: 54px;
  border: var(--sb-line);
  border-radius: 14px;
  background: var(--sb-amber);
  color: var(--sb-ink);
  font-family: var(--sb-display);
  font-size: 2rem;
  line-height: 1;
  box-shadow: var(--sb-pop-sm);
}

/* Edit form */
.cw-form-btns {
  display: flex;
  gap: 8px;
  justify-content: flex-end;
  margin-top: 12px;
}

/* ----- Group snapshot: two luggage tags ----- */
.cw-summary {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 16px;
  margin-top: 24px;
}
.cw-sum-item {
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: 12px 16px 12px 44px;
  border: var(--sb-line);
  border-radius: 8px 16px 16px 8px;
  background: #fff1cf;
  color: var(--sb-ink);
  box-shadow: var(--sb-pop-sm);
}
.cw-sum-item + .cw-sum-item {
  background: var(--sb-teal-soft);
}
/* the tag's eyelet */
.cw-sum-item::before {
  content: '';
  position: absolute;
  left: 15px;
  top: 50%;
  width: 14px;
  height: 14px;
  margin-top: -7px;
  border: 2.5px solid var(--sb-ink);
  border-radius: 50%;
  background: var(--sb-cream);
}
.cw-sum-label {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  font-size: 11px;
  font-weight: 800;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: var(--sb-ink-soft);
}
.cw-sum-value {
  font-size: 15px;
  font-weight: 800;
}
.cw-toast {
  position: fixed;
  left: 50%;
  bottom: 24px;
  transform: translateX(-50%);
  z-index: 1080;
  padding: 10px 18px;
  border: var(--sb-line);
  border-radius: 14px;
  background: var(--sb-cream);
  color: var(--sb-ink);
  font-size: 14px;
  font-weight: 700;
  box-shadow: var(--sb-pop);
  animation: cw-in 0.2s ease;
}

/* Keyboard focus */
.cw-primary:focus-visible,
.cw-ghost:focus-visible,
.cw-link:focus-visible,
.cw-add:focus-visible,
.cw-persona.add:focus-visible {
  outline: 3px solid var(--sb-teal);
  outline-offset: 3px;
}
@keyframes cw-in {
  from { opacity: 0; transform: translate(-50%, 8px); }
}
@media (max-width: 720px) {
  .cw-summary {
    grid-template-columns: 1fr;
  }
  .cw-actions {
    width: 100%;
  }
  .cw-actions > * {
    flex: 1;
  }
  .cw-grid {
    grid-template-columns: minmax(0, 1fr);
  }
}
@media (prefers-reduced-motion: reduce) {
  .cw-card, .cw-primary, .cw-ghost { transition: none; }
  .cw-card:hover { transform: none; }
}
/* Phones and touch screens: every control is at least 40px to tap (WCAG / Apple guidance) */
@media (pointer: coarse), (max-width: 560px) {
  .cw-link {
    min-height: 40px;
  }
}
</style>
