/* discoverHelpers.unit.spec.js (by Kay Herng)
 Unit test for codeForDestination() in destinations.js.
 Discover uses it to turn what the user types ("Kyoto, Japan") into a country code,
 which gives each trip and city its flag.

 | Test | Input                                       | Expected output    | Purpose                                     |
 |------|---------------------------------------------|--------------------|---------------------------------------------|
 | 1    | "Kyoto, Japan"                              | "JP"               | Normal "City, Country" label                |
 |      | "London, UK"                                | "GB"               | Everyday nickname for a country             |
 |      | "Bishkek" (a city on its own)               | "KG"               | City without a country still works          |
 |      | "Narnia" (not a real place)                 | ""                 | Unknown input returns empty, doesn't crash  |
*/

import { describe, it, expect } from 'vitest'
import { codeForDestination } from '../../../src/destinations.js'

describe('TestSuite: codeForDestination', () => {

  // Verify that what the user typed becomes the right country code.
  it('Test1: turns what the user typed into a country code', () => {
    expect(codeForDestination('Kyoto, Japan')).toBe('JP')
    expect(codeForDestination('London, UK')).toBe('GB')
    expect(codeForDestination('Bishkek')).toBe('KG')
    expect(codeForDestination('Narnia')).toBe('')
  })
})
