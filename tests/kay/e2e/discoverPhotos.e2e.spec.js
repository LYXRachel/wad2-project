/* discoverPhotos.e2e.spec.js (by Kay Herng)
 E2E tests for my two features, done the way a user uses them: Discover and Photos.
 Playwright starts the Vue app with `pnpm dev` (see playwright.config.js).
 Test 2 also needs the Express server + MongoDB running, and the test account, like the itinerary tests:
   E2E_USERNAME=... E2E_PASSWORD=... pnpm exec playwright test tests/kay
 Each test has 3 stages: (1) setup: go to the page, (2) actions, (3) assert.

 | Test | Feature  | User actions                                                   | Expected result                                   |
 |------|----------|----------------------------------------------------------------|---------------------------------------------------|
 | 1    | Discover | As a guest: search "Kyoto" -> pick it -> tap the heart ->      | Japan opens; suitcase says "1 place packed",      |
 |      |          | reload the page                                                | and it's still packed after the reload            |
 | 2    | Photos   | Log in -> open the Kyoto trip -> Photos -> make a new album -> | New album selected; photo uploads ("Added ✓")     |
 |      |          | upload a JPEG -> open it -> "Delete for everyone"              | and shows; after deleting, the album is empty     |

 Test 2 makes its own album with a new name each run, so it never touches the group's real photos,
 and it deletes the photo it uploaded (cleanup), so the test can be run again and again.
*/

import { test, expect } from '@playwright/test'

test('Test1: guest can search for Kyoto and pack it into the suitcase', async ({ page }) => {
  // (1) setup: open Discover and skip the first-visit tour
  await page.goto('/discover')
  await page.getByRole('button', { name: 'Skip the tour' }).click()
  await expect(page.getByRole('heading', { name: 'Where to next?' })).toBeVisible()

  // (2) actions: search for Kyoto, pick the suggestion, then tap the heart
  await page.getByRole('combobox', { name: 'Search a city or country' }).fill('Kyoto')
  await page.getByRole('option', { name: /Kyoto/ }).click()
  await expect(page.getByRole('navigation', { name: 'You are here' }).getByText('Japan')).toBeVisible()

  const heart = page.getByRole('button', { name: 'Favorite destination: Kyoto' })
  await heart.click()

  // (3) assert: Kyoto is packed in the suitcase
  await expect(heart).toHaveAttribute('aria-pressed', 'true')
  await expect(page.getByText('1 place packed')).toBeVisible()

  // ...and it's remembered after a reload (guests keep it in this browser)
  await page.reload()
  await expect(page.getByText('1 place packed')).toBeVisible()
})

test('Test2: user can upload a photo to a new album and delete it', async ({ page }) => {
  // (1) setup: log in, open the Kyoto trip, then the Photos tab
  await page.goto('/login')
  await page.getByTestId('login-username').fill(process.env.E2E_USERNAME)
  await page.getByTestId('login-password').fill(process.env.E2E_PASSWORD)
  await page.getByTestId('login-submit').click()
  await expect(page).toHaveURL(/\/home/)

  const tripCard = page.locator('.trip-card').filter({ hasText: 'Kyoto' }).last()
  await tripCard.getByTestId('open-trip').click()
  await page.getByRole('tab', { name: /Photos/ }).click()
  await expect(page.getByRole('heading', { name: 'Shared roll' })).toBeVisible()

  // (2) actions: make a new album just for this test
  const albumName = 'E2E album ' + Date.now()
  await page.getByRole('button', { name: '+ Add album' }).click()
  await page.getByLabel('Album name').fill(albumName)
  await page.getByRole('button', { name: 'Create', exact: true }).click()

  // (3) assert: the new album is open and empty
  await expect(page.getByRole('tab', { name: new RegExp(albumName) })).toHaveAttribute('aria-selected', 'true')
  await expect(page.getByText(/No photos here yet|Start the shared roll/)).toBeVisible()

  // (2) actions: upload a photo (it goes into the open album)
  await page.locator('input[type="file"][accept^="image/jpeg"]').setInputFiles('tests/kay/e2e/fixtures/test-photo.jpg')

  // (3) assert: the upload finished and the photo shows
  await expect(page.getByText('Added ✓')).toBeVisible()
  await expect(page.getByTestId('photo-grid').getByRole('img', { name: /Photo by/ })).toBeVisible()

  // (2) actions, cleanup: open the photo and delete it for everyone
  await page.getByRole('button', { name: 'Open photo 1' }).click()
  const viewer = page.getByRole('dialog', { name: 'Photo viewer' })
  await viewer.getByRole('button', { name: 'Delete', exact: true }).click()
  await viewer.getByRole('button', { name: 'Delete for everyone' }).click()

  // (3) assert: the photo is gone and the album is empty again
  await expect(page.getByText(/No photos here yet|Start the shared roll/)).toBeVisible()
})
