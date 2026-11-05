// Popular places from Google Places (New) Text Search: the same answer as typing
// "popular places to visit in Kyoto, Japan" into Google Maps. Google decides relevance and order.
const FIELDS = 'places.id,places.displayName,places.formattedAddress,places.location,places.types'

// Google's place types -> the kinds of place the app has icons for (anything else is an attraction)
const KIND = {
  museum: 'museum', art_gallery: 'gallery', zoo: 'zoo', aquarium: 'aquarium',
  amusement_park: 'theme_park', park: 'park', national_park: 'park', garden: 'park',
  observation_deck: 'viewpoint', place_of_worship: 'heritage', historical_landmark: 'heritage',
  shopping_mall: 'shop', market: 'shop', restaurant: 'food'
}
const INDOOR = ['museum', 'gallery', 'aquarium', 'shop', 'food']

export async function searchPopularPlaces(destination) {
  const key = process.env.GOOGLE_PLACES_API_KEY
  if (!key) throw Object.assign(new Error('GOOGLE_PLACES_API_KEY is not set'), { status: 503 })
  const response = await fetch('https://places.googleapis.com/v1/places:searchText', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Goog-Api-Key': key, 'X-Goog-FieldMask': FIELDS },
    body: JSON.stringify({ textQuery: 'popular places to visit in ' + destination, languageCode: 'en', pageSize: 20 }),
    signal: AbortSignal.timeout(12000)
  })
  if (!response.ok) throw new Error('Google Places ' + response.status + ': ' + (await response.text()).slice(0, 200))
  const data = await response.json()
  const out = []
  for (const p of data.places || []) {
    if (!p.displayName || !p.location) continue
    const type = KIND[(p.types || []).find((t) => KIND[t])] || 'attraction'
    out.push({
      name: p.displayName.text,
      type,
      indoor: INDOOR.includes(type),
      address: p.formattedAddress || '',
      lat: p.location.latitude,
      lon: p.location.longitude,
      googlePlaceId: p.id,
      src: 'google'
    })
  }
  return out
}
