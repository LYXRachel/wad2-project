import mongoose from 'mongoose'

// Saved "popular places" per destination, so each destination is only looked up once
const attractionSchema = new mongoose.Schema({
  key: { type: String, required: true, unique: true }, // destination in lowercase
  items: { type: [mongoose.Schema.Types.Mixed], default: [] }, // [{ name, type, indoor, address }]
  version: Number, // LIST_VERSION in routes/places.js when it was saved (older lists are looked up again)
  fetchedAt: { type: Date, default: Date.now }
})

export default mongoose.model('Attraction', attractionSchema)
