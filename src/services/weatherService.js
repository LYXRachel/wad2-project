// Weather for the itinerary: OpenWeather's 5-day forecast in 3-hour blocks (through our server, /api/weather).
// Days without a forecast get no blocks (the itinerary then shows typical weather from past years).
import axios from 'axios'

// -> [{ date: '2026-04-05', time: 9, span: 3, condition: 'Rain', temp: 18, rain: true }] (local time at the place)
export async function fetchWeatherForecast({ dates = [], place = '' }) {
  if (!place || !dates.length) return []
  const res = await axios.get('/api/weather', { params: { q: place } })
  const offset = (res.data.city && res.data.city.timezone) || 0 // seconds from UTC
  const wanted = new Set(dates)
  const blocks = []
  for (const item of res.data.list || []) {
    const local = new Date((item.dt + offset) * 1000) // read with UTC getters = local time there
    const date = local.toISOString().slice(0, 10)
    if (!wanted.has(date)) continue
    const condition = (item.weather && item.weather[0] && item.weather[0].main) || ''
    blocks.push({
      date,
      time: local.getUTCHours(),
      span: 3,
      condition,
      temp: Math.round(item.main.temp),
      rain: ['Rain', 'Drizzle', 'Thunderstorm'].includes(condition)
    })
  }
  return blocks
}
