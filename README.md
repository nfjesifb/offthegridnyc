# Off The Grid NYC

A map of New York's unusual homes, courts, shared spaces and streets. Places are the primary content: the map fills the workspace, a narrow list follows its visible area, and a selected place opens beside the map.

## Run

```sh
python -m pip install -r requirements.txt
python -m http.server 8765 --bind 127.0.0.1
```

Open http://127.0.0.1:8765. The site is static and needs no application server or visitor account.

## Content and rebuilding

- `locations.json`: original editorial records and canonical slugs.
- `offthegridnyc.kml`: locations, categories and original curator notes. Readable notes are used when the old JSON description is empty; HTML is converted to text and damaged duplicate paragraphs are omitted.
- `place-notes.json`: sourced descriptions and context for 23 entries, edited curator observations, corrected display names, and suppression of mismatched cached images. Original source files and photo assets remain intact.
- `location-template.html`: one Jinja template for all 85 place pages. Rendering is offline, deterministic and HTML-escaped.
- `photo_cache.json`: existing photographer credit information.

```sh
npm run build:catalog
```

Commit the resulting catalog, directory, sitemap and location pages. The build fails if an entry has no description. Pages show descriptions, available background, original map notes, linked sources, coordinates, an interactive context map, directions, Street View links, and four geographically nearby places. Empty galleries and empty history sections are omitted. The original AI-assisted background is identified as unverified. Sourced additions are linked where used; this is not a blanket historical fact check.

The legacy `generate_pages.py` remains the external photo-fetching workflow and may call paid APIs. After updating its cache and data it invokes the same renderer. It is unnecessary for normal edits. To regenerate small previews from local photos, install Pillow and run `python scripts/build_catalog.py --thumbnails` before rendering pages. Files with `hasPhotos: false`, or `hidePhotos: true` in the additions, never produce galleries. Unrelated search images found during the visual audit are intentionally withheld.

## Map behavior

Search and type filters update both map markers and the list. Panning changes the visible list when "In map" is checked. Selecting or saving a place does not refit the whole city. Nearby links move directly to the next place. On small screens the map stays above a resizable details/list panel. Saved collections persist locally, sync between tabs and can be shared without an account. Shared map links retain the current area and zoom. Location permission is requested only on Near me; device coordinates are kept in session memory and are not included in URLs.

Leaflet 1.9.4 is vendored with its license. OpenStreetMap tiles have visible attribution and use normal browser caching; there is no bulk/offline prefetch. Follow https://operations.osmfoundation.org/policies/tiles/ and choose a suitable provider if traffic grows. If maps fail, text, nearby links, directions and the static `/browse/` directory remain available. Story discussions load only when expanded.

## Tests

```sh
npm test
python -m unittest discover -s tests -p 'test_*.py'
```

For browser tests, install Node development dependencies, install the Playwright browser, and run with the preview server available:

```sh
npm ci
npx playwright install chromium
npm run test:browser
```

`TEST_URL` sets a different server URL; `BROWSER_CHANNEL=msedge` uses installed Edge; `PLAYWRIGHT_MODULE` can point to an existing package; `SCREENSHOT_DIR` changes screenshot output. Tests block production analytics. GitHub Actions checks content, templates and deterministic regeneration.

## Editorial next steps

The useful growth mechanisms are direct place links, shared saved lists, and nearby discoveries. Future work should focus on the places: source-check existing AI-assisted histories, replace withheld images with confirmed photographs, and publish short neighborhood walks with verified access. Avoid popularity counts or access claims without evidence.
