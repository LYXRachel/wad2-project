// The logged-in user's trip preferences, shared by every page.
// reactive() = any component showing prefs updates when they change.
import { reactive, ref } from 'vue'
import axios from 'axios'
import { DEFAULT_PREFS } from './crowd.js'

export const prefs = reactive({ ...DEFAULT_PREFS })
// Goes up by one each time the user changes their active hours or transit buffer in the
// Schedule panel (not when the settings first load), so the itinerary re-times the open day
export const hoursChangedByUser = ref(0)

// Load from the server (call this when a page opens)
export async function loadPreferences() {
  const res = await axios.get('/api/preferences', { keep: true })
  Object.assign(prefs, res.data)
}

// Save to the server; throws if the server rejects the values
export async function savePreferences(newPrefs) {
  const res = await axios.put('/api/preferences', newPrefs)
  Object.assign(prefs, res.data)
}
