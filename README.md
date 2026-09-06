# Off The Grid NYC

A hand-curated map of New York City's mews, courtyards, rooftop tracks, hidden
gardens and other quiet corners. Live at <https://offthegridnyc.com>.

The site is fully static: every page is generated from one JSON dataset and
published from the repository root by GitHub Pages. It needs **no API keys**:
the map uses [Leaflet](https://leafletjs.com) with OpenStreetMap tiles (provider configurable in `data/site.json`),
street view comes from NYC Planning Labs' Roadview, and photos are stored in
the repository.

## Layout

| Path | What it is |
| --- | --- |
| `data/locations.json` | **The dataset.** Name, slug, description, history, borough, neighborhood, coordinates, street-view pin. |
| `data/site.json` | Site name, URLs, analytics id, giscus and form settings. |
| `data/images.json` | Image dimensions (written by `npm run images`). |
| `data/redirects.json` | Old page names from the first version of the site. |
| `templates/site/` | Jinja2 templates (autoescaped). |
| `src/css/styles.css` | Tailwind v4 source of the design system. |
| `assets/` | Built CSS, JavaScript, self-hosted fonts, vendored Leaflet, icons, the public dataset. |
| `locations/<slug>/` | One generated page per place plus its photos (`photo_N.jpg` and WebP variants). |
| `tools/` | Build, image, import, photo, icon and admin scripts. |
| `index.html`, `locations/index.html`, `404.html`, `sitemap.xml`, `robots.txt` | Generated. Do not edit by hand. |

## Working on the site

```bash
npm ci
pip install -r requirements.txt

npm run build      # vendor assets + CSS + all pages
npm run serve      # preview at http://127.0.0.1:4173
npm run check      # links, secrets, CSP/meta sanity
npm test           # Playwright smoke tests (first time: npx playwright install chromium)
```

Commit the generated output together with your change. CI rebuilds the site
and fails if the committed output is stale, if a link is broken, if an API key
ever appears in the tree, or if a dependency has a known high-severity issue.

### Editing places

Either edit `data/locations.json` directly, or use the local admin tool:

```bash
OTG_ADMIN_PASSWORD='a long passphrase' npm run admin   # http://127.0.0.1:5000
```

It runs on localhost only, has no default password, uses CSRF tokens and
throttles failed logins. It can add, edit and delete places, look up the
borough and neighborhood for a pin (NYC Neighborhood Tabulation Areas from
NYC Open Data), and trigger a rebuild. Then `npm run build:css` (if templates
changed), review, commit and push.

### Photos

```bash
GOOGLE_PLACES_API_KEY=... python tools/fetch_photos.py --only <slug>
npm run images        # generates 480px and 1200px WebP variants
npm run build:site
```

The Places key is only ever read from the environment. Photos that people
send in can simply be dropped into `locations/<slug>/images/photo_N.jpg`.

### Importing from Google My Maps

`python tools/import_kml.py --geo` merges coordinates from a KML export in
`data/` into the dataset and assigns boroughs/neighborhoods to new entries.
Entries with `"geo_auto": false` keep hand-edited values.

## Security notes

* No secrets in the repository. `npm run check` fails the build if a key-like
  string appears anywhere; `.env` is git-ignored.
* Every page ships a Content Security Policy: scripts, styles, fonts and images
  are self-hosted; the only third parties are the tile server, Google Analytics
  (opt-out honoured for Do Not Track / Global Privacy Control), giscus and the
  two embeds that load only on request (Roadview street view, the Google Form).
  Embeds are sandboxed iframes with `referrerpolicy="no-referrer"`.
* Dependencies are pinned in `package-lock.json` and audited in CI;
  `node_modules` is no longer committed.
* If a key from the old version of this repository is still active in Google
  Cloud, rotate or delete it: the old pages embedded two keys and they remain
  in git history.

## Deployment

GitHub Pages serves the `main` branch root (custom domain in `CNAME`). Merging
a branch whose generated files are up to date is the whole deployment.
