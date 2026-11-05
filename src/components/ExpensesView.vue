<template>
  <div class="xp">
    <!-- ===== Toolbar ===== -->
    <div class="xp-toolbar">
      <div class="xp-select">
        <span>Show totals in</span>
        <CustomDropdown :model-value="state.homeCurrency" :options="currencyOptions" size="sm" header-text="Home currency"
          aria-label="Home currency" @update:model-value="changeCurrency" />
      </div>
      <span v-if="!demo" class="xp-live" title="Changes from everyone on the trip show up here automatically">
        <span class="xp-live-dot" aria-hidden="true"></span> Synced with the group
      </span>
      <!-- Live rates, or the group's own (click to see and change) -->
      <ExchangeRates :home="home" :live="liveRates" :live-date="ratesDate" :live-error="ratesError" :group="state.groupRates"
        :totals="currencyTotals" :me="me" @set="setGroupRate" @reset="resetGroupRate" />
      <button v-if="state.items.length" type="button" class="btn xp-add" @click="openForm(null)" data-testid="expense-add">
        <span class="xp-coin-drop" aria-hidden="true">🪙</span> Add expense <kbd aria-hidden="true">N</kbd>
      </button>
    </div>

    <!-- ===== Empty state: an empty wallet ===== -->
    <div v-if="!state.items.length" class="xp-empty">
      <div class="xp-empty-wallet" aria-hidden="true"><span class="xp-empty-flap"></span><AppIcon name="receipt" :size="34" /></div>
      <h1 class="xp-h">No expenses yet</h1>
      <p class="xp-muted mb-0">Your trip wallet is empty. Add a receipt and the group's totals start here.</p>
      <button type="button" class="btn xp-add" @click="openForm(null)">
        <span class="xp-coin-drop" aria-hidden="true">🪙</span> Add the first expense
      </button>
    </div>

    <template v-else>
      <!-- No exchange rate for some currencies: say so, instead of showing wrong totals -->
      <div v-if="unconverted.count" class="xp-warn" role="status">
        <AppIcon name="alert" :size="16" />
        <span>
          {{ unconverted.count }} expense{{ unconverted.count === 1 ? '' : 's' }} in {{ unconverted.codes.join(', ') }}
          {{ unconverted.count === 1 ? 'is' : 'are' }} left out of the totals and balances: there's no exchange rate yet.
          Set one in <strong>Live rates</strong> above, or try again later.
        </span>
      </div>

      <!-- ===== The trip wallet: cards on the left, receipts on the right ===== -->
      <section class="xp-wallet" aria-label="Trip wallet">
        <div class="xp-side-l">
          <p class="xp-pocket-label">Trip cards</p>

          <!-- Group spent: the cash card behind the clear window -->
          <div class="xp-window">
            <div class="xp-cash">
              <span class="xp-chip" aria-hidden="true"></span>
              <span class="xp-k">Group spent</span>
              <span class="xp-big xp-num" data-testid="expense-total">{{ money(total, home) }}</span>
              <span class="xp-cash-foot">
                <span>{{ travellers.length }} traveller{{ travellers.length === 1 ? '' : 's' }}</span>
                <span>{{ dayCount }} day{{ dayCount === 1 ? '' : 's' }}</span>
              </span>

              <!-- Budget: ten notes; the spent ones turn into dashed outlines -->
              <template v-if="state.budget">
                <span class="xp-budget-row">
                  <span>Budget {{ money(state.budget, home) }}</span>
                  <span class="xp-num" :class="{ over: budgetPct > 100 }">
                    {{ budgetPct > 100 ? money(total - state.budget, home) + ' over' : money(state.budget - total, home) + ' left' }}
                  </span>
                </span>
                <span class="xp-notes" :class="{ over: budgetPct > 100 }" role="progressbar" :aria-valuenow="Math.round(budgetPct)"
                  aria-valuemin="0" aria-valuemax="100" aria-label="Budget used">
                  <i v-for="n in 10" :key="n" :class="{ spent: n <= spentNotes }"></i>
                </span>
                <span class="xp-cash-foot">
                  <span>{{ Math.round(budgetPct) }}% used</span>
                  <button type="button" class="xp-link" @click="editBudget">Edit budget</button>
                </span>
              </template>
              <button v-else type="button" class="xp-link xp-set-budget" @click="editBudget">+ Set a budget</button>
              <form v-if="budgetEditing" class="xp-budget-form" @submit.prevent="saveBudget">
                <label for="xp-budget" class="visually-hidden">Budget in {{ home }}</label>
                <input id="xp-budget" ref="budget" v-model.number="budgetInput" type="number" min="0" class="form-control form-control-sm" :placeholder="'Budget in ' + home">
                <button type="submit" class="btn btn-sm xp-mini">Save</button>
              </form>
            </div>
          </div>

          <!-- The other cards peek out of leather slots -->
          <div class="xp-slots">
            <div class="xp-slot">
              <div class="xp-slot-card amber">
                <span class="xp-slot-icon" aria-hidden="true">⚖️</span>
                <span class="xp-slot-text">
                  <span class="xp-k">Your balance</span>
                  <span class="xp-slot-v xp-num" :class="myBalance > 0.009 ? 'pos' : myBalance < -0.009 ? 'neg' : ''">
                    {{ myBalance > 0.009 ? '+ ' : myBalance < -0.009 ? '− ' : '' }}{{ money(Math.abs(myBalance), home) }}
                  </span>
                  <span class="xp-slot-sub">{{ myBalance > 0.009 ? 'The group owes you' : myBalance < -0.009 ? 'You owe the group' : "You're all settled" }}</span>
                </span>
                <span class="xp-stamp" :class="myBalance > 0.009 ? 'owed' : myBalance < -0.009 ? 'owe' : 'ok'">
                  {{ myBalance > 0.009 ? 'Owed' : myBalance < -0.009 ? 'You owe' : 'Settled' }}
                </span>
              </div>
              <span class="xp-slot-lip" aria-hidden="true"></span>
            </div>
            <div class="xp-slot">
              <div class="xp-slot-card teal">
                <span class="xp-slot-icon" aria-hidden="true">🧾</span>
                <span class="xp-slot-text">
                  <span class="xp-k">Your share</span>
                  <span class="xp-slot-v xp-num">{{ money(myShare, home) }}</span>
                  <span class="xp-slot-sub">What you've used of the group's spending</span>
                </span>
              </div>
              <span class="xp-slot-lip" aria-hidden="true"></span>
            </div>
            <div class="xp-slot">
              <div class="xp-slot-card peach">
                <span class="xp-slot-icon" aria-hidden="true">📅</span>
                <span class="xp-slot-text">
                  <span class="xp-k">Per day</span>
                  <span class="xp-slot-v xp-num">{{ money(perDay, home) }}</span>
                  <span class="xp-slot-sub">Group average over {{ dayCount }} day{{ dayCount === 1 ? '' : 's' }}</span>
                </span>
              </div>
              <span class="xp-slot-lip" aria-hidden="true"></span>
            </div>
          </div>
        </div>

        <div class="xp-spine" aria-hidden="true"></div>

        <!-- ===== Receipts: one receipt per day ===== -->
        <div class="xp-side-r" aria-labelledby="xp-feed-title">
          <h3 id="xp-feed-title" class="xp-pocket-label">Receipts <span class="xp-count">{{ state.items.length }}</span></h3>
          <div class="xp-pocket">
            <span class="xp-pocket-lip" aria-hidden="true"></span>
            <div class="xp-pocket-tools">
              <div class="xp-search">
                <AppIcon name="search" :size="16" />
                <label for="xp-search" class="visually-hidden">Search expenses</label>
                <input id="xp-search" v-model="search" type="search" placeholder="Search receipts">
              </div>
              <div class="xp-filters">
                <CustomDropdown v-model="filterCat" :options="categoryOptions" size="sm" header-text="Category" aria-label="Filter by category" />
              </div>
            </div>

            <div class="xp-receipts">
              <p v-if="!feed.length" class="xp-receipt xp-nothing">Nothing matches. <button type="button" class="xp-link" @click="search = ''; filterCat = ''">Clear filters</button></p>

              <article v-for="day in feed" :key="day.date" class="xp-receipt">
                <div class="xp-r-head">
                  <span class="xp-r-day">{{ day.label }}<small>{{ longDate(day.date) }}</small></span>
                  <span class="xp-r-count">{{ day.items.length }} item{{ day.items.length === 1 ? '' : 's' }}</span>
                </div>
                <ul class="xp-list">
                  <li v-for="e in day.items" :key="e.id">
                    <button type="button" class="xp-row" @click="openForm(e)" :aria-label="'Edit ' + e.title">
                      <span class="xp-coin" :style="{ '--c': categoryOf(e.category).color }" aria-hidden="true">{{ categoryOf(e.category).icon }}</span>
                      <span class="xp-row-main">
                        <span class="xp-row-title">{{ e.title }}</span>
                        <span class="xp-row-sub">
                          {{ e.paidBy === me ? 'You' : e.paidBy }} paid · {{ splitText(e) }}
                          <template v-if="e.addedBy && e.addedBy !== me && e.addedBy !== e.paidBy"> · added by {{ e.addedBy }}</template>
                        </span>
                      </span>
                      <span class="xp-leader" aria-hidden="true"></span>
                      <span class="xp-row-right">
                        <span class="xp-num xp-row-amount">{{ money(e.amount, e.currency) }}</span>
                        <span v-if="e.unconverted" class="xp-row-conv xp-unconv">not in totals yet (no {{ e.currency }} rate)</span>
                        <span v-else-if="e.currency !== home" class="xp-row-conv xp-num">≈ {{ money(e.home, home) }}</span>
                        <span v-if="!e.unconverted" class="xp-effect" :class="e.effect > 0.009 ? 'pos' : e.effect < -0.009 ? 'neg' : ''">
                          {{ e.effect > 0.009 ? 'you lent ' + money(e.effect, home) : e.effect < -0.009 ? 'you owe ' + money(-e.effect, home) : e.mine > 0.009 ? 'your own share' : 'not involved' }}
                        </span>
                      </span>
                    </button>
                  </li>
                </ul>
                <div class="xp-r-total"><span>Total</span><span class="xp-num">{{ money(day.total, home) }}</span></div>
                <span class="xp-barcode" aria-hidden="true"></span>
              </article>
            </div>
          </div>
        </div>
      </section>

      <div class="xp-lower">
        <!-- ===== Who owes whom: banknotes, IOUs, and the zipped purse ===== -->
        <section class="xp-card" aria-labelledby="xp-bal-title">
          <h3 id="xp-bal-title" class="xp-h">Who owes whom <small>{{ travellers.length }} traveller{{ travellers.length === 1 ? '' : 's' }}</small></h3>
          <ul class="xp-bal">
            <li v-for="b in balanceList" :key="b.name" class="xp-bal-row" :class="b.amount > 0.009 ? 'pos' : b.amount < -0.009 ? 'neg' : 'zero'">
              <span class="xp-avatar" :style="{ background: personColor(b.name) }" aria-hidden="true">{{ b.name.charAt(0).toUpperCase() }}</span>
              <span class="xp-bal-name">
                {{ b.name }}
                <span v-if="b.name === me" class="xp-you">You</span>
              </span>
              <span class="xp-bal-amt xp-num">
                <span class="xp-bal-word">{{ b.amount > 0.009 ? 'gets back' : b.amount < -0.009 ? 'owes' : 'settled' }}</span>
                <template v-if="Math.abs(b.amount) > 0.009"><span class="xp-bal-sign" aria-hidden="true">{{ b.amount > 0 ? '+' : '−' }}</span>{{ money(Math.abs(b.amount), home) }}</template>
                <template v-else>✓</template>
              </span>
            </li>
          </ul>

          <h4 class="xp-sub-h">Settle up</h4>
          <div v-if="!payments.length" class="xp-square">
            <span class="xp-purse" aria-hidden="true"></span>
            <span class="xp-square-stamp">All square</span>
            <span class="xp-muted">Nobody owes anything right now.</span>
          </div>
          <ul class="xp-pay">
            <!-- From → to, with the amount on the arrow -->
            <li v-for="p in payments" :key="p.from + p.to" class="xp-cheque">
              <span class="xp-pay-who">
                <span class="xp-avatar sm" :style="{ background: personColor(p.from) }" aria-hidden="true">{{ p.from.charAt(0).toUpperCase() }}</span>
                <strong>{{ p.from === me ? 'You' : p.from }}</strong>
              </span>
              <span class="xp-pay-arrow">
                <span class="xp-num xp-pay-amt">{{ money(p.amount, home) }}</span>
                <span class="xp-pay-line" aria-hidden="true"></span>
                <span class="visually-hidden">{{ p.from === me ? 'pay' : 'pays' }}</span>
              </span>
              <span class="xp-pay-who">
                <span class="xp-avatar sm" :style="{ background: personColor(p.to) }" aria-hidden="true">{{ p.to.charAt(0).toUpperCase() }}</span>
                <strong>{{ p.to === me ? 'you' : p.to }}</strong>
              </span>
              <!-- Only the two people in a payment can settle it -->
              <span v-if="pendingFor(p)" class="xp-wait">Waiting for {{ p.to === me ? 'you' : p.to }} to confirm</span>
              <button v-else-if="p.to === me" type="button" class="btn btn-sm xp-paid" @click="markPaid(p)">Mark received</button>
              <button v-else-if="p.from === me" type="button" class="btn btn-sm xp-paid" @click="markPaid(p)">I've paid</button>
              <span v-else class="xp-only">Only {{ p.from }} or {{ p.to }} can settle this</span>
            </li>
          </ul>

          <!-- Payments waiting for the receiver to confirm -->
          <div v-if="pendingSettlements.length" class="xp-pending">
            <h5 class="xp-pending-h">Waiting to be confirmed <span class="xp-count">{{ pendingSettlements.length }}</span></h5>
            <ul class="xp-slips">
              <li v-for="s in pendingSettlements" :key="s.id" class="xp-slip pending">
                <span class="xp-avatar sm" :style="{ background: personColor(s.from) }" aria-hidden="true">{{ s.from.charAt(0).toUpperCase() }}</span>
                <span class="xp-slip-text">
                  <template v-if="s.to === me"><strong>{{ s.from }}</strong> says they paid <strong>you</strong></template>
                  <template v-else><strong>{{ s.from === me ? 'You' : s.from }}</strong> paid <strong>{{ s.to }}</strong>, waiting for {{ s.to }} to confirm</template>
                  <small v-if="s.date">{{ shortDate(s.date) }}</small>
                </span>
                <span class="xp-slip-amount xp-num">{{ money(s.amount, home) }}</span>
                <template v-if="s.to === me">
                  <button type="button" class="xp-slip-ok" @click="confirmPayment(s.id)">Got it</button>
                  <button type="button" class="xp-slip-undo" @click="undoPayment(s.id)">Not received</button>
                </template>
                <button v-else-if="s.from === me || s.addedBy === me" type="button" class="xp-slip-undo" @click="undoPayment(s.id)">Cancel</button>
              </li>
            </ul>
          </div>
          <!-- Payments already made: little "PAID" slips -->
          <details v-if="confirmedSettlements.length" class="xp-history">
            <summary>
              <span class="xp-history-chev" aria-hidden="true"></span>
              Payments made <span class="xp-count">{{ confirmedSettlements.length }}</span>
            </summary>
            <ul class="xp-slips">
              <li v-for="s in confirmedSettlements" :key="s.id" class="xp-slip">
                <span class="xp-avatar sm" :style="{ background: personColor(s.from) }" aria-hidden="true">{{ s.from.charAt(0).toUpperCase() }}</span>
                <span class="xp-slip-text">
                  <strong>{{ s.from === me ? 'You' : s.from }}</strong> paid <strong>{{ s.to === me ? 'you' : s.to }}</strong>
                  <small v-if="s.date">{{ shortDate(s.date) }}</small>
                </span>
                <span class="xp-slip-amount xp-num">{{ money(s.amount, home) }}</span>
                <span class="xp-slip-stamp" aria-hidden="true">Paid</span>
                <button v-if="canChange(s)" type="button" class="xp-slip-undo" :aria-label="'Undo: ' + (s.from === me ? 'you' : s.from) + ' paid ' + (s.to === me ? 'you' : s.to)" @click="undoPayment(s.id)">Undo</button>
              </li>
            </ul>
          </details>
        </section>

        <div class="xp-lower-side">
          <!-- ===== Where it went: a coin stack per category ===== -->
          <section class="xp-card" aria-labelledby="xp-cat-title">
            <div class="xp-cat-head">
              <h3 id="xp-cat-title" class="xp-h">Where it went</h3>
              <!-- Same filter as the receipts: picking a category here filters them too -->
              <div class="xp-filters">
                <CustomDropdown v-model="filterCat" :options="categoryOptions" size="sm" header-text="Category" aria-label="Filter receipts by category" />
              </div>
            </div>
            <!-- One row per category: coin, name, amount, and a bar (tap a row to filter the receipts) -->
            <ul class="xp-cats" :aria-label="categoryAria">
              <li v-for="c in byCategory" :key="c.key">
                <button type="button" class="xp-cat" :class="{ on: filterCat === c.key }" :style="{ '--c': c.color }"
                  :aria-pressed="filterCat === c.key" @click="filterCat = filterCat === c.key ? '' : c.key">
                  <span class="xp-coin" aria-hidden="true">{{ c.icon }}</span>
                  <span class="xp-cat-main">
                    <span class="xp-cat-top">
                      <span class="xp-cat-name">{{ c.label }}</span>
                      <span class="xp-cat-amt xp-num">{{ money(c.amount, home) }}</span>
                    </span>
                    <span class="xp-cat-track" aria-hidden="true">
                      <span class="xp-cat-fill" :style="{ width: Math.max(c.pct, 3) + '%' }"></span>
                    </span>
                  </span>
                  <span class="xp-cat-pct xp-num">{{ Math.round(c.pct) }}%</span>
                </button>
              </li>
            </ul>
          </section>

          <!-- ===== Spending per day ===== -->
          <section v-if="days.length > 1" class="xp-card" aria-labelledby="xp-day-title">
            <h3 id="xp-day-title" class="xp-h">Per day
              <small class="xp-num">{{ hoverDay ? longDate(hoverDay.date) + ' · ' + money(hoverDay.amount, home) : 'Highest ' + money(maxDay, home) }}</small>
            </h3>
            <div class="xp-bars">
              <button v-for="d in days" :key="d.date" type="button" class="xp-bar-hit" :class="{ active: hoverDay && hoverDay.date === d.date }"
                :aria-label="longDate(d.date) + ': ' + money(d.amount, home)"
                @mouseenter="hoverDay = d" @focus="hoverDay = d" @mouseleave="hoverDay = null" @blur="hoverDay = null">
                <span class="xp-bar" :class="{ zero: !d.amount, top: d.amount && d.amount === maxDay }"
                  :style="{ height: d.amount && maxDay ? Math.max(d.amount / maxDay * 100, 4) + '%' : '4px' }">
                  <span v-if="d.amount && d.amount === maxDay" class="xp-bar-tag" aria-hidden="true">Biggest day</span>
                </span>
              </button>
            </div>
            <div class="xp-bar-dates">
              <span>{{ shortDate(days[0].date) }}</span><span>{{ shortDate(days[days.length - 1].date) }}</span>
            </div>
          </section>
        </div>
      </div>

      <p class="xp-muted small text-end mt-2 mb-0" role="status">{{ saveStatus }}</p>
    </template>

    <!-- Teleport: the panel sits above the whole page, including the sticky top bar -->
    <Teleport to="body">
    <ExpenseForm v-if="showForm" :expense="editing" :travellers="travellers" :me="me" :home-currency="home"
      :last-currency="lastCurrency" :rates="rates" :default-date="defaultDate"
      @save="saveExpense" @delete="deleteExpense" @close="showForm = false" />
    </Teleport>

    <!-- What others just changed (shown for a few seconds) -->
    <Teleport to="body">
      <transition-group name="xp-toast" tag="div" class="xp-toasts" aria-live="polite">
        <div v-for="t in toasts" :key="t.id" class="xp-toast" title="Tap to close" @click="closeToast(t.id)">
          <span class="xp-avatar sm" aria-hidden="true">{{ t.who.charAt(0).toUpperCase() }}</span>
          <span>{{ t.text }}</span>
        </div>
      </transition-group>
    </Teleport>
  </div>
</template>

<script>
import axios from 'axios'
import ExpenseForm from './ExpenseForm.vue'
import ExchangeRates from './ExchangeRates.vue'
import CustomDropdown from './CustomDropdown.vue'
import { CATEGORIES, CURRENCIES, currencyOptions, categoryOf, money, toHome, sharesOf, balances, settleUp, demoExpenses } from '../expenses.js'
import AppIcon from './AppIcon.vue'

export default {
  components: { AppIcon, ExpenseForm, CustomDropdown, ExchangeRates },
  props: {
    tripId: { type: String, default: '' },
    travellers: { type: Array, default: () => [] },
    startDate: { type: String, default: '' },
    endDate: { type: String, default: '' },
    initial: { type: Object, default: null }, // saved expenses, or null
    me: { type: String, default: '' }          // my traveller name on this trip
  },

  data() {
    const demo = this.tripId === 'seoul'
    const saved = demo ? demoExpenses() : this.initial || {}
    return {
      CATEGORIES,
      CURRENCIES,
      currencyOptions: currencyOptions(),
      categoryOptions: [{ value: '', label: 'All categories', icon: '🗂' }].concat(CATEGORIES.map((c) => ({ value: c.key, label: c.label, icon: c.icon }))),
      demo,
      state: {
        homeCurrency: saved.homeCurrency || 'SGD',
        budget: saved.budget || null,
        items: saved.items || [],
        settlements: saved.settlements || [],
        groupRates: saved.groupRates || {}
      },
      liveRates: {}, // from /api/rates; the group's own rates (state.groupRates) win, see rates()
      ratesDate: '',
      ratesError: '',
      showForm: false,
      editing: null,
      search: '',
      filterCat: '',
      hoverDay: null,
      budgetEditing: false,
      budgetInput: null,
      saveStatus: '',
      pollTimer: null,
      toasts: []
    }
  },

  computed: {
    // Rates used for every conversion: live, with the group's own rates on top (if set for this home currency)
    rates() {
      const merged = { ...this.liveRates }
      for (const c in this.state.groupRates || {}) {
        const g = this.state.groupRates[c]
        if (g && g.base === this.home && g.rate > 0) merged[c] = g.rate
      }
      return merged
    },
    // How much was spent in each currency (for the rates panel's "what would change")
    currencyTotals() {
      const totals = {}
      for (const e of this.state.items) totals[e.currency] = (totals[e.currency] || 0) + e.amount
      return totals
    },
    home() {
      return this.state.homeCurrency
    },

    // Every expense with its home-currency amount and what it means for "me"
    items() {
      const list = []
      for (const e of this.state.items) {
        const converted = toHome(e.amount, e.currency, this.rates, this.home)
        if (converted === null) {
          // No rate for this currency yet: leave it out of the totals instead of guessing
          list.push({ ...e, home: 0, mine: 0, effect: 0, unconverted: true })
          continue
        }
        const shares = sharesOf(e)
        const mine = shares[this.me] ? toHome(shares[this.me], e.currency, this.rates, this.home) : 0
        // + = I lent money on this one, - = I owe for it
        const effect = (e.paidBy === this.me ? converted : 0) - mine
        list.push({ ...e, home: converted, mine, effect, unconverted: false })
      }
      return list
    },

    // Expenses in a currency we have no rate for (left out of the totals)
    unconverted() {
      const codes = []
      let count = 0
      for (const e of this.items) {
        if (!e.unconverted) continue
        count++
        if (!codes.includes(e.currency)) codes.push(e.currency)
      }
      return { count, codes }
    },

    total() {
      let sum = 0
      for (const e of this.items) sum += e.home
      return sum
    },

    myShare() {
      let sum = 0
      for (const e of this.items) sum += e.mine
      return sum
    },

    budgetPct() {
      return this.state.budget ? (this.total / this.state.budget) * 100 : 0
    },
    // Budget shown as ten notes: how many are spent
    spentNotes() {
      return Math.min(10, Math.round(this.budgetPct / 10))
    },

    balanceMap() {
      return balances(this.travellers, this.state.items, this.state.settlements, this.rates, this.home)
    },

    myBalance() {
      return this.balanceMap[this.me] || 0
    },

    balanceList() {
      const list = []
      for (const name of this.travellers) list.push({ name, amount: this.balanceMap[name] || 0 })
      list.sort((a, b) => b.amount - a.amount)
      return list
    },

    payments() {
      return settleUp(this.balanceMap)
    },
    // Payments the receiver has confirmed (older ones without a status count as confirmed)
    confirmedSettlements() {
      return this.state.settlements.filter((s) => s.status !== 'pending')
    },
    // "I've paid" from the payer, waiting for the receiver's "Got it"
    pendingSettlements() {
      return this.state.settlements.filter((s) => s.status === 'pending')
    },

    // Category totals, biggest first
    byCategory() {
      const list = []
      for (const c of CATEGORIES) {
        let amount = 0
        for (const e of this.items) {
          if (e.category === c.key) amount += e.home
        }
        if (amount > 0) list.push({ ...c, amount, pct: this.total ? (amount / this.total) * 100 : 0 })
      }
      return list
    },

    categoryAria() {
      const parts = []
      for (const c of this.byCategory) parts.push(c.label + ' ' + Math.round(c.pct) + '%')
      return 'Spending by category: ' + parts.join(', ')
    },

    // One entry per day of the trip (or of the expenses if the trip has no dates)
    days() {
      const dates = []
      for (const e of this.items) dates.push(e.date)
      dates.sort()
      const first = this.startDate || dates[0]
      const last = this.endDate || dates[dates.length - 1]
      if (!first || !last) return []
      const list = []
      const d = new Date(first + 'T00:00:00Z')
      const end = new Date(last + 'T00:00:00Z')
      while (d <= end && list.length < 60) {
        const date = d.toISOString().slice(0, 10)
        let amount = 0
        for (const e of this.items) {
          if (e.date === date) amount += e.home
        }
        list.push({ date, amount })
        d.setUTCDate(d.getUTCDate() + 1)
      }
      return list
    },

    dayCount() {
      return Math.max(1, this.days.length)
    },

    perDay() {
      return this.total / this.dayCount
    },

    maxDay() {
      let max = 0
      for (const d of this.days) max = Math.max(max, d.amount)
      return max
    },

    // Search + category filter, grouped by day (newest first)
    feed() {
      const q = this.search.trim().toLowerCase()
      const groups = []
      const sorted = this.items.slice().sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0))
      for (const e of sorted) {
        if (this.filterCat && e.category !== this.filterCat) continue
        if (q && !e.title.toLowerCase().includes(q) && !e.paidBy.toLowerCase().includes(q)) continue
        let group = groups.find((g) => g.date === e.date)
        if (!group) {
          group = { date: e.date, label: this.dayLabel(e.date), total: 0, items: [] }
          groups.push(group)
        }
        group.items.push(e)
        group.total += e.home
      }
      return groups
    },

    defaultDate() {
      const today = new Date().toISOString().slice(0, 10)
      if (this.startDate && today < this.startDate) return this.startDate
      if (this.endDate && today > this.endDate) return this.endDate
      return today
    },

    lastCurrency() {
      const last = this.state.items[this.state.items.length - 1]
      return last ? last.currency : ''
    }
  },

  created() {
    this.loadRates()
  },

  mounted() {
    window.addEventListener('keydown', this.onKey)
    // Check for other people's changes every 15 s while the tab is open
    if (!this.demo) this.pollTimer = setInterval(this.poll, 15000)
  },

  beforeUnmount() {
    window.removeEventListener('keydown', this.onKey)
    clearInterval(this.pollTimer)
  },

  methods: {
    // Each traveller keeps the same avatar colour everywhere on this tab
    personColor(name) {
      const colours = ['#ffd36e', '#8fd3dd', '#f9ab9e', '#a9dfbb', '#ffc9a3', '#c9b8f0']
      const i = this.travellers.indexOf(name)
      return colours[(i < 0 ? 0 : i) % colours.length]
    },
    money,
    categoryOf,

    async loadRates() {
      this.ratesError = ''
      try {
        const res = await axios.get('/api/rates', { params: { base: this.home } })
        this.liveRates = res.data.rates
        this.ratesDate = res.data.date
      } catch (err) {
        this.liveRates = {}
        this.ratesError = 'Live rates unavailable, other currencies are not converted'
      }
    },

    // Press N anywhere (except while typing) to add an expense
    onKey(e) {
      const typing = ['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement && document.activeElement.tagName)
      if (e.key.toLowerCase() === 'n' && !typing && !this.showForm && !e.metaKey && !e.ctrlKey && this.$el.offsetParent) {
        e.preventDefault()
        this.openForm(null)
      }
    },

    openForm(expense) {
      this.editing = expense ? this.state.items.find((x) => x.id === expense.id) : null
      this.showForm = true
    },

    // Every change is one small request; the server answers with the latest expenses from everyone
    async send(method, path, body) {
      this.saveStatus = 'Saving…'
      try {
        const res = await axios({ method, url: '/api/trips/' + this.tripId + '/expenses' + path, data: body })
        this.applyServer(res.data, false)
        this.saveStatus = 'Saved ✓'
        return true
      } catch (err) {
        this.saveStatus = (err.response && err.response.data && err.response.data.message) || 'Could not save. Check your connection.'
        return false
      }
    },

    // Take the server's copy. With notify, say what other people added.
    applyServer(data, notify) {
      if (notify) {
        const known = this.state.items.map((x) => x.id)
        for (const x of data.items || []) {
          if (!known.includes(x.id) && x.addedBy && x.addedBy !== this.me) {
            this.toast(x.addedBy, x.addedBy + ' added ' + x.title + ' · ' + money(x.amount, x.currency))
          }
        }
        const knownPay = this.state.settlements.map((x) => x.id)
        for (const p of data.settlements || []) {
          const amount = money(p.amount, data.homeCurrency || this.home)
          if (!knownPay.includes(p.id) && p.addedBy && p.addedBy !== this.me) {
            if (p.status === 'pending' && p.to === this.me) this.toast(p.from, p.from + ' says they paid you ' + amount + '. Confirm it under Settle up')
            else this.toast(p.addedBy, p.from + ' paid ' + p.to + ' ' + amount)
          }
          // My "I've paid" was just confirmed
          const before = this.state.settlements.find((x) => x.id === p.id)
          if (before && before.status === 'pending' && p.status !== 'pending' && p.from === this.me) {
            this.toast(p.to, p.to + ' confirmed your payment of ' + amount)
          }
        }
      }
      if (notify) {
        const mine = this.state.groupRates || {}
        for (const c in data.groupRates || {}) {
          const g = data.groupRates[c]
          if (g && g.by !== this.me && (!mine[c] || mine[c].at !== g.at)) {
            this.toast(g.by, g.by + ' set the group rate: 1 ' + g.base + ' = ' + g.rate + ' ' + c)
          }
        }
      }
      const currencyChanged = data.homeCurrency && data.homeCurrency !== this.state.homeCurrency
      this.state = {
        homeCurrency: data.homeCurrency || 'SGD',
        budget: data.budget || null,
        items: data.items || [],
        settlements: data.settlements || [],
        groupRates: data.groupRates || {}
      }
      if (currencyChanged) this.loadRates()
    },

    async poll() {
      if (!this.$el.offsetParent || this.showForm || document.hidden) return // only while you're looking
      try {
        const res = await axios.get('/api/trips/' + this.tripId + '/expenses')
        this.applyServer(res.data, true)
      } catch (err) {
        // try again next time
      }
    },

    toast(who, text) {
      const id = Math.random()
      this.toasts.push({ id, who, text })
      // (matched by id: the list holds Vue's reactive copy, so comparing the objects never matched and it stayed up)
      setTimeout(() => this.closeToast(id), 5000)
    },
    closeToast(id) {
      this.toasts = this.toasts.filter((x) => x.id !== id)
    },

    async saveExpense(expense) {
      if (this.demo) {
        const i = this.state.items.findIndex((x) => x.id === expense.id)
        if (i >= 0) this.state.items.splice(i, 1, expense)
        else this.state.items.push(expense)
        this.showForm = false
        return
      }
      const exists = this.state.items.some((x) => x.id === expense.id)
      const ok = exists ? await this.send('put', '/items/' + expense.id, expense) : await this.send('post', '/items', expense)
      if (ok) this.showForm = false
    },

    async deleteExpense(id) {
      if (this.demo) this.state.items = this.state.items.filter((x) => x.id !== id)
      else if (!(await this.send('delete', '/items/' + id))) return
      this.showForm = false
    },

    // The receiver marking it received settles it; the payer saying they've paid waits for the receiver
    markPaid(p) {
      if (this.demo) {
        const status = p.to === this.me ? 'confirmed' : 'pending'
        this.state.settlements.push({ id: 's' + Date.now(), from: p.from, to: p.to, amount: p.amount, date: new Date().toISOString().slice(0, 10), addedBy: this.me, status })
      } else {
        this.send('post', '/settlements', { from: p.from, to: p.to, amount: p.amount })
      }
    },

    // The receiver: "Got it"
    confirmPayment(id) {
      if (this.demo) {
        const list = []
        for (const s of this.state.settlements) list.push(s.id === id ? { ...s, status: 'confirmed' } : s)
        this.state.settlements = list
      } else {
        this.send('post', '/settlements/' + id + '/confirm')
      }
    },

    // Undo / cancel / "Not received"
    undoPayment(id) {
      if (this.demo) this.state.settlements = this.state.settlements.filter((s) => s.id !== id)
      else this.send('delete', '/settlements/' + id)
    },

    // The pending "I've paid" for this payer -> receiver, if there is one
    pendingFor(p) {
      return this.pendingSettlements.find((s) => s.from === p.from && s.to === p.to) || null
    },
    // Only the payer, the receiver or whoever recorded a payment can undo it
    canChange(s) {
      return s.from === this.me || s.to === this.me || s.addedBy === this.me
    },

    // The group's own exchange rate (saved for everyone on the trip)
    setGroupRate(code, rate) {
      if (this.demo) {
        this.state.groupRates = { ...this.state.groupRates, [code]: { base: this.home, rate, by: this.me, at: new Date().toISOString() } }
        return
      }
      this.send('put', '/rates/' + code, { rate })
    },
    resetGroupRate(code) {
      if (this.demo) {
        const copy = { ...this.state.groupRates }
        delete copy[code]
        this.state.groupRates = copy
        return
      }
      this.send('delete', '/rates/' + code)
    },

    changeCurrency(code) {
      this.state.homeCurrency = code
      this.loadRates()
      if (!this.demo) this.send('patch', '/settings', { homeCurrency: code })
    },

    editBudget() {
      this.budgetInput = this.state.budget
      this.budgetEditing = true
      this.$nextTick(() => this.$refs.budget && this.$refs.budget.focus())
    },

    saveBudget() {
      this.state.budget = this.budgetInput > 0 ? this.budgetInput : null
      this.budgetEditing = false
      if (!this.demo) this.send('patch', '/settings', { budget: this.state.budget })
    },

    splitText(e) {
      const count = Object.keys(sharesOf(e)).length
      if (e.splitType === 'exact') return 'exact amounts, ' + count + (count === 1 ? ' person' : ' people')
      return count === this.travellers.length ? 'split equally' : 'split ' + count + ' ways'
    },

    // "Day 2" if the date is inside the trip
    dayLabel(date) {
      if (!this.startDate || date < this.startDate || (this.endDate && date > this.endDate)) return 'Before/after trip'
      return 'Day ' + (Math.round((new Date(date) - new Date(this.startDate)) / 86400000) + 1)
    },

    longDate(date) {
      return new Date(date + 'T00:00:00').toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })
    },

    shortDate(date) {
      return new Date(date + 'T00:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
    }
  }
}
</script>

<style scoped>
/* Expenses & split as an open travel wallet (colours and fonts from src/assets/scrapbook.css):
   cards in the left slots, receipts in the right pocket, banknotes for who owes whom. */
.xp {
  --ink: var(--sb-ink);
  --muted: var(--sb-ink-soft);
  --pos: #1f7a4d;
  --neg: #d1495b;
  --leather: #2f8f9d;
  --leather-dk: #23707b;
  --paper-card: #fffdf8;
  color: var(--sb-ink);
}
.xp-muted {
  color: var(--muted);
}
.xp-num {
  font-variant-numeric: tabular-nums;
}
.xp-h {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 10px;
  margin: 0 0 14px;
  font-family: var(--sb-display);
  font-weight: 400;
  font-size: 1.45rem;
  letter-spacing: 0.01em;
  color: var(--sb-ink);
}
.xp-h small {
  font-family: var(--font-body);
  font-size: 12.5px;
  font-weight: 700;
  letter-spacing: 0;
  color: var(--muted);
}
.xp-k {
  display: block;
  font-size: 11px;
  font-weight: 800;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: var(--muted);
}
.xp-link {
  border: 0;
  padding: 0;
  background: none;
  color: var(--sb-ink);
  font-weight: 800;
  text-decoration: underline;
  text-decoration-color: var(--sb-amber);
  text-decoration-thickness: 3px;
  text-underline-offset: 3px;
}
.xp-link:hover {
  color: var(--sb-ink);
  text-decoration-color: var(--sb-ink);
}

/* ===== Toolbar ===== */
.xp-toolbar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 10px;
  margin-bottom: 24px;
}
.xp-select {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  margin: 0;
  padding: 3px 4px 3px 14px;
  border: 2px solid var(--sb-ink);
  border-radius: 999px;
  background: var(--paper-card);
  box-shadow: 0 3px 0 var(--sb-ink);
  font-size: 13px;
  font-weight: 700;
  color: var(--sb-ink);
}
.xp-select :deep(.dd-trigger) {
  border: 2px solid var(--sb-ink);
  border-radius: 999px;
  background: var(--sb-amber);
  color: var(--sb-ink);
  font-weight: 800;
  box-shadow: none;
}
.xp-live {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 5px 11px;
  border: 2px dashed rgba(18, 50, 74, 0.35);
  border-radius: 999px;
  font-size: 12.5px;
  font-weight: 700;
  color: var(--muted);
}
.xp-live-dot {
  width: 9px;
  height: 9px;
  border: 1.5px solid var(--sb-ink);
  border-radius: 50%;
  background: #4caf7d;
  box-shadow: 0 0 0 0 rgba(76, 175, 125, 0.6);
  animation: xp-pulse 2s infinite;
}
@keyframes xp-pulse {
  70% { box-shadow: 0 0 0 7px rgba(76, 175, 125, 0); }
  100% { box-shadow: 0 0 0 0 rgba(76, 175, 125, 0); }
}
.xp-toolbar :deep(.er-trigger) {
  padding: 5px 12px;
  border: 2px dashed rgba(18, 50, 74, 0.35);
  border-radius: 999px;
  background: transparent;
  color: var(--sb-ink);
  font-size: 12.5px;
  font-weight: 700;
}
.xp-toolbar :deep(.er-trigger:hover),
.xp-toolbar :deep(.er-trigger[aria-expanded='true']) {
  border-style: solid;
  border-color: var(--sb-ink);
  background: var(--paper-card);
}
/* The rates panel in the journal look: cream card, navy outline, hard shadow */
/* "+ Add a currency" (pick another currency to set its rate): a dashed cream pill, so its words show */
.xp-toolbar :deep(.er-add .dd-trigger) {
  border: 2px dashed var(--sb-ink);
  border-radius: 999px;
  background: #fffaf0;
  box-shadow: none;
  color: var(--sb-ink);
  font-weight: 800;
}
.xp-toolbar :deep(.er-add .dd-trigger:hover) {
  border-style: solid;
  background: #fff1cf;
}
.xp-toolbar :deep(.er-add .dd-value),
.xp-toolbar :deep(.er-add .dd-value.placeholder),
.xp-toolbar :deep(.er-add .dd-chevron) {
  color: var(--sb-ink);
  opacity: 1;
  background: none;
}
.xp-toolbar :deep(.er-panel) {
  border: 2.5px solid var(--sb-ink);
  border-radius: 16px;
  background: #fffaf0;
  box-shadow: 0 6px 0 var(--sb-ink);
  color: var(--sb-ink);
}
.xp-toolbar :deep(.er-title) {
  font-family: var(--sb-display);
  font-size: 1.3rem;
  font-weight: 400;
  letter-spacing: 0.02em;
}
.xp-toolbar :deep(.er-sub),
.xp-toolbar :deep(.er-empty),
.xp-toolbar :deep(.er-meta),
.xp-toolbar :deep(.er-dim) {
  color: var(--sb-ink-soft);
  font-weight: 600;
}
.xp-toolbar :deep(.er-x) {
  border: 2px solid var(--sb-ink);
  background: #fff;
  color: var(--sb-ink);
  box-shadow: 0 2px 0 var(--sb-ink);
}
.xp-toolbar :deep(.er-row) {
  border: 2px solid rgba(18, 50, 74, 0.25);
  border-radius: 12px;
  background: #fff;
}
.xp-toolbar :deep(.er-row.editing) {
  border-color: var(--sb-ink);
}
.xp-toolbar :deep(.er-code) {
  font-family: var(--sb-display);
  letter-spacing: 0.04em;
}
.xp-toolbar :deep(.er-badge) {
  border: 1.5px solid var(--sb-ink);
  border-radius: 999px;
  font-weight: 800;
}
.xp-toolbar :deep(.er-badge.live) {
  background: #d6f0f3;
  color: var(--sb-ink);
}
.xp-toolbar :deep(.er-badge.group) {
  background: var(--sb-amber);
  color: var(--sb-ink);
}
.xp-toolbar :deep(.er-btn) {
  border: 2px solid var(--sb-ink);
  border-radius: 999px;
  background: #fff;
  color: var(--sb-ink);
  font-weight: 800;
  box-shadow: 0 2px 0 var(--sb-ink);
}
.xp-toolbar :deep(.er-btn.primary) {
  background: var(--sb-amber);
  color: var(--sb-ink);
}
.xp-toolbar :deep(.er-btn.ghost) {
  border-style: dashed;
  box-shadow: none;
}
.xp-toolbar :deep(.er-field input) {
  border: 2px solid var(--sb-ink);
  border-radius: 10px;
  background: #fff;
  color: var(--sb-ink);
}
.xp-toolbar :deep(.er-link) {
  color: var(--sb-ink);
  font-weight: 800;
  text-decoration: underline;
  text-decoration-color: var(--sb-amber);
  text-decoration-thickness: 3px;
}
.xp-add {
  margin-left: auto;
  display: inline-flex;
  align-items: center;
  gap: 10px;
  padding: 9px 18px 9px 10px;
  border: 2.5px solid var(--sb-ink);
  border-radius: 999px;
  background: var(--sb-amber);
  color: var(--sb-ink);
  font-family: var(--sb-display);
  font-size: 1.1rem;
  letter-spacing: 0.02em;
  box-shadow: 0 5px 0 var(--sb-ink);
  transition: transform 0.15s var(--sb-spring), box-shadow 0.15s;
}
.xp-add:hover {
  background: var(--sb-amber-hi);
  color: var(--sb-ink);
  transform: translateY(-2px);
  box-shadow: 0 7px 0 var(--sb-ink);
}
.xp-add:active {
  transform: translateY(4px);
  box-shadow: 0 1px 0 var(--sb-ink);
}
.xp-coin-drop {
  display: grid;
  place-items: center;
  width: 28px;
  height: 28px;
  border: 2px solid var(--sb-ink);
  border-radius: 50%;
  background: var(--sb-amber-hi);
  font-size: 14px;
  transition: transform 0.25s var(--sb-spring);
}
.xp-add:hover .xp-coin-drop {
  transform: translateY(3px) rotate(20deg);
}
.xp-add kbd {
  margin-left: 2px;
  padding: 1px 6px;
  border: 1.5px solid var(--sb-ink);
  border-radius: 6px;
  background: var(--paper-card);
  color: var(--sb-ink);
  font-size: 11px;
  box-shadow: none;
}

/* ===== Empty: an empty wallet ===== */
.xp-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
  padding: 48px 16px;
  border: 2.5px dashed rgba(18, 50, 74, 0.3);
  border-radius: 24px;
  text-align: center;
}
.xp-empty-wallet {
  position: relative;
  display: grid;
  place-items: center;
  width: 110px;
  height: 78px;
  margin-bottom: 6px;
  border: 3px solid var(--sb-ink);
  border-radius: 16px;
  background: var(--leather);
  color: var(--paper-card);
  box-shadow: 0 5px 0 var(--sb-ink);
  transform: rotate(-4deg);
}
.xp-empty-flap {
  position: absolute;
  inset: 8px;
  border: 2px dashed rgba(255, 250, 240, 0.7);
  border-radius: 10px;
}
.xp-empty .xp-add {
  margin: 10px auto 0;
}

/* Warning strip */
.xp-warn {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  margin-bottom: 18px;
  padding: 10px 14px;
  border: 2px solid var(--sb-ink);
  border-radius: 12px;
  background: #fff1cf;
  color: var(--sb-ink);
  font-size: 13.5px;
}

/* ===== The wallet ===== */
.xp-wallet {
  position: relative;
  display: grid;
  grid-template-columns: minmax(0, 5fr) 24px minmax(0, 7fr);
  padding: 18px;
  border: 3px solid var(--sb-ink);
  border-radius: 28px;
  background:
    radial-gradient(rgba(255, 255, 255, 0.08) 1px, transparent 1.6px) 0 0 / 7px 7px,
    var(--leather);
  box-shadow: 0 8px 0 var(--sb-ink);
}
.xp-wallet::before { /* stitching */
  content: '';
  position: absolute;
  inset: 8px;
  border: 2px dashed rgba(255, 250, 240, 0.7);
  border-radius: 21px;
  pointer-events: none;
}
.xp-spine {
  margin: -18px 0;
  border-left: 2px solid rgba(18, 50, 74, 0.5);
  border-right: 2px solid rgba(18, 50, 74, 0.5);
  background: linear-gradient(90deg, rgba(0, 0, 0, 0.18), rgba(255, 255, 255, 0.12) 50%, rgba(0, 0, 0, 0.18));
}
.xp-side-l,
.xp-side-r {
  position: relative;
  min-width: 0;
  padding: 14px;
  border-radius: 18px;
  background: var(--leather-dk);
  box-shadow: inset 0 3px 0 rgba(0, 0, 0, 0.18);
}
.xp-pocket-label {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 0 0 12px 4px;
  font-family: var(--sb-display);
  font-weight: 400;
  font-size: 1.1rem;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: #fffaf0;
  text-shadow: 0 2px 0 var(--sb-ink);
}
.xp-count {
  padding: 0 8px;
  border: 2px solid var(--sb-ink);
  border-radius: 999px;
  background: var(--sb-amber);
  color: var(--sb-ink);
  font-size: 0.85rem;
  text-shadow: none;
}

/* Left: the cash card behind a clear window */
.xp-window {
  position: relative;
  padding: 10px;
  border: 2.5px solid var(--sb-ink);
  border-radius: 16px;
  background: rgba(255, 255, 255, 0.22);
}
.xp-window::after { /* plastic shine */
  content: '';
  position: absolute;
  inset: 10px;
  border-radius: 12px;
  background: linear-gradient(115deg, transparent 30%, rgba(255, 255, 255, 0.35) 42%, transparent 52%);
  pointer-events: none;
}
.xp-cash {
  position: relative;
  display: flex;
  flex-direction: column;
  padding: 16px 18px 14px;
  border: 2.5px solid var(--sb-ink);
  border-radius: 12px;
  background:
    repeating-linear-gradient(135deg, rgba(18, 50, 74, 0.04) 0 2px, transparent 2px 9px),
    var(--paper-card);
}
.xp-cash > * {
  position: relative;
  z-index: 1; /* above the shine, so buttons and the budget box stay clickable */
}
.xp-chip {
  position: absolute;
  top: 16px;
  right: 18px;
  width: 38px;
  height: 28px;
  border: 2px solid var(--sb-ink);
  border-radius: 6px;
  background:
    linear-gradient(90deg, transparent 45%, rgba(18, 50, 74, 0.4) 45% 55%, transparent 55%),
    linear-gradient(0deg, transparent 45%, rgba(18, 50, 74, 0.4) 45% 55%, transparent 55%),
    var(--sb-amber);
}
.xp-big {
  display: block;
  margin-top: 4px;
  font-family: var(--sb-display);
  font-size: 2.3rem;
  line-height: 1.05;
  letter-spacing: 0.01em;
  color: var(--sb-ink);
}
.xp-cash-foot {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 10px;
  margin-top: 8px;
  font-size: 12px;
  font-weight: 700;
  color: var(--muted);
}
.xp-cash-foot .xp-link {
  font-size: 12px;
}
.xp-budget-row {
  display: flex;
  justify-content: space-between;
  gap: 10px;
  margin: 12px 0 5px;
  font-size: 12px;
  font-weight: 800;
}
.xp-budget-row .over {
  color: var(--neg);
}
/* Ten notes: spent ones become dashed outlines */
.xp-notes {
  display: flex;
  gap: 3px;
  height: 20px;
}
.xp-notes i {
  flex: 1;
  border: 1.5px solid var(--sb-ink);
  border-radius: 3px;
  background:
    radial-gradient(circle, rgba(18, 50, 74, 0.25) 0 3px, transparent 3.5px),
    #bfe6c9;
}
.xp-notes i.spent {
  border-style: dashed;
  border-color: rgba(18, 50, 74, 0.3);
  background: transparent;
}
.xp-notes.over i {
  border-style: solid;
  border-color: var(--neg);
  background: #fde0dc;
}
.xp-set-budget {
  align-self: flex-start;
  margin-top: 12px;
  font-size: 13.5px;
}
.xp-budget-form {
  display: flex;
  gap: 8px;
  margin-top: 10px;
}
.xp-budget-form .form-control {
  border: 2px solid var(--sb-ink);
  border-radius: 10px;
  background: var(--paper-card);
  color: var(--sb-ink);
  font-weight: 700;
}
.xp-budget-form .form-control:focus {
  border-color: var(--sb-ink);
  box-shadow: 0 0 0 4px rgba(255, 191, 60, 0.45);
}
.xp-mini {
  padding: 5px 14px;
  border: 2px solid var(--sb-ink);
  border-radius: 999px;
  background: var(--paper-card);
  color: var(--sb-ink);
  font-size: 13px;
  font-weight: 800;
  box-shadow: 0 3px 0 var(--sb-ink);
}
.xp-mini:hover {
  background: var(--sb-amber);
  color: var(--sb-ink);
}

/* Card slots: each card peeks out of a leather slot */
.xp-slots {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin-top: 16px;
}
.xp-slot {
  position: relative;
  padding-top: 4px;
}
.xp-slot-card {
  position: relative;
  display: flex;
  align-items: center;
  gap: 12px;
  margin: 0 8px;
  padding: 12px 14px 26px;
  border: 2.5px solid var(--sb-ink);
  border-bottom: 0;
  border-radius: 12px 12px 0 0;
  color: var(--sb-ink);
  transition: transform 0.2s var(--sb-spring);
}
.xp-slot:hover .xp-slot-card {
  transform: translateY(-6px);
}
.xp-slot-card.amber { background: #fff1cf; }
.xp-slot-card.teal { background: #d6f0f3; }
.xp-slot-card.peach { background: #ffe1cf; }
.xp-slot-icon {
  flex: none;
  display: grid;
  place-items: center;
  width: 36px;
  height: 36px;
  border: 2px solid var(--sb-ink);
  border-radius: 50%;
  background: var(--paper-card);
  font-size: 17px;
}
.xp-slot-text {
  flex: 1;
  min-width: 0;
}
.xp-slot-v {
  display: block;
  font-family: var(--sb-display);
  font-size: 1.45rem;
  line-height: 1.1;
}
.xp-slot-v.pos { color: var(--pos); }
.xp-slot-v.neg { color: var(--neg); }
.xp-slot-sub {
  display: block;
  font-size: 12px;
  font-weight: 600;
  color: var(--muted);
}
.xp-slot-lip {
  position: relative;
  display: block;
  margin-top: -18px;
  height: 22px;
  border: 2.5px solid var(--sb-ink);
  border-radius: 6px 6px 12px 12px;
  background: var(--leather);
  box-shadow: 0 3px 0 rgba(18, 50, 74, 0.35);
}
.xp-slot-lip::before {
  content: '';
  position: absolute;
  left: 8px;
  right: 8px;
  top: 5px;
  border-top: 2px dashed rgba(255, 250, 240, 0.65);
}
.xp-stamp {
  flex: none;
  padding: 3px 9px;
  border: 2.5px solid currentColor;
  border-radius: 6px;
  background: rgba(255, 255, 255, 0.6);
  font-family: var(--sb-display);
  font-size: 0.85rem;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  transform: rotate(-8deg);
}
.xp-stamp.owed { color: #1b7f8d; }
.xp-stamp.owe { color: var(--neg); }
.xp-stamp.ok { color: var(--pos); }

/* Right: the receipt pocket */
.xp-pocket {
  position: relative;
  padding-top: 26px;
}
.xp-pocket-lip {
  position: absolute;
  z-index: 3;
  top: 0;
  left: -4px;
  right: -4px;
  height: 58px;
  border: 2.5px solid var(--sb-ink);
  border-radius: 14px 14px 50% 50% / 14px 14px 26px 26px;
  background: var(--leather);
  box-shadow: 0 4px 0 rgba(18, 50, 74, 0.35);
}
.xp-pocket-lip::before {
  content: '';
  position: absolute;
  left: 14px;
  right: 14px;
  bottom: 9px;
  height: 18px;
  border-bottom: 2px dashed rgba(255, 250, 240, 0.7);
  border-radius: 0 0 50% 50%;
}
.xp-pocket-tools {
  position: relative;
  z-index: 4;
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  margin-top: -14px;
  padding: 0 12px;
}
.xp-search {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 0 12px;
  border: 2px solid var(--sb-ink);
  border-radius: 999px;
  background: var(--paper-card);
  box-shadow: 0 2px 0 var(--sb-ink);
  color: var(--sb-ink);
}
.xp-search input {
  width: 150px;
  min-width: 0;
  border: 0;
  outline: 0;
  padding: 6px 0;
  background: transparent;
  color: var(--sb-ink);
  font-size: 13px;
  font-weight: 600;
}
.xp-search:focus-within {
  box-shadow: 0 2px 0 var(--sb-ink), 0 0 0 4px rgba(255, 191, 60, 0.45);
}
.xp-filters :deep(.dd-trigger) {
  border: 2px solid var(--sb-ink);
  border-radius: 999px;
  background: var(--paper-card);
  color: var(--sb-ink);
  font-weight: 800;
  box-shadow: 0 2px 0 var(--sb-ink);
}
.xp-receipts {
  position: relative;
  z-index: 2;
  margin-top: 4px;
  padding: 0 6px 6px;
}

/* A receipt: torn zig-zag edges, a dashed rule, dotted leaders, the total and a barcode */
.xp-receipt {
  position: relative;
  margin: 0 0 28px;
  padding: 30px 18px 22px;
  border-left: 2.5px solid var(--sb-ink);
  border-right: 2.5px solid var(--sb-ink);
  background: var(--paper-card);
  filter: drop-shadow(0 4px 0 rgba(18, 50, 74, 0.45));
}
.xp-receipt:nth-child(odd) { transform: rotate(-0.5deg); }
.xp-receipt:nth-child(even) { transform: rotate(0.4deg); }
.xp-receipt::before,
.xp-receipt::after {
  content: '';
  position: absolute;
  left: -2.5px;
  right: -2.5px;
  height: 10px;
  background:
    linear-gradient(135deg, var(--paper-card) 33%, transparent 33%) 0 0 / 12px 10px,
    linear-gradient(225deg, var(--paper-card) 33%, transparent 33%) 0 0 / 12px 10px;
}
.xp-receipt::before { top: -9px; transform: scaleY(-1); }
.xp-receipt::after { bottom: -9px; }
.xp-nothing {
  text-align: center;
  font-weight: 600;
  color: var(--muted);
}
.xp-r-head {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  gap: 10px;
  margin-bottom: 6px;
  padding-bottom: 8px;
  border-bottom: 2px dashed rgba(18, 50, 74, 0.35);
}
.xp-r-day {
  font-family: var(--sb-display);
  font-size: 1.15rem;
  letter-spacing: 0.04em;
  text-transform: uppercase;
}
.xp-r-day small {
  margin-left: 8px;
  font-family: var(--font-body);
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0;
  text-transform: none;
  color: var(--muted);
}
.xp-r-count {
  font-size: 12px;
  font-weight: 700;
  color: var(--muted);
}
.xp-list {
  list-style: none;
  margin: 0;
  padding: 0;
}
.xp-row {
  width: 100%;
  display: grid;
  grid-template-columns: 38px minmax(0, auto) 1fr auto;
  align-items: center;
  gap: 10px;
  padding: 7px 4px;
  border: 0;
  border-radius: 10px;
  background: transparent;
  color: var(--sb-ink);
  text-align: left;
  transition: background 0.15s;
}
.xp-row:hover {
  background: rgba(255, 191, 60, 0.2);
}
/* Category coin: the category's own colour, with a rim */
.xp-coin {
  display: grid;
  place-items: center;
  width: 36px;
  height: 36px;
  border: 2px solid var(--sb-ink);
  border-radius: 50%;
  background:
    radial-gradient(circle, rgba(255, 255, 255, 0.55) 0 52%, transparent 54%),
    var(--c, var(--sb-amber));
  box-shadow: inset 0 0 0 3px rgba(255, 255, 255, 0.5), 0 2px 0 var(--sb-ink);
  font-size: 16px;
}
.xp-row-main {
  display: flex;
  flex-direction: column;
  min-width: 0;
}
.xp-row-title {
  overflow: hidden;
  font-size: 14.5px;
  font-weight: 800;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.xp-row-sub {
  font-size: 12px;
  font-weight: 600;
  color: var(--muted);
}
.xp-leader {
  height: 1px;
  margin-top: 4px;
  border-bottom: 2.5px dotted rgba(18, 50, 74, 0.35);
}
.xp-row-right {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  text-align: right;
}
.xp-row-amount {
  font-size: 15px;
  font-weight: 800;
}
.xp-row-conv {
  font-size: 11.5px;
  font-weight: 600;
  color: var(--muted);
}
.xp-unconv {
  color: var(--neg);
}
.xp-effect {
  font-size: 11.5px;
  font-weight: 700;
  color: var(--muted);
}
.xp-effect.pos { color: var(--pos); }
.xp-effect.neg { color: var(--neg); }
.xp-r-total {
  display: flex;
  justify-content: space-between;
  margin-top: 8px;
  padding-top: 8px;
  border-top: 2px solid var(--sb-ink);
  font-family: var(--sb-display);
  font-size: 1.1rem;
  letter-spacing: 0.04em;
  text-transform: uppercase;
}
.xp-barcode {
  display: block;
  width: 55%;
  height: 18px;
  margin-top: 10px;
  background: repeating-linear-gradient(90deg, var(--sb-ink) 0 2px, transparent 2px 4px, var(--sb-ink) 4px 5px, transparent 5px 8px, var(--sb-ink) 8px 11px, transparent 11px 13px);
  opacity: 0.55;
}

/* ===== Below the wallet ===== */
.xp-lower {
  display: grid;
  align-items: start;
  grid-template-columns: minmax(0, 1.25fr) minmax(0, 1fr);
  gap: 26px;
  margin-top: 34px;
}
.xp-lower-side {
  display: flex;
  flex-direction: column;
  gap: 24px;
  min-width: 0;
}
.xp-card {
  padding: 18px 20px 20px;
  border: 2.5px solid var(--sb-ink);
  border-radius: 18px;
  background: var(--paper-card);
  box-shadow: 0 5px 0 var(--sb-ink);
}
.xp-sub-h {
  margin: 20px 0 10px;
  font-size: 11px;
  font-weight: 800;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: var(--muted);
}

/* Balances: one row per person, the amount in a coloured pill */
.xp-bal {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin: 0;
  padding: 0;
  list-style: none;
}
.xp-bal-row {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 8px 10px 8px 8px;
  border: 2px solid rgba(18, 50, 74, 0.14);
  border-left: 6px solid rgba(18, 50, 74, 0.2);
  border-radius: 14px;
  background: var(--paper-card);
  transition: transform 0.15s var(--sb-spring);
}
.xp-bal-row:hover {
  transform: translateX(3px);
}
.xp-bal-row.pos { border-left-color: #4caf7d; }
.xp-bal-row.neg { border-left-color: var(--sb-coral); }
.xp-avatar {
  flex: none;
  display: grid;
  place-items: center;
  width: 36px;
  height: 36px;
  border: 2px solid var(--sb-ink);
  border-radius: 50%;
  background: var(--sb-cream);
  color: var(--sb-ink);
  box-shadow: 0 2px 0 var(--sb-ink);
  font-family: var(--sb-display);
  font-size: 16px;
  font-weight: 400;
}
.xp-avatar.sm {
  width: 28px;
  height: 28px;
  font-size: 13px;
}
.xp-bal-name {
  flex: 1;
  min-width: 0;
  display: flex;
  align-items: center;
  gap: 8px;
  overflow: hidden;
  font-family: var(--sb-display);
  font-size: 1.1rem;
  font-weight: 400;
  letter-spacing: 0.02em;
  white-space: nowrap;
}
.xp-you {
  padding: 1px 8px;
  border: 1.5px solid var(--sb-ink);
  border-radius: 6px;
  background: var(--sb-amber);
  font-size: 0.7rem;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  transform: rotate(-4deg);
}
.xp-bal-amt {
  display: inline-flex;
  align-items: baseline;
  gap: 6px;
  padding: 4px 12px;
  border: 2px solid var(--sb-ink);
  border-radius: 999px;
  background: var(--sb-cream);
  color: var(--sb-ink-soft);
  font-family: var(--sb-display);
  font-size: 1rem;
  font-weight: 400;
  letter-spacing: 0.02em;
  white-space: nowrap;
}
.xp-bal-word {
  font-size: 0.8em;
  opacity: 0.8;
}
.xp-bal-sign {
  display: none; /* phones only: shown instead of the words */
}
.pos .xp-bal-amt { background: #e2f5e8; color: var(--pos); }
.neg .xp-bal-amt { background: #fde6e1; color: var(--neg); }
.zero .xp-bal-amt { border-color: rgba(18, 50, 74, 0.3); }

/* Settle up: from → to, the amount riding on a dashed arrow */
.xp-pay {
  display: flex;
  flex-direction: column;
  gap: 10px;
  margin: 0;
  padding: 0;
  list-style: none;
}
.xp-cheque {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 14px;
  border: 2px solid var(--sb-ink);
  border-radius: 14px;
  background: #fff6df;
  box-shadow: 0 3px 0 var(--sb-ink);
}
.xp-pay-who {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
  font-family: var(--sb-display);
  font-size: 1.05rem;
  letter-spacing: 0.02em;
  white-space: nowrap;
}
.xp-pay-who strong {
  font-weight: 400;
  overflow: hidden;
  text-overflow: ellipsis;
}
.xp-pay-arrow {
  flex: 1;
  min-width: 70px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
}
.xp-pay-amt {
  font-family: var(--sb-display);
  font-size: 1.05rem;
  letter-spacing: 0.02em;
  color: var(--sb-ink);
}
.xp-pay-line {
  position: relative;
  width: 100%;
  border-top: 2.5px dashed var(--sb-ink);
}
.xp-pay-line::after { /* arrow head */
  content: '';
  position: absolute;
  right: -2px;
  top: -7.5px;
  width: 11px;
  height: 11px;
  border-top: 2.5px solid var(--sb-ink);
  border-right: 2.5px solid var(--sb-ink);
  transform: rotate(45deg);
}
.xp-paid {
  flex: none;
  padding: 6px 14px;
  border: 2px solid var(--sb-ink);
  border-radius: 999px;
  background: var(--sb-amber);
  color: var(--sb-ink);
  font-family: var(--sb-display);
  font-size: 0.95rem;
  letter-spacing: 0.02em;
  box-shadow: 0 3px 0 var(--sb-ink);
  transition: transform 0.15s var(--sb-spring), box-shadow 0.15s;
}
.xp-paid:hover {
  background: var(--sb-amber-hi);
  color: var(--sb-ink);
  transform: translateY(-1px);
  box-shadow: 0 4px 0 var(--sb-ink);
}
.xp-paid:active {
  transform: translateY(2px);
  box-shadow: 0 1px 0 var(--sb-ink);
}
/* All square: a zipped coin purse */
.xp-square {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 14px 16px;
  padding: 12px 16px;
  border: 2px dashed rgba(18, 50, 74, 0.35);
  border-radius: 14px;
}
.xp-square .xp-muted {
  font-size: 13px;
  font-weight: 600;
}
.xp-purse {
  position: relative;
  flex: none;
  width: 70px;
  height: 52px;
  border: 2.5px solid var(--sb-ink);
  border-radius: 10px 10px 26px 26px;
  background: var(--leather);
}
.xp-purse::before { /* zip */
  content: '';
  position: absolute;
  left: 6px;
  right: 6px;
  top: 10px;
  height: 6px;
  border-radius: 3px;
  background: repeating-linear-gradient(90deg, #fffaf0 0 3px, var(--sb-ink) 3px 5px);
}
.xp-purse::after { /* pull */
  content: '';
  position: absolute;
  right: 4px;
  top: 6px;
  width: 9px;
  height: 16px;
  border: 2px solid var(--sb-ink);
  border-radius: 4px;
  background: var(--sb-amber);
}
.xp-square-stamp {
  padding: 4px 12px;
  border: 3px solid var(--pos);
  border-radius: 8px;
  color: var(--pos);
  font-family: var(--sb-display);
  font-size: 1.3rem;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  transform: rotate(-6deg);
}
.xp-history {
  margin-top: 16px;
  padding-top: 14px;
  border-top: 2px dashed rgba(18, 50, 74, 0.25);
}
.xp-history summary {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  list-style: none;
  font-family: var(--sb-display);
  font-size: 1.05rem;
  letter-spacing: 0.02em;
  color: var(--sb-ink);
  cursor: pointer;
}
.xp-history summary::-webkit-details-marker {
  display: none;
}
.xp-history-chev { /* a little arrow that turns when open */
  width: 9px;
  height: 9px;
  border-right: 2.5px solid var(--sb-ink);
  border-bottom: 2.5px solid var(--sb-ink);
  transform: rotate(-45deg);
  transition: transform 0.2s;
}
.xp-history[open] .xp-history-chev {
  transform: rotate(45deg);
}
.xp-slips {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin: 12px 0 0;
  padding: 0;
  list-style: none;
}
/* Each payment: a cream slip with a dashed edge and a green PAID stamp */
.xp-slip {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 9px 12px;
  border: 2px dashed rgba(18, 50, 74, 0.45);
  border-radius: 12px;
  background: #fffaf0;
}
.xp-slip-text {
  flex: 1;
  min-width: 0;
  font-size: 14px;
  font-weight: 600;
  color: var(--sb-ink-soft);
}
.xp-slip-text strong {
  color: var(--sb-ink);
  font-weight: 800;
}
.xp-slip-text small {
  display: block;
  font-size: 12px;
  color: rgba(18, 50, 74, 0.6);
}
.xp-slip-amount {
  font-weight: 800;
  color: var(--sb-ink);
  white-space: nowrap;
}
.xp-slip-stamp {
  padding: 1px 8px;
  border: 2px solid var(--pos);
  border-radius: 6px;
  color: var(--pos);
  font-family: var(--sb-display);
  font-size: 0.8rem;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  transform: rotate(-6deg);
}
.xp-slip.pending {
  border-color: rgba(207, 120, 26, 0.6);
  background: #fff6df;
}
.xp-slip-ok {
  flex: none;
  padding: 4px 12px;
  border: 2px solid var(--sb-ink);
  border-radius: 999px;
  background: var(--sb-amber);
  color: var(--sb-ink);
  font-size: 12.5px;
  font-weight: 800;
  box-shadow: 0 2px 0 var(--sb-ink);
  transition: transform 0.12s, box-shadow 0.12s;
}
.xp-slip-ok:hover {
  transform: translateY(-1px);
}
.xp-slip-ok:active {
  transform: translateY(1px);
  box-shadow: 0 1px 0 var(--sb-ink);
}
.xp-wait,
.xp-only {
  flex: none;
  max-width: 190px;
  font-size: 12.5px;
  font-weight: 700;
  line-height: 1.3;
  text-align: right;
}
.xp-wait {
  padding: 4px 10px;
  border: 2px dashed rgba(207, 120, 26, 0.7);
  border-radius: 999px;
  color: #8a4b0e;
}
.xp-only {
  color: rgba(18, 50, 74, 0.6);
}
.xp-pending {
  margin-top: 14px;
}
.xp-pending-h {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 0;
  font-family: var(--sb-display);
  font-size: 1.05rem;
  font-weight: 400;
  letter-spacing: 0.02em;
  color: var(--sb-ink);
}
.xp-slip-undo {
  flex: none;
  padding: 4px 12px;
  border: 2px solid var(--sb-ink);
  border-radius: 999px;
  background: #fff;
  color: var(--sb-ink);
  font-size: 12.5px;
  font-weight: 800;
  box-shadow: 0 2px 0 var(--sb-ink);
  transition: transform 0.12s, box-shadow 0.12s, background 0.12s;
}
.xp-slip-undo:hover {
  background: #fff1cf;
  transform: translateY(-1px);
}
.xp-slip-undo:active {
  transform: translateY(1px);
  box-shadow: 0 1px 0 var(--sb-ink);
}
@media (max-width: 480px) {
  .xp-slip {
    flex-wrap: wrap;
  }
  .xp-slip-stamp {
    display: none;
  }
}

/* Where it went: a row per category with a bar in its colour */
.xp-cat-head {
  display: flex;
  flex-wrap: wrap;
  justify-content: space-between;
  align-items: center;
  gap: 10px;
  margin-bottom: 14px;
}
.xp-cat-head .xp-h {
  margin: 0;
}
.xp-cats {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin: 0;
  padding: 0;
  list-style: none;
}
.xp-cat {
  width: 100%;
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 8px 10px;
  border: 2px solid transparent;
  border-radius: 14px;
  background: transparent;
  color: var(--sb-ink);
  text-align: left;
  transition: background 0.15s;
}
.xp-cat:hover {
  background: rgba(255, 191, 60, 0.15);
}
.xp-cat.on {
  border-color: var(--sb-ink);
  background: #fff1cf;
}
.xp-cat-main {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.xp-cat-top {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  gap: 10px;
}
.xp-cat-name {
  overflow: hidden;
  font-family: var(--sb-display);
  font-size: 1.05rem;
  letter-spacing: 0.02em;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.xp-cat-amt {
  font-size: 13.5px;
  font-weight: 700;
  color: var(--muted);
  white-space: nowrap;
}
.xp-cat-track {
  display: block;
  height: 14px;
  border: 2px solid var(--sb-ink);
  border-radius: 999px;
  background: var(--sb-cream);
  overflow: hidden;
}
.xp-cat-fill {
  display: block;
  height: 100%;
  border-right: 2px solid var(--sb-ink);
  border-radius: 999px;
  background:
    repeating-linear-gradient(135deg, rgba(255, 255, 255, 0.28) 0 6px, transparent 6px 12px),
    var(--c, var(--sb-amber));
}
.xp-cat-pct {
  flex: none;
  width: 58px;
  padding: 3px 0;
  border: 2px solid var(--sb-ink);
  border-radius: 999px;
  background: var(--paper-card);
  font-family: var(--sb-display);
  font-size: 0.95rem;
  letter-spacing: 0.02em;
  text-align: center;
}

/* Per day: teal bars, the biggest day in amber with a tag */
.xp-bars {
  display: flex;
  align-items: flex-end;
  gap: 3px;
  height: 150px;
  margin-top: 30px;
  padding: 0 2px;
  border-bottom: 2.5px solid var(--sb-ink);
}
.xp-bar-hit {
  flex: 1;
  min-width: 0;
  height: 100%;
  display: flex;
  align-items: flex-end;
  padding: 0;
  border: 0;
  background: transparent;
}
.xp-bar {
  position: relative;
  width: 100%;
  border: 2px solid var(--sb-ink);
  border-bottom: 0;
  border-radius: 6px 6px 0 0;
  background: repeating-linear-gradient(0deg, #8fd3dd 0 9px, #6fc3cf 9px 11px);
  transition: filter 0.15s;
}
.xp-bar.top {
  background: repeating-linear-gradient(0deg, var(--sb-amber) 0 9px, #f0a91f 9px 11px);
}
.xp-bar.zero {
  border-style: dashed;
  border-color: rgba(18, 50, 74, 0.35);
  background: transparent;
}
.xp-bar-hit:hover .xp-bar,
.xp-bar-hit.active .xp-bar {
  filter: brightness(0.92);
}
.xp-bar-tag {
  position: absolute;
  z-index: 1;
  bottom: calc(100% + 6px);
  left: 50%;
  padding: 2px 7px;
  border: 2px solid var(--sb-ink);
  border-radius: 6px;
  background: var(--sb-amber);
  font-size: 10.5px;
  font-weight: 800;
  white-space: nowrap;
  transform: translateX(-50%) rotate(-6deg);
}
.xp-bar-dates {
  display: flex;
  justify-content: space-between;
  margin-top: 6px;
  font-size: 11.5px;
  font-weight: 800;
  color: var(--muted);
}

/* What others just changed */
.xp-toasts {
  position: fixed;
  right: 20px;
  bottom: 20px;
  z-index: 1070;
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.xp-toast {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 14px;
  border: 2.5px solid var(--sb-ink);
  border-radius: 14px;
  background: #fffdf8;
  color: var(--sb-ink);
  font-size: 14px;
  font-weight: 600;
  box-shadow: 0 4px 0 var(--sb-ink);
}
.xp-toast {
  cursor: pointer;
}
.xp-toast-enter-active,
.xp-toast-leave-active {
  transition: opacity 0.25s, transform 0.25s;
}
.xp-toast-enter-from,
.xp-toast-leave-to {
  opacity: 0;
  transform: translateY(10px);
}

/* Keyboard focus */
.xp-row:focus-visible,
.xp-cat:focus-visible,
.xp-bar-hit:focus-visible,
.xp-add:focus-visible,
.xp-mini:focus-visible,
.xp-paid:focus-visible,
.xp-link:focus-visible {
  outline: 3px solid var(--sb-teal);
  outline-offset: 2px;
}

/* Tablets and phones: the wallet opens top-to-bottom */
@media (max-width: 991px) {
  .xp-wallet {
    grid-template-columns: minmax(0, 1fr);
    padding: 14px;
  }
  .xp-spine {
    height: 22px;
    margin: 0 -14px;
    border: 0;
    border-top: 2px solid rgba(18, 50, 74, 0.5);
    border-bottom: 2px solid rgba(18, 50, 74, 0.5);
    background: linear-gradient(180deg, rgba(0, 0, 0, 0.18), rgba(255, 255, 255, 0.12) 50%, rgba(0, 0, 0, 0.18));
  }
  .xp-lower {
    grid-template-columns: minmax(0, 1fr);
  }
}
@media (max-width: 560px) {
  .xp-add {
    margin-left: 0;
  }
  .xp-big {
    font-size: 2rem;
  }
  .xp-side-l,
  .xp-side-r {
    padding: 10px;
    overflow: hidden;
  }
  .xp-pocket-tools {
    padding: 0 6px;
  }
  .xp-search {
    flex: 1;
  }
  .xp-search input {
    width: 100%;
  }
  .xp-receipt {
    padding: 28px 12px 20px;
  }
  .xp-row {
    grid-template-columns: 34px minmax(0, 1fr) auto;
  }
  .xp-row-title {
    white-space: normal;
  }
  .xp-leader {
    display: none;
  }
  .xp-coin {
    width: 32px;
    height: 32px;
  }
  .xp-slot-v {
    font-size: 1.25rem;
  }
  .xp-slot-card {
    padding-right: 10px;
  }
  .xp-slot-card .xp-stamp {
    position: absolute;
    top: -8px;
    right: 6px;
    font-size: 0.7rem;
    background: #fffdf8;
  }
  .xp-cheque {
    flex-wrap: wrap;
  }
  .xp-paid {
    width: 100%;
  }
  .xp-bal-word {
    display: none;
  }
  .xp-cat {
    gap: 8px;
    padding: 8px 4px;
  }
  .xp-cat-pct {
    width: 46px;
    font-size: 0.85rem;
  }
  .xp-cat-amt {
    font-size: 12px;
  }
  .xp-bal-sign {
    display: inline;
    margin-right: -2px;
  }
}
@media (prefers-reduced-motion: reduce) {
  .xp-row,
  .xp-add,
  .xp-coin-drop,
  .xp-slot-card,
  .xp-bal-row,
  .xp-paid,
  .xp-bar { transition: none; }
  .xp-live-dot { animation: none; }
}

/* Phones and touch screens: every control is at least 40px to tap (WCAG / Apple guidance) */
@media (pointer: coarse), (max-width: 560px) {
  .xp-mini,
  .xp-paid,
  .xp-link {
    min-height: 40px;
  }
  .xp-search input {
    min-height: 36px;
  }
}
/* ===== A little wiggle on hover, for everything on the page =====
   Uses the separate `rotate` property, so it adds to each item's own tilt or lift instead of replacing it.
   Big things wiggle less (--wig), small things a bit more. */
@keyframes xp-wiggle {
  0%, 100% { rotate: 0deg; }
  25% { rotate: calc(var(--wig, 1.5deg) * -1); }
  50% { rotate: var(--wig, 1.5deg); }
  75% { rotate: calc(var(--wig, 1.5deg) * -0.5); }
}
.xp-wallet { --wig: 0.25deg; }
.xp-card,
.xp-receipt,
.xp-window { --wig: 0.5deg; }
.xp-slot-card,
.xp-bal-row,
.xp-cheque,
.xp-cat,
.xp-row,
.xp-empty { --wig: 0.8deg; }
.xp-coin,
.xp-avatar,
.xp-chip,
.xp-stamp,
.xp-you,
.xp-purse,
.xp-square-stamp,
.xp-coin-drop,
.xp-slot-icon,
.xp-cat-pct { --wig: 6deg; }

.xp-add:hover,
.xp-select:hover,
.xp-live:hover,
.xp-toolbar :deep(.er-trigger:hover), /* (only the button: wiggling .er shook the open rates panel too) */
.xp-wallet:hover,
.xp-window:hover,
.xp-slot:hover .xp-slot-card,
.xp-search:hover,
.xp-filters:hover,
.xp-receipt:hover,
.xp-row:hover,
.xp-row:hover .xp-coin,
.xp-card:hover,
.xp-bal-row:hover,
.xp-bal-row:hover .xp-avatar,
.xp-cheque:hover,
.xp-cheque:hover .xp-avatar,
.xp-paid:hover,
.xp-mini:hover,
.xp-cat:hover,
.xp-cat:hover .xp-coin,
.xp-cat:hover .xp-cat-pct,
.xp-bar-hit:hover .xp-bar,
.xp-square:hover .xp-purse,
.xp-square:hover .xp-square-stamp,
.xp-slot:hover .xp-stamp,
.xp-slot:hover .xp-slot-icon,
.xp-cash:hover .xp-chip,
.xp-empty:hover,
.xp-empty-wallet:hover {
  animation: xp-wiggle 0.45s ease-in-out;
}
@media (prefers-reduced-motion: reduce) {
  .xp *,
  .xp *:hover,
  .xp :deep(*) {
    animation: none !important;
  }
}
</style>
