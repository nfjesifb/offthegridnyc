# Off The Grid NYC

A human-curated field guide to NYC's hidden communities, unusual homes, shared spaces, and streets worth a detour. The editorial lens is how the city's spaces are made, shared, and lived in. Existing descriptions are AI-assisted and should be verified before visiting.

## Run locally

The production site is static HTML, CSS, and JavaScript on the existing custom domain. No server, account system, or build service is required to use it.

```sh
python -m http.server 8765 --bind 127.0.0.1
```

Open http://127.0.0.1:8765. JavaScript modules and catalog loading require an HTTP server, rather than opening index.html as a file.

## Discovery experience

- Search names, descriptions, histories, and themes. Categories come directly from the curated KML folders.
- List and map views use the same filtered catalog. The map is loaded on demand, using vendored Leaflet 1.9.4 and attributed OpenStreetMap tiles. List discovery and Google directions continue to work when map tiles fail.
- Save places in local storage without an account. The site handles blocked or corrupt storage, and synchronizes changes between open tabs.
- Share searches, themes, individual places, and saved collections. Shared collections encode explicit place slugs, so recipients need no saved browser state.
- “Surprise me” selects from the current results. “Near me” requests location only after a click, sorts by straight-line distance, and keeps coordinates in memory. Distances are not walking routes or access guarantees.
- Existing stories have save/share controls, related discoveries, canonical metadata, and social previews. The full directory at `/browse/` works without JavaScript.

## Content maintenance

`locations.json` is the editorial source for names, descriptions, histories and canonical slugs. `offthegridnyc.kml` supplies coordinates and categories. The generated discovery catalog de-duplicates repeated slugs and verifies every page path. The original 86 records currently produce 85 unique places.

After editing source content and generating any new location pages:

```sh
python scripts/build_catalog.py
python scripts/enhance_pages.py
```

Commit the generated `assets/data/places.json`, `browse/index.html`, `sitemap.xml`, and location-page changes. `enhance_pages.py` is idempotent and updates the page template as well as existing stories, without calling the photo APIs. It preserves photos, attribution, discussion, and original editorial copy.

For new or changed preview photos, install Pillow and run:

```sh
python -m pip install Pillow
python scripts/build_catalog.py --thumbnails
python scripts/enhance_pages.py
```

The generator creates small WebP previews from photos already in the repository; originals and their credit information stay on the story pages. Leaflet is vendored under `assets/vendor/leaflet/`, including its license. Tile usage must continue to follow https://operations.osmfoundation.org/policies/tiles/: visible attribution, normal browser caching, and no bulk/offline prefetch. Choose a suitable tile provider if traffic grows beyond the public service's capacity.

The legacy `generate_pages.py` makes external photo requests. It is not needed to rebuild the explorer or run tests. The new homepage stylesheet is independent of the legacy Tailwind build used by story pages.

## Validation

Node.js 22+ and Python 3 are sufficient for the core tests and catalog build:

```sh
npm test
```

Browser checks use Playwright (a development dependency). With the local server running:

```sh
npm ci
npx playwright install chromium
npm run test:browser
```

Optional environment variables: `TEST_URL` changes the preview address; `BROWSER_CHANNEL=msedge` uses installed Edge; `PLAYWRIGHT_MODULE` points to an existing Playwright package; `SCREENSHOT_DIR` changes the screenshot output folder. Browser tests block production analytics and test desktop/mobile layouts, sharing across browsers, persistence, denial/failure states, and no-JavaScript navigation. Screenshots are ignored by Git.

## Making the guide grow

Implemented foundations: direct story links and social cards for sharing; shareable collections for planning together; saved places and related stories for return visits; a crawlable directory and sitemap for discovery; and a short contribution path using the existing form.

Next editorial experiments, in priority order:

1. Verify a small set of standout places, access notes and histories with primary sources. Show a genuine last-checked date only when checked. Confidence in the guide matters more than adding many uncertain entries.
2. Publish a regular “one unexpected block” story, linking to a themed collection. Use the same recurring format in social posts; ask readers to contribute a place or a correction through the form.
3. Create short, access-checked neighborhood walks with local historians or walking groups. Route planning should distinguish public streets from private entrances.
4. Measure shared-link visits, engaged sessions and returning visitors in the existing analytics. If readers return, consider an opt-in newsletter with an actual delivery service and a clear publishing cadence.

These are experiments, not guarantees of traffic. The implementation does not invent reviews, popularity counts, opening hours, or public-access claims.
