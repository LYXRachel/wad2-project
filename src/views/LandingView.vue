<template>
  <div ref="lpEl" class="lp" :style="{ '--mx': mx, '--my': my }" @mousemove="onMove" @mouseleave="mx = 0; my = 0" @scroll.passive="onScroll">
    <!-- Landing page: an animated night scene with the brand, a big title and two ways in,
         then a scroll story: a 3D app window shows the four things the app does -->
    <section class="lp-hero">
      <!-- ===== Travel journal hero ===== -->
    <div class="journal-hero">
      <header class="journal-nav">
        <div class="journal-brand">
          <div class="journal-logo">
            <span>✈</span>
          </div>

          <span class="journal-brand-name">Chui-se Your Trip</span>
        </div>

        <router-link to="/login" class="journal-signin">
          Sign In / Join
        </router-link>
      </header>

      <div class="journal-dots" aria-hidden="true"></div>

      <div class="journal-route" aria-hidden="true">
        <span class="route-plane">✈</span>
        <span class="route-line"></span>
      </div>

      <main class="journal-content">
        <div class="journal-copy">
          <span class="journal-eyebrow">
            YOUR WHOLE TRIP, IN ONE PLACE
          </span>

          <h1>
            Plan together.<br />
            <span>Travel better.</span>
          </h1>

          <p>
            Discover places, decide as a group, build your itinerary
            and adapt when plans change — all without juggling ten tabs.
          </p>

          <div class="journal-actions">
            <router-link to="/discover" class="journal-primary">
              Explore Trips
              <span>→</span>
            </router-link>

            <button
              type="button"
              class="journal-secondary"
              @click="goToStep(0)"
            >
              See how it works
            </button>
          </div>
        </div>

        <div class="journal-art" aria-hidden="true">
          <div class="journal-postcard postcard-back">
            <div class="postcard-stamp">✈</div>

            <div class="postcard-message">
              Wish you<br />
              were here!
            </div>

            <div class="postcard-lines">
              <span></span>
              <span></span>
              <span></span>
            </div>
          </div>

          <div class="journal-postcard postcard-front">
            <div class="postcard-tape"></div>

            <div class="postcard-picture">
              <div class="picture-sky">
                  <span class="picture-sun"></span>
                  <span class="picture-cloud cloud-one"></span>
                  <span class="picture-cloud cloud-two"></span>
                </div>

                <!-- Mountains -->
                <div class="mountain mountain-back"></div>

                <div class="mountain mountain-front">
                  <div class="snow-cap"></div>
                </div>

                <!-- Foreground hills -->
                <div class="foreground-hill hill-one"></div>
                <div class="foreground-hill hill-two"></div>

                <span class="picture-plane">✈</span>
            </div>

            <div class="postcard-caption">
              <strong>The world is calling</strong>
              <span>Where are we going next?</span>
            </div>

            <div class="postcard-stamp-small">
              CHUI<br />SE
            </div>
          </div>

          <div class="journal-pin">●</div>
        </div>
      </main>

      <div class="journal-scroll">
        <button type="button" @click="goToStep(0)">
          <span>Start the journey</span>
          <span class="journal-arrow">↓</span>
        </button>
      </div>
    </div>
    <!-- ===== The scene: the photo, with the moving parts drawn on top in the same coordinates ===== -->
    <!-- The stage keeps the photo's shape on every screen and keeps the mountain in view
         (on a phone the right part of the photo is shown, not the empty middle) -->
    <div class="lp-stage" :class="{ shaking: shaking }" aria-hidden="true">
    <div class="lp-photo"></div>
    <svg class="lp-scene" viewBox="0 0 1376 768" preserveAspectRatio="none">
      <defs>
        <filter id="lp-soft"><feGaussianBlur stdDeviation="1.4" /></filter>
        <!-- The plane's body: lit warm from above by the sunset, darker underneath -->
        <linearGradient id="lp-hull" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stop-color="#f6ead6" />
          <stop offset="0.55" stop-color="#b9b6b0" />
          <stop offset="1" stop-color="#4b5560" />
        </linearGradient>
        <linearGradient id="lp-wing" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stop-color="#d9d2c6" />
          <stop offset="1" stop-color="#58626d" />
        </linearGradient>
      </defs>

      <!-- Tap the mountain: it erupts (sparks, a flash and smoke) -->
      <g class="lp-layer" style="--depth: 10px">
        <path class="lp-volcano-hit" d="M985 255 L1100 255 L1376 470 L1376 660 L700 660 Z" @click="erupt" />
        <g v-for="e in eruptions" :key="e.id" class="lp-erupt">
          <circle class="lp-erupt-glow" :cx="SUMMIT.x" :cy="SUMMIT.y" r="70" />
          <circle v-for="m in e.smoke" :key="'m' + m.id" class="lp-smoke" :cx="SUMMIT.x + m.x" :cy="SUMMIT.y" :r="m.r"
            :style="{ '--dx': m.dx + 'px', '--dy': m.dy + 'px', animationDelay: m.d + 's' }" />
          <circle v-for="p in e.sparks" :key="'p' + p.id" class="lp-spark" :cx="SUMMIT.x + p.x" :cy="SUMMIT.y" :r="p.r"
            :style="{ '--dx': p.dx + 'px', '--dy': p.dy + 'px', '--fall': p.fall + 'px', fill: p.c, animationDuration: p.t + 's', animationDelay: p.d + 's' }" />
        </g>
      </g>

      <!-- Trip routes over the land, with glowing stops -->
      <g class="lp-layer" style="--depth: 14px">
        <path d="M612 422 C 600 500, 680 565, 769 561 C 830 558, 880 540, 922 528 C 990 508, 1050 480, 1105 463 C 1200 440, 1310 420, 1327 335 C 1335 300, 1300 285, 1260 290" class="lp-route" />
        <path d="M1105 463 C 1180 480, 1240 500, 1288 507 S 1360 525, 1400 540" class="lp-route" />
        <circle v-for="n in nodes" :key="'n' + n.id" :cx="n.x" :cy="n.y" r="4.5" class="lp-node" :style="{ animationDelay: n.d + 's' }" />
      </g>

      <!-- Embers rising off the summit -->
      <g class="lp-layer" style="--depth: 10px">
        <circle v-for="e in embers" :key="'e' + e.id" :cx="e.x" cy="262" :r="e.s" class="lp-ember"
          :style="{ animationDelay: e.d + 's', animationDuration: e.t + 's', '--drift': e.drift + 'px' }" />
      </g>

      <!-- The plane: takes off from a route stop, climbs away to the left, then comes back high
           across the sky and glides down onto another stop. Moved by script (see flyPlane)
           so its nose never tips more than a real climb or descent would. -->
      <g class="lp-layer" style="--depth: 20px">
        <path v-for="(leg, k) in LEGS" :key="'t' + k" :ref="(el) => { if (el) trailEls[k] = el }" :d="leg.d" fill="none"
          stroke="#f7f2e8" stroke-opacity="0.32" stroke-width="1.3" stroke-linecap="round" filter="url(#lp-soft)" opacity="0" />
        <g ref="planeEl" opacity="0">
          <!-- A simple side-view jet, nose to the right, centred on 0,0 (flipped by script when flying left) -->
          <!-- A slim airliner seen from the side, nose to the right, centred on 0,0 (flipped by script when flying left).
               Shaded by the sunset and drawn small, with blinking navigation lights like a real plane at dusk. -->
          <g ref="imgEl" class="lp-plane">
            <!-- far wing and tailplane (behind the body, in shadow) -->
            <path class="shade" d="M7 -2.8 L1.5 -6 L3.4 -6.2 L11 -3.1 Z" />
            <path class="shade" d="M-30 -1.2 L-35.5 -4.6 L-33.6 -4.8 L-26 -1.6 Z" />
            <!-- body -->
            <path class="hull" d="M-37 -1.2 C-37 -2.8 -34.5 -3.4 -30 -3.4 L27 -3.4 C33.5 -3.4 38.5 -1.9 41 0 C38.5 1.7 33.5 2.4 27 2.4 L-27.5 2.4 C-33.5 2.4 -37 1.2 -37 -1.2 Z" />
            <!-- tail fin, swept back -->
            <path class="wing" d="M-35.5 -3 L-33.6 -14.6 L-30.6 -14.6 L-22.5 -3.4 Z" />
            <!-- near tailplane -->
            <path class="wing" d="M-30.5 0.6 L-36.6 5 L-34.4 5.2 L-25.5 1.2 Z" />
            <!-- near wing, swept back and down towards us, with its engine -->
            <path class="wing" d="M3.5 1 L-8.6 10.6 L-5.4 11 L11.5 1.6 Z" />
            <!-- engine hanging just under the wing, on a short pylon -->
            <path class="engine" d="M3.8 3 L5.6 3 L5.4 3.9 L3.6 3.9 Z" />
            <path class="engine" d="M0.6 3.7 H8.2 C9.1 3.7 9.4 4.4 9.4 4.8 C9.4 5.3 9.1 5.9 8.2 5.9 H0.6 C0.1 5.9 -0.1 5.3 -0.1 4.8 C-0.1 4.4 0.1 3.7 0.6 3.7 Z" />
            <!-- cockpit windows and a cabin window line -->
            <path class="glass" d="M35.2 -2.4 C37 -2 38.4 -1.3 39.2 -0.8 L36 -0.9 Z" />
            <path class="windows" d="M-24 -1.4 H30" />
            <!-- lights: green on the near wingtip, red on the far one, white on the tail, red beacon on the belly -->
            <circle class="nav green" cx="-8" cy="10.8" r="0.9" />
            <circle class="nav red" cx="2" cy="-6.1" r="0.75" />
            <circle class="strobe" cx="-36.4" cy="-1.4" r="1" />
            <circle class="beacon" cx="-6" cy="2.9" r="0.85" />
          </g>
        </g>
      </g>
    </svg>
    </div>

    <!-- Drifting clouds and rising embers (plain HTML, lighter than SVG filters) -->
    <div class="lp-clouds" aria-hidden="true">
      <span class="lp-cloud c1"></span>
      <span class="lp-cloud c2"></span>
      <span class="lp-cloud c3"></span>
    </div>
    <div class="lp-shade" aria-hidden="true"></div>

    <!-- Two origami paper planes drifting across the sky on glowing dotted trails -->
    <div class="lp-origami" aria-hidden="true">
      <span v-for="n in 2" :key="'o' + n" class="lp-paper" :class="'p' + n">
        <svg viewBox="0 0 220 90">
          <path class="lp-paper-trail" d="M4 70 C 50 84, 90 40, 140 52 S 180 50, 196 40" />
          <g transform="translate(176 22)">
            <path d="M0 18 L40 0 L18 26 Z" fill="#faf8f3" />
            <path d="M18 26 L40 0 L22 36 Z" fill="#e8dcc4" />
            <path d="M18 26 L22 36 L14 30 Z" fill="#cdbb98" />
          </g>
        </svg>
      </span>
    </div>

    <!-- ===== Brand, title and the two ways in ===== -->
    <!-- Brand: a rounded cream tab with a hand-drawn paper plane -->
    <header class="lp-brand">
      <span class="lp-brand-icon" aria-hidden="true"><DoodleIcon name="plane" :size="28" anim="" /></span>
      <span class="lp-brand-text"><span>CHUI-SE</span> <span>YOUR TRIP</span></span>
    </header>

    <router-link to="/login" class="lp-signin lp-top-signin">Sign in / Join</router-link>

    <main class="lp-content">
      <h1 class="lp-title"><span>Travel</span><span class="lp-accent">without</span><span>limits</span></h1>
      <p class="lp-tag">Plan together. Drift nowhere.</p>
      <div class="lp-actions">
        <!-- Explore straight away as a guest; sign in only when saving something -->
        <router-link to="/discover" class="lp-explore">Explore trips <span class="lp-arrow" aria-hidden="true">→</span></router-link>
      </div>
    </main>

    <!-- Invite to scroll down to the story -->
    <button type="button" class="lp-cue" @click="goToStep(0)">
      <span>See how it works</span>
      <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m6 9 6 6 6-6" /></svg>
    </button>
    </section>

    <!-- ===== The Campfire Briefing: Pip welcomes you and shows what you'll pack when you join ===== -->
    <section class="lp-brief" aria-labelledby="lp-brief-title">
      <div class="lp-brief-card">
        <span class="lp-brief-tape tl" aria-hidden="true"></span>
        <span class="lp-brief-tape tr" aria-hidden="true"></span>
        <div class="lp-brief-guide">
          <button type="button" class="lp-brief-pip" aria-label="Pip, your guide. Tap to say hi" @click="pipHi">
            <PlaneGuide :size="124" :mood="pipMood" />
          </button>
          <div class="lp-brief-bubble">
            <p class="lp-brief-kicker">The Campfire Briefing</p>
            <h2 id="lp-brief-title" class="lp-brief-title">Ahoy, explorer! Before we hit the trail, let’s pack your field essentials.</h2>
          </div>
        </div>
        <div class="lp-brief-body">
          <p class="lp-brief-sub">Tell us once and every trip your crew plans fits you: what you eat, how to reach you, the money you think in and how fast you like to go.</p>
          <ul class="lp-bags">
            <li v-for="t in BRIEF_TAGS" :key="t.label" class="lp-bag" :style="{ '--r': t.r + 'deg' }">
              <span class="lp-bag-stamp" aria-hidden="true"><DoodleIcon :name="t.icon" :size="20" anim="" /></span>{{ t.label }}
            </li>
          </ul>
          <div class="lp-brief-btns">
            <router-link to="/signup" class="lp-explore small">Pack my essentials <span class="lp-arrow" aria-hidden="true">→</span></router-link>
            <small class="lp-brief-hint">Free account · change them anytime in Settings</small>
          </div>
        </div>
      </div>
    </section>

    <!-- ===== Scroll story: the window stays pinned while you scroll; each quarter is one step ===== -->
    <section ref="storyEl" class="lp-story" :style="{ height: (STEPS.length + 1) * 100 + 'vh' }" aria-label="How Chui-se Your Trip works">
      <div class="lp-sticky">
        <!-- The words: one step at a time -->
        <div class="lp-copy">
          <article v-for="(st, k) in STEPS" :key="st.key" class="lp-step" :class="{ on: step === k, past: step > k }" :aria-hidden="step !== k">
            <span class="lp-step-num">Chapter {{ String(k + 1).padStart(2, '0') }} · {{ st.label }}</span>
            <h2 class="lp-step-title">{{ st.title }}</h2>
            <p class="lp-step-text">{{ st.text }}</p>
            <ul class="lp-step-points">
              <li v-for="pt in st.points" :key="pt">{{ pt }}</li>
            </ul>
          </article>
        </div>

        <!-- The 3D window (decoration: the words above say the same thing) -->
        <div class="lp-3d" aria-hidden="true">
          <div class="lp-device" :style="deviceStyle">
            <div class="lp-win">
              <!-- Browser bar + the app's own top bar -->
              <div class="lp-win-bar"><i></i><i></i><i></i><span class="w-url">🔒 chuiseyourtrip.app/{{ URLS[step] }}</span></div>
              <div class="w-nav">
                <span class="w-logo"><svg viewBox="0 0 40 40" width="16" height="16"><circle cx="20" cy="20" r="16" fill="none" stroke="#edae49" stroke-width="3" /><path d="M27 13 L22 22 L13 27 L18 18 Z" fill="#edae49" /></svg>Chui-se</span>
                <span v-for="(tab, k) in NAV_TABS" :key="tab" class="w-tab" :class="{ on: step === k }">{{ tab }}</span>
                <span class="w-faces"><i style="background:#edae49">KH</i><i style="background:#d1495b">AT</i><i style="background:#00798c">BL</i><i style="background:#66a182">GM</i></span>
              </div>
              <div class="lp-win-body">

                <!-- 1. Discover: filters, a country with its cities, and a 3D map of matches -->
                <div class="sc sc-discover" :class="sceneClass(0)">
                  <div class="d-left">
                    <div class="d-filters">
                      <span class="w-chip">📅 19 – 26 Nov</span>
                      <span class="w-seg"><i>$</i><i class="on">$$</i><i>$$$</i></span>
                      <span class="w-chip">✨ Culture ▾</span>
                    </div>
                    <div class="w-search">🔍 <span>Search a city or country</span><kbd>/</kbd></div>
                    <div class="d-country">
                      <div><b>🇯🇵 Japan</b><small>Temples, food and neon, all on one rail pass</small></div>
                      <span class="w-score">92</span>
                    </div>
                    <div class="d-cities">
                      <div v-for="c in DISCOVER_CITIES" :key="c.name" class="d-city" :style="{ background: c.bg }">
                        <span class="d-heart">♥</span>
                        <em v-if="c.gem" class="d-gem">Hidden gem</em>
                        <span class="d-art">{{ c.icon }}</span>
                        <div class="d-city-text">
                          <small><b>{{ c.score }}</b>/100</small>
                          <b>{{ c.name }}</b>
                          <span>{{ c.note }}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                  <div class="d-map">
                    <div class="sc-plane">
                      <span class="d-land l1"></span><span class="d-land l2"></span><span class="d-land l3"></span>
                      <span v-for="(pl, n) in PILLARS" :key="n" class="sc-pillar" :class="{ low: pl.h < 30 }" :style="{ left: pl.x + '%', top: pl.y + '%', '--h': pl.h + 'px', '--d': n * 0.08 + 's' }"></span>
                    </div>
                    <span class="d-pin">Kyoto · 92</span>
                    <span class="d-zoom"><i>+</i><i>−</i></span>
                    <span class="d-legend">Taller = better match</span>
                  </div>
                </div>

                <!-- 2. Decide together: quick vote and the group's votes -->
                <div class="sc sc-vote" :class="sceneClass(1)">
                  <div class="v-head">
                    <div><b>Group decisions</b><small>A place is a group pick when 3 of 4 want to go</small></div>
                    <span class="w-chip gold">✓ 2 group picks</span>
                  </div>
                  <div class="v-quick">
                    <div><b>Quick vote</b><small>3 places still need your vote</small></div>
                    <div class="sc-bar dark"><span style="width: 62%"></span></div>
                    <span class="v-yes">👍 Yes to all</span>
                  </div>
                  <div v-for="(v, n) in VOTE_ROWS" :key="v.name" class="v-row" :style="{ '--d': n * 0.12 + 's' }">
                    <span class="w-thumb" :style="{ background: v.bg }">{{ v.icon }}</span>
                    <div class="v-main">
                      <div class="v-top"><b>{{ v.name }}</b><em v-if="v.yes >= 3" class="v-pick">Group pick</em></div>
                      <div class="v-people">
                        <span v-for="p in v.people" :key="p.n" class="v-person" :class="{ yes: p.yes, me: p.n === 'You' }">{{ p.yes ? '✓' : '…' }} {{ p.n }}</span>
                      </div>
                    </div>
                    <div class="v-count">
                      <div class="sc-bar"><span :style="{ width: v.yes * 25 + '%' }" :class="{ pick: v.yes >= 3 }"></span></div>
                      <small>{{ v.yes }}/4</small>
                    </div>
                  </div>
                </div>

                <!-- 3. Plan the days: day strip, a timeline, and the day's route on a map -->
                <div class="sc sc-plan" :class="sceneClass(2)">
                  <div class="p-left">
                    <div class="p-days">
                      <span v-for="(d, k) in PLAN_DAYS" :key="d.d" class="p-day" :class="{ on: k === 0 }"><b>{{ d.d }}</b><small>{{ d.n }} stops</small></span>
                    </div>
                    <div class="p-status">✓ Day balanced · ends 7:30 PM <span>Undo</span></div>
                    <template v-for="(t, n) in PLAN_STOPS" :key="t.name">
                      <div class="sc-stop" :class="{ meal: t.meal }" :style="{ '--d': n * 0.1 + 's' }">
                        <span class="p-num" :style="{ background: t.color }">{{ t.meal ? '🍜' : t.num }}</span>
                        <span class="w-thumb sm" :style="{ background: t.bg }">{{ t.icon }}</span>
                        <div class="p-text">
                          <small><b>{{ t.time }}</b> · {{ t.len }}</small>
                          <b>{{ t.name }}</b>
                          <span v-if="!t.meal" class="p-chips"><i>{{ t.wx }}</i><i :class="t.crowd === 'Busy' ? 'busy' : 'quiet'">{{ t.crowd }}</i></span>
                        </div>
                        <span class="p-grip">⠿</span>
                      </div>
                      <div v-if="t.leg" class="p-leg">{{ t.leg }}</div>
                    </template>
                  </div>
                  <div class="p-map">
                    <svg viewBox="0 0 200 260" preserveAspectRatio="none">
                      <path d="M0 70 C 60 60, 90 110, 200 90" class="p-river" />
                      <path d="M40 210 C 70 170, 120 190, 120 130 S 160 70, 150 40" class="p-route" />
                    </svg>
                    <span class="p-pin" style="left: 20%; top: 80%; background: #00798c"><i>1</i></span>
                    <span class="p-pin" style="left: 60%; top: 50%; background: #d1495b"><i>2</i></span>
                    <span class="p-pin" style="left: 75%; top: 15%; background: #003d5b"><i>3</i></span>
                    <div class="p-map-foot"><span>7.2 km · 38 min travel</span><b>✦ Optimize route</b></div>
                  </div>
                </div>

                <!-- 4. Travel smart: today's weather, a rain swap, crowds and money -->
                <div class="sc sc-today" :class="sceneClass(3)">
                  <div class="t-hours">
                    <div v-for="h in HOURS" :key="h.t" class="t-hour" :class="{ wet: h.wet, now: h.now }">
                      <small>{{ h.now ? 'Now' : h.t }}</small><span>{{ h.icon }}</span><b>{{ h.temp }}°</b><i :style="{ height: h.rain + '%' }"></i>
                    </div>
                  </div>
                  <div class="t-alert">
                    <div class="t-alert-text"><b>🌧️ Rain from 1 PM</b><small>Arashiyama Bamboo Grove is outdoors. Swap it for an indoor place?</small></div>
                    <div class="t-swap">
                      <span class="w-thumb sm" style="background: linear-gradient(135deg, #a8d5a2, #3f7a63)">🎋</span>
                      <span class="t-arrow">→</span>
                      <span class="w-thumb sm" style="background: linear-gradient(135deg, #cfe3f1, #003d5b)">🏛️</span>
                      <em>Swap</em>
                    </div>
                  </div>
                  <div class="t-row">
                    <div class="t-card">
                      <div class="t-card-head"><b>Fushimi Inari</b><span class="quiet">Quiet now</span></div>
                      <div class="t-bars">
                        <i v-for="(c, n) in CROWD" :key="n" :class="{ now: n === 2 }" :style="{ height: c + '%', '--d': n * 0.05 + 's' }"></i>
                      </div>
                      <div class="t-axis"><small>8a</small><small>12p</small><small>4p</small><small>8p</small></div>
                    </div>
                    <div class="t-card money">
                      <small>You owe Aisha</small>
                      <b>S$12.00</b>
                      <span>Dinner in Gion · split 4</span>
                      <em>Settle up</em>
                    </div>
                  </div>
                  <div class="t-next">
                    <span class="w-thumb sm" style="background: linear-gradient(135deg, #cfe3f1, #00798c)">🛍️</span>
                    <div><small>Up next · 1:15 PM</small><b>Nishiki Market</b></div>
                    <span class="t-go">🚶 9 min walk · Directions</span>
                  </div>
                </div>
              </div>
            </div>

            <!-- Floating notification cards, closer to you than the window -->
            <div v-for="(ch, n) in CHIPS" :key="n" class="lp-chip" :class="[sceneClass(ch.step), 'pos' + ch.pos]" :style="{ '--z': ch.z + 'px' }">
              <span class="lp-chip-icon">{{ ch.icon }}</span>
              <div><b>{{ ch.text }}</b><small>{{ ch.sub }}</small></div>
            </div>
          </div>
          <div class="lp-shadow"></div>
        </div>

        <!-- Where you are in the story; tap to jump -->
        <nav class="lp-dots" aria-label="Story steps">
          <button v-for="(st, k) in STEPS" :key="st.key" type="button" class="lp-dot" :class="{ on: step === k }"
            :aria-label="'Step ' + (k + 1) + ': ' + st.label" :aria-current="step === k ? 'step' : null" @click="goToStep(k)"></button>
        </nav>
      </div>
    </section>

    <!-- ===== Features: six cards that tilt toward the mouse, with the picture popping out in layers ===== -->
    <section ref="featEl" class="lp-feat" :class="{ shown: featShown }" aria-labelledby="lp-feat-title">
      <h2 id="lp-feat-title" class="lp-feat-title">One app instead of ten tabs</h2>
      <p class="lp-feat-sub">Everything your group needs, before the trip and during it.</p>
      <div class="lp-feat-grid">
        <article v-for="(f, k) in FEATURES" :key="f.key" class="lp-card" :style="{ '--i': k }">
          <div class="lp-card-in" title="Click to play again" @pointermove="tilt" @pointerleave="untilt" @click="replay">
            <div class="lp-art" :class="'art-' + f.key" aria-hidden="true">

              <template v-if="f.key === 'save'">
                <div class="z1 a-photo p1">⛩️</div>
                <div class="z1 a-photo p2">🍜</div>
                <div class="z2 a-tag t1">★ Popular</div>
                <div class="z2 a-tag t2">Temple</div>
                <div class="z3 a-heart">♥</div>
                <svg class="z3 a-cursor" viewBox="0 0 24 24" width="26" height="26"><path d="M4 2l14 9-6 1.5 3.5 7-2.5 1.2-3.5-7L5 17z" fill="#001d2c" stroke="#fff" stroke-width="1.4" /></svg>
              </template>

              <template v-else-if="f.key === 'split'">
                <div class="z1 a-bill"><small>Dinner in Gion</small><b>¥8,400</b><span>Split 4 ways</span></div>
                <div class="z2 a-faces"><i style="background:#edae49">KH</i><i style="background:#d1495b">AT</i><i style="background:#00798c">BL</i><i style="background:#66a182">GM</i></div>
                <div class="z3 a-pill">You owe Aisha <b>S$19</b></div>
                <div class="z1 a-progress"><span></span></div>
              </template>

              <template v-else-if="f.key === 'together'">
                <div class="z2 a-faces big"><i style="background:#edae49">KH</i><i style="background:#d1495b">AT</i><i style="background:#00798c">BL</i><i style="background:#66a182">GM</i></div>
                <div class="z1 a-row"><span>📍</span><div><b>Nishiki Market</b><small>Added by Aisha</small></div></div>
                <div class="z3 a-tip">Ben voted yes 👍</div>
              </template>

              <template v-else-if="f.key === 'pack'">
                <div v-for="(item, n) in ['Passport', 'Rain jacket', 'Power adapter']" :key="item" class="z1 a-check" :style="{ '--n': n }">
                  <span class="a-tick">✓</span>{{ item }}
                </div>
                <div class="z3 a-pill pk">🌧️ Rain expected</div>
              </template>

              <template v-else-if="f.key === 'recs'">
                <div class="z2 a-ring"><b>92</b><small>match</small></div>
                <div class="z3 a-pill r1">🕘 Quieter at 9 AM</div>
                <div class="z1 a-pill r2">☔ Indoor swap ready</div>
              </template>

              <template v-else>
                <div class="z1 a-ticket back"></div>
                <div class="z2 a-ticket"><small>Booked tour</small><b>Tea ceremony</b><span>Tue 19 Nov · 2:00 PM</span><em>Booking link ↗</em></div>
                <div class="z3 a-pill lock">🔒 Locked on Day 2</div>
              </template>
            </div>
            <span class="lp-card-log">Field log {{ String(k + 1).padStart(2, '0') }}</span>
            <h3>{{ f.title }}</h3>
            <p>{{ f.text }}</p>
          </div>
        </article>
      </div>
    </section>

    <!-- ===== The end: one clear next step ===== -->
    <!-- ===== Join: a phone showing a trip; its screen scrolls as you scroll the page ===== -->
    <section ref="joinEl" class="lp-join" aria-labelledby="lp-join-title">
      <div class="lp-join-art" aria-hidden="true">
        <div class="lp-phone" :style="phoneStyle">
          <div class="lp-phone-screen">
            <!-- Fixed on top: status bar and the trip's header -->
            <div class="ph-top">
              <div class="ph-status">
                <b>9:41</b>
                <span class="ph-sys">
                  <svg viewBox="0 0 18 12" width="17" height="11"><rect x="0" y="8" width="3" height="4" rx="1" /><rect x="5" y="5.5" width="3" height="6.5" rx="1" /><rect x="10" y="3" width="3" height="9" rx="1" /><rect x="15" y="0" width="3" height="12" rx="1" /></svg>
                  <svg viewBox="0 0 16 12" width="15" height="11"><path d="M8 11.5 5.6 9a3.4 3.4 0 0 1 4.8 0z" /><path d="M3.4 6.8a6.5 6.5 0 0 1 9.2 0l-1.4 1.4a4.5 4.5 0 0 0-6.4 0z" /><path d="M1.2 4.6a9.6 9.6 0 0 1 13.6 0l-1.4 1.4a7.6 7.6 0 0 0-10.8 0z" /></svg>
                  <svg viewBox="0 0 27 12" width="25" height="11"><rect x="0.5" y="0.5" width="22" height="11" rx="3.5" fill="none" stroke="currentColor" opacity="0.4" /><rect x="2.5" y="2.5" width="15" height="7" rx="2" /><path d="M24.5 4v4a2 2 0 0 0 0-4z" opacity="0.4" /></svg>
                </span>
              </div>
              <div class="ph-appbar">
                <span class="ph-back">‹</span>
                <b>Kyoto with friends</b>
                <span class="ph-faces sm"><i style="background:#edae49">KH</i><i style="background:#d1495b">AT</i><i style="background:#00798c">BL</i></span>
              </div>
            </div>

            <!-- The page inside: scrolls by itself, and you can scroll it too -->
            <div ref="phoneScroller" class="ph-scroll" @pointerenter="phoneHover = true" @pointerleave="phoneHover = false"
              @wheel.passive="pausePhone" @touchstart.passive="pausePhone">
              <div class="ph-hero">
                <span class="ph-hero-wx">⛅ 14° Kyoto</span>
                <div class="ph-hero-text"><small>KYOTO, JAPAN</small><b>7 days · 4 travellers</b></div>
              </div>
              <div class="ph-card">
                <b class="ph-title">Kyoto with friends<i class="ph-caret"></i></b>
                <div class="ph-meta">
                  <span>📅 19 – 26 Nov</span>
                  <span class="ph-faces"><i style="background:#edae49">KH</i><i style="background:#d1495b">AT</i><i style="background:#00798c">BL</i><i style="background:#66a182">GM</i></span>
                </div>
                <span class="ph-cursor c1"><svg viewBox="0 0 16 16" width="14" height="14"><path d="M1 1l13 5.5-5.6 1.6L6.8 14z" /></svg><em>Aisha</em></span>
              </div>

              <div class="ph-days"><b>Day 1</b><span>Day 2</span><span>Day 3</span><span>Day 4</span><span>Day 5</span></div>
              <div class="ph-dayhead">
                <div><b>Tue 19 Nov</b><small>4 stops · 7.2 km</small></div>
                <span class="ph-opt">✦ Optimize</span>
              </div>
              <template v-for="(t, n) in PHONE_STOPS" :key="t.name">
                <div class="ph-stop" :class="{ meal: t.meal }">
                  <span class="ph-thumb" :style="{ background: t.bg }">{{ t.icon }}</span>
                  <div class="ph-stop-text">
                    <small><b>{{ t.time }}</b> · {{ t.len }}</small>
                    <b>{{ t.name }}</b>
                    <span class="ph-chips"><i>{{ t.kind }}</i><i v-if="t.wx">{{ t.wx }}</i><i v-if="t.crowd" :class="t.crowd === 'Busy' ? 'busy' : 'quiet'">{{ t.crowd }}</i></span>
                  </div>
                </div>
                <div v-if="t.leg" class="ph-leg">{{ t.leg }}</div>
              </template>

              <div class="ph-sec-head"><b>Group decisions</b><small>2 group picks</small></div>
              <div v-for="v in VOTES" :key="v.name" class="ph-vote">
                <div class="ph-vote-top">
                  <b>{{ v.name }}</b>
                  <em v-if="v.yes >= 3" class="ph-pick">Group pick</em>
                  <span v-else class="ph-votebtn">Vote</span>
                </div>
                <div class="ph-vote-row">
                  <span class="ph-faces xs"><i v-for="f in v.faces" :key="f" :style="{ background: f }"></i></span>
                  <div class="ph-bar"><i :style="{ width: v.yes * 25 + '%' }" :class="{ pick: v.yes >= 3 }"></i></div>
                  <small>{{ v.yes }}/4</small>
                </div>
              </div>
              <div class="ph-cursor-wrap"><span class="ph-cursor c2"><svg viewBox="0 0 16 16" width="14" height="14"><path d="M1 1l13 5.5-5.6 1.6L6.8 14z" /></svg><em>Ben</em></span></div>

              <div class="ph-sec-head"><b>Packing</b><small>5 of 8 packed</small></div>
              <div class="ph-progress"><i style="width: 62%"></i></div>
              <div class="ph-group-label">Documents</div>
              <div class="ph-check"><span class="on">✓</span>Passport</div>
              <div class="ph-check"><span class="on">✓</span>JR Pass</div>
              <div class="ph-group-label">Clothes</div>
              <div class="ph-check"><span class="on">✓</span>Rain jacket</div>
              <div class="ph-check"><span></span>Warm layers</div>
              <div class="ph-check"><span></span>Walking shoes</div>

              <div class="ph-sec-head"><b>Expenses</b><small>Home: SGD</small></div>
              <div class="ph-tiles">
                <div><small>Total spent</small><b>S$1,284</b></div>
                <div class="owe"><small>You owe</small><b>S$19</b></div>
              </div>
              <div v-for="x in PHONE_COSTS" :key="x.name" class="ph-cost">
                <span class="ph-cost-icon">{{ x.icon }}</span>
                <div><b>{{ x.name }}</b><small>{{ x.who }}</small></div>
                <b class="ph-cost-amt">{{ x.amt }}</b>
              </div>
              <div class="ph-end"></div>
            </div>

            <!-- Fixed at the bottom: the tab bar and home bar -->
            <nav class="ph-nav">
              <span class="on"><svg viewBox="0 0 24 24"><rect x="3" y="5" width="18" height="16" rx="3" /><path d="M3 10h18M8 3v4M16 3v4" /></svg>Itinerary</span>
              <span><svg viewBox="0 0 24 24"><path d="M12 21s-7-6.2-7-11.5a7 7 0 0 1 14 0C19 14.8 12 21 12 21z" /><circle cx="12" cy="9.5" r="2.5" /></svg>Places</span>
              <span><svg viewBox="0 0 24 24"><rect x="5" y="7" width="14" height="14" rx="3" /><path d="M9 7V4h6v3M9 11v6M15 11v6" /></svg>Packing</span>
              <span><svg viewBox="0 0 24 24"><rect x="3" y="6" width="18" height="13" rx="3" /><path d="M16 12.5h2M3 10h18" /></svg>Expenses</span>
            </nav>
            <span class="ph-home"></span>
          </div>
          <span class="lp-phone-island"></span>
        </div>
      </div>

      <div class="lp-join-copy">
        <h2 id="lp-join-title">Join Chui-se Your Trip</h2>
        <p>Find where to go, decide with your friends, plan the days and split the costs, all in one app.</p>
        <div class="lp-join-actions">
          <router-link to="/discover" class="lp-join-btn">Start planning</router-link>
          <router-link to="/signup" class="lp-join-link">Create a free account <span aria-hidden="true">→</span></router-link>
        </div>
      </div>
    </section>

    <!-- ===== Footer: one last call to adventure, quick links and the expedition's status ===== -->
    <footer class="lp-foot" aria-labelledby="lp-foot-title">
      <svg class="lp-foot-ridge" viewBox="0 0 1440 110" preserveAspectRatio="none" aria-hidden="true">
        <path d="M0 110 L0 72 L110 44 L200 66 L330 20 L430 58 L560 34 L690 74 L820 28 L930 62 L1060 16 L1180 56 L1300 36 L1440 66 L1440 110 Z" />
      </svg>
      <div class="lp-foot-in">
        <div class="lp-foot-cta">
          <h2 id="lp-foot-title" class="lp-foot-title">Where to next?</h2>
          <p class="lp-foot-text">Pick a place, rally your crew and let the route draw itself.</p>
          <router-link to="/discover" class="lp-explore">Launch your next journey <span class="lp-arrow" aria-hidden="true">→</span></router-link>
        </div>

        <div class="lp-foot-grid">
          <div class="lp-foot-brand">
            <span class="lp-brand static"><span class="lp-brand-icon" aria-hidden="true"><DoodleIcon name="plane" :size="24" anim="" /></span><span class="lp-brand-text">CHUI-SE YOUR TRIP</span></span>
            <p>Plan together. Drift nowhere.</p>
          </div>
          <nav class="lp-foot-nav" aria-label="Quick links">
            <p class="lp-foot-head">Trailheads</p>
            <router-link to="/discover">Explore trips</router-link>
            <button type="button" @click="goToStep(0)">How it works</button>
            <button type="button" @click="scrollToFeat">Features</button>
            <router-link to="/login">Sign in</router-link>
            <router-link to="/signup">Create a free account</router-link>
          </nav>
          <div class="lp-foot-status">
            <p class="lp-foot-head">Expedition status</p>
            <ul>
              <li><span class="lp-dot green" aria-hidden="true"></span>Discover is open to guests</li>
              <li><span class="lp-dot amber" aria-hidden="true"></span>Crew planning with a free account</li>
              <li><span class="lp-dot teal" aria-hidden="true"></span>Weather and crowd tips in every itinerary</li>
            </ul>
          </div>
        </div>

        <div class="lp-foot-base">
          <small>© {{ year }} Chui-se Your Trip</small>
          <button type="button" class="lp-foot-top" @click="toTop">Back to the summit <span aria-hidden="true">↑</span></button>
        </div>
      </div>
    </footer>

    <AuthJoinModal :open="authOpen" :initial-tab="authTab" :initial-code="authCode" @close="authOpen = false" />
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'
import { useRoute } from 'vue-router'
import AuthJoinModal from '../components/AuthJoinModal.vue'
import DoodleIcon from '../components/DoodleIcon.vue'
import PlaneGuide from '../components/PlaneGuide.vue'

// Sign in / Join dialog. /welcome?auth=signin or ?code=XXXX opens it straight away (handy for links)
const route = useRoute()
const authOpen = ref(!!(route.query.auth || route.query.code))
const authTab = ref(route.query.auth === 'signin' ? 'signin' : 'join')
const authCode = ref(route.query.code ? String(route.query.code) : '')

// Fixed "random" numbers, so the embers look scattered but never jump between visits
function seeded(n) {
  const x = Math.sin(n * 9301 + 49297) * 233280
  return x - Math.floor(x)
}
// Embers rise from around the summit (at about x 1000-1080 in the photo)
const embers = []
for (let i = 0; i < 22; i++) {
  embers.push({ id: i, x: 990 + Math.round(seeded(i + 500) * 100), d: seeded(i + 600) * 9, t: 6 + seeded(i + 700) * 6, drift: 20 + Math.round(seeded(i + 800) * 120), s: 1 + seeded(i + 900) * 1.8 })
}
// ---------- tap the mountain: eruption ----------
const SUMMIT = { x: 1042, y: 262 } // the crater, in photo coordinates
const eruptions = ref([])
const shaking = ref(false)
let eruptionId = 0
const SPARK_COLOURS = ['#ffd27a', '#ffb35c', '#ff8a3d', '#ff6a2b', '#fff1c9']
function erupt() {
  if (reduceMotion) return // "reduce motion" is on: no explosions
  if (eruptions.value.length >= 3) return // enough fireworks at once
  const id = ++eruptionId
  const sparks = []
  for (let i = 0; i < 46; i++) {
    const angle = (-90 + (Math.random() - 0.5) * 110) * Math.PI / 180 // mostly upwards, fanning out
    const speed = 90 + Math.random() * 190
    sparks.push({
      id: i,
      x: (Math.random() - 0.5) * 30,
      dx: Math.round(Math.cos(angle) * speed),
      dy: Math.round(Math.sin(angle) * speed),
      fall: Math.round(120 + Math.random() * 160), // gravity pulls them back down
      r: (1.4 + Math.random() * 2.6).toFixed(1),
      c: SPARK_COLOURS[i % SPARK_COLOURS.length],
      t: (1.4 + Math.random() * 1.1).toFixed(2),
      d: (Math.random() * 0.35).toFixed(2)
    })
  }
  const smoke = []
  for (let i = 0; i < 7; i++) {
    smoke.push({ id: i, x: (Math.random() - 0.5) * 40, r: 16 + Math.random() * 14, dx: Math.round((Math.random() - 0.3) * 120), dy: -Math.round(120 + Math.random() * 120), d: (0.1 + i * 0.12).toFixed(2) })
  }
  eruptions.value.push({ id, sparks, smoke })
  if (!reduceMotion) {
    shaking.value = true
    setTimeout(() => { shaking.value = false }, 500)
  }
  setTimeout(() => { eruptions.value = eruptions.value.filter((e) => e.id !== id) }, 4600) // once the sparks and smoke are gone
}

// The route stops, where they sit in the photo
const nodes = [
  { id: 1, x: 612, y: 422, d: 0 }, { id: 2, x: 769, y: 561, d: 0.6 }, { id: 3, x: 922, y: 528, d: 1.2 },
  { id: 4, x: 1105, y: 463, d: 1.8 }, { id: 5, x: 1288, y: 507, d: 2.4 }, { id: 6, x: 1327, y: 335, d: 3 }
]

// Parallax: the mouse position, from -1 to 1 on each axis (each layer moves by its own depth)
const mx = ref(0)
const my = ref(0)
let reduceMotion = false
function onMove(e) {
  if (reduceMotion) return
  mx.value = ((e.clientX / window.innerWidth) * 2 - 1).toFixed(3)
  my.value = ((e.clientY / window.innerHeight) * 2 - 1).toFixed(3)
}

// ---------- the scroll story ----------
const STEPS = [
  { key: 'discover', label: 'Discover', title: 'Find where to go',
    text: 'Pick your dates, budget and vibe. Every city gets a match score, so the best fits rise to the top.',
    points: ['Best time to go, by month', 'Hidden gems, not just the famous ones', 'A 3D map of where you could be'] },
  { key: 'decide', label: 'Decide together', title: 'Everyone votes. The group decides.',
    text: 'Invite your friends, save places to one shared wishlist, and vote. Only group picks make it onto the plan.',
    points: ['Invite by link, WhatsApp or friends list', 'One tap to vote on everything', 'Majority wins, no endless group chat'] },
  { key: 'plan', label: 'Plan the days', title: 'A day that plans itself',
    text: 'Drag places onto a day. Travel times, meal breaks and the order of stops work themselves out.',
    points: ['Drag or tap arrows to reorder', 'Optimize route in one tap', 'Lock reservations to their time'] },
  { key: 'smart', label: 'Travel smart', title: 'Ready for rain, crowds and costs',
    text: 'Weather and crowd conditions help you adapt your plan, while shared expenses keep group spending organised.',
    points: ['Adapt activities when rain affects the plan', 'Go when it\'s quiet', 'Who owes who, in any currency'] }
]
const PILLARS = [
  { x: 30, y: 40, h: 58 }, { x: 46, y: 26, h: 34 }, { x: 62, y: 50, h: 46 }, { x: 76, y: 32, h: 28 },
  { x: 38, y: 68, h: 22 }, { x: 84, y: 64, h: 30 }, { x: 56, y: 78, h: 18 }, { x: 20, y: 60, h: 26 }
]
// Still used by the phone at the bottom
const VOTES = [
  { name: 'Fushimi Inari', yes: 4, faces: ['#edae49', '#d1495b', '#00798c', '#66a182'] },
  { name: 'Nishiki Market', yes: 3, faces: ['#edae49', '#d1495b', '#00798c'] },
  { name: 'Kyoto Tower', yes: 1, faces: ['#66a182'] }
]
// ---- what the 3D window shows ----
const URLS = ['discover', 'trip/kyoto/places', 'trip/kyoto/itinerary', 'trip/kyoto/today']
const NAV_TABS = ['Discover', 'Places', 'Itinerary', 'Today']
const DISCOVER_CITIES = [
  { name: 'Kyoto', score: 92, note: '✓ Great time to go', icon: '⛩️', bg: 'linear-gradient(160deg, #f6c7a0 0%, #d1495b 55%, #5b2a52 100%)' },
  { name: 'Kanazawa', score: 87, note: '~$85/day', icon: '🏯', gem: true, bg: 'linear-gradient(160deg, #cfe3f1 0%, #00798c 55%, #003d5b 100%)' }
]
const VOTE_ROWS = [
  { name: 'Fushimi Inari Shrine', icon: '⛩️', bg: 'linear-gradient(135deg, #f6c7a0, #d1495b)', yes: 4,
    people: [{ n: 'You', yes: true }, { n: 'Aisha', yes: true }, { n: 'Ben', yes: true }, { n: 'Mum', yes: true }] },
  { name: 'Nishiki Market', icon: '🛍️', bg: 'linear-gradient(135deg, #ffe2a6, #edae49)', yes: 3,
    people: [{ n: 'You', yes: true }, { n: 'Aisha', yes: true }, { n: 'Ben', yes: true }, { n: 'Mum', yes: false }] },
  { name: 'Kyoto Tower', icon: '🗼', bg: 'linear-gradient(135deg, #cfe3f1, #00798c)', yes: 1,
    people: [{ n: 'You', yes: false }, { n: 'Aisha', yes: false }, { n: 'Ben', yes: true }, { n: 'Mum', yes: false }] }
]
const PLAN_DAYS = [{ d: 'Tue 19', n: 4 }, { d: 'Wed 20', n: 3 }, { d: 'Thu 21', n: 5 }, { d: 'Fri 22', n: 2 }]
const PLAN_STOPS = [
  { num: 1, name: 'Fushimi Inari Shrine', time: '8:00 AM', len: '2 hrs', icon: '⛩️', color: '#00798c', bg: 'linear-gradient(135deg, #f6c7a0, #d1495b)', wx: '☀️ 12°', crowd: 'Quiet', leg: '🚆 18 min by train' },
  { name: 'Lunch break', time: '12:15 PM', len: '1 hr', icon: '🍜', color: '#edae49', bg: 'linear-gradient(135deg, #ffe2a6, #edae49)', meal: true },
  { num: 2, name: 'Nishiki Market', time: '1:15 PM', len: '1.5 hrs', icon: '🛍️', color: '#d1495b', bg: 'linear-gradient(135deg, #cfe3f1, #00798c)', wx: '⛅ 14°', crowd: 'Busy', leg: '🚶 9 min walk' },
  { num: 3, name: 'Gion at dusk', time: '5:30 PM', len: '2 hrs', icon: '🏮', color: '#003d5b', bg: 'linear-gradient(135deg, #f4a259, #5b2a52)', wx: '⛅ 11°', crowd: 'Quiet' }
]
const HOURS = [
  { t: '9 AM', icon: '☀️', temp: 12, rain: 0, now: true }, { t: '11 AM', icon: '🌤️', temp: 14, rain: 5 },
  { t: '1 PM', icon: '🌧️', temp: 13, rain: 70, wet: true }, { t: '3 PM', icon: '🌧️', temp: 12, rain: 85, wet: true },
  { t: '5 PM', icon: '🌦️', temp: 11, rain: 40, wet: true }, { t: '7 PM', icon: '☁️', temp: 9, rain: 10 }
]
const CROWD = [18, 26, 34, 52, 70, 86, 92, 80, 64, 48, 30, 20]
// pos: where the card floats (1 top-left, 2 right, 3 bottom-left); z: how far it sits in front of the window
const CHIPS = [
  { step: 0, pos: 1, z: 90, icon: '✓', text: 'Great time to go', sub: "November is one of Kyoto's best months" },
  { step: 0, pos: 3, z: 60, icon: '💎', text: '+3 hidden gems', sub: 'Kanazawa, Nara and Takayama' },
  { step: 1, pos: 2, z: 100, icon: '👍', text: 'Aisha voted yes', sub: 'Nishiki Market is now a group pick' },
  { step: 1, pos: 3, z: 70, icon: '🗳️', text: 'Your turn', sub: '3 places still need your vote' },
  { step: 2, pos: 1, z: 80, icon: '⠿', text: 'Drag to reorder', sub: 'or tap the arrows' },
  { step: 2, pos: 2, z: 110, icon: '⏱', text: 'Times re-worked', sub: 'Gion now starts at 5:30 PM' },
  { step: 3, pos: 2, z: 100, icon: '💸', text: 'You owe Aisha S$12', sub: 'Dinner in Gion · split 4' },
  { step: 3, pos: 3, z: 70, icon: '🛡️', text: 'No alerts nearby', sub: 'Checked 2 minutes ago' }
]
// Feature cards (only things the app really does)
const FEATURES = [
  { key: 'save', title: 'Save places in one tap',
    text: 'Every city comes with its popular sights ready to save. Or search any café, temple or street-food stall and add it to your wishlist.' },
  { key: 'split', title: 'Split costs without the maths',
    text: 'Log spending in any currency. Totals convert to your home currency, and the app works out who owes who.' },
  { key: 'together', title: 'Plan with your friends',
    text: 'Invite your crew by link or from your friends list. Saved places, votes and changes to the plan show up for everyone.' },
  { key: 'pack', title: 'Packing lists for your trip',
    text: 'Pick the weather and what you will be doing, and get a checklist to tick off. Add your own items too.' },
  { key: 'recs', title: 'Recommendations that fit you',
    text: 'Cities ranked for your dates, budget and vibe, quieter times for busy sights, and indoor swaps when rain is coming.' },
  { key: 'book', title: 'Bookings in one place',
    text: 'Save booked tours with their link and time. They lock onto the right day, so nothing gets planned over them.' }
]
// The cards come in when you scroll to them
const featEl = ref(null)
const featShown = ref(false)
let featWatcher = null
// Tilt a card toward the mouse (mouse only; phones just get the scroll-in animation)
function tilt(e) {
  if (reduceMotion || e.pointerType !== 'mouse') return
  const el = e.currentTarget
  const box = el.getBoundingClientRect()
  const x = (e.clientX - box.left) / box.width   // 0 left .. 1 right
  const y = (e.clientY - box.top) / box.height   // 0 top .. 1 bottom
  el.style.setProperty('--ry', ((x - 0.5) * 14).toFixed(2) + 'deg')
  el.style.setProperty('--rx', ((0.5 - y) * 10).toFixed(2) + 'deg')
  el.style.setProperty('--gx', (x * 100).toFixed(1) + '%')
  el.style.setProperty('--gy', (y * 100).toFixed(1) + '%')
  el.classList.add('hover')
}
// Click a card: reset its picture instantly, then let it animate again
function replay(e) {
  const card = e.currentTarget.closest('.lp-card')
  card.classList.add('replay')
  void card.offsetWidth // let the browser draw the reset state first
  card.classList.remove('replay')
  card.classList.remove('pop')
  void card.offsetWidth
  card.classList.add('pop')
}
function untilt(e) {
  const el = e.currentTarget
  el.style.setProperty('--ry', '0deg')
  el.style.setProperty('--rx', '0deg')
  el.classList.remove('hover')
}

// The window's pose for each step (turned left/right and tipped back); it glides between them as you scroll
const POSES = [
  { ry: -24, rx: 12, rz: 2 }, { ry: 20, rx: 8, rz: -2 }, { ry: -16, rx: 14, rz: 1 }, { ry: 22, rx: 6, rz: -1 }
]

const lpEl = ref(null)
const storyEl = ref(null)
const progress = ref(0) // 0 at the start of the story, 1 at the end
const step = computed(() => Math.min(STEPS.length - 1, Math.floor(progress.value * STEPS.length)))

function sceneClass(k) {
  return { on: step.value === k, past: step.value > k }
}
// Glide from this step's pose to the next one during the last third of each step, plus a little mouse tilt
const deviceStyle = computed(() => {
  const n = STEPS.length
  const at = Math.min(n - 1, progress.value * n)
  const k = Math.floor(at)
  const local = at - k
  const a = POSES[k]
  const b = POSES[Math.min(n - 1, k + 1)]
  let t = Math.max(0, (local - 0.66) / 0.34)
  t = t * t * (3 - 2 * t) // smooth start and finish
  const tilt = reduceMotion ? 0 : 1
  const ry = (a.ry + (b.ry - a.ry) * t) * tilt + mx.value * 6 * tilt
  const rx = (a.rx + (b.rx - a.rx) * t) * tilt - my.value * 4 * tilt
  const rz = (a.rz + (b.rz - a.rz) * t) * tilt
  return { transform: 'rotateX(' + rx.toFixed(2) + 'deg) rotateY(' + ry.toFixed(2) + 'deg) rotateZ(' + rz.toFixed(2) + 'deg)' }
})

let ticking = false
function onScroll() {
  if (ticking) return
  ticking = true
  requestAnimationFrame(() => {
    ticking = false
    const box = storyEl.value && lpEl.value ? storyEl.value.getBoundingClientRect() : null
    if (!box) return
    const room = storyEl.value.offsetHeight - lpEl.value.clientHeight
    progress.value = Math.max(0, Math.min(0.9999, -box.top / room))
    updateJoin()
  })
}
// ---------- the phone at the bottom ----------
const PHONE_STOPS = [
  { name: 'Fushimi Inari Shrine', time: '8:00 AM', len: '2 hrs', icon: '⛩️', bg: 'linear-gradient(135deg, #f6c7a0, #d1495b)', kind: 'Culture', wx: '☀️ 12°', crowd: 'Quiet', leg: '🚆 18 min by train' },
  { name: 'Lunch break', time: '12:15 PM', len: '1 hr', icon: '🍜', bg: 'linear-gradient(135deg, #ffe2a6, #edae49)', kind: 'Food', meal: true },
  { name: 'Nishiki Market', time: '1:15 PM', len: '1.5 hrs', icon: '🛍️', bg: 'linear-gradient(135deg, #cfe3f1, #00798c)', kind: 'Shopping', wx: '⛅ 14°', crowd: 'Busy', leg: '🚶 9 min walk' },
  { name: 'Gion at dusk', time: '5:30 PM', len: '2 hrs', icon: '🏮', bg: 'linear-gradient(135deg, #f4a259, #5b2a52)', kind: 'Sight', wx: '⛅ 11°', crowd: 'Quiet' }
]
const PHONE_COSTS = [
  { icon: '🍣', name: 'Dinner in Gion', who: 'Paid by Aisha · split 4', amt: '¥8,400' },
  { icon: '🚆', name: 'Kyoto ↔ Nara tickets', who: 'Paid by you · split 4', amt: '¥3,520' },
  { icon: '🏨', name: 'Machiya stay, 3 nights', who: 'Paid by Ben · split 4', amt: 'S$612' }
]
const joinEl = ref(null)
const joinP = ref(0) // 0 when the Join section peeks in, 1 once it's well in view
function updateJoin() {
  if (!joinEl.value || !lpEl.value) return
  const view = lpEl.value.clientHeight
  const box = joinEl.value.getBoundingClientRect()
  joinP.value = Math.max(0, Math.min(1, (view - box.top) / Math.min(box.height, view)))
}

// The phone's page scrolls by itself: slowly down, a pause, back up, a pause, again.
// Hovering pauses it; scrolling it yourself takes over for a few seconds, then it carries on from there.
const phoneScroller = ref(null)
const phoneHover = ref(false)
let phoneFrame = null
let phoneLast = 0
let phoneDir = 1
let phonePos = 0
let phoneHoldUntil = 0
let phonePauseUntil = 0
let phoneWatcher = null
function pausePhone() {
  phonePauseUntil = performance.now() + 3000
}
function phoneTick(now) {
  const el = phoneScroller.value
  if (!el) return
  const dt = phoneLast ? Math.min(50, now - phoneLast) : 16
  phoneLast = now
  if (phoneHover.value || now < phonePauseUntil) {
    phonePos = el.scrollTop // pick up from wherever it was left
  } else if (now >= phoneHoldUntil) {
    const max = el.scrollHeight - el.clientHeight
    phonePos += phoneDir * (phoneDir > 0 ? 0.06 : 0.25) * dt // px per ms: read going down, quick going back up
    if (phonePos >= max) {
      phonePos = max
      phoneDir = -1
      phoneHoldUntil = now + 1800
    } else if (phonePos <= 0) {
      phonePos = 0
      phoneDir = 1
      phoneHoldUntil = now + 1800
    }
    el.scrollTop = phonePos
  }
  phoneFrame = requestAnimationFrame(phoneTick)
}
function startPhone() {
  if (phoneFrame || reduceMotion) return
  phoneLast = 0
  phoneHoldUntil = performance.now() + 1200
  phoneFrame = requestAnimationFrame(phoneTick)
}
function stopPhone() {
  cancelAnimationFrame(phoneFrame)
  phoneFrame = null
}

// The phone turns to face you as it comes in
const phoneStyle = computed(() => {
  if (reduceMotion) return {}
  const turn = 1 - Math.min(1, joinP.value * 1.4)
  return { transform: 'rotateY(' + (-18 * turn).toFixed(2) + 'deg) rotateX(' + (8 * turn).toFixed(2) + 'deg) translateY(' + (40 * turn).toFixed(1) + 'px)' }
})

// Jump to a step (the dots, and "See how it works")
function goToStep(k) {
  const room = storyEl.value.offsetHeight - lpEl.value.clientHeight
  const top = storyEl.value.offsetTop + room * (k + 0.3) / STEPS.length
  lpEl.value.scrollTo({ top, behavior: reduceMotion ? 'auto' : 'smooth' })
}

// ---------- Campfire Briefing ----------
const BRIEF_TAGS = [
  { label: 'Food needs & allergies', icon: 'bowl', r: -2 },
  { label: 'WhatsApp number', icon: 'chat', r: 1.5 },
  { label: 'Base currency', icon: 'wallet', r: -1 },
  { label: 'Trip pacing', icon: 'boot', r: 2 }
]
// Tap Pip: he does a loop-the-loop, then floats again
const pipMood = ref('idle')
function pipHi() {
  if (pipMood.value === 'loop') return
  pipMood.value = 'loop'
  setTimeout(() => { pipMood.value = 'idle' }, 1200)
}

// ---------- footer ----------
const year = new Date().getFullYear()
function scrollToFeat() {
  featEl.value.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth' })
}
function toTop() {
  lpEl.value.scrollTo({ top: 0, behavior: reduceMotion ? 'auto' : 'smooth' })
}

// ---------- the plane ----------
// Two legs in photo coordinates: out (take off right, climb away left) and back (high and far, gliding down to land)
const LEGS = [
  { d: 'M1288 507 C 1200 470, 1120 400, 980 330 S 700 215, 480 165 S 120 95, -140 70', time: 16000, from: 0.35, to: 0.8 },
  { d: 'M-140 40 C 200 25, 560 50, 860 120 S 1220 260, 1327 335', time: 18000, from: 0.4, to: 0.6 }
]
const REST_TIME = 1500   // ms off screen between legs
const MAX_PITCH = 8      // degrees: airliners climb and descend gently
const trailEls = []
const planeEl = ref(null)
const imgEl = ref(null)
let frame = null
let startedAt = 0

function easeInOut(t) {
  return 0.5 - Math.cos(Math.PI * t) / 2 // slow start, cruise, slow finish
}
function pathFor(k) {
  return trailEls[k]
}
function flyPlane(now) {
  if (!planeEl.value || !trailEls[0] || !trailEls[1]) return
  if (!startedAt) startedAt = now
  const cycle = LEGS[0].time + LEGS[1].time + 2 * REST_TIME
  let elapsed = (now - startedAt) % cycle
  // Which leg are we on, and how far through it?
  let k = 0
  if (elapsed >= LEGS[0].time + REST_TIME) {
    k = 1
    elapsed -= LEGS[0].time + REST_TIME
  }
  const leg = LEGS[k]
  const path = pathFor(k)
  const total = path.getTotalLength()
  const flying = elapsed < leg.time
  const t = Math.min(1, elapsed / leg.time)
  const along = easeInOut(t) * total
  const here = path.getPointAtLength(along)
  const ahead = path.getPointAtLength(Math.min(total, along + 6))
  const behind = path.getPointAtLength(Math.max(0, along - 6))
  const goingLeft = k === 0
  // Heading from the path, then turned into a gentle nose-up / nose-down angle
  let angle = Math.atan2(ahead.y - behind.y, ahead.x - behind.x) * 180 / Math.PI
  if (goingLeft) angle = angle > 0 ? angle - 180 : angle + 180
  let pitch = goingLeft ? -angle : angle
  pitch = Math.max(-MAX_PITCH, Math.min(MAX_PITCH, pitch))
  const rot = goingLeft ? -pitch : pitch
  const bob = Math.sin(now / 900) * 1.2
  const sway = Math.sin(now / 1300) * 1.2
  const size = leg.from + (leg.to - leg.from) * t
  const fade = flying ? Math.min(1, t / 0.06, (1 - t) / 0.08) : 0
  imgEl.value.setAttribute('transform', goingLeft ? 'scale(-1,1)' : '')
  planeEl.value.setAttribute('transform', 'translate(' + here.x.toFixed(1) + ' ' + (here.y + bob).toFixed(1) + ') rotate(' + (rot + sway).toFixed(2) + ') scale(' + size.toFixed(3) + ')')
  planeEl.value.setAttribute('opacity', fade.toFixed(2))
  // Vapour trail: the stretch just behind the plane on this leg; the other leg's trail is hidden
  path.style.strokeDasharray = '110 ' + total
  path.style.strokeDashoffset = (110 - along).toFixed(1)
  path.setAttribute('opacity', (fade * Math.min(1, t * 5)).toFixed(2))
  pathFor(1 - k).setAttribute('opacity', '0')
  frame = requestAnimationFrame(flyPlane)
}

onMounted(() => {
  reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  document.body.classList.add('lp-body')
  // Feature cards: play their entrance once, when a quarter of the section is on screen
  if (window.IntersectionObserver && featEl.value) {
    featWatcher = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting) {
        featShown.value = true
        featWatcher.disconnect()
      }
    }, { root: lpEl.value, threshold: 0.15 })
    featWatcher.observe(featEl.value)
  } else {
    featShown.value = true
  }
  // The phone only scrolls while you can see it
  if (window.IntersectionObserver && joinEl.value) {
    phoneWatcher = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting) startPhone()
      else stopPhone()
    }, { root: lpEl.value, threshold: 0.2 })
    phoneWatcher.observe(joinEl.value)
  }
  onScroll() // in case the page opens part-way down
  window.addEventListener('resize', onScroll)
  if (reduceMotion) {
    // Still: just show the plane mid-flight
    const p = trailEls[0].getPointAtLength(trailEls[0].getTotalLength() * 0.55)
    imgEl.value.setAttribute('transform', 'scale(-1,1)')
    planeEl.value.setAttribute('transform', 'translate(' + p.x + ' ' + p.y + ') rotate(8)')
    planeEl.value.setAttribute('opacity', '1')
  } else {
    frame = requestAnimationFrame(flyPlane)
  }
})
onBeforeUnmount(() => {
  cancelAnimationFrame(frame)
  if (featWatcher) featWatcher.disconnect()
  if (phoneWatcher) phoneWatcher.disconnect()
  stopPhone()
  window.removeEventListener('resize', onScroll)
  document.body.classList.remove('lp-body')
})
</script>

<style scoped>
.lp {
  --mx: 0;
  --my: 0;
  position: fixed;
  inset: 0;
  overflow-x: hidden;
  overflow-y: auto; /* the page scrolls inside here: hero, then the story */
  background: #05080d;
  color: #fff;
  font-family: var(--sans); /* everything you read; the big titles use --hand */
}
/* The first screen: the night scene (everything in it is placed inside this box) */
.lp-hero {
  position: relative;
  height: var(--vh);
  overflow: hidden;
}
/* The photo is 1376 x 768. The stage is that shape, big enough to cover the screen (plus a little
   room for the mouse parallax), slid sideways so the focus point (--focus, 0-1 across the photo)
   sits mid-screen without ever leaving a gap at the edges. */
.lp {
  --vh: 100vh;
  --focus: 0.6;
}
@supports (height: 100dvh) {
  .lp { --vh: 100dvh; } /* phones: the visible height, not counting the address bar */
}
.lp-stage {
  --sw: calc(max(100vw, var(--vh) * 1.7917) * 1.04);
  --sh: calc(var(--sw) * 0.5581);
  position: absolute;
  width: var(--sw);
  height: var(--sh);
  left: clamp(calc(100vw - var(--sw)), calc(50vw - var(--sw) * var(--focus)), 0px);
  top: calc((var(--vh) - var(--sh)) / 2);
}
.lp-photo {
  position: absolute;
  inset: 0;
  background: #05080d url('../assets/landing-bg.jpg') center / 100% 100% no-repeat;
  transform: translate(calc(var(--mx) * -8px), calc(var(--my) * -5px));
  transition: transform 0.6s cubic-bezier(.2, .7, .2, 1);
}
.lp-scene {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
}
/* ----- Tap the mountain: eruption ----- */
.lp-volcano-hit {
  fill: transparent;
  cursor: pointer;
  pointer-events: all;
}
.lp-erupt-glow {
  fill: #ff8a3d;
  filter: blur(18px);
  transform-box: fill-box;
  transform-origin: center;
  animation: lp-flash 1.6s ease-out forwards;
  pointer-events: none;
}
@keyframes lp-flash {
  0% { opacity: 0; transform: scale(0.3); }
  15% { opacity: 0.9; transform: scale(1.2); }
  100% { opacity: 0; transform: scale(2); }
}
.lp-spark {
  opacity: 0;
  filter: drop-shadow(0 0 4px rgba(255, 140, 60, 0.95));
  animation-name: lp-spark;
  animation-timing-function: cubic-bezier(.2, .6, .4, 1);
  animation-fill-mode: forwards;
  pointer-events: none;
}
/* Up and out, then gravity pulls the spark back down as it cools */
@keyframes lp-spark {
  0% { opacity: 1; transform: translate(0, 0); }
  45% { opacity: 1; transform: translate(calc(var(--dx) * 0.7), var(--dy)); }
  100% { opacity: 0; transform: translate(var(--dx), calc(var(--dy) + var(--fall))); }
}
.lp-smoke {
  fill: #4f4a47;
  opacity: 0;
  filter: blur(16px);
  transform-box: fill-box;
  transform-origin: center;
  animation: lp-smoke 3.6s ease-out forwards;
  pointer-events: none;
}
@keyframes lp-smoke {
  0% { opacity: 0; transform: translate(0, 0) scale(0.5); }
  20% { opacity: 0.45; }
  100% { opacity: 0; transform: translate(var(--dx), var(--dy)) scale(3); }
}
/* A little rumble */
.lp-stage.shaking {
  animation: lp-shake 0.5s linear;
}
@keyframes lp-shake {
  0%, 100% { transform: translate(0, 0); }
  20% { transform: translate(-3px, 2px); }
  40% { transform: translate(3px, -2px); }
  60% { transform: translate(-2px, 1px); }
  80% { transform: translate(2px, -1px); }
}

/* Each layer drifts against the mouse by its depth: far layers barely, near layers more */
.lp-layer {
  transform: translate(calc(var(--mx) * var(--depth) * -1), calc(var(--my) * var(--depth) * -0.6));
  transition: transform 0.6s cubic-bezier(.2, .7, .2, 1);
}
/* Vapour trail: a short bright stretch of the flight path that travels with the plane */
/* The plane: sunset-lit body, shaded wings, dark windows, and small lights that blink like a real one */
.lp-plane {
  opacity: 0.92;
}
.lp-plane .hull { fill: url(#lp-hull); }
.lp-plane .wing { fill: url(#lp-wing); }
.lp-plane .shade { fill: #4b5560; }
.lp-plane .engine { fill: #6b737c; }
.lp-plane .glass { fill: #1d2b36; }
.lp-plane .windows {
  stroke: #2b3a46;
  stroke-width: 0.9;
  stroke-dasharray: 0.9 1.6;
  opacity: 0.55;
}
.lp-plane .nav.green { fill: #6dff9e; filter: drop-shadow(0 0 1.5px #6dff9e); }
.lp-plane .nav.red { fill: #ff5a5a; filter: drop-shadow(0 0 1.5px #ff5a5a); }
.lp-plane .strobe {
  fill: #ffffff;
  opacity: 0;
  animation: lp-strobe 1.4s linear infinite;
}
.lp-plane .beacon {
  fill: #ff4d4d;
  animation: lp-beacon 1.1s ease-in-out infinite;
}
@keyframes lp-strobe {
  0%, 6% { opacity: 1; }
  10%, 100% { opacity: 0; }
}
@keyframes lp-beacon {
  0%, 100% { opacity: 0.25; }
  50% { opacity: 1; }
}
.lp-route {
  fill: none;
  stroke: #edae49;
  stroke-width: 2;
  stroke-dasharray: 6 9;
  opacity: 0.75;
  animation: lp-dash 3s linear infinite;
}
@keyframes lp-dash {
  to { stroke-dashoffset: -60; }
}
.lp-node {
  fill: #edae49;
  filter: drop-shadow(0 0 6px #edae49);
  transform-box: fill-box;
  transform-origin: center;
  animation: lp-node 3.6s ease-in-out infinite;
}
@keyframes lp-node {
  50% { transform: scale(1.6); opacity: 0.6; }
}

/* Clouds */
.lp-clouds {
  position: absolute;
  inset: 0;
  pointer-events: none;
}
.lp-cloud {
  position: absolute;
  width: 220px;
  height: 60px;
  border-radius: 60px;
  background:
    radial-gradient(40px 34px at 30% 40%, rgba(255, 255, 255, 0.9), transparent 70%),
    radial-gradient(52px 40px at 55% 35%, rgba(255, 255, 255, 0.85), transparent 70%),
    radial-gradient(70px 30px at 50% 70%, rgba(220, 228, 236, 0.8), transparent 75%);
  filter: blur(2px);
  opacity: 0.7;
  animation: lp-cloud linear infinite;
}
.lp-cloud.c1 { top: 28%; animation-duration: 70s; animation-delay: -20s; }
.lp-cloud.c2 { top: 18%; transform: scale(0.7); opacity: 0.45; animation-duration: 95s; animation-delay: -60s; }
.lp-cloud.c3 { top: 36%; transform: scale(0.5); opacity: 0.35; animation-duration: 120s; animation-delay: -90s; }
@keyframes lp-cloud {
  from { left: 105%; }
  to { left: -30%; }
}

/* Embers rising from the summit (SVG circles, so they line up with the photo) */
.lp-ember {
  fill: #ffb35c;
  filter: drop-shadow(0 0 3px rgba(255, 140, 60, 0.9));
  opacity: 0;
  animation: lp-ember linear infinite;
}
@keyframes lp-ember {
  0% { transform: translate(0, 0); opacity: 0; }
  15% { opacity: 1; }
  100% { transform: translate(var(--drift), -200px); opacity: 0; }
}

/* Darkens the left so the title reads on any screen */
.lp-shade {
  position: absolute;
  inset: 0;
  pointer-events: none;
  background: linear-gradient(90deg, rgba(5, 8, 13, 0.85) 0%, rgba(5, 8, 13, 0.45) 40%, transparent 65%);
}

/* Brand */
.lp-brand {
  position: absolute;
  top: 28px;
  left: 40px;
  display: flex;
  align-items: center;
  gap: 10px;
  font-family: var(--sans);
  font-weight: 600;
  font-size: 22px;
  letter-spacing: 0.06em;
  color: #edae49;
  text-shadow: 0 0 18px rgba(237, 174, 73, 0.5);
}
.lp-compass {
  width: 38px;
  height: 38px;
  filter: drop-shadow(0 0 8px rgba(237, 174, 73, 0.7));
  animation: lp-spin 12s ease-in-out infinite;
}
@keyframes lp-spin {
  0%, 100% { transform: rotate(-8deg); }
  50% { transform: rotate(8deg); }
}

/* Title and actions */
.lp-content {
  position: absolute;
  left: 40px;
  bottom: 72px;
  max-width: 640px;
  transform: translate(calc(var(--mx) * 6px), calc(var(--my) * 4px));
  transition: transform 0.6s cubic-bezier(.2, .7, .2, 1);
}
/* The headline (hand lettering is set in the night theme further down) */
.lp-title {
  margin: 0;
  font-family: var(--sans);
  font-weight: 500;
  font-size: clamp(64px, 10vw, 150px);
  line-height: 0.92;
  letter-spacing: -0.03em;
  text-shadow: 0 4px 30px rgba(0, 0, 0, 0.55);
}
/* One word in italic, a soft champagne like the sunlit snow on the peak (calmer than the button gold) */
.lp-title .lp-accent {
  font-style: italic;
  color: #e6c99a;
  padding-left: 0.06em;
}
.lp-title span {
  display: block;
  width: fit-content;
  color: #f7f2e8;
  opacity: 0;
  animation: lp-rise 0.9s cubic-bezier(.2, .8, .2, 1) forwards;
}
.lp-title span:nth-child(2) { animation-delay: 0.12s; }
.lp-title span:nth-child(3) { animation-delay: 0.24s; }
@keyframes lp-rise {
  from { opacity: 0; transform: translateY(30px) rotate(-2deg); }
  to { opacity: 1; transform: none; }
}
.lp-tag {
  margin: 20px 0 40px;
  font-family: var(--sans); /* same as Sign in / Explore trips / See how it works */
  font-weight: 500;
  font-size: clamp(18px, 1.9vw, 24px);
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: rgba(255, 255, 255, 0.9);
  opacity: 0;
  animation: lp-rise 0.9s 0.45s cubic-bezier(.2, .8, .2, 1) forwards;
}
.lp-actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 28px;
  opacity: 0;
  animation: lp-rise 0.9s 0.6s cubic-bezier(.2, .8, .2, 1) forwards;
}
.lp-btn {
  font-family: var(--sans);
  font-weight: 500;
  font-size: 20px;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  text-decoration: none;
  color: #e9edf2;
  transition: color 0.2s, background 0.2s, border-color 0.2s, box-shadow 0.2s, transform 0.2s;
}
.lp-btn.primary {
  padding: 10px 30px;
  border: 1.5px solid rgba(255, 255, 255, 0.8);
  border-radius: 999px;
}
.lp-btn.primary:hover {
  border-color: #edae49;
  color: #edae49;
  box-shadow: 0 0 24px rgba(237, 174, 73, 0.35);
  transform: translateY(-2px);
}
.lp-btn.ghost {
  border: 0;
  background: none;
  padding: 0;
}
.lp-top-signin {
  position: absolute;
  top: 26px;
  right: 40px;
  z-index: 2;
  font-size: 26px;
  letter-spacing: 0.05em;
}
.lp-btn.ghost:hover {
  color: #edae49;
}
.lp-btn:focus-visible {
  outline: 3px solid rgba(237, 174, 73, 0.7);
  outline-offset: 4px;
  border-radius: 999px;
}

@media (max-width: 700px) {
  .lp { --focus: 0.74; } /* centre on the peak */
  .lp-brand { left: 20px; top: 20px; font-size: 18px; }
  .lp-compass { width: 32px; height: 32px; }
  .lp-top-signin { top: 20px; right: 20px; font-size: 20px; }
  .lp-content { left: 20px; right: 20px; bottom: 48px; }
  /* keep the mountain and routes clear; only darken behind the title */
  .lp-shade { background: linear-gradient(180deg, rgba(5, 8, 13, 0.15) 0%, rgba(5, 8, 13, 0) 30%, rgba(5, 8, 13, 0.3) 52%, rgba(5, 8, 13, 0.88) 72%); }
  .lp-clouds { opacity: 0.6; } /* softer clouds so the small sky doesn't look busy */
  .lp-actions { gap: 18px; }
  .lp-btn { font-size: 17px; }
}
/* Phones: the name goes on two short lines so it never runs into "Sign in / Join" */
@media (max-width: 520px) {
  .lp-brand { font-size: 15px; gap: 8px; }
  .lp-brand-text { display: flex; flex-direction: column; line-height: 1.1; }
  .lp-top-signin { font-size: 16px; }
}
/* Very narrow phones: logo and Sign in must share one line */
@media (max-width: 360px) {
  .lp-brand { font-size: 14px; gap: 6px; }
  .lp-compass { width: 28px; height: 28px; }
  .lp-top-signin { font-size: 15px; right: 16px; }
  .lp-title { font-size: 54px; }
}
/* Phones turned sideways: not much height, so everything gets shorter */
@media (max-height: 520px) and (orientation: landscape) {
  .lp { --focus: 0.62; }
  .lp-brand { top: 14px; }
  .lp-top-signin { top: 12px; }
  .lp-content { bottom: 18px; }
  .lp-title { font-size: clamp(34px, 13vh, 72px); }
  .lp-tag { margin: 6px 0 14px; font-size: 16px; }
  .lp-btn { font-size: 16px; }
  .lp-btn.primary { padding: 6px 22px; }
}
/* ===== "See how it works" ===== */
.lp-cue {
  position: absolute;
  left: 50%;
  bottom: 18px;
  z-index: 2;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  transform: translateX(-50%);
  border: 0;
  background: none;
  color: rgba(255, 255, 255, 0.85);
  font-family: var(--sans);
  font-size: 15px;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  cursor: pointer;
}
.lp-cue svg {
  animation: lp-bob 1.8s ease-in-out infinite;
}
.lp-cue:hover {
  color: #edae49;
}
.lp-cue:focus-visible {
  outline: 3px solid rgba(237, 174, 73, 0.7);
  outline-offset: 4px;
  border-radius: 8px;
}
@keyframes lp-bob {
  50% { transform: translateY(6px); }
}

/* ===== The scroll story ===== */
.lp-story {
  position: relative;
  background:
    radial-gradient(900px 600px at 75% 40%, rgba(0, 121, 140, 0.25), transparent 70%),
    radial-gradient(700px 500px at 15% 80%, rgba(237, 174, 73, 0.1), transparent 70%),
    linear-gradient(180deg, #05080d 0%, #001d2c 30%, #001d2c 80%, #05080d 100%);
}
.lp-sticky {
  position: sticky;
  top: 0;
  height: var(--vh);
  display: grid;
  grid-template-columns: minmax(300px, 0.9fr) minmax(0, 1.1fr);
  align-items: center;
  gap: 24px;
  padding: 0 72px 0 56px;
  overflow: hidden;
}

/* The words */
.lp-copy {
  position: relative;
  height: 360px;
}
.lp-step {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  justify-content: center;
  opacity: 0;
  transform: translateY(40px);
  transition: opacity 0.5s, transform 0.6s cubic-bezier(.2, .8, .2, 1);
  pointer-events: none;
}
.lp-step.past {
  transform: translateY(-40px);
}
.lp-step.on {
  opacity: 1;
  transform: none;
  pointer-events: auto;
}
.lp-step-num {
  font-family: var(--sans);
  font-size: 15px;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: #edae49;
}
.lp-step-title {
  margin: 10px 0 14px;
  font-family: var(--sans); /* same serif as the big hero title */
  font-weight: 500;
  letter-spacing: -0.02em;
  font-size: clamp(36px, 4.4vw, 60px);
  line-height: 1.05;
  color: #fff;
}
.lp-step-text {
  max-width: 460px;
  margin: 0 0 18px;
  font-size: 18px;
  line-height: 1.55;
  color: rgba(255, 255, 255, 0.78);
}
.lp-step-points {
  margin: 0;
  padding: 0;
  list-style: none;
  display: grid;
  gap: 8px;
}
.lp-step-points li {
  position: relative;
  padding-left: 26px;
  font-size: 15px;
  color: rgba(255, 255, 255, 0.88);
}
.lp-step-points li::before {
  content: '✓';
  position: absolute;
  left: 0;
  color: #edae49;
  font-weight: 700;
}

/* The 3D window */
.lp-3d {
  position: relative;
  height: 100%;
  display: grid;
  place-items: center;
  perspective: 1400px;
  --s: 1; /* overall size */
}
.lp-device {
  position: relative;
  width: 620px;
  height: 410px;
  scale: var(--s); /* smaller screens shrink the whole window, text included */
  transform-style: preserve-3d;
  transition: transform 0.25s ease-out;
  will-change: transform;
}
.lp-win {
  position: absolute;
  inset: 0;
  border-radius: 18px;
  overflow: hidden;
  background: #fbf5ea;
  box-shadow: 0 40px 80px rgba(0, 0, 0, 0.55), 0 0 0 1px rgba(255, 255, 255, 0.08);
  transform: translateZ(0);
}
.lp-win-bar {
  display: flex;
  align-items: center;
  gap: 6px;
  height: 30px;
  padding: 0 12px;
  background: #003d5b;
}
.lp-win-bar i {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: #d1495b;
}
.lp-win-bar i:nth-child(2) { background: #edae49; }
.lp-win-bar i:nth-child(3) { background: #66a182; }
.lp-win-body {
  position: relative;
  height: calc(100% - 66px); /* minus the browser bar and the app bar */
  perspective: 900px;
}
.lp-shadow {
  position: absolute;
  bottom: 12%;
  left: 50%;
  width: 60%;
  height: 40px;
  transform: translateX(-50%);
  background: radial-gradient(closest-side, rgba(0, 0, 0, 0.55), transparent);
  filter: blur(6px);
}

/* ===== Inside the 3D window: browser bar, the app's top bar, then the scene ===== */
.w-url {
  margin-left: 12px;
  padding: 3px 14px;
  border-radius: 7px;
  background: rgba(255, 255, 255, 0.12);
  color: rgba(255, 255, 255, 0.85);
  font-size: 11px;
}
.w-nav {
  display: flex;
  align-items: center;
  gap: 4px;
  height: 36px;
  padding: 0 12px;
  background: #001d2c;
  color: rgba(255, 255, 255, 0.7);
  font-size: 11.5px;
}
.w-logo {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-right: 12px;
  color: #edae49;
  font-weight: 800;
}
.w-tab {
  padding: 4px 10px;
  border-radius: 999px;
  font-weight: 600;
  transition: background 0.3s, color 0.3s;
}
.w-tab.on {
  background: rgba(237, 174, 73, 0.16);
  color: #edae49;
}
.w-faces {
  display: flex;
  margin-left: auto;
}
.w-faces i {
  width: 22px;
  height: 22px;
  margin-left: -6px;
  display: grid;
  place-items: center;
  border: 2px solid #001d2c;
  border-radius: 50%;
  color: #fff;
  font-size: 8px;
  font-style: normal;
  font-weight: 700;
}
.w-chip {
  padding: 4px 10px;
  border-radius: 999px;
  background: #efe6d6;
  font-size: 10.5px;
  font-weight: 600;
  white-space: nowrap;
}
.w-chip.gold {
  background: #edae49;
  font-weight: 700;
}
.w-seg {
  display: inline-flex;
  padding: 2px;
  border-radius: 999px;
  background: #efe6d6;
  font-size: 10.5px;
  font-weight: 700;
}
.w-seg i {
  padding: 2px 8px;
  border-radius: 999px;
  font-style: normal;
  color: #5b6b75;
}
.w-seg i.on {
  background: #edae49;
  color: #001d2c;
}
.w-search {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-top: 8px;
  padding: 7px 10px;
  border-radius: 10px;
  background: #fbf5ea;
  border: 1px solid #e8dfcf;
  color: #8a959c;
  font-size: 11px;
}
.w-search span {
  flex: 1;
}
.w-search kbd {
  padding: 0 5px;
  border: 1px solid #e8dfcf;
  border-radius: 4px;
  font-family: inherit;
  font-size: 10px;
}
.w-score {
  padding: 2px 8px;
  border-radius: 999px;
  background: #001d2c;
  color: #edae49;
  font-size: 11px;
  font-weight: 800;
}
.w-thumb {
  flex: none;
  width: 42px;
  height: 42px;
  display: grid;
  place-items: center;
  border-radius: 10px;
  font-size: 19px;
}
.w-thumb.sm {
  width: 34px;
  height: 34px;
  border-radius: 8px;
  font-size: 16px;
}

/* Scenes: the new one swings in, the old one tips away */
.sc {
  position: absolute;
  inset: 0;
  padding: 12px 14px;
  color: #001d2c;
  font-size: 11.5px;
  line-height: 1.35;
  opacity: 0;
  transform: rotateX(-18deg) translateY(30px) scale(0.96);
  transform-origin: 50% 100%;
  transition: opacity 0.45s, transform 0.6s cubic-bezier(.2, .8, .2, 1);
}
.sc.past {
  transform: rotateX(18deg) translateY(-30px) scale(0.96);
  transform-origin: 50% 0%;
}
.sc.on {
  opacity: 1;
  transform: none;
}
.sc small {
  color: #5b6b75;
}
.sc-bar {
  height: 6px;
  border-radius: 999px;
  background: #efe6d6;
  overflow: hidden;
}
.sc-bar.dark {
  background: rgba(255, 255, 255, 0.15);
}
.sc-bar span {
  display: block;
  height: 100%;
  border-radius: 999px;
  background: #00798c;
  transform: scaleX(0);
  transform-origin: left;
  transition: transform 0.9s cubic-bezier(.2, .8, .2, 1) var(--d, 0.2s);
}
.sc-bar.dark span {
  background: #edae49;
}
.sc-bar span.pick {
  background: #66a182;
}
.sc.on .sc-bar span {
  transform: scaleX(1);
}

/* 1. Discover */
.sc-discover {
  display: grid;
  grid-template-columns: 1.05fr 1fr;
  gap: 12px;
}
.d-filters {
  display: flex;
  align-items: center;
  gap: 6px;
}
.d-country {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin: 10px 0 8px;
}
.d-country b,
.d-country small {
  display: block;
}
.d-country b {
  font-size: 14px;
}
.d-country small {
  font-size: 10px;
}
.d-cities {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
}
.d-city {
  position: relative;
  height: 152px;
  border-radius: 14px;
  overflow: hidden;
  color: #fff;
  box-shadow: 0 6px 16px rgba(0, 29, 44, 0.18);
}
.d-art {
  position: absolute;
  top: 34%;
  left: 50%;
  transform: translate(-50%, -50%);
  font-size: 44px;
  filter: drop-shadow(0 6px 10px rgba(0, 0, 0, 0.3));
}
.d-city::after {
  content: '';
  position: absolute;
  inset: 45% 0 0;
  background: linear-gradient(180deg, transparent, rgba(0, 29, 44, 0.85));
}
.d-heart {
  position: absolute;
  top: 8px;
  right: 8px;
  z-index: 1;
  width: 24px;
  height: 24px;
  display: grid;
  place-items: center;
  border-radius: 50%;
  background: rgba(0, 29, 44, 0.45);
  font-size: 11px;
}
.d-gem {
  position: absolute;
  top: 9px;
  left: 8px;
  z-index: 1;
  padding: 2px 7px;
  border-radius: 999px;
  background: rgba(0, 29, 44, 0.6);
  color: #edae49;
  font-size: 9px;
  font-style: normal;
  font-weight: 700;
}
.d-city-text {
  position: absolute;
  left: 10px;
  right: 10px;
  bottom: 9px;
  z-index: 1;
}
.d-city-text small {
  color: rgba(255, 255, 255, 0.8);
  font-size: 9.5px;
}
.d-city-text small b {
  color: #edae49;
  font-size: 11px;
}
.d-city-text > b {
  display: block;
  font-family: var(--sans);
  font-size: 19px;
  font-weight: 500;
  line-height: 1.1;
}
.d-city-text span {
  font-size: 9.5px;
  font-weight: 700;
  color: #ffe1a1;
}
/* The map: a dark panel with a tilted ground and gold pillars that grow */
.d-map {
  position: relative;
  border-radius: 14px;
  overflow: hidden;
  perspective: 500px;
  background: radial-gradient(220px 160px at 50% 40%, rgba(0, 121, 140, 0.35), transparent 70%), #0b2a3c;
}
.sc-plane {
  position: absolute;
  left: 6%;
  right: 6%;
  top: 70px;
  height: 230px;
  transform: rotateX(56deg);
  transform-style: preserve-3d;
  border-radius: 12px;
  background:
    repeating-linear-gradient(0deg, rgba(255, 255, 255, 0.05) 0 1px, transparent 1px 22px),
    repeating-linear-gradient(90deg, rgba(255, 255, 255, 0.05) 0 1px, transparent 1px 22px),
    #0e4a6b;
}
.d-land {
  position: absolute;
  border-radius: 46% 54% 40% 60%;
  background: #3f6f63;
  opacity: 0.85;
}
.d-land.l1 { left: 14%; top: 20%; width: 42%; height: 40%; }
.d-land.l2 { left: 52%; top: 40%; width: 36%; height: 34%; }
.d-land.l3 { left: 30%; top: 66%; width: 30%; height: 22%; }
.sc-pillar {
  position: absolute;
  width: 12px;
  height: 12px;
  border-radius: 50%;
  background: #edae49;
  box-shadow: 0 0 10px rgba(237, 174, 73, 0.8);
  transform-style: preserve-3d;
}
.sc-pillar.low {
  background: #c98a3a;
}
.sc-pillar::before {
  content: '';
  position: absolute;
  left: 2px;
  bottom: 6px;
  width: 8px;
  height: 0;
  border-radius: 4px 4px 0 0;
  background: linear-gradient(180deg, #ffe1a1, #edae49 60%, #c98a3a);
  transform-origin: 50% 100%;
  transform: rotateX(-90deg);
  transition: height 0.7s cubic-bezier(.2, .8, .2, 1) var(--d);
}
.sc.on .sc-pillar::before {
  height: var(--h);
}
.d-pin {
  position: absolute;
  left: 26%;
  top: 46px;
  padding: 3px 8px;
  border-radius: 8px;
  background: #fbf5ea;
  font-size: 10px;
  font-weight: 800;
  box-shadow: 0 6px 14px rgba(0, 0, 0, 0.3);
}
.d-pin::after {
  content: '';
  position: absolute;
  left: 14px;
  bottom: -5px;
  border: 5px solid transparent;
  border-top-color: #fff;
  border-bottom: 0;
}
.d-zoom {
  position: absolute;
  top: 8px;
  right: 8px;
  display: grid;
  border-radius: 8px;
  overflow: hidden;
  background: rgba(0, 29, 44, 0.75);
  color: #fff;
  font-size: 12px;
}
.d-zoom i {
  width: 22px;
  height: 20px;
  display: grid;
  place-items: center;
  font-style: normal;
}
.d-legend {
  position: absolute;
  left: 8px;
  bottom: 8px;
  padding: 2px 8px;
  border-radius: 999px;
  background: rgba(0, 29, 44, 0.75);
  color: rgba(255, 255, 255, 0.85);
  font-size: 9.5px;
}

/* 2. Votes */
.v-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  margin-bottom: 8px;
}
.v-head b,
.v-head small {
  display: block;
}
.v-head b {
  font-family: var(--sans);
  font-size: 18px;
  font-weight: 500;
}
.v-quick {
  display: grid;
  grid-template-columns: auto 1fr auto;
  align-items: center;
  gap: 12px;
  margin-bottom: 8px;
  padding: 9px 12px;
  border-radius: 12px;
  background: #001d2c;
  color: #fff;
}
.v-quick b,
.v-quick small {
  display: block;
}
.v-quick small {
  color: rgba(255, 255, 255, 0.7);
  font-size: 10px;
}
.v-yes {
  padding: 5px 11px;
  border-radius: 999px;
  background: #edae49;
  color: #001d2c;
  font-weight: 800;
  font-size: 10.5px;
}
.v-row {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 6px;
  padding: 7px 10px;
  border-radius: 12px;
  background: #fbf5ea;
  box-shadow: 0 2px 8px rgba(0, 29, 44, 0.07);
}
.v-main {
  flex: 1;
  min-width: 0;
}
.v-top {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 4px;
}
.v-pick {
  padding: 1px 7px;
  border-radius: 999px;
  background: #66a182;
  color: #fff;
  font-size: 9px;
  font-style: normal;
  font-weight: 700;
}
.v-people {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}
.v-person {
  padding: 1px 7px;
  border-radius: 999px;
  border: 1px dashed #c9c2b5;
  color: #8a959c;
  font-size: 9.5px;
  font-weight: 600;
}
.v-person.yes {
  border: 1px solid #00798c;
  background: #e1f0f2;
  color: #00596a;
}
.v-person.me {
  border-width: 1.5px;
}
.v-count {
  flex: none;
  width: 70px;
  display: grid;
  gap: 3px;
  text-align: right;
}

/* 3. Plan */
.sc-plan {
  display: grid;
  grid-template-columns: 1.35fr 1fr;
  gap: 12px;
}
.p-days {
  display: flex;
  gap: 5px;
  margin-bottom: 6px;
}
.p-day {
  padding: 4px 9px;
  border-radius: 10px;
  background: #efe6d6;
  text-align: center;
}
.p-day b,
.p-day small {
  display: block;
}
.p-day b {
  font-size: 10.5px;
}
.p-day small {
  font-size: 9px;
}
.p-day.on {
  background: #001d2c;
  color: #fff;
}
.p-day.on small {
  color: #edae49;
}
.p-status {
  display: flex;
  justify-content: space-between;
  margin-bottom: 6px;
  padding: 5px 9px;
  border-radius: 8px;
  background: #e3efe8;
  color: #2f6f4f;
  font-size: 10px;
  font-weight: 700;
}
.p-status span {
  color: #00798c;
  text-decoration: underline;
}
.sc-stop {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 8px;
  border-radius: 12px;
  background: #fbf5ea;
  box-shadow: 0 2px 8px rgba(0, 29, 44, 0.07);
  opacity: 0;
  transform: translateX(40px);
  transition: opacity 0.4s var(--d), transform 0.6s cubic-bezier(.2, .8, .2, 1) var(--d);
}
.sc.on .sc-stop {
  opacity: 1;
  transform: none;
}
.sc-stop.meal {
  background: #fdf3e0;
  border: 1px dashed #edae49;
  box-shadow: none;
}
.p-num {
  flex: none;
  width: 20px;
  height: 20px;
  display: grid;
  place-items: center;
  border-radius: 50%;
  color: #fff;
  font-size: 9.5px;
  font-weight: 800;
}
.p-text {
  flex: 1;
  min-width: 0;
}
.p-text small {
  display: block;
  font-size: 9.5px;
}
.p-text small b {
  color: #001d2c;
}
.p-text > b {
  display: block;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.p-chips {
  display: flex;
  gap: 4px;
  margin-top: 2px;
}
.p-chips i {
  padding: 0 6px;
  border-radius: 999px;
  background: #efe6d6;
  font-size: 9px;
  font-style: normal;
  font-weight: 600;
}
.p-chips i.quiet { background: #dcefe4; color: #2f6f4f; }
.p-chips i.busy { background: #fbe3c4; color: #8a5a12; }
.p-grip {
  color: #b9b2a6;
  font-size: 12px;
}
.p-leg {
  margin: 1px 0 1px 9px;
  padding-left: 18px;
  border-left: 2px dotted #c9c2b5;
  color: #5b6b75;
  font-size: 9.5px;
  line-height: 17px;
}
.p-map {
  position: relative;
  border-radius: 14px;
  overflow: hidden;
  background:
    linear-gradient(90deg, rgba(0, 29, 44, 0.04) 1px, transparent 1px) 0 0 / 24px 24px,
    linear-gradient(0deg, rgba(0, 29, 44, 0.04) 1px, transparent 1px) 0 0 / 24px 24px,
    radial-gradient(90px 70px at 70% 70%, #dcebd8, transparent 70%),
    #eef3ee;
}
.p-map svg {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
}
.p-river {
  fill: none;
  stroke: #b9d9ea;
  stroke-width: 10;
}
.p-route {
  fill: none;
  stroke: #00798c;
  stroke-width: 4;
  stroke-linecap: round;
  stroke-dasharray: 400;
  stroke-dashoffset: 400;
  transition: stroke-dashoffset 1.4s 0.3s cubic-bezier(.2, .8, .2, 1);
}
.sc.on .p-route {
  stroke-dashoffset: 0;
}
.p-pin {
  position: absolute;
  width: 22px;
  height: 22px;
  margin: -11px 0 0 -11px;
  display: grid;
  place-items: center;
  border: 2px solid #fff;
  border-radius: 50% 50% 50% 0;
  transform: rotate(-45deg);
  color: #fff;
  font-size: 10px;
  font-weight: 800;
  box-shadow: 0 4px 10px rgba(0, 29, 44, 0.3);
}
.p-pin i {
  font-style: normal;
  transform: rotate(45deg); /* the pin is turned; the number stays upright */
}
.p-map-foot {
  position: absolute;
  left: 8px;
  right: 8px;
  bottom: 8px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 6px;
  padding: 6px 8px;
  border-radius: 10px;
  background: #fbf5ea;
  font-size: 9.5px;
  box-shadow: 0 4px 12px rgba(0, 29, 44, 0.12);
}
.p-map-foot b {
  padding: 3px 8px;
  border-radius: 999px;
  background: #00798c;
  color: #fff;
  font-size: 9.5px;
}

/* 4. Today */
.t-hours {
  display: grid;
  grid-template-columns: repeat(6, 1fr);
  gap: 6px;
  margin-bottom: 8px;
}
.t-hour {
  position: relative;
  display: grid;
  justify-items: center;
  gap: 1px;
  padding: 6px 2px 10px;
  border-radius: 12px;
  background: #fbf5ea;
  overflow: hidden;
}
.t-hour span {
  font-size: 18px;
}
.t-hour.wet {
  background: #e6eff5;
}
.t-hour.now {
  background: #001d2c;
  color: #fff;
}
.t-hour.now small {
  color: #edae49;
  font-weight: 700;
}
.t-hour i {
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  max-height: 6px;
  background: #00798c;
  opacity: 0.6;
}
.t-alert {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 8px;
  padding: 9px 12px;
  border-radius: 12px;
  background: #fdf3e0;
  border: 1px solid #f1d29a;
}
.t-alert-text {
  flex: 1;
}
.t-alert-text b,
.t-alert-text small {
  display: block;
}
.t-alert-text small {
  font-size: 10px;
}
.t-swap {
  display: flex;
  align-items: center;
  gap: 5px;
}
.t-arrow {
  color: #c98a3a;
  font-weight: 800;
}
.t-swap em {
  margin-left: 4px;
  padding: 5px 11px;
  border-radius: 999px;
  background: #001d2c;
  color: #fff;
  font-size: 10.5px;
  font-style: normal;
  font-weight: 700;
}
.t-row {
  display: grid;
  grid-template-columns: 1.4fr 1fr;
  gap: 8px;
}
.t-card {
  padding: 9px 11px;
  border-radius: 12px;
  background: #fbf5ea;
  box-shadow: 0 2px 8px rgba(0, 29, 44, 0.07);
}
.t-card-head {
  display: flex;
  justify-content: space-between;
  margin-bottom: 6px;
}
.t-card-head .quiet {
  padding: 0 7px;
  border-radius: 999px;
  background: #dcefe4;
  color: #2f6f4f;
  font-size: 9.5px;
  font-weight: 700;
}
.t-bars {
  display: flex;
  align-items: flex-end;
  gap: 3px;
  height: 46px;
}
.t-bars i {
  flex: 1;
  border-radius: 3px 3px 0 0;
  background: #cfe3e6;
  transform: scaleY(0);
  transform-origin: bottom;
  transition: transform 0.6s cubic-bezier(.2, .8, .2, 1) var(--d);
}
.t-bars i.now {
  background: #00798c;
}
.sc.on .t-bars i {
  transform: scaleY(1);
}
.t-axis {
  display: flex;
  justify-content: space-between;
  margin-top: 3px;
}
.t-axis small {
  font-size: 8.5px;
}
.t-next {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-top: 8px;
  padding: 7px 10px;
  border-radius: 12px;
  background: #fbf5ea;
  box-shadow: 0 2px 8px rgba(0, 29, 44, 0.07);
}
.t-next div {
  flex: 1;
}
.t-next small,
.t-next b {
  display: block;
}
.t-go {
  padding: 4px 10px;
  border-radius: 999px;
  background: #e1f0f2;
  color: #00596a;
  font-size: 10px;
  font-weight: 700;
}
.t-card.money {
  display: grid;
  align-content: start;
  gap: 1px;
  background: #001d2c;
  color: #fff;
}
.t-card.money small,
.t-card.money span {
  color: rgba(255, 255, 255, 0.7);
  font-size: 10px;
}
.t-card.money b {
  font-family: var(--sans);
  font-size: 24px;
  font-weight: 500;
  color: #edae49;
}
.t-card.money em {
  justify-self: start;
  margin-top: 6px;
  padding: 3px 10px;
  border-radius: 999px;
  background: #edae49;
  color: #001d2c;
  font-size: 10px;
  font-style: normal;
  font-weight: 800;
}

/* Floating notification cards: in front of the window (translateZ), so they shift more as it turns */
.lp-chip {
  position: absolute;
  display: flex;
  align-items: center;
  gap: 10px;
  max-width: 260px;
  padding: 10px 14px 10px 10px;
  border-radius: 16px;
  background: rgba(255, 255, 255, 0.97);
  color: #001d2c;
  box-shadow: 0 18px 40px rgba(0, 0, 0, 0.35), 0 0 0 1px rgba(0, 29, 44, 0.06);
  opacity: 0;
  transform: translateZ(0) scale(0.8);
  transition: opacity 0.4s, transform 0.6s cubic-bezier(.2, .8, .2, 1);
}
.lp-chip b,
.lp-chip small {
  display: block;
  white-space: nowrap;
}
.lp-chip b {
  font-size: 13.5px;
}
.lp-chip small {
  color: #5b6b75;
  font-size: 11px;
}
.lp-chip-icon {
  flex: none;
  display: grid;
  place-items: center;
  width: 32px;
  height: 32px;
  border-radius: 10px;
  background: #edae49;
  font-size: 15px;
  font-weight: 800;
}
.lp-chip.on {
  opacity: 1;
  transform: translateZ(var(--z)) scale(1);
  transition-delay: 0.25s;
}
.lp-chip.pos1 { top: -30px; left: -48px; }
.lp-chip.pos2 { top: 34%; right: -70px; }
.lp-chip.pos3 { bottom: -26px; left: 6%; }

/* Step dots */
.lp-dots {
  position: absolute;
  right: 24px;
  top: 50%;
  display: grid;
  gap: 12px;
  transform: translateY(-50%);
}
.lp-dot {
  width: 12px;
  height: 12px;
  padding: 0;
  border: 2px solid rgba(255, 255, 255, 0.5);
  border-radius: 50%;
  background: transparent;
  cursor: pointer;
  transition: background 0.2s, border-color 0.2s, transform 0.2s;
}
.lp-dot.on {
  border-color: #edae49;
  background: #edae49;
  transform: scale(1.25);
}
.lp-dot:focus-visible {
  outline: 3px solid rgba(237, 174, 73, 0.7);
  outline-offset: 3px;
}

/* ===== The end ===== */
/* ===== Join: phone on the left, words and buttons on the right ===== */
.lp-join {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
  align-items: center;
  gap: 64px;
  max-width: 1180px;
  margin: 0 auto;
  padding: 100px 40px 90px;
}
.lp-join-art {
  position: relative;
  height: 680px;
  border-radius: 32px;
  overflow: hidden;
  background:
    radial-gradient(420px 300px at 50% 30%, rgba(237, 174, 73, 0.18), transparent 70%),
    linear-gradient(180deg, #0b3550, #003d5b);
  border: 1px solid rgba(255, 255, 255, 0.08);
  perspective: 1200px;
}
.lp-phone {
  position: absolute;
  left: 50%;
  top: 40px;
  width: 300px;
  height: 600px; /* the whole phone shows, tab bar included */
  margin-left: -150px;
  padding: 12px;
  border-radius: 48px;
  background: #00283c;
  box-shadow: 0 0 0 2px #2b3440, 0 40px 80px rgba(0, 0, 0, 0.5);
  transition: transform 0.2s ease-out;
}
.lp-phone-island {
  position: absolute;
  top: 22px;
  left: 50%;
  width: 92px;
  height: 26px;
  margin-left: -46px;
  border-radius: 999px;
  background: #00283c;
}
.lp-phone-screen {
  position: relative;
  height: 100%;
  border-radius: 38px;
  overflow: hidden;
  background: #fbf5ea;
}
/* ===== The trip page inside the phone ===== */
.lp-phone-screen {
  display: flex;
  flex-direction: column;
  color: #001d2c;
  font-size: 11.5px;
  line-height: 1.35;
}
.ph-top {
  position: relative;
  z-index: 3;
  background: #001d2c;
  color: #fff;
}
.ph-status {
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: 44px;
  padding: 4px 26px 0 30px;
  font-size: 13px;
}
.ph-sys {
  display: flex;
  align-items: center;
  gap: 5px;
}
.ph-sys svg {
  fill: currentColor;
}
.ph-appbar {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 4px 14px 10px;
}
.ph-appbar b {
  flex: 1;
  font-size: 14px;
}
.ph-back {
  font-size: 22px;
  line-height: 1;
  color: #edae49;
}
.ph-scroll {
  position: relative;
  flex: 1;
  overflow-y: auto;
  overscroll-behavior: contain;
  scrollbar-width: none;
}
.ph-scroll::-webkit-scrollbar {
  display: none;
}
.ph-hero {
  position: relative;
  height: 150px;
  background: linear-gradient(180deg, rgba(0, 29, 44, 0) 40%, rgba(0, 29, 44, 0.75)), url('../assets/landing-bg.jpg') 70% 40% / cover no-repeat, #003d5b;
}
.ph-hero-wx {
  position: absolute;
  top: 10px;
  right: 10px;
  padding: 3px 8px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.9);
  font-size: 10.5px;
  font-weight: 700;
}
.ph-hero-text {
  position: absolute;
  left: 14px;
  bottom: 52px;
  color: #fff;
}
.ph-hero-text small {
  display: block;
  font-size: 9.5px;
  letter-spacing: 0.12em;
  opacity: 0.85;
}
.ph-card {
  position: relative;
  margin: -42px 12px 0;
  padding: 12px 14px;
  border-radius: 16px;
  background: #fbf5ea;
  box-shadow: 0 10px 24px rgba(0, 29, 44, 0.14);
}
.ph-title {
  display: block;
  font-size: 17px;
}
.ph-caret {
  display: inline-block;
  width: 2px;
  height: 17px;
  margin-left: 2px;
  vertical-align: -3px;
  background: #00798c;
  animation: ph-blink 1s steps(1) infinite;
}
@keyframes ph-blink {
  50% { opacity: 0; }
}
.ph-meta {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: 8px;
  color: #5b6b75;
}
.ph-faces {
  display: flex;
}
.ph-faces i {
  width: 24px;
  height: 24px;
  margin-left: -6px;
  display: grid;
  place-items: center;
  border: 2px solid #fff;
  border-radius: 50%;
  color: #fff;
  font-size: 8px;
  font-style: normal;
  font-weight: 700;
}
.ph-faces.sm i {
  width: 22px;
  height: 22px;
  border-color: #001d2c;
}
.ph-faces.xs i {
  width: 16px;
  height: 16px;
  margin-left: -5px;
  border-width: 1.5px;
}
/* Friends' cursors: arrow + name, drifting */
.ph-cursor {
  position: absolute;
  z-index: 2;
  display: flex;
  align-items: flex-start;
  pointer-events: none;
  animation: ph-drift 6s ease-in-out infinite;
}
.ph-cursor svg {
  fill: var(--c);
  stroke: #fff;
  stroke-width: 1.2;
}
.ph-cursor em {
  margin: 10px 0 0 -2px;
  padding: 2px 8px;
  border-radius: 6px;
  background: var(--c);
  color: #fff;
  font-size: 10.5px;
  font-style: normal;
  font-weight: 700;
  box-shadow: 0 4px 10px rgba(0, 0, 0, 0.18);
}
.ph-cursor.c1 { --c: #00798c; right: 18px; bottom: -22px; }
.ph-cursor-wrap { position: relative; height: 0; }
.ph-cursor.c2 { --c: #d1495b; left: 46%; top: -86px; animation-delay: -3s; }
@keyframes ph-drift {
  0%, 100% { transform: translate(0, 0); }
  35% { transform: translate(-16px, 6px); }
  70% { transform: translate(8px, -6px); }
}
.ph-days {
  display: flex;
  gap: 6px;
  margin: 18px 12px 0;
  overflow: hidden;
}
.ph-days b,
.ph-days span {
  flex: none;
  padding: 4px 11px;
  border-radius: 999px;
  background: #efe6d6;
  font-weight: 600;
}
.ph-days b {
  background: #001d2c;
  color: #fff;
}
.ph-dayhead {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin: 12px 12px 8px;
}
.ph-dayhead b,
.ph-dayhead small {
  display: block;
}
.ph-dayhead b {
  font-size: 14px;
}
.ph-dayhead small {
  color: #5b6b75;
}
.ph-opt {
  padding: 5px 10px;
  border-radius: 999px;
  background: #00798c;
  color: #fff;
  font-size: 10.5px;
  font-weight: 700;
}
.ph-stop {
  display: flex;
  gap: 10px;
  margin: 0 12px;
  padding: 8px;
  border-radius: 14px;
  background: #fbf5ea;
  box-shadow: 0 2px 8px rgba(0, 29, 44, 0.07);
}
.ph-stop + .ph-stop {
  margin-top: 8px;
}
.ph-stop.meal {
  background: #fdf3e0;
  border: 1px dashed #edae49;
  box-shadow: none;
}
.ph-thumb {
  flex: none;
  width: 52px;
  height: 52px;
  display: grid;
  place-items: center;
  border-radius: 10px;
  font-size: 22px;
}
.ph-stop-text {
  min-width: 0;
}
.ph-stop-text small {
  display: block;
  color: #5b6b75;
  font-size: 10px;
}
.ph-stop-text small b {
  color: #001d2c;
}
.ph-stop-text > b {
  display: block;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.ph-chips {
  display: flex;
  gap: 4px;
  margin-top: 4px;
}
.ph-chips i {
  padding: 1px 6px;
  border-radius: 999px;
  background: #efe6d6;
  font-size: 9.5px;
  font-style: normal;
  font-weight: 600;
}
.ph-chips i.quiet { background: #dcefe4; color: #2f6f4f; }
.ph-chips i.busy { background: #fbe3c4; color: #8a5a12; }
.ph-leg {
  margin: 4px 12px 4px 34px;
  padding-left: 14px;
  border-left: 2px dotted #c9c2b5;
  color: #5b6b75;
  font-size: 10px;
  line-height: 22px;
}
.ph-sec-head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  margin: 22px 12px 8px;
}
.ph-sec-head b {
  font-size: 14px;
}
.ph-sec-head small {
  color: #5b6b75;
}
.ph-vote {
  margin: 0 12px 8px;
  padding: 9px 10px;
  border-radius: 12px;
  background: #fbf5ea;
  box-shadow: 0 2px 8px rgba(0, 29, 44, 0.07);
}
.ph-vote-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 6px;
}
.ph-pick {
  padding: 1px 7px;
  border-radius: 999px;
  background: #66a182;
  color: #fff;
  font-size: 9.5px;
  font-style: normal;
  font-weight: 700;
}
.ph-votebtn {
  padding: 2px 9px;
  border: 1.5px solid #edae49;
  border-radius: 999px;
  font-size: 9.5px;
  font-weight: 700;
}
.ph-vote-row {
  display: flex;
  align-items: center;
  gap: 8px;
  padding-left: 5px;
}
.ph-vote-row small {
  color: #5b6b75;
}
.ph-bar,
.ph-progress {
  flex: 1;
  height: 6px;
  border-radius: 999px;
  background: #efe6d6;
  overflow: hidden;
}
.ph-bar i,
.ph-progress i {
  display: block;
  height: 100%;
  border-radius: 999px;
  background: #00798c;
}
.ph-bar i.pick {
  background: #66a182;
}
.ph-progress {
  margin: 0 12px 6px;
}
.ph-group-label {
  margin: 10px 12px 4px;
  color: #5b6b75;
  font-size: 9.5px;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}
.ph-check {
  display: flex;
  align-items: center;
  gap: 10px;
  margin: 0 12px 6px;
  padding: 8px 10px;
  border-radius: 12px;
  background: #fbf5ea;
  font-weight: 600;
}
.ph-check span {
  width: 18px;
  height: 18px;
  display: grid;
  place-items: center;
  border: 2px solid #c9c2b5;
  border-radius: 50%;
  color: #fff;
  font-size: 10px;
}
.ph-check span.on {
  background: #00798c;
  border-color: #00798c;
}
.ph-tiles {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
  margin: 0 12px 8px;
}
.ph-tiles div {
  padding: 10px;
  border-radius: 12px;
  background: #001d2c;
  color: #fff;
}
.ph-tiles div.owe {
  background: #edae49;
  color: #001d2c;
}
.ph-tiles small,
.ph-tiles b {
  display: block;
}
.ph-tiles small {
  opacity: 0.8;
}
.ph-tiles b {
  font-size: 16px;
}
.ph-cost {
  display: flex;
  align-items: center;
  gap: 10px;
  margin: 0 12px 6px;
  padding: 8px 10px;
  border-radius: 12px;
  background: #fbf5ea;
}
.ph-cost-icon {
  width: 30px;
  height: 30px;
  display: grid;
  place-items: center;
  border-radius: 9px;
  background: #efe6d6;
  font-size: 15px;
}
.ph-cost div {
  flex: 1;
  min-width: 0;
}
.ph-cost div b,
.ph-cost div small {
  display: block;
}
.ph-cost div small {
  color: #5b6b75;
  font-size: 9.5px;
}
.ph-cost-amt {
  color: #00798c;
}
.ph-end {
  height: 74px; /* room under the tab bar */
}
.ph-nav {
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 3;
  display: flex;
  justify-content: space-around;
  padding: 8px 8px 24px;
  background: rgba(251, 245, 234, 0.92);
  backdrop-filter: blur(10px);
  border-top: 1px solid #e8dfcf;
}
.ph-nav span {
  display: grid;
  justify-items: center;
  gap: 2px;
  color: #8a959c;
  font-size: 9px;
  font-weight: 600;
}
.ph-nav span.on {
  color: #00798c;
}
.ph-nav svg {
  width: 20px;
  height: 20px;
  fill: none;
  stroke: currentColor;
  stroke-width: 1.8;
  stroke-linecap: round;
  stroke-linejoin: round;
}
.ph-home {
  position: absolute;
  bottom: 7px;
  left: 50%;
  z-index: 4;
  width: 104px;
  height: 4px;
  margin-left: -52px;
  border-radius: 999px;
  background: #001d2c;
}

.lp-join-copy h2 {
  margin: 0 0 16px;
  font-family: var(--sans); /* same serif as the big hero title */
  font-weight: 500;
  letter-spacing: -0.02em;
  font-size: clamp(42px, 5vw, 68px);
  line-height: 1.05;
  color: #fff;
}
.lp-join-copy p {
  max-width: 460px;
  margin: 0 0 36px;
  font-size: 19px;
  line-height: 1.55;
  color: rgba(255, 255, 255, 0.75);
}
.lp-join-actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 18px 28px;
}
.lp-join-btn {
  padding: 16px 40px;
  border-radius: 999px;
  background: #edae49;
  color: #001d2c;
  font-family: var(--sans);
  font-size: 19px;
  font-weight: 600;
  letter-spacing: 0.05em;
  text-transform: uppercase;
  text-decoration: none;
  box-shadow: 0 14px 30px rgba(237, 174, 73, 0.3);
  transition: transform 0.2s, box-shadow 0.2s, background 0.2s;
}
.lp-join-btn:hover {
  background: #f3bd62;
  transform: translateY(-2px);
  box-shadow: 0 18px 36px rgba(237, 174, 73, 0.4);
}
.lp-join-link {
  color: #fff;
  font-family: var(--sans);
  font-size: 19px;
  font-weight: 500;
  letter-spacing: 0.05em;
  text-transform: uppercase;
  text-decoration: none;
}
.lp-join-link span {
  display: inline-block;
  transition: transform 0.2s;
}
.lp-join-link:hover span {
  transform: translateX(4px);
}
.lp-join-btn:focus-visible,
.lp-join-link:focus-visible {
  outline: 3px solid rgba(237, 174, 73, 0.7);
  outline-offset: 4px;
  border-radius: 999px;
}
@media (max-width: 860px) {
  .lp-join {
    grid-template-columns: minmax(0, 1fr);
    gap: 36px;
    padding: 70px 20px 60px;
  }
  .lp-join-art { height: 660px; }
  .lp-join-copy { text-align: center; }
  .lp-join-copy p { margin-left: auto; margin-right: auto; }
  .lp-join-actions { justify-content: center; }
}

/* Tablets and phones: the window on top, the words underneath */
@media (max-width: 900px) {
  .lp-sticky {
    grid-template-columns: minmax(0, 1fr); /* never wider than the phone */
    grid-template-rows: minmax(0, 1.1fr) minmax(0, 1fr);
    gap: 0;
    padding: 12px 20px 24px;
  }
  .lp-3d { order: -1; --s: 0.56; }
  .lp-device { position: absolute; left: 50%; top: 50%; margin: -205px 0 0 -310px; } /* exact centre, even though it's wider than the phone before shrinking */
  .lp-copy { height: 100%; }
  .lp-step { justify-content: flex-start; }
  .lp-step-title { font-size: 30px; margin: 6px 0 8px; }
  .lp-step-text { font-size: 15px; margin-bottom: 10px; }
  .lp-step-points li { font-size: 14px; }
  .lp-dots { right: 10px; }
  .lp-chip.pos1 { left: -10px; }
  .lp-chip.pos2 { right: -14px; }
}
@media (max-width: 420px) {
  .lp-3d { --s: 0.5; }
  .lp-step-points { display: none; } /* keep each step short on small phones */
}
/* ===== Features ===== */
.lp-feat {
  padding: 110px 40px 40px;
  background: linear-gradient(180deg, #05080d, #001d2c 40%, #05080d);
}
.lp-feat-title {
  margin: 0 0 10px;
  text-align: center;
  font-family: var(--sans); /* same serif as the big hero title */
  font-weight: 500;
  letter-spacing: -0.02em;
  font-size: clamp(38px, 5vw, 64px);
  color: #fff;
}
.lp-feat-sub {
  margin: 0 auto 56px;
  max-width: 560px;
  text-align: center;
  font-size: 18px;
  color: rgba(255, 255, 255, 0.72);
}
.lp-feat-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 32px 28px;
  max-width: 1180px;
  margin: 0 auto;
}
/* Comes up and tips forward into place, one card after another */
.lp-card {
  perspective: 900px;
  opacity: 0;
  transform: translateY(50px) rotateX(18deg);
  transform-origin: 50% 100%;
  transition: opacity 0.6s, transform 0.8s cubic-bezier(.2, .8, .2, 1);
  transition-delay: calc(var(--i) * 0.1s);
}
.lp-feat.shown .lp-card {
  opacity: 1;
  transform: none;
}
.lp-card-in {
  --rx: 0deg;
  --ry: 0deg;
  --gx: 50%;
  --gy: 50%;
  position: relative;
  height: 100%;
  padding: 14px 14px 22px;
  border-radius: 22px;
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid rgba(255, 255, 255, 0.08);
  transform: rotateX(var(--rx)) rotateY(var(--ry));
  transform-style: preserve-3d;
  transition: transform 0.35s ease-out, border-color 0.3s, background 0.3s;
}
.lp-card-in.hover {
  transition: transform 0.08s linear, border-color 0.3s, background 0.3s;
  border-color: rgba(237, 174, 73, 0.45);
  background: rgba(255, 255, 255, 0.06);
}
/* A soft light that follows the mouse */
.lp-card-in::after {
  content: '';
  position: absolute;
  inset: 0;
  border-radius: inherit;
  background: radial-gradient(320px circle at var(--gx) var(--gy), rgba(237, 174, 73, 0.14), transparent 60%);
  opacity: 0;
  transition: opacity 0.3s;
  pointer-events: none;
}
.lp-card-in.hover::after {
  opacity: 1;
}
/* Replaying: jump back to the start with no animation, then play again */
.lp-card.replay .lp-art *,
.lp-card.replay .lp-art .a-progress span {
  transition: none !important;
  animation: none !important;
}
.lp-card-in {
  cursor: pointer;
}
/* A small press when clicked */
.lp-card.pop .lp-art {
  animation: a-pop 0.45s cubic-bezier(.2, .8, .2, 1);
}
@keyframes a-pop {
  40% { scale: 0.96; }
}
.lp-card h3 {
  margin: 20px 8px 8px;
  font-family: var(--sans); /* same serif as the big hero title */
  font-weight: 500;
  letter-spacing: -0.02em;
  font-size: 25px;
  color: #fff;
  transform: translateZ(20px);
}
.lp-card p {
  margin: 0 8px;
  font-size: 15.5px;
  line-height: 1.55;
  color: rgba(255, 255, 255, 0.7);
  transform: translateZ(12px);
}

/* The picture: a light panel whose pieces sit at three depths (z1 back, z3 front) */
.lp-art {
  position: relative;
  height: 200px;
  border-radius: 16px;
  background: #fbf5ea;
  transform-style: preserve-3d;
  color: #001d2c;
}
.lp-art > * {
  position: absolute;
  transition: transform 0.4s cubic-bezier(.2, .8, .2, 1);
}
.lp-art .z1 { --z: 18px; }
.lp-art .z2 { --z: 38px; }
.lp-art .z3 { --z: 60px; }
.lp-art > .z1, .lp-art > .z2, .lp-art > .z3 { transform: translateZ(var(--z)); }
.lp-card-in.hover .lp-art > .z1, .lp-card-in.hover .lp-art > .z2, .lp-card-in.hover .lp-art > .z3 { transform: translateZ(calc(var(--z) * 1.6)); }

.a-pill {
  padding: 8px 12px;
  border-radius: 12px;
  background: #001d2c;
  color: #fff;
  font-size: 13px;
  font-weight: 700;
  white-space: nowrap;
  box-shadow: 0 12px 24px rgba(0, 29, 44, 0.25);
}
.a-pill b {
  color: #edae49;
}
.a-faces {
  display: flex;
}
.a-faces i {
  width: 34px;
  height: 34px;
  margin-left: -8px;
  display: grid;
  place-items: center;
  border: 3px solid #fbf5ea;
  border-radius: 50%;
  color: #fff;
  font-size: 11px;
  font-style: normal;
  font-weight: 700;
  transition: margin 0.4s cubic-bezier(.2, .8, .2, 1);
}
.a-faces.big i {
  width: 44px;
  height: 44px;
  font-size: 13px;
}
.lp-card-in.hover .a-faces i {
  margin-left: 2px; /* the group spreads out */
}

/* 1. Save */
.a-photo {
  display: grid;
  place-items: center;
  width: 120px;
  height: 92px;
  border-radius: 14px;
  font-size: 38px;
  box-shadow: 0 10px 20px rgba(0, 29, 44, 0.12);
}
.a-photo.p1 { left: 12%; top: 24px; background: linear-gradient(135deg, #f6c7a0, #d1495b); }
.a-photo.p2 { right: 12%; top: 70px; background: linear-gradient(135deg, #ffe2a6, #edae49); }
.a-tag {
  padding: 4px 10px;
  border-radius: 8px;
  font-size: 12px;
  font-weight: 800;
  color: #001d2c;
}
.a-tag.t1 { left: 10%; top: 128px; background: #edae49; }
.a-tag.t2 { left: 30%; top: 152px; background: #8fd3c0; }
.a-heart {
  right: 22%;
  top: 34px;
  width: 44px;
  height: 44px;
  display: grid;
  place-items: center;
  border-radius: 50%;
  background: #fbf5ea;
  color: #c9c2b5;
  font-size: 22px;
  box-shadow: 0 10px 22px rgba(0, 29, 44, 0.2);
}
.lp-feat.shown .lp-card:not(.replay) .a-heart { animation: a-love 0.5s 0.9s forwards; }
@keyframes a-love {
  50% { scale: 1.3; }
  to { color: #d1495b; }
}
.a-cursor { right: 17%; top: 62px; }

/* 2. Split */
.a-bill {
  left: 10%;
  top: 22px;
  display: grid;
  gap: 2px;
  padding: 14px 16px;
  border-radius: 14px;
  background: #fbf5ea;
  box-shadow: 0 10px 20px rgba(0, 29, 44, 0.12);
}
.a-bill small, .a-bill span { color: #5b6b75; font-size: 12px; }
.a-bill b { font-size: 26px; }
.art-split .a-faces { right: 12%; top: 34px; }
.art-split .a-pill { right: 8%; top: 98px; }
.a-progress {
  left: 10%;
  right: 10%;
  bottom: 22px;
  height: 10px;
  border-radius: 999px;
  background: #efe6d6;
  overflow: hidden;
}
.a-progress span {
  display: block;
  width: 75%;
  height: 100%;
  border-radius: 999px;
  background: #66a182;
  transform: scaleX(0);
  transform-origin: left;
  transition: transform 1.2s 0.6s cubic-bezier(.2, .8, .2, 1);
}
.lp-feat.shown .lp-card:not(.replay) .a-progress span { transform: scaleX(1); }

/* 3. Together */
.art-together .a-faces { right: 12%; top: 22px; }
.a-row {
  left: 10%;
  top: 92px;
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px 16px;
  border-radius: 14px;
  background: #fbf5ea;
  box-shadow: 0 10px 20px rgba(0, 29, 44, 0.12);
}
.a-row b, .a-row small { display: block; }
.a-row small { color: #5b6b75; font-size: 12px; }
.a-tip {
  right: 10%;
  top: 136px;
  padding: 8px 12px;
  border-radius: 10px;
  background: #001d2c;
  color: #fff;
  font-size: 13px;
  font-weight: 700;
  box-shadow: 0 12px 24px rgba(0, 29, 44, 0.25);
}

/* 4. Packing: each line ticks in turn */
.a-check {
  left: 16%;
  right: 16%;
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 9px 12px;
  border-radius: 12px;
  background: #fbf5ea;
  font-weight: 600;
  box-shadow: 0 6px 14px rgba(0, 29, 44, 0.08);
  top: calc(20px + var(--n) * 52px);
}
.a-tick {
  width: 24px;
  height: 24px;
  display: grid;
  place-items: center;
  border: 2px solid #c9c2b5;
  border-radius: 50%;
  color: transparent;
  font-size: 13px;
  transition: background 0.3s, border-color 0.3s, color 0.3s;
  transition-delay: calc(0.7s + var(--n) * 0.35s);
}
.lp-feat.shown .lp-card:not(.replay) .a-tick {
  background: #00798c;
  border-color: #00798c;
  color: #fff;
}
.art-pack .a-pill { right: 6%; top: 8px; }

/* 5. Recommendations: a score ring that fills */
@property --fill {
  syntax: '<percentage>';
  inherits: false;
  initial-value: 0%;
}
.a-ring {
  left: calc(50% - 56px);
  top: 36px;
  width: 112px;
  height: 112px;
  display: grid;
  place-content: center;
  text-align: center;
  border-radius: 50%;
  background:
    radial-gradient(closest-side, #fff 76%, transparent 78% 100%),
    conic-gradient(#edae49 var(--fill), #efe6d6 0);
  box-shadow: 0 12px 24px rgba(0, 29, 44, 0.15);
  transition: --fill 1.2s 0.6s cubic-bezier(.2, .8, .2, 1), transform 0.4s cubic-bezier(.2, .8, .2, 1);
}
.lp-feat.shown .lp-card:not(.replay) .a-ring { --fill: 92%; }
.a-ring b { font-size: 32px; line-height: 1; }
.a-ring small { color: #5b6b75; font-size: 12px; }
.art-recs .r1 { right: 6%; top: 22px; }
.art-recs .r2 { left: 6%; bottom: 20px; background: #00798c; }

/* 6. Bookings */
.a-ticket {
  left: 12%;
  right: 22%;
  top: 30px;
  display: grid;
  gap: 2px;
  padding: 14px 16px;
  border-radius: 14px;
  background: #fbf5ea;
  border: 2px dashed #edae49;
  box-shadow: 0 10px 20px rgba(0, 29, 44, 0.12);
}
.a-ticket.back {
  left: 20%;
  right: 12%;
  top: 52px;
  height: 104px;
  border-color: #c9c2b5;
  background: #f3ece0;
}
.a-ticket small, .a-ticket span { color: #5b6b75; font-size: 12px; }
.a-ticket b { font-size: 18px; }
.a-ticket em { color: #00798c; font-size: 12px; font-style: normal; font-weight: 700; }
.art-book .a-pill { right: 8%; bottom: 22px; }

@media (max-width: 1000px) {
  .lp-feat-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
}
@media (max-width: 640px) {
  .lp-feat { padding: 80px 20px 20px; }
  .lp-feat-grid { grid-template-columns: minmax(0, 1fr); gap: 24px; }
  .lp-feat-sub { margin-bottom: 36px; font-size: 16px; }
}
@media (prefers-reduced-motion: reduce) {
  .lp-hero *, .lp-title span, .lp-tag, .lp-actions { animation: none !important; opacity: 1 !important; }
  .lp-layer, .lp-content { transition: none; transform: none; }
  .lp-step, .sc, .lp-chip, .sc-stop, .sc-bar span, .sc-pillar::before, .lp-device { transition: opacity 0.2s !important; }
  .lp-card, .lp-card-in, .lp-art > *, .a-progress span, .a-tick, .a-ring { transition: none !important; }
  .lp-card { opacity: 1; transform: none; }
  .a-heart { animation: none !important; color: #d1495b; }
  .lp-card.pop .lp-art { animation: none; }
  .ph-cursor, .ph-caret { animation: none; }
}

/* =====================================================================
   Night expedition theme (the whole page, top to bottom)
   Navy-slate night sky, warm campfire amber, cream sketch-paper.
   Hand lettering (Caveat) only for the big titles and chapter markers;
   everything you read or press uses Plus Jakarta Sans.
   ===================================================================== */
.lp {
  --sans: 'Plus Jakarta Sans', system-ui, -apple-system, 'Segoe UI', sans-serif;
  --hand: 'Caveat', 'Segoe Script', cursive;
  --night: #0f172a;
  --night-2: #0b131d;
  --slip: #132238;
  --edge: #1e293b;
  --cream: #faf8f3;
  --amber: #f59e0b;
  --amber-hi: #fbbf24;
  --amber-dark: #b45309;
  --soft: #cbd5e1;
  background: var(--night-2);
  /* faint constellations and topographic contour lines, shared by the night sections */
  --stars: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='520' height='420'%3E%3Cg fill='%23faf8f3'%3E%3Ccircle cx='40' cy='60' r='1.6'/%3E%3Ccircle cx='96' cy='34' r='1.1'/%3E%3Ccircle cx='150' cy='72' r='1.8'/%3E%3Ccircle cx='204' cy='50' r='1.2'/%3E%3Ccircle cx='330' cy='300' r='1.7'/%3E%3Ccircle cx='384' cy='262' r='1.2'/%3E%3Ccircle cx='440' cy='310' r='1.5'/%3E%3Ccircle cx='470' cy='360' r='1'/%3E%3Ccircle cx='260' cy='170' r='0.9'/%3E%3Ccircle cx='70' cy='300' r='0.9'/%3E%3Ccircle cx='480' cy='90' r='1'/%3E%3Ccircle cx='160' cy='380' r='0.8'/%3E%3C/g%3E%3Cg fill='none' stroke='%23faf8f3' stroke-width='0.8' stroke-dasharray='2 4'%3E%3Cpath d='M40 60 96 34 150 72 204 50'/%3E%3Cpath d='M330 300 384 262 440 310 470 360'/%3E%3C/g%3E%3C/svg%3E");
  --contours: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='640' height='480'%3E%3Cg fill='none' stroke='%23faf8f3' stroke-width='1'%3E%3Cpath d='M-20 380 C 80 320 160 360 250 300 S 420 250 520 290 660 260 680 250'/%3E%3Cpath d='M-20 410 C 90 350 170 390 260 330 S 430 280 530 320 660 290 680 280'/%3E%3Cpath d='M-20 440 C 100 380 180 420 270 360 S 440 310 540 350 660 320 680 310'/%3E%3Cpath d='M-20 120 C 90 80 170 140 280 100 S 470 40 560 90 660 110 680 100'/%3E%3Cpath d='M-20 150 C 100 110 180 170 290 130 S 480 70 570 120 660 140 680 130'/%3E%3C/g%3E%3C/svg%3E");
}

/* ----- A. Hero ----- */
/* Brand: a rounded cream tab with a hand-drawn paper plane */
.lp-brand {
  gap: 10px;
  padding: 7px 16px 7px 8px;
  border: 2px solid #e2d9cc;
  border-radius: 16px;
  background: var(--cream);
  color: var(--night);
  font-family: var(--sans);
  font-size: 15px;
  font-weight: 800;
  letter-spacing: 0.14em;
  text-shadow: none;
  box-shadow: 0 4px 0 #c9b893, 0 0 28px rgba(245, 158, 11, 0.25);
}
.lp-brand.static {
  position: static;
  display: inline-flex;
  font-size: 13px;
}
.lp-brand-icon {
  display: grid;
  place-items: center;
  width: 34px;
  height: 34px;
  border-radius: 11px;
  background: #fdf1d6;
  border: 1.5px solid #e8d5a8;
}
.lp-brand-text span {
  white-space: nowrap;
}

/* Sign in / Join: a dark tactile button with a cream edge */
.lp-signin {
  display: inline-flex;
  align-items: center;
  padding: 11px 20px;
  border: 2px solid var(--cream);
  border-radius: 14px;
  background: rgba(15, 23, 42, 0.78);
  color: var(--cream);
  font-family: var(--sans);
  font-size: 14px;
  font-weight: 800;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  text-decoration: none;
  box-shadow: 0 4px 0 #c9b893, 0 12px 26px rgba(0, 0, 0, 0.35);
  backdrop-filter: blur(6px);
  transition: transform 0.12s, box-shadow 0.12s, background 0.15s;
}
.lp-signin:hover {
  background: rgba(19, 34, 56, 0.92);
  transform: translateY(-2px);
  box-shadow: 0 6px 0 #c9b893, 0 16px 30px rgba(0, 0, 0, 0.4);
}
.lp-signin:active {
  transform: translateY(4px);
  box-shadow: 0 0 0 #c9b893;
}
.lp-signin:focus-visible {
  outline: 3px solid rgba(245, 158, 11, 0.8);
  outline-offset: 4px;
}

/* The headline in hand lettering, one word glowing like a campfire */
.lp-title {
  font-family: var(--hand);
  font-weight: 700;
  font-size: clamp(76px, 11vw, 168px);
  line-height: 0.82;
  letter-spacing: 0;
  text-shadow: 0 4px 30px rgba(0, 0, 0, 0.6);
}
.lp-title .lp-accent {
  font-style: normal;
  color: var(--amber-hi);
  padding-left: 0;
  text-shadow: 0 0 28px rgba(245, 158, 11, 0.55), 0 4px 30px rgba(0, 0, 0, 0.5);
}
.lp-tag {
  font-family: var(--sans);
  font-weight: 700;
  font-size: clamp(16px, 1.6vw, 20px);
  letter-spacing: 0.14em;
  color: var(--cream);
}

/* The big amber button: chunky, bevelled, presses down */
.lp-explore {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  padding: 16px 32px;
  border: 2px solid var(--amber-dark);
  border-radius: 16px;
  background: linear-gradient(180deg, var(--amber-hi), var(--amber));
  color: #1a1408;
  font-family: var(--sans);
  font-size: 18px;
  font-weight: 800;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  text-decoration: none;
  box-shadow:
    inset 0 2px 0 rgba(255, 255, 255, 0.45),
    inset 0 -3px 0 rgba(180, 83, 9, 0.35),
    0 6px 0 #92400e,
    0 18px 34px rgba(245, 158, 11, 0.32);
  transition: transform 0.12s, box-shadow 0.12s, filter 0.15s;
}
.lp-explore:hover {
  filter: brightness(1.06);
  transform: translateY(-2px);
  box-shadow:
    inset 0 2px 0 rgba(255, 255, 255, 0.45),
    inset 0 -3px 0 rgba(180, 83, 9, 0.35),
    0 8px 0 #92400e,
    0 22px 40px rgba(245, 158, 11, 0.4);
}
.lp-explore:active {
  transform: translateY(6px);
  box-shadow: inset 0 2px 0 rgba(255, 255, 255, 0.45), 0 0 0 #92400e, 0 8px 16px rgba(245, 158, 11, 0.25);
}
.lp-explore:focus-visible {
  outline: 3px solid var(--cream);
  outline-offset: 4px;
}
.lp-explore.small {
  padding: 13px 24px;
  font-size: 15px;
}
.lp-arrow {
  display: inline-block;
  transition: transform 0.2s;
}
.lp-explore:hover .lp-arrow {
  transform: translateX(4px);
}
.lp-cue {
  font-family: var(--sans);
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.16em;
}

/* Origami paper planes drifting on glowing dotted trails */
.lp-origami {
  position: absolute;
  inset: 0;
  pointer-events: none;
}
.lp-paper {
  position: absolute;
  display: block;
  width: 200px;
  filter: drop-shadow(0 0 8px rgba(251, 191, 36, 0.35));
  animation: lp-paper-drift 9s ease-in-out infinite;
}
.lp-paper svg {
  display: block;
  width: 100%;
}
.lp-paper.p1 {
  top: 15%;
  left: 36%;
}
.lp-paper.p2 {
  top: 7%;
  left: 60%;
  width: 130px;
  opacity: 0.75;
  animation-duration: 12s;
  animation-delay: -4s;
}
.lp-paper-trail {
  fill: none;
  stroke: var(--amber-hi);
  stroke-width: 2.2;
  stroke-linecap: round;
  stroke-dasharray: 1 9;
  opacity: 0.8;
  animation: lp-trail-run 1.6s linear infinite;
}
@keyframes lp-paper-drift {
  0%, 100% { transform: translate(0, 0) rotate(0deg); }
  50% { transform: translate(26px, -12px) rotate(-3deg); }
}
@keyframes lp-trail-run {
  to { stroke-dashoffset: -20; }
}

/* ----- B. The Campfire Briefing ----- */
.lp-brief {
  position: relative;
  padding: 90px 40px 100px;
  background:
    radial-gradient(520px 200px at 50% 78%, rgba(245, 158, 11, 0.16), transparent 70%),
    linear-gradient(180deg, #05080d 0%, var(--night) 60%, var(--night-2) 100%);
}
/* faint stars behind the card */
.lp-brief::before {
  content: '';
  position: absolute;
  inset: 0;
  background: var(--stars) 0 0 / 520px 420px;
  opacity: 0.18;
  pointer-events: none;
}
.lp-brief-card {
  position: relative;
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
  align-items: center;
  gap: 24px 40px;
  max-width: 1120px;
  margin: 0 auto;
  padding: 34px 38px 32px;
  border: 2px solid #e2d9cc;
  border-radius: 22px;
  background:
    radial-gradient(circle, rgba(18, 50, 74, 0.07) 1px, transparent 1.2px) 0 0 / 18px 18px,
    var(--cream);
  color: var(--night);
  box-shadow: 0 6px 0 #c9b893, 0 30px 60px -20px rgba(0, 0, 0, 0.7), 0 0 80px rgba(245, 158, 11, 0.12);
  transform: rotate(-0.4deg);
}
/* stitching round the inside edge */
.lp-brief-card::before {
  content: '';
  position: absolute;
  inset: 9px;
  border: 2px dashed rgba(201, 184, 148, 0.7);
  border-radius: 15px;
  pointer-events: none;
}
.lp-brief-tape {
  position: absolute;
  top: -12px;
  width: 92px;
  height: 26px;
  background: rgba(245, 158, 11, 0.55);
  border-left: 2px dashed rgba(255, 255, 255, 0.5);
  border-right: 2px dashed rgba(255, 255, 255, 0.5);
}
.lp-brief-tape.tl {
  left: 34px;
  transform: rotate(-6deg);
}
.lp-brief-tape.tr {
  right: 34px;
  transform: rotate(5deg);
  background: rgba(47, 143, 148, 0.45);
}
.lp-brief-guide {
  display: flex;
  align-items: center;
  gap: 18px;
}
.lp-brief-pip {
  flex: none;
  display: grid;
  place-items: center;
  width: 150px;
  height: 150px;
  padding: 0;
  border: 3px solid var(--night);
  border-radius: 50%;
  background: radial-gradient(circle at 50% 40%, #1f3a5c, var(--night));
  box-shadow: 0 0 0 6px #f3e8cf, 0 0 0 8px #c9b893, 0 0 30px rgba(245, 158, 11, 0.35);
  cursor: pointer;
  transition: transform 0.15s;
}
.lp-brief-pip:hover {
  transform: rotate(-4deg) scale(1.03);
}
.lp-brief-pip:focus-visible {
  outline: 3px solid var(--amber);
  outline-offset: 10px;
}
.lp-brief-bubble {
  position: relative;
  padding: 16px 20px 18px;
  border: 2px solid var(--night);
  border-radius: 18px;
  background: #fbf5ea;
  box-shadow: 0 4px 0 var(--night);
}
/* the bubble's tail points at Pip */
.lp-brief-bubble::before {
  content: '';
  position: absolute;
  left: -12px;
  top: 40%;
  width: 20px;
  height: 20px;
  background: #fbf5ea;
  border-left: 2px solid var(--night);
  border-bottom: 2px solid var(--night);
  transform: rotate(45deg);
}
.lp-brief-kicker {
  margin: 0 0 2px;
  font-family: var(--hand);
  font-size: 30px;
  font-weight: 700;
  line-height: 1;
  color: var(--amber-dark);
}
.lp-brief-title {
  margin: 0;
  font-family: var(--sans);
  font-size: 19px;
  font-weight: 800;
  line-height: 1.35;
  color: var(--night);
}
.lp-brief-sub {
  margin: 0 0 16px;
  font-size: 15px;
  line-height: 1.55;
  color: #3a4a57;
}
/* luggage tags */
.lp-bags {
  display: flex;
  flex-wrap: wrap;
  gap: 12px 14px;
  margin: 0 0 22px;
  padding: 0;
  list-style: none;
}
.lp-bag {
  position: relative;
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 7px 14px 7px 26px;
  border: 2px solid var(--night);
  border-radius: 6px 12px 12px 6px;
  background: #fdf1d6;
  font-size: 13.5px;
  font-weight: 800;
  color: var(--night);
  box-shadow: 0 3px 0 var(--night);
  transform: rotate(var(--r));
  transition: transform 0.2s;
}
/* the tag's eyelet */
.lp-bag::before {
  content: '';
  position: absolute;
  left: 8px;
  top: 50%;
  width: 9px;
  height: 9px;
  margin-top: -4.5px;
  border: 2px solid var(--night);
  border-radius: 50%;
  background: var(--cream);
}
.lp-bag:hover {
  transform: rotate(0deg) translateY(-2px);
}
.lp-bag-stamp {
  display: grid;
  place-items: center;
}
.lp-brief-btns {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 12px 18px;
}
.lp-brief-hint {
  font-size: 12.5px;
  font-weight: 600;
  color: #5b6b75;
}

/* ----- C. Story and features: the night trail ----- */
.lp-story {
  background:
    radial-gradient(900px 600px at 75% 40%, rgba(245, 158, 11, 0.08), transparent 70%),
    radial-gradient(700px 500px at 15% 80%, rgba(47, 143, 148, 0.12), transparent 70%),
    linear-gradient(180deg, var(--night-2) 0%, var(--night) 30%, var(--night) 80%, var(--night-2) 100%);
}
.lp-story::before,
.lp-feat::before,
.lp-join::before {
  content: '';
  position: absolute;
  inset: 0;
  background: var(--stars) 0 0 / 520px 420px, var(--contours) 0 0 / 640px 480px;
  opacity: 0.12;
  pointer-events: none;
}
.lp-step-num {
  font-family: var(--hand);
  font-size: 30px;
  font-weight: 700;
  letter-spacing: 0;
  text-transform: none;
  color: var(--amber-hi);
}
.lp-step-title {
  font-family: var(--hand);
  font-weight: 700;
  letter-spacing: 0;
  font-size: clamp(48px, 5.4vw, 78px);
  line-height: 0.95;
  color: var(--cream);
}
.lp-step-text {
  color: var(--soft);
}
.lp-step-points li {
  font-weight: 600;
  color: #e2e8f0;
}
.lp-step-points li::before {
  color: var(--amber);
}

.lp-feat {
  position: relative;
  background:
    radial-gradient(800px 400px at 50% 0%, rgba(245, 158, 11, 0.08), transparent 70%),
    linear-gradient(180deg, var(--night-2), var(--night) 40%, var(--night-2));
}
.lp-feat > * {
  position: relative;
}
.lp-feat-title {
  font-family: var(--hand);
  font-weight: 700;
  letter-spacing: 0;
  font-size: clamp(54px, 6vw, 86px);
  line-height: 1;
  color: var(--cream);
}
.lp-feat-sub {
  color: var(--soft);
}
/* Each feature: a navy dossier card with a cream sketch-paper picture */
.lp-card-in {
  padding: 12px 12px 22px;
  border-radius: 16px;
  background: var(--slip);
  border: 1px solid var(--edge);
  box-shadow: 0 3px 0 rgba(0, 0, 0, 0.35), 0 24px 40px -26px rgba(0, 0, 0, 0.8);
}
.lp-card-in.hover {
  border-color: rgba(245, 158, 11, 0.55);
  background: #16294a;
}
.lp-art {
  border-radius: 10px;
  border: 1px solid #e2d9cc;
  background:
    radial-gradient(circle, rgba(18, 50, 74, 0.07) 1px, transparent 1.2px) 0 0 / 16px 16px,
    var(--cream);
}
.lp-card-log {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 18px 8px 0;
  font-size: 10.5px;
  font-weight: 800;
  letter-spacing: 0.16em;
  text-transform: uppercase;
  color: var(--amber);
  transform: translateZ(20px);
}
.lp-card-log::after {
  content: '';
  flex: 1;
  border-bottom: 1px dashed rgba(148, 163, 184, 0.25);
}
.lp-card h3 {
  margin: 8px 8px 8px;
  font-size: 19px;
  font-weight: 800;
  letter-spacing: 0;
  color: var(--cream);
}
.lp-card p {
  font-size: 14.5px;
  color: var(--soft);
}

/* Join */
.lp-join {
  position: relative;
}
.lp-join > * {
  position: relative;
}
/* the stars and contours run the full width, not just the centred column */
.lp-join::before {
  left: 50%;
  right: auto;
  width: 100vw;
  margin-left: -50vw;
}
.lp-join-art {
  background:
    radial-gradient(420px 300px at 50% 30%, rgba(245, 158, 11, 0.16), transparent 70%),
    linear-gradient(180deg, var(--slip), var(--night));
  border: 1px solid var(--edge);
}
.lp-join-copy h2 {
  font-family: var(--hand);
  font-weight: 700;
  letter-spacing: 0;
  font-size: clamp(56px, 6vw, 88px);
  line-height: 0.95;
  color: var(--cream);
}
.lp-join-copy p {
  color: var(--soft);
}
.lp-join-btn {
  border: 2px solid var(--amber-dark);
  border-radius: 16px;
  background: linear-gradient(180deg, var(--amber-hi), var(--amber));
  color: #1a1408;
  font-size: 17px;
  font-weight: 800;
  letter-spacing: 0.08em;
  box-shadow: inset 0 2px 0 rgba(255, 255, 255, 0.45), 0 6px 0 #92400e, 0 18px 34px rgba(245, 158, 11, 0.3);
  transition: transform 0.12s, box-shadow 0.12s, filter 0.15s;
}
.lp-join-btn:hover {
  background: linear-gradient(180deg, var(--amber-hi), var(--amber));
  filter: brightness(1.06);
  transform: translateY(-2px);
  box-shadow: inset 0 2px 0 rgba(255, 255, 255, 0.45), 0 8px 0 #92400e, 0 22px 40px rgba(245, 158, 11, 0.4);
}
.lp-join-btn:active {
  transform: translateY(6px);
  box-shadow: inset 0 2px 0 rgba(255, 255, 255, 0.45), 0 0 0 #92400e;
}
.lp-join-link {
  font-size: 15px;
  font-weight: 800;
  letter-spacing: 0.1em;
  color: var(--cream);
}

/* ----- D. Footer ----- */
.lp-foot {
  position: relative;
  padding: 120px 40px 28px;
  background:
    radial-gradient(1.2px 1.2px at 12% 30%, rgba(250, 248, 243, 0.8), transparent),
    radial-gradient(1px 1px at 28% 12%, rgba(250, 248, 243, 0.6), transparent),
    radial-gradient(1.4px 1.4px at 46% 22%, rgba(250, 248, 243, 0.7), transparent),
    radial-gradient(1px 1px at 63% 8%, rgba(250, 248, 243, 0.5), transparent),
    radial-gradient(1.3px 1.3px at 78% 26%, rgba(250, 248, 243, 0.75), transparent),
    radial-gradient(1px 1px at 91% 14%, rgba(250, 248, 243, 0.55), transparent),
    radial-gradient(600px 260px at 50% 100%, rgba(245, 158, 11, 0.14), transparent 70%),
    linear-gradient(180deg, var(--night-2) 0 88px, var(--night) 88px, #060b12);
  color: var(--soft);
  overflow: hidden;
}
/* a faint mountain ridge along the top edge */
.lp-foot-ridge {
  position: absolute;
  left: 0;
  right: 0;
  top: 0;
  width: 100%;
  height: 90px;
  fill: var(--night); /* the same colour as the footer below it, so the peaks rise out of it */
}
.lp-foot-in {
  position: relative;
  max-width: 1180px;
  margin: 0 auto;
}
.lp-foot-cta {
  display: grid;
  justify-items: center;
  gap: 10px;
  margin-bottom: 64px;
  text-align: center;
}
.lp-foot-title {
  margin: 0;
  font-family: var(--hand);
  font-size: clamp(56px, 6vw, 84px);
  font-weight: 700;
  line-height: 1;
  color: var(--cream);
  text-shadow: 0 0 30px rgba(245, 158, 11, 0.25);
}
.lp-foot-text {
  margin: 0 0 14px;
  font-size: 17px;
  color: var(--soft);
}
.lp-foot-grid {
  display: grid;
  grid-template-columns: minmax(0, 1.2fr) minmax(0, 1fr) minmax(0, 1.2fr);
  gap: 32px 40px;
  padding: 28px;
  border: 1px solid var(--edge);
  border-radius: 16px;
  background: rgba(19, 34, 56, 0.7);
}
.lp-foot-brand p {
  margin: 14px 0 0;
  font-size: 14px;
  font-weight: 700;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: var(--soft);
}
.lp-foot-head {
  margin: 0 0 12px;
  font-size: 11px;
  font-weight: 800;
  letter-spacing: 0.16em;
  text-transform: uppercase;
  color: var(--amber);
}
.lp-foot-nav {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 8px;
}
.lp-foot-nav a,
.lp-foot-nav button {
  padding: 0;
  border: 0;
  background: none;
  color: #e2e8f0;
  font: inherit;
  font-size: 14.5px;
  font-weight: 600;
  text-decoration: none;
  transition: color 0.15s, transform 0.15s;
}
.lp-foot-nav a:hover,
.lp-foot-nav button:hover {
  color: var(--amber-hi);
  transform: translateX(3px);
}
.lp-foot-status ul {
  display: grid;
  gap: 10px;
  margin: 0;
  padding: 0;
  list-style: none;
}
.lp-foot-status li {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 14px;
  font-weight: 600;
  color: #e2e8f0;
}
.lp-dot {
  flex: none;
  width: 9px;
  height: 9px;
  border-radius: 50%;
  animation: lp-dot-glow 2.4s ease-in-out infinite;
}
.lp-dot.green { background: #4ade80; color: #4ade80; }
.lp-dot.amber { background: var(--amber); color: var(--amber); animation-delay: 0.6s; }
.lp-dot.teal { background: #5fbfc4; color: #5fbfc4; animation-delay: 1.2s; }
@keyframes lp-dot-glow {
  0%, 100% { box-shadow: 0 0 0 0 currentColor; }
  50% { box-shadow: 0 0 10px 1px currentColor; }
}
.lp-foot-base {
  display: flex;
  flex-wrap: wrap;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
  margin-top: 22px;
  font-size: 12.5px;
  color: #94a3b8;
}
.lp-foot-top {
  padding: 0;
  border: 0;
  background: none;
  color: #94a3b8;
  font: inherit;
  font-weight: 700;
}
.lp-foot-top:hover {
  color: var(--amber-hi);
}
.lp-foot-nav a:focus-visible,
.lp-foot-nav button:focus-visible,
.lp-foot-top:focus-visible {
  outline: 2px solid var(--amber);
  outline-offset: 3px;
  border-radius: 4px;
}

/* ----- Smaller screens ----- */
@media (max-width: 900px) {
  .lp-step-num { font-size: 24px; }
  .lp-step-title { font-size: 40px; margin: 4px 0 8px; }
  .lp-brief-card { grid-template-columns: minmax(0, 1fr); padding: 30px 24px 26px; }
  .lp-foot-grid { grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); }
  .lp-foot-brand { grid-column: 1 / -1; }
}
@media (max-width: 700px) {
  .lp-brand { left: 16px; top: 16px; font-size: 12px; letter-spacing: 0.1em; padding: 5px 12px 5px 6px; }
  .lp-brand.static { font-size: 12px; }
  .lp-brand-icon { width: 28px; height: 28px; border-radius: 9px; }
  .lp-signin { padding: 9px 14px; font-size: 12px; }
  .lp-explore { padding: 14px 24px; font-size: 16px; }
  .lp-content { bottom: 86px; } /* room for "See how it works" under the taller button */
  .lp-paper.p1 { left: 8%; top: 18%; width: 150px; }
  .lp-paper.p2 { display: none; }
  .lp-brief { padding: 60px 16px 70px; }
  .lp-brief-guide { flex-direction: column; align-items: flex-start; }
  .lp-brief-pip { width: 116px; height: 116px; }
  .lp-brief-bubble::before { left: 40px; top: -12px; transform: rotate(135deg); }
  .lp-brief-title { font-size: 17px; }
  .lp-foot { padding: 100px 20px 24px; }
  .lp-foot-grid { grid-template-columns: minmax(0, 1fr); padding: 22px; }
}
@media (max-width: 520px) {
  .lp-brand-text { display: flex; flex-direction: column; line-height: 1.15; }
  .lp-brand.static .lp-brand-text { display: inline; }
  .lp-title { font-size: 72px; }
}
@media (max-height: 520px) and (orientation: landscape) {
  .lp-title { font-size: clamp(44px, 15vh, 84px); }
  .lp-explore { padding: 9px 20px; font-size: 14px; }
}
@media (prefers-reduced-motion: reduce) {
  .lp-paper, .lp-paper-trail, .lp-dot { animation: none !important; }
  .lp-explore, .lp-signin, .lp-bag, .lp-brief-pip { transition: none; }
}
</style>

<!-- The page fills the whole window, so the body behind it goes dark too -->
<style>
body.lp-body {
  background: #0b131d;
  overflow: hidden;
}
</style>

<style scoped>

/* =========================================================
   NEW TRAVEL JOURNAL HERO
   ========================================================= */

/*
  Keep the original hero code in the file for now,
  but hide its visual elements while we test the redesign.
*/
.lp-hero > .lp-stage,
.lp-hero > .lp-clouds,
.lp-hero > .lp-shade,
.lp-hero > .lp-brand,
.lp-hero > .lp-top-signin,
.lp-hero > .lp-content,
.lp-hero > .lp-cue {
  display: none;
}

.lp {
  background: #f8f4e9;
  color: #17304d;
}

.lp-hero {
  min-height: var(--vh);
  height: var(--vh);
  background:
    radial-gradient(circle, rgba(23, 48, 77, 0.10) 1.5px, transparent 1.6px)
      0 0 / 34px 34px,
    #f8f4e9;
  color: #17304d;
}

.journal-hero {
  position: absolute;
  inset: 0;
  overflow: hidden;
}

/* ---------- navigation ---------- */

.journal-nav {
  position: relative;
  z-index: 10;

  height: 112px;
  padding: 22px clamp(28px, 4vw, 68px);

  display: flex;
  align-items: center;
  justify-content: space-between;
}

.journal-brand {
  display: flex;
  align-items: center;
  gap: 18px;
}

.journal-logo {
  width: 66px;
  height: 66px;

  display: grid;
  place-items: center;

  border: 4px solid #17304d;
  border-radius: 18px;

  background: #efbd4e;

  box-shadow: 0 7px 0 #17304d;

  font-size: 30px;
  transform: rotate(-3deg);
}

.journal-logo span {
  display: block;
  transform: rotate(-20deg);
}

.journal-brand-name {
  font-family: 'Oswald', 'Inter', sans-serif;
  font-size: clamp(25px, 2.3vw, 38px);
  font-weight: 700;
  letter-spacing: 0.02em;
}

.journal-signin {
  padding: 15px 29px;

  border: 3px solid #17304d;
  border-radius: 18px;

  background: #fffaf0;
  color: #17304d;

  box-shadow: 0 7px 0 #17304d;

  font-family: 'Oswald', 'Inter', sans-serif;
  font-size: 19px;
  font-weight: 600;

  text-decoration: none;

  transition:
    transform 0.18s ease,
    box-shadow 0.18s ease,
    background 0.18s ease;
}

.journal-signin:hover {
  transform: translateY(3px);
  box-shadow: 0 4px 0 #17304d;
  background: #fff3d2;
}

/* ---------- main hero ---------- */

.journal-content {
  position: relative;
  z-index: 3;

  width: min(1450px, calc(100% - 80px));
  height: calc(100% - 165px);
  margin: 0 auto;

  display: grid;
  grid-template-columns: minmax(0, 0.9fr) minmax(520px, 1.1fr);
  align-items: center;
  gap: clamp(35px, 6vw, 100px);
}

.journal-copy {
  position: relative;
  z-index: 5;
  padding-bottom: 40px;
}

.journal-eyebrow {
  display: inline-block;

  margin-bottom: 22px;
  padding: 9px 16px;

  border: 2px solid #17304d;
  border-radius: 999px;

  background: #efbd4e;

  font-family: 'Oswald', 'Inter', sans-serif;
  font-size: 14px;
  font-weight: 700;
  letter-spacing: 0.12em;
}

.journal-copy h1 {
  margin: 0;

  font-family: 'Oswald', 'Inter', sans-serif;
  font-size: clamp(60px, 6.6vw, 108px);
  line-height: 0.95;
  letter-spacing: -0.035em;

  color: #17304d;
}

.journal-copy h1 span {
  color: #c88931;
}

.journal-copy p {
  max-width: 610px;
  margin: 30px 0 34px;

  font-size: clamp(17px, 1.4vw, 22px);
  line-height: 1.65;

  color: #536376;
}

.journal-actions {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 22px;
}

.journal-primary,
.journal-secondary {
  min-height: 58px;
  padding: 0 27px;

  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 18px;

  border: 3px solid #17304d;
  border-radius: 16px;

  font-family: 'Oswald', 'Inter', sans-serif;
  font-size: 18px;
  font-weight: 700;

  cursor: pointer;
  text-decoration: none;

  transition:
    transform 0.18s ease,
    box-shadow 0.18s ease;
}

.journal-primary {
  background: #efbd4e;
  color: #17304d;
  box-shadow: 0 7px 0 #17304d;
}

.journal-primary:hover {
  transform: translateY(3px);
  box-shadow: 0 4px 0 #17304d;
}

.journal-primary span {
  font-size: 25px;
}

.journal-secondary {
  background: transparent;
  color: #17304d;
  border-style: dashed;
}

.journal-secondary:hover {
  background: rgba(239, 189, 78, 0.13);
}

/* ---------- postcard artwork ---------- */

.journal-art {
  position: relative;
  width: 100%;
  height: min(620px, 68vh);
}

.journal-postcard {
  position: absolute;

  border: 4px solid #17304d;
  border-radius: 14px;

  background: #fffaf0;

  box-shadow: 0 15px 30px rgba(23, 48, 77, 0.12);
}

.postcard-back {
  width: min(430px, 65%);
  height: 460px;

  right: 1%;
  top: 11%;

  transform: rotate(5deg);
}

.postcard-message {
  position: absolute;
  right: 35px;
  top: 180px;

  font-family: 'Newsreader', Georgia, serif;
  font-size: 38px;
  font-style: italic;
  font-weight: 700;
  line-height: 1.05;

  transform: rotate(-4deg);
}

.postcard-stamp {
  position: absolute;
  right: 26px;
  top: 24px;

  width: 86px;
  height: 98px;

  display: grid;
  place-items: center;

  border: 8px solid #f1ead8;

  background: #88a6bd;
  color: #fffaf0;

  font-size: 35px;

  transform: rotate(7deg);
}

.postcard-lines {
  position: absolute;
  right: 32px;
  bottom: 62px;

  width: 155px;

  display: grid;
  gap: 14px;
}

.postcard-lines span {
  border-bottom: 2px dotted #c5b99e;
}

.postcard-front {
  width: min(590px, 83%);
  height: 410px;

  left: 2%;
  bottom: 7%;

  padding: 22px;

  transform: rotate(-2deg);

  box-shadow:
    0 17px 35px rgba(23, 48, 77, 0.15),
    8px 10px 0 rgba(239, 189, 78, 0.16);
}

.postcard-tape {
  position: absolute;
  width: 55px;
  height: 90px;

  left: 51%;
  top: -54px;

  background: rgba(211, 75, 77, 0.9);

  clip-path: polygon(
    20% 0,
    90% 6%,
    78% 48%,
    100% 100%,
    10% 92%,
    25% 50%
  );

  transform: rotate(7deg);

  z-index: 5;
}

.postcard-picture {
  position: relative;
  height: 275px;

  overflow: hidden;

  border: 3px solid #17304d;
  border-radius: 8px;

  background:
    linear-gradient(
      180deg,
      #8fc6d5 0%,
      #cfe4dc 55%,
      #eee1b7 100%
    );
}

.picture-sky {
  position: absolute;
  inset: 0;
}

.picture-cloud {
  position: absolute;

  width: 90px;
  height: 25px;

  border-radius: 50%;
  background: rgba(255,255,255,0.65);
}

.cloud-one {
  left: 12%;
  top: 20%;
}

.cloud-two {
  right: 14%;
  top: 12%;
  transform: scale(0.7);
}

.picture-mountain {
  position: absolute;
  bottom: -5px;

  clip-path: polygon(50% 0, 100% 100%, 0 100%);
}

.mountain-back {
  width: 380px;
  height: 210px;

  right: -45px;

  background: #7b8e83;
}

.mountain-front {
  width: 430px;
  height: 230px;

  left: -50px;

  background: #526c65;
}

.picture-plane {
  position: absolute;
  top: 55px;
  left: 47%;

  color: #17304d;
  font-size: 27px;

  transform: rotate(-12deg);
}

.postcard-caption {
  padding-top: 14px;

  display: flex;
  flex-direction: column;
}

.postcard-caption strong {
  font-family: 'Oswald', 'Inter', sans-serif;
  font-size: 26px;
  line-height: 1.1;
}

.postcard-caption span {
  margin-top: 3px;
  color: #647284;
}

.postcard-stamp-small {
  position: absolute;
  right: 25px;
  bottom: 25px;

  width: 58px;
  height: 58px;

  display: grid;
  place-items: center;

  border: 2px dashed #17304d;
  border-radius: 50%;

  font-family: 'Oswald', sans-serif;
  font-size: 12px;
  line-height: 1;
  text-align: center;

  transform: rotate(10deg);
}

.journal-pin {
  position: absolute;
  right: 45%;
  top: 4%;

  color: #d34b4d;
  font-size: 62px;

  text-shadow: 0 5px 8px rgba(23,48,77,0.25);

  transform: rotate(10deg);
}

/* ---------- decorative route ---------- */

.journal-route {
  position: absolute;
  z-index: 1;

  left: 36%;
  right: -5%;
  bottom: 8%;

  height: 180px;

  border-bottom: 3px dashed rgba(200, 137, 49, 0.55);
  border-radius: 50%;

  transform: rotate(-7deg);

  pointer-events: none;
}

.route-plane {
  position: absolute;
  left: 32%;
  bottom: -16px;

  width: 48px;
  height: 48px;

  display: grid;
  place-items: center;

  border: 3px solid #17304d;
  border-radius: 50%;

  background: #efbd4e;

  font-size: 22px;

  transform: rotate(-15deg);
}

.journal-scroll {
  position: absolute;
  z-index: 10;

  left: 50%;
  bottom: 17px;

  transform: translateX(-50%);
}

.journal-scroll button {
  display: flex;
  align-items: center;
  gap: 10px;

  border: 0;
  background: transparent;

  color: #17304d;

  font-family: 'Oswald', sans-serif;
  font-weight: 600;
  letter-spacing: 0.04em;

  cursor: pointer;
}

.journal-arrow {
  display: inline-block;
  animation: journal-bounce 1.6s ease-in-out infinite;
}

@keyframes journal-bounce {
  50% {
    transform: translateY(6px);
  }
}

/* ---------- responsive ---------- */

@media (max-width: 950px) {
  .journal-content {
    width: min(90%, 760px);
    grid-template-columns: 1fr;
    align-content: center;
  }

  .journal-copy {
    text-align: center;
    padding-bottom: 0;
  }

  .journal-copy p {
    margin-left: auto;
    margin-right: auto;
  }

  .journal-actions {
    justify-content: center;
  }

  .journal-art {
    display: none;
  }

  .journal-route {
    left: 5%;
    right: 5%;
    bottom: 13%;
  }
}

@media (max-width: 600px) {
  .journal-nav {
    height: 88px;
    padding: 15px 18px;
  }

  .journal-logo {
    width: 48px;
    height: 48px;
    border-width: 3px;
    border-radius: 13px;
    box-shadow: 0 5px 0 #17304d;
    font-size: 22px;
  }

  .journal-brand {
    gap: 10px;
  }

  .journal-brand-name {
    max-width: 125px;
    font-size: 18px;
    line-height: 1.05;
  }

  .journal-signin {
    padding: 11px 14px;
    border-width: 2px;
    border-radius: 12px;
    box-shadow: 0 5px 0 #17304d;
    font-size: 14px;
  }

  .journal-content {
    width: calc(100% - 36px);
    height: calc(100% - 105px);
  }

  .journal-copy h1 {
    font-size: clamp(54px, 17vw, 76px);
  }

  .journal-copy p {
    margin: 22px auto 27px;
    font-size: 16px;
  }

  .journal-eyebrow {
    font-size: 11px;
  }

  .journal-actions {
    flex-direction: column;
    align-items: stretch;
    max-width: 300px;
    margin: auto;
  }

  .journal-primary,
  .journal-secondary {
    width: 100%;
  }

  .journal-scroll {
    bottom: 12px;
  }
}

/* =========================================================
   TRAVEL JOURNAL THEME — REST OF LANDING PAGE
   ========================================================= */

/* Shared paper background */
.lp-story,
.lp-feat {
  background:
    radial-gradient(
      circle,
      rgba(23, 48, 77, 0.09) 1.4px,
      transparent 1.5px
    ) 0 0 / 34px 34px,
    #f8f4e9;
}

/* ---------- HOW IT WORKS / STORY ---------- */

.lp-sticky {
  color: #17304d;
}

.lp-step-num {
  display: inline-flex;
  width: fit-content;

  padding: 8px 14px;
  margin-bottom: 16px;

  border: 2px solid #17304d;
  border-radius: 999px;

  background: #efbd4e;
  color: #17304d;

  font-weight: 700;
  letter-spacing: 0.08em;
}

.lp-step-title {
  color: #17304d;
  font-family: 'Oswald', 'Inter', sans-serif;
  font-weight: 700;
  letter-spacing: -0.025em;
}

.lp-step-text {
  color: #596879;
}

.lp-step-points {
  color: #17304d;
}

.lp-step-points li::marker {
  color: #c88931;
}

/* Story navigation dots */
.lp-dot {
  border-color: #17304d;
  background: #fffaf0;
}

.lp-dot.on {
  background: #efbd4e;
}

/* ---------- FEATURE SECTION ---------- */

.lp-feat {
  padding-top: 110px;
  padding-bottom: 110px;
}

.lp-feat-title {
  color: #17304d;

  font-family: 'Oswald', 'Inter', sans-serif;
  font-weight: 700;
  letter-spacing: -0.025em;
}

.lp-feat-sub {
  color: #657284;
}

/* Each feature becomes a scrapbook card */
.lp-card {
  border: 3px solid #17304d;
  border-radius: 22px;

  background: #fffaf0;

  box-shadow: 8px 9px 0 #17304d;

  overflow: visible;
}

.lp-card-in {
  background: #fffaf0;
  border-radius: 19px;
}

.lp-card h3 {
  color: #17304d;

  font-family: 'Oswald', 'Inter', sans-serif;
  font-weight: 700;
}

.lp-card p {
  color: #657284;
}

/* The mini UI illustration inside each feature */
.lp-art {
  background: #f6efdf;

  border: 2px solid rgba(23, 48, 77, 0.16);
  border-radius: 17px;
}

/* Story checklist — readable on cream background */
.lp-step-points li {
  color: #17304d;
}

.lp-step-points li::before {
  color: #c88931;
}

/* ---------- JOIN SECTION ---------- */

.lp-join-copy h2 {
  color: #17304d;

  font-family: 'Oswald', 'Inter', sans-serif;
  font-weight: 700;
  letter-spacing: -0.025em;
}

.lp-join-copy p {
  color: #657284;
}

.lp-join-link {
  color: #17304d;
  font-weight: 700;
}

.lp-join-link:hover {
  color: #c88931;
}

/* Cute postcard mountains */

.picture-mountain {
  position: absolute;
  bottom: 0;

  clip-path: polygon(50% 0, 100% 100%, 0 100%);
}

.mountain-back {
  width: 360px;
  height: 175px;

  right: -70px;
  bottom: 0;

  background: #8fa79d;

  z-index: 1;
}

.mountain-front {
  width: 440px;
  height: 225px;

  left: 50%;
  bottom: 0;

  transform: translateX(-50%);

  background: #587b72;

  z-index: 2;
}


/* ==============================
   POSTCARD LANDSCAPE
   ============================== */

.postcard-picture {
  position: relative;
  overflow: hidden;
}

/* ---------- mountains ---------- */

.mountain {
  position: absolute;
  bottom: 0;
  pointer-events: none;

  clip-path: polygon(
    50% 0%,
    100% 100%,
    0% 100%
  );
}

/* mountain behind */
.mountain-back {
  z-index: 2;

  width: 330px;
  height: 155px;

  right: -55px;
  bottom: 0;

  background: #91a99c;
}

/* main mountain */
.mountain-front {
  z-index: 3;

  width: 470px;
  height: 230px;

  left: 50%;
  bottom: 0;

  transform: translateX(-50%);

  background: #5f8175;
}

/* ---------- snow ---------- */

.snow-cap {
  position: absolute;

  width: 190px;
  height: 95px;

  left: 50%;
  top: 0;

  transform: translateX(-50%);

  background: #fffaf0;

  clip-path: polygon(
    50% 0%,
    100% 100%,
    76% 72%,
    64% 88%,
    51% 68%,
    37% 88%,
    23% 72%,
    0% 100%
  );
}

/* ---------- foreground hills ---------- */

.foreground-hill {
  position: absolute;
  z-index: 4;

  bottom: -65px;

  border-radius: 50% 50% 0 0;

  pointer-events: none;
}

.hill-one {
  width: 430px;
  height: 135px;

  left: -100px;

  background: #789888;
}

.hill-two {
  width: 450px;
  height: 125px;

  right: -120px;

  background: #698879;
}

/* ---------- plane ---------- */

.picture-plane {
  position: absolute;
  z-index: 8;

  top: 28%;
  left: 24%;

  color: #17304d;

  font-size: 27px;

  transform: rotate(-12deg);
}

</style>
