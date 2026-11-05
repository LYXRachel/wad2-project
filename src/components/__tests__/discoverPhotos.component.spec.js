// @vitest-environment jsdom
/* discoverPhotos.component.spec.js (by Kay Herng)
 Component tests for my two features: Discover (DiscoverView.vue) and Photos (PhotosView.vue).
 Each component is tested in isolation:
   - small child components (icons, the Pip mascot, the tour, flags, dropdowns) are automatic stubs
   - the server (axios), router, 3D map and photo loader are replaced with fakes
     (no backend in a component test, and the map needs WebGL, which the test browser "jsdom" doesn't have)
 The tests check what the user sees (Week 10b: test behaviour, not implementation).

 | Test | Component    | Input                                        | Expected output                                    | Purpose                                  |
 |------|--------------|----------------------------------------------|----------------------------------------------------|------------------------------------------|
 | 1    | DiscoverView | Click the heart on Kyoto                     | No suitcase at first; then the heart is pressed    | Saving a city to the shortlist, the main |
 |      |              |                                              | and the suitcase says "1 place packed"             | action on Discover                       |
 | 2    | PhotosView   | 3 photos (1 in "Nishiki Market");            | All 3 listed first; after the click the tab is     | The group's photos show, and an album    |
 |      |              | click that album's tab                       | selected and only that album's 1 photo shows       | shows only its own photos                |
*/

import { describe, it, expect, vi } from 'vitest'

// Browser features the test browser (jsdom) doesn't have. vi.hoisted runs before the components
// are imported, because DiscoverView checks matchMedia as soon as it loads.
vi.hoisted(() => {
  window.matchMedia = (query) => ({ matches: query.includes('reduce'), addEventListener() {}, removeEventListener() {} })
  Element.prototype.scrollIntoView = () => {}
  Element.prototype.scrollTo = () => {}
  URL.createObjectURL = () => 'blob:fake' // no real image files in tests
  URL.revokeObjectURL = () => {}
})

// Fakes for what the components talk to outside themselves
// (auth.js also sets a login header and a "logged out" check on axios when it loads, so the fake has those too)
vi.mock('axios', () => ({
  default: {
    get: vi.fn(),
    put: () => Promise.resolve({ data: {} }),
    defaults: { headers: { common: {} } },
    interceptors: { response: { use: () => {} } }
  }
}))
vi.mock('vue-router', () => ({ useRouter: () => ({ push: () => {} }) }))
// the 3D map never loads in tests
vi.mock('../../services/maplibre.js', () => ({ loadMapLibre: () => new Promise(() => {}) }))
vi.mock('../../photoCache.js', () => ({ PHOTO_CACHE: {}, photoUrl: (url) => url, loadCityPhotos: () => {} }))

import { mount, flushPromises } from '@vue/test-utils'
import axios from 'axios'
import DiscoverView from '../../views/DiscoverView.vue'
import PhotosView from '../PhotosView.vue'
import { shortlist } from '../../shortlist.js'

describe('DiscoverView', () => {

  // Verify that the heart packs a city into the suitcase.
  it('Test1: the heart packs Kyoto into the suitcase', async () => {
    axios.get.mockImplementation(() => new Promise(() => {})) // the server never answers (not needed here)
    shortlist.value = [] // the suitcase starts empty

    const wrapper = mount(DiscoverView, {
      global: {
        stubs: {
          'router-link': true,
          PlaneGuide: true,
          FeatureTour: true,
          DoodleIcon: true,
          FlagImg: true,
          AppIcon: true,
          AuthJoinModal: true
        }
      }
    })
    expect(wrapper.find('[aria-label="Your suitcase"]').exists()).toBe(false)

    const heart = wrapper.find('button[aria-label="Favorite destination: Kyoto"]')
    await heart.trigger('click')

    expect(heart.attributes('aria-pressed')).toBe('true')
    expect(wrapper.find('[aria-label="Your suitcase"]').exists()).toBe(true)
    expect(wrapper.find('[aria-label="Your suitcase"]').text()).toContain('1 place packed')
  })
})

describe('PhotosView', () => {

  // Verify that the trip's photos are listed, and that an album tab shows only that album's photos.
  it('Test2: an album tab shows only the photos in that album', async () => {
    // the fake server answers with 3 photos; only p2 is in the Nishiki Market album (a1)
    axios.get.mockImplementation((url) => {
      if (url === '/api/trips/trip1/photos') {
        return Promise.resolve({
          data: [
            { id: 'p1', uploadedBy: 'Kay', album: '', reactions: {} },
            { id: 'p2', uploadedBy: 'Kay', album: 'a1', reactions: {} },
            { id: 'p3', uploadedBy: 'Mei', album: '', reactions: {} }
          ]
        })
      }
      return Promise.reject(new Error('no image files in tests'))
    })

    const wrapper = mount(PhotosView, {
      props: {
        tripId: 'trip1',
        travellers: ['Kay', 'Mei'],
        me: 'Kay',
        initialAlbums: [{ id: 'a1', name: 'Nishiki Market', icon: '🍢' }]
      },
      global: {
        stubs: { AppIcon: true, CustomDropdown: true }
      }
    })
    await flushPromises() // wait for the photos to "arrive" from the fake server

    // all 3 photos are listed
    expect(wrapper.text()).toContain('3 photos')
    expect(wrapper.findAll('[data-testid="photo-grid"] figure')).toHaveLength(3)

    // click the Nishiki Market album
    const albumTab = wrapper.findAll('[role="tab"]').find((tab) => tab.text().includes('Nishiki Market'))
    await albumTab.trigger('click')

    // only that album's photo shows
    expect(albumTab.attributes('aria-selected')).toBe('true')
    expect(wrapper.findAll('[data-testid="photo-grid"] figure')).toHaveLength(1)
  })
})
