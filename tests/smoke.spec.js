const { test, expect } = require('@playwright/test');

// Network noise from third parties (tiles, analytics) must not fail the suite,
// but genuine script errors and CSP violations on our own pages must.
const IGNORED = [/basemaps\.cartocdn\.com/, /googletagmanager|google-analytics/, /giscus\.app/, /net::ERR_/, /Failed to load resource/];

// Keep the suite hermetic: everything the pages need is served locally, and a
// slow or unreachable tile/analytics/comments server must not fail or stall it.
test.beforeEach(async ({ context }) => {
  await context.route(/^https?:\/\/(?!127\.0\.0\.1)/, (route) => route.abort());
});

function collectErrors(page) {
  const errors = [];
  page.on('pageerror', (err) => errors.push(`pageerror: ${err.message}`));
  page.on('console', (msg) => {
    if (msg.type() !== 'error') return;
    const text = msg.text();
    if (IGNORED.some((re) => re.test(text))) return;
    errors.push(`console: ${text}`);
  });
  return errors;
}

test('home page: map, search and filters work without errors', async ({ page }) => {
  const errors = collectErrors(page);
  await page.goto('/');
  await expect(page).toHaveTitle(/Off The Grid NYC/);
  await expect(page.locator('meta[http-equiv="Content-Security-Policy"]')).toHaveCount(1);

  const markers = page.locator('#map .otg-marker');
  await expect(markers.first()).toBeVisible();
  const total = await page.locator('#place-list > li').count();
  expect(total).toBeGreaterThan(50);
  await expect(markers).toHaveCount(total);

  await page.fill('#search', 'mews');
  await expect(page.locator('#results-count')).toContainText(/Showing \d+ of/);
  const visible = await page.locator('#place-list > li:not([hidden])').count();
  expect(visible).toBeGreaterThan(0);
  expect(visible).toBeLessThan(total);
  await expect(page.locator('#map .otg-marker')).toHaveCount(visible);

  await page.click('#reset-filters');
  await expect(page.locator('#place-list > li:not([hidden])')).toHaveCount(total);
  await page.click('#borough-filters [data-borough="brooklyn"]');
  const brooklyn = await page.locator('#place-list > li:not([hidden])').count();
  expect(brooklyn).toBeGreaterThan(0);
  expect(brooklyn).toBeLessThan(total);

  await page.click('#place-list > li:not([hidden]) .place-card__map-btn');
  await expect(page.locator('.leaflet-popup .popup__title')).toBeVisible();
  expect(page.url()).toMatch(/#place=/);
  expect(errors).toEqual([]);
});

test('deep link opens the right place on the map', async ({ page }) => {
  await page.goto('/#place=elevated-acre');
  await expect(page.locator('.leaflet-popup .popup__title')).toHaveText('Elevated Acre');
  await expect(page.locator('#place-list > li[data-slug="elevated-acre"]')).toHaveClass(/is-active/);
});

test('place page: gallery, lightbox, street view on demand, nearby links', async ({ page }) => {
  const errors = collectErrors(page);
  await page.goto('/locations/elevated-acre/');
  await expect(page.locator('h1')).toHaveText('Elevated Acre');
  await expect(page.locator('#place-map .otg-marker')).toHaveCount(1);
  await expect(page.locator('#gallery-main-img')).toBeVisible();
  await expect(page.locator('.gallery__thumb')).toHaveCount(await page.locator('#gallery-data').evaluate((el) => JSON.parse(el.textContent).length));

  await page.click('.gallery__thumb[data-index="1"]');
  await expect(page.locator('#gallery-main-img')).toHaveAttribute('alt', /photo 2/);
  await page.click('.gallery__open');
  await expect(page.locator('#lightbox')).toHaveAttribute('open', '');
  await page.keyboard.press('ArrowRight');
  await expect(page.locator('#lightbox-caption')).toContainText('3 of');
  await page.keyboard.press('Escape');
  await expect(page.locator('#lightbox')).not.toHaveAttribute('open', '');

  await expect(page.locator('#streetview iframe')).toHaveCount(0);
  await page.click('#load-streetview');
  const frame = page.locator('#streetview iframe');
  await expect(frame).toHaveCount(1);
  await expect(frame).toHaveAttribute('sandbox', /allow-scripts/);
  await expect(frame).toHaveAttribute('src', /roadview\.planninglabs\.nyc/);

  const nearby = page.locator('.nearby a');
  expect(await nearby.count()).toBeGreaterThan(0);
  await expect(page.locator('a[rel="prev"]')).toHaveAttribute('href', /\/locations\//);
  expect(errors).toEqual([]);
});

test('directory filters and 404 page', async ({ page }) => {
  await page.goto('/locations/');
  const all = await page.locator('.place-card').count();
  await page.fill('#directory-search', 'garden');
  await expect(page.locator('#directory-status')).toContainText(/match/);
  const shown = await page.locator('.place-card:not([hidden])').count();
  expect(shown).toBeGreaterThan(0);
  expect(shown).toBeLessThan(all);

  const res = await page.goto('/this-page-does-not-exist');
  expect(res.status()).toBe(404);
  await expect(page.locator('h1')).toContainText('off the grid');
});

test('legacy URLs redirect and no page leaks an API key', async ({ page }) => {
  await page.goto('/locations/brooklyn-bridge-park.html');
  await expect(page).toHaveURL(/\/locations\/brooklyn-bridge-parks\/$/);
  for (const path of ['/', '/locations/', '/locations/elevated-acre/']) {
    const html = await (await page.goto(path)).text();
    expect(html).not.toMatch(/AIza[0-9A-Za-z_-]{30,}/);
  }
});

test('mobile layout has a working menu', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 800 });
  await page.goto('/');
  await expect(page.locator('#site-nav')).toBeHidden();
  await page.click('#nav-toggle');
  await expect(page.locator('#site-nav')).toBeVisible();
  await expect(page.locator('#nav-toggle')).toHaveAttribute('aria-expanded', 'true');
});
