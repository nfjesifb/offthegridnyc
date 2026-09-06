"""Download Google Places photos for locations that have none (optional).

Requires GOOGLE_PLACES_API_KEY in the environment; the key is never written
anywhere. Results are cached in data/photo_cache.json (place ids, photo names,
attributions) so re-runs do not repeat paid API calls.

    GOOGLE_PLACES_API_KEY=... python tools/fetch_photos.py [--only SLUG] [--force] [--max 5]

Afterwards run `npm run images` (WebP variants) and `npm run build:site`.
"""
from __future__ import annotations

import argparse
import json
import os
import sys
import time
from pathlib import Path

import requests

ROOT = Path(__file__).resolve().parent.parent
DATA_FILE = ROOT / "data" / "locations.json"
CACHE_FILE = ROOT / "data" / "photo_cache.json"
LOCATIONS_DIR = ROOT / "locations"
API = "https://places.googleapis.com/v1"


def search_place(name: str, lat: float, lng: float, key: str) -> dict | None:
    resp = requests.post(
        f"{API}/places:searchText",
        headers={"X-Goog-Api-Key": key, "X-Goog-FieldMask": "places.id,places.photos"},
        json={"textQuery": f"{name} NYC", "locationBias": {"circle": {"center": {"latitude": lat, "longitude": lng}, "radius": 1000.0}}},
        timeout=20,
    )
    resp.raise_for_status()
    places = resp.json().get("places") or []
    if not places:
        return None
    place = places[0]
    return {"place_id": place.get("id"), "photo_names": [p["name"] for p in place.get("photos", [])]}


def attributions(place_id: str, key: str) -> str | None:
    resp = requests.get(f"{API}/places/{place_id}", headers={"X-Goog-Api-Key": key, "X-Goog-FieldMask": "photos.authorAttributions"}, timeout=20)
    resp.raise_for_status()
    names = []
    for photo in resp.json().get("photos", []):
        for attr in photo.get("authorAttributions", []):
            uri = attr.get("uri", "")
            if uri.startswith("//"):
                uri = "https:" + uri
            label = attr.get("displayName", "Unknown contributor")
            names.append(f'<a href="{uri}" target="_blank" rel="noopener noreferrer">{label}</a>' if uri else label)
    unique = list(dict.fromkeys(names))
    return ", ".join(unique) or None


def download(photo_name: str, dest: Path, key: str, max_width: int = 1200) -> bool:
    meta = requests.get(f"{API}/{photo_name}/media", params={"key": key, "maxWidthPx": max_width, "skipHttpRedirect": "true"}, timeout=20)
    meta.raise_for_status()
    uri = meta.json().get("photoUri")
    if not uri:
        return False
    img = requests.get(uri, timeout=30)
    img.raise_for_status()
    dest.parent.mkdir(parents=True, exist_ok=True)
    dest.write_bytes(img.content)
    return True


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--only", help="slug of a single location")
    parser.add_argument("--force", action="store_true", help="ignore the cache and re-fetch")
    parser.add_argument("--max", type=int, default=5, help="photos per location (max 5)")
    args = parser.parse_args()

    key = os.environ.get("GOOGLE_PLACES_API_KEY", "").strip()
    if not key:
        print("Set GOOGLE_PLACES_API_KEY in the environment (see .env.example).", file=sys.stderr)
        return 2

    places = json.loads(DATA_FILE.read_text(encoding="utf-8"))
    cache = json.loads(CACHE_FILE.read_text(encoding="utf-8")) if CACHE_FILE.exists() else {}
    fetched = 0
    for place in places:
        if args.only and place["slug"] != args.only:
            continue
        images = LOCATIONS_DIR / place["slug"] / "images"
        if not args.force and any(images.glob("photo_*.jpg")):
            continue
        print(f"Fetching photos for {place['name']} ...")
        entry = None if args.force else cache.get(place["name"])
        try:
            if not entry:
                entry = search_place(place["name"], place["lat"], place["lng"], key)
                if not entry:
                    print("  no place found")
                    continue
                entry["attributions"] = attributions(entry["place_id"], key) if entry.get("place_id") else None
                cache[place["name"]] = entry
                CACHE_FILE.write_text(json.dumps(cache, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
            for i, photo_name in enumerate(entry.get("photo_names", [])[: max(1, min(args.max, 5))], start=1):
                if download(photo_name, images / f"photo_{i}.jpg", key):
                    fetched += 1
                time.sleep(0.2)
        except requests.RequestException as exc:
            print(f"  request failed: {exc}")
    print(f"Downloaded {fetched} photos. Next: npm run images && npm run build:site")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
