<template>
  <!-- Profile button in the nav bar + its menu (Friends, Settings, Log out) -->
  <div ref="rootEl" class="upm">
    <button ref="btnEl" type="button" class="upm-avatar" :aria-expanded="open" aria-haspopup="menu" aria-controls="upm-menu"
      :aria-label="'Account menu for ' + user.name" :title="user.name" data-testid="nav-user" @click="toggle">
      <img v-if="avatar.picture" :src="avatar.picture" alt="" class="upm-twin">
      <template v-else>{{ initial }}</template>
      <span v-if="friends.requests" class="upm-avatar-dot" aria-hidden="true"></span>
    </button>

    <transition name="upm-pop">
      <div v-if="open" id="upm-menu" ref="menuEl" class="upm-menu" role="menu" :aria-label="'Account: ' + user.name" @keydown="onMenuKey">
        <!-- faint compass in the corner, like the Settings card -->
        <svg class="upm-motif" viewBox="0 0 120 120" aria-hidden="true">
          <g fill="none" stroke="currentColor" stroke-width="1.4">
            <circle cx="60" cy="60" r="44" /><circle cx="60" cy="60" r="38" stroke-dasharray="1 4" />
            <path d="M60 8 66 54 112 60 66 66 60 112 54 66 8 60 54 54Z" />
          </g>
        </svg>

        <!-- Who's signed in: a little explorer pass -->
        <header class="upm-head">
          <span class="upm-avatar big" aria-hidden="true"><img v-if="avatar.picture" :src="avatar.picture" alt="" class="upm-twin"><template v-else>{{ initial }}</template></span>
          <div class="upm-who">
            <span class="upm-kicker">Explorer pass</span>
            <strong class="upm-name">{{ user.name }}</strong>
            <span class="upm-handle">@{{ user.username }}<template v-if="user.email"> · {{ user.email }}</template></span>
            <span class="upm-status online">
              <span class="upm-status-dot" aria-hidden="true"></span>Online
            </span>
          </div>
        </header>
        <!-- Travel twin level: the same tier and XP shown in Settings -->
        <div v-if="avatar.progressLoaded" class="upm-level">
          <span class="upm-tier">Tier {{ avatar.progress.tier }} · {{ avatar.progress.tierName }}</span>
          <span class="upm-xp">{{ avatar.progress.xp }} XP</span>
          <span class="upm-bar" role="progressbar" :aria-valuenow="levelPct" aria-valuemin="0" aria-valuemax="100" :aria-label="levelText"><span :style="{ width: levelPct + '%' }"></span></span>
          <small class="upm-next">{{ levelText }}</small>
        </div>

        <!-- Friends -->
        <div class="upm-section" role="group" aria-label="Friends">
          <button type="button" class="upm-item" role="menuitem" @click="openFriends">
            <span class="upm-ico"><AppIcon name="users" /></span>
            <span class="upm-text">Friends</span>
            <span v-if="friends.online" class="upm-online">{{ friends.online }} online</span>
            <span v-if="friends.requests" class="upm-badge" :aria-label="friends.requests + ' friend requests'">{{ friends.requests }}</span>
          </button>
        </div>

        <!-- Preferences -->
        <div class="upm-section" role="group" aria-label="Preferences">
          <p class="upm-label">Preferences</p>
          <router-link to="/avatar" class="upm-item" role="menuitem" @click="open = false">
            <span class="upm-ico"><AppIcon name="smile" /></span>
            <span class="upm-text">Travel twin<small class="upm-hint">Your 3D avatar and gear</small></span>
            <AppIcon name="chevron" :size="15" class="upm-chev" />
          </router-link>
          <!-- (trip pacing lives in Settings too, so it's not a separate item) -->
          <router-link to="/settings" class="upm-item" role="menuitem" data-testid="settings-link" @click="open = false">
            <span class="upm-ico"><AppIcon name="settings" /></span>
            <span class="upm-text">Settings<small class="upm-hint">Food needs, currency, trip pacing</small></span>
            <AppIcon name="chevron" :size="15" class="upm-chev" />
          </router-link>
        </div>

        <footer class="upm-foot">
          <button type="button" class="upm-item danger" role="menuitem" data-testid="logout-btn" @click="logOut">
            <span class="upm-ico"><AppIcon name="log-out" /></span>
            <span class="upm-text">Log out</span>
          </button>
        </footer>
      </div>
    </transition>
  </div>
</template>

<script setup>
import { ref, computed, watch, nextTick, onMounted, onBeforeUnmount } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { auth, logout } from '../auth.js'
import { friends, pingFriends } from '../friends.js'
import AppIcon from './AppIcon.vue'
import { avatar, loadAvatar, loadProgress } from '../avatarStore.js'

const router = useRouter()
const route = useRoute()

const open = ref(false)
const rootEl = ref(null)
const btnEl = ref(null)
const menuEl = ref(null)

const user = computed(() => auth.user || { name: '?', username: '' })
const initial = computed(() => (user.value.name || '?').charAt(0).toUpperCase())

// Travel twin level bar (same numbers as the Settings card)
const levelPct = computed(() => {
  const P = avatar.progress
  if (!P.next) return 100
  const from = P.tier === 1 ? 0 : P.tier === 2 ? 40 : 120
  return Math.round(((P.xp - from) / (P.next.min - from)) * 100)
})
const levelText = computed(() => {
  const P = avatar.progress
  return P.next ? P.next.min - P.xp + ' XP to ' + P.next.name : 'All gear unlocked'
})

async function toggle() {
  open.value = !open.value
  if (!open.value) return
  pingFriends() // fresh request / online counts
  if (!avatar.progressLoaded) loadProgress() // tier and XP for the level bar
  await nextTick()
  focusItem(0)
}

function openFriends() {
  open.value = false
  friends.open = true
}

function logOut() {
  open.value = false
  logout()
  router.push('/login')
}

// ----- Keyboard: arrows move between items, Esc closes and goes back to the button -----
function items() {
  return menuEl.value ? Array.from(menuEl.value.querySelectorAll('[role="menuitem"]:not([disabled])')) : []
}
function focusItem(i) {
  const list = items()
  if (list.length) list[(i + list.length) % list.length].focus()
}
function onMenuKey(e) {
  const list = items()
  const i = list.indexOf(document.activeElement)
  if (e.key === 'ArrowDown') { e.preventDefault(); focusItem(i + 1) }
  else if (e.key === 'ArrowUp') { e.preventDefault(); focusItem(i - 1) }
  else if (e.key === 'Home') { e.preventDefault(); focusItem(0) }
  else if (e.key === 'End') { e.preventDefault(); focusItem(-1) }
  else if (e.key === 'Escape') { open.value = false; btnEl.value.focus() }
  else if (e.key === 'Tab') open.value = false
}

// Click anywhere else closes it
function onDocClick(e) {
  if (open.value && rootEl.value && !rootEl.value.contains(e.target)) open.value = false
}
onMounted(() => {
  document.addEventListener('click', onDocClick)
  loadAvatar() // the twin's picture for the button
})
watch(() => auth.user && auth.user.id, () => loadAvatar()) // someone else logged in
onBeforeUnmount(() => {
  document.removeEventListener('click', onDocClick)
})
// Changing page closes it
watch(() => route.fullPath, () => { open.value = false })
</script>

<style scoped>
/* ===== Account menu: a pocket-sized Explorer's Dossier =====
   Same look as the Settings card: navy-slate, faint grid, slate borders, amber and teal accents. */
.upm {
  position: relative;
  --upm-card: #0f172a;
  --upm-slip: #132238;
  --upm-field: #0b131d;
  --upm-edge: #334155;
  --upm-line: rgba(148, 163, 184, 0.16);
  --upm-text: #f8fafc;
  --upm-muted: #94a3b8;
  --upm-brass: #c9a46a;
  --upm-accent: #f59e0b;
  --upm-accent-dark: #b45309;
  --upm-teal: #2f8f94;
  --upm-online: #4ade80;
  --upm-danger: #f87171;
}
.upm *,
.upm *::before,
.upm *::after {
  box-sizing: border-box;
}

/* Avatar button: a brass-ringed medallion */
.upm-avatar {
  position: relative;
  width: 38px;
  height: 38px;
  border-radius: 50%;
  border: 2px solid var(--upm-brass);
  background: linear-gradient(135deg, #00798c, #edae49);
  color: #fff;
  font-weight: 800;
  font-size: 15px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 0 0 2px rgba(15, 23, 42, 0.35), 0 2px 0 rgba(0, 0, 0, 0.25);
  transition: border-color 0.15s, transform 0.15s;
}
.upm-twin {
  width: 100%;
  height: 100%;
  border-radius: 50%;
  object-fit: cover;
}
.upm-avatar:hover {
  border-color: var(--upm-accent);
  transform: scale(1.05);
}
.upm-avatar:focus-visible {
  outline: 3px solid var(--upm-accent);
  outline-offset: 2px;
}
.upm-avatar.big {
  width: 52px;
  height: 52px;
  font-size: 19px;
  flex-shrink: 0;
  border: 2px solid var(--upm-brass);
  outline: 1px solid rgba(201, 164, 106, 0.45);
  outline-offset: 3px;
  box-shadow: none;
}
.upm-avatar-dot {
  position: absolute;
  right: -1px;
  bottom: -1px;
  width: 11px;
  height: 11px;
  border-radius: 50%;
  background: var(--upm-accent);
  border: 2px solid #0f172a;
}

/* The menu card */
.upm-menu {
  position: absolute;
  right: 0;
  top: calc(100% + 10px);
  z-index: 1100;
  width: min(330px, calc(100vw - 24px));
  overflow: hidden;
  padding: 10px;
  border-radius: 14px;
  border: 1px solid #1e293b;
  background:
    linear-gradient(rgba(148, 163, 184, 0.04) 1px, transparent 1px) 0 0 / 20px 20px,
    linear-gradient(90deg, rgba(148, 163, 184, 0.04) 1px, transparent 1px) 0 0 / 20px 20px,
    var(--upm-card);
  color: var(--upm-text);
  box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.55);
}
.upm-motif {
  position: absolute;
  top: -18px;
  right: -18px;
  width: 110px;
  color: rgba(148, 163, 184, 0.08);
  pointer-events: none;
}

/* Explorer pass header */
.upm-head {
  position: relative;
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 12px;
  border: 1px solid rgba(30, 41, 59, 0.8);
  border-radius: 8px;
  background:
    linear-gradient(135deg, rgba(255, 255, 255, 0.05), transparent 40%),
    var(--upm-slip);
  box-shadow: inset 1px 1px 0 rgba(255, 255, 255, 0.05), 0 2px 0 rgba(0, 0, 0, 0.25);
}
.upm-who {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 1px;
}
.upm-kicker {
  font-size: 10px;
  font-weight: 800;
  letter-spacing: 0.16em;
  text-transform: uppercase;
  color: var(--upm-accent);
}
.upm-name {
  font-size: 15.5px;
  font-weight: 800;
  line-height: 1.25;
}
.upm-handle {
  font-size: 12px;
  color: var(--upm-muted);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
/* "Online" as a small inked stamp, like Settings' "Saved" */
.upm-status {
  align-self: flex-start;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  margin-top: 6px;
  padding: 2px 8px;
  border: 1.5px solid currentColor;
  border-radius: 4px;
  font-size: 10.5px;
  font-weight: 800;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: var(--upm-muted);
  transform: rotate(-2deg);
}
.upm-status-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: currentColor;
}
.upm-status.online {
  color: var(--upm-online);
}

/* Level bar */
.upm-level {
  display: grid;
  grid-template-columns: 1fr auto;
  align-items: baseline;
  gap: 4px 8px;
  margin: 10px 2px 2px;
  padding: 0 10px;
}
.upm-tier {
  font-size: 12px;
  font-weight: 800;
  color: var(--upm-text);
}
.upm-xp {
  font-size: 11.5px;
  font-weight: 800;
  color: var(--upm-accent);
}
.upm-bar {
  grid-column: 1 / -1;
  display: block;
  height: 6px;
  border: 1px solid var(--upm-edge);
  border-radius: 3px;
  background: var(--upm-field);
  overflow: hidden;
}
.upm-bar span {
  display: block;
  height: 100%;
  background: linear-gradient(90deg, var(--upm-brass), var(--upm-accent));
  transition: width 0.6s cubic-bezier(0.3, 1.2, 0.5, 1);
}
.upm-next {
  grid-column: 1 / -1;
  font-size: 11.5px;
  color: var(--upm-muted);
}

/* Sections */
.upm-section {
  position: relative;
  padding: 8px 0 6px;
  border-bottom: 1px dashed var(--upm-line);
}
.upm-label {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 4px 10px 4px;
  font-size: 10.5px;
  font-weight: 800;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: var(--upm-brass);
  white-space: nowrap;
}
.upm-label::after {
  content: '';
  flex: 1;
  border-bottom: 1px solid var(--upm-line);
}

/* Rows */
.upm-item {
  position: relative;
  width: 100%;
  min-height: 46px;
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 7px 10px;
  border: 1px solid transparent;
  border-radius: 8px;
  background: none;
  color: var(--upm-text);
  font-size: 14px;
  font-weight: 700;
  text-align: left;
  text-decoration: none;
  transition: background 0.12s, border-color 0.12s, transform 0.12s;
}
/* icon in a small dark tile with a pressable edge */
.upm-ico {
  flex: none;
  display: grid;
  place-items: center;
  width: 32px;
  height: 32px;
  border: 1px solid var(--upm-edge);
  border-radius: 7px;
  background: var(--upm-field);
  color: var(--upm-muted);
  box-shadow: 0 2px 0 var(--upm-edge);
  transition: background 0.12s, color 0.12s, border-color 0.12s, box-shadow 0.12s, transform 0.12s;
}
a.upm-item:hover,
button.upm-item:hover,
.upm-item:focus-visible {
  background: var(--upm-slip);
  border-color: rgba(30, 41, 59, 0.9);
  color: var(--upm-text);
  outline: none;
}
a.upm-item:hover .upm-ico,
button.upm-item:hover .upm-ico,
.upm-item:focus-visible .upm-ico {
  border-color: var(--upm-accent-dark);
  background: linear-gradient(180deg, #fbbf24, var(--upm-accent));
  color: #1a1408;
  box-shadow: 0 2px 0 var(--upm-accent-dark);
  transform: translateY(-1px);
}
.upm-item:active .upm-ico {
  transform: translateY(2px);
  box-shadow: 0 0 0 var(--upm-accent-dark);
}
.upm-item:focus-visible {
  box-shadow: inset 0 0 0 2px rgba(245, 158, 11, 0.6);
}
.upm-text {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
}
.upm-hint {
  font-size: 12px;
  font-weight: 500;
  color: var(--upm-muted);
}
.upm-chev {
  color: var(--upm-muted);
  transition: transform 0.15s, color 0.15s;
}
a.upm-item:hover .upm-chev {
  color: var(--upm-accent);
  transform: translateX(2px);
}
.upm-badge {
  min-width: 24px;
  height: 22px;
  padding: 0 7px;
  border-radius: 6px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  font-weight: 800;
  background: var(--upm-accent);
  color: #1a1408;
  box-shadow: 0 2px 0 var(--upm-accent-dark);
}
.upm-online {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  font-size: 12px;
  font-weight: 700;
  color: var(--upm-online);
}
.upm-online::before {
  content: '';
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: currentColor;
}

/* Log out */
.upm-foot {
  padding-top: 6px;
}
.upm-item.danger {
  color: var(--upm-danger);
}
.upm-item.danger .upm-ico {
  border-color: rgba(248, 113, 113, 0.45);
  color: var(--upm-danger);
  box-shadow: 0 2px 0 #7f1d1d;
}
button.upm-item.danger:hover,
.upm-item.danger:focus-visible {
  background: rgba(248, 113, 113, 0.08);
  border-color: rgba(248, 113, 113, 0.25);
  color: var(--upm-danger);
}
button.upm-item.danger:hover .upm-ico,
.upm-item.danger:focus-visible .upm-ico {
  border-color: #7f1d1d;
  background: #dc2626;
  color: #fff;
  box-shadow: 0 2px 0 #7f1d1d;
}
.upm-item.danger:active .upm-ico {
  box-shadow: 0 0 0 #7f1d1d;
}
.upm-item.danger:focus-visible {
  box-shadow: inset 0 0 0 2px rgba(248, 113, 113, 0.6);
}

/* Open / close */
/* Opening: the menu unrolls downwards from the profile button (with a little spring),
   then its rows drop in one after another. Closing: it rolls back up, quickly. */
.upm-menu {
  transform-origin: calc(100% - 20px) 0;
}
.upm-pop-enter-active {
  animation: upm-unroll 0.42s cubic-bezier(0.34, 1.4, 0.64, 1);
}
.upm-pop-leave-active {
  animation: upm-unroll 0.18s ease-in reverse;
}
@keyframes upm-unroll {
  0% { opacity: 0; transform: translateY(-8px) scale(0.9, 0.4); clip-path: inset(0 0 100% 0 round 14px); }
  60% { opacity: 1; clip-path: inset(0 0 0 0 round 14px); }
  100% { opacity: 1; transform: none; clip-path: inset(0 0 0 0 round 14px); }
}
/* the rows cascade in */
.upm-pop-enter-active .upm-head,
.upm-pop-enter-active .upm-level,
.upm-pop-enter-active .upm-item,
.upm-pop-enter-active .upm-label {
  animation: upm-drop 0.38s cubic-bezier(0.34, 1.5, 0.64, 1) both;
}
.upm-pop-enter-active .upm-head { animation-delay: 0.05s; }
.upm-pop-enter-active .upm-level { animation-delay: 0.08s; }
.upm-pop-enter-active .upm-section:nth-of-type(1) .upm-item { animation-delay: 0.11s; }
.upm-pop-enter-active .upm-section:nth-of-type(2) .upm-label { animation-delay: 0.14s; }
.upm-pop-enter-active .upm-section:nth-of-type(2) .upm-item:nth-of-type(1) { animation-delay: 0.17s; }
.upm-pop-enter-active .upm-section:nth-of-type(2) .upm-item:nth-of-type(2) { animation-delay: 0.21s; }
.upm-pop-enter-active .upm-foot .upm-item { animation-delay: 0.28s; }
@keyframes upm-drop {
  from { opacity: 0; transform: translateY(-10px); }
  to { opacity: 1; transform: none; }
}
@media (prefers-reduced-motion: reduce) {
  .upm-pop-enter-active,
  .upm-pop-leave-active,
  .upm-pop-enter-active .upm-head,
  .upm-pop-enter-active .upm-level,
  .upm-pop-enter-active .upm-item,
  .upm-pop-enter-active .upm-label {
    animation: none;
  }
  .upm-avatar,
  .upm-ico,
  .upm-bar span {
    transition: none;
  }
}
/* =====================================================================
   Night scrapbook (same as Settings and Friends): the app's ink navy, dots,
   a stitched edge, chunky outlines and amber. These rules come last, so they win.
   ===================================================================== */
.upm {
  --upm-card: var(--sb-ink, #12324a);
  --upm-slip: #183f5c;
  --upm-edge: #0b2233;
  --upm-text: #fffaf0;
  --upm-muted: #b9cad6;
  --upm-accent: var(--sb-amber, #ffbf3c);
}
.upm-avatar {
  border: 2.5px solid var(--upm-edge);
  box-shadow: 0 3px 0 var(--upm-edge);
}
.upm-avatar:hover {
  border-color: var(--upm-edge);
  box-shadow: 0 0 0 3px var(--upm-accent), 0 3px 0 var(--upm-edge);
}
.upm-avatar-dot {
  border: 2px solid var(--upm-edge);
  background: var(--sb-coral, #ff7a5c);
}
.upm-menu {
  padding: 12px;
  border: 3px solid var(--upm-edge);
  border-radius: 18px;
  background:
    radial-gradient(circle, rgba(255, 250, 240, 0.07) 1.2px, transparent 1.5px) 0 0 / 20px 20px,
    var(--upm-card);
  box-shadow: 0 6px 0 var(--upm-edge), 0 24px 44px rgba(18, 50, 74, 0.35);
}
.upm-menu::before { /* stitching */
  content: '';
  position: absolute;
  inset: 6px;
  border: 2px dashed rgba(255, 250, 240, 0.14);
  border-radius: 12px;
  pointer-events: none;
}
.upm-motif {
  color: rgba(255, 250, 240, 0.07);
}
/* Explorer pass header: a card on the navy */
.upm-head {
  border: 2.5px solid var(--upm-edge);
  border-radius: 14px;
  background: var(--upm-slip);
  box-shadow: 0 4px 0 var(--upm-edge);
}
.upm-avatar.big {
  border: 2.5px solid var(--upm-edge);
  outline: 0;
  box-shadow: 0 0 0 3px var(--upm-accent), 0 4px 0 3px var(--upm-edge);
}
.upm-kicker {
  align-self: flex-start;
  padding: 1px 8px;
  border: 2px solid var(--upm-edge);
  border-radius: 6px;
  background: var(--upm-accent);
  color: var(--sb-ink, #12324a);
  font-size: 10px;
  font-weight: 800;
  letter-spacing: 0.1em;
  transform: rotate(-2deg);
}
.upm-name {
  font-family: var(--sb-display);
  font-size: 1.35rem;
  font-weight: 400;
  letter-spacing: 0.02em;
  color: #fffaf0;
}
.upm-handle {
  color: var(--upm-muted);
  font-weight: 600;
}
.upm-status.online {
  border: 2px solid #7ee2a8;
  background: rgba(126, 226, 168, 0.12);
  color: #7ee2a8;
  font-family: var(--sb-display);
  font-weight: 400;
  letter-spacing: 0.08em;
}
/* Level: a striped amber bar */
.upm-tier,
.upm-xp {
  font-family: var(--sb-display);
  font-weight: 400;
  letter-spacing: 0.02em;
}
.upm-tier { color: #fffaf0; }
.upm-xp { color: var(--upm-accent); }
.upm-bar {
  height: 12px;
  border: 2px solid var(--upm-edge);
  border-radius: 999px;
  background: #fffaf0;
}
.upm-bar span {
  border-radius: 999px;
  background:
    repeating-linear-gradient(135deg, rgba(255, 255, 255, 0.35) 0 5px, transparent 5px 10px),
    var(--upm-accent);
}
.upm-next {
  color: var(--upm-muted);
  font-weight: 600;
}
.upm-label {
  color: var(--upm-accent);
  font-family: var(--sb-display);
  font-weight: 400;
  letter-spacing: 0.08em;
}
.upm-label::after {
  border-color: rgba(255, 250, 240, 0.16);
  border-style: dashed;
}
/* Menu rows: cream icon tiles that turn amber on hover */
.upm-item {
  border-radius: 12px;
  font-family: var(--sb-display);
  font-size: 1.05rem;
  font-weight: 400;
  letter-spacing: 0.02em;
}
.upm-hint {
  font-family: var(--font-body);
  font-weight: 600;
  letter-spacing: 0;
}
.upm-ico {
  border: 2px solid var(--upm-edge);
  border-radius: 10px;
  background: #fffaf0;
  color: var(--sb-ink, #12324a);
  box-shadow: 0 3px 0 var(--upm-edge);
}
a.upm-item:hover,
button.upm-item:hover,
.upm-item:focus-visible {
  border-color: var(--upm-edge);
  background: var(--upm-slip);
}
a.upm-item:hover .upm-ico,
button.upm-item:hover .upm-ico,
.upm-item:focus-visible .upm-ico {
  border-color: var(--upm-edge);
  background: var(--upm-accent);
  color: var(--sb-ink, #12324a);
  box-shadow: 0 4px 0 var(--upm-edge);
}
.upm-item:active .upm-ico {
  box-shadow: 0 1px 0 var(--upm-edge);
}
.upm-item:focus-visible {
  box-shadow: inset 0 0 0 2px var(--upm-accent);
}
.upm-chev {
  color: var(--upm-muted);
}
.upm-badge {
  border: 2px solid var(--upm-edge);
  background: var(--sb-coral, #ff7a5c);
  color: var(--sb-ink, #12324a);
  font-family: var(--sb-display);
  font-weight: 400;
}
.upm-online {
  color: #7ee2a8;
}
.upm-foot {
  border-top: 2px dashed rgba(255, 250, 240, 0.16);
}
.upm-item.danger {
  color: #ff9a8a;
}
.upm-item.danger .upm-ico {
  border-color: var(--upm-edge);
  background: #fde0dc;
  color: var(--sb-red, #d1495b);
}
.upm-item.danger:hover .upm-ico,
.upm-item.danger:focus-visible .upm-ico {
  border-color: var(--upm-edge);
  background: var(--sb-red, #d1495b);
  color: #fffaf0;
}
</style>
