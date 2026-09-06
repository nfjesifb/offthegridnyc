#!/usr/bin/env python3
"""Static site generator for Off The Grid NYC.

Reads the canonical dataset (data/locations.json), the image manifest and the
site configuration, and writes every public page into the repository root,
which is what GitHub Pages publishes:

    index.html                 home page with the interactive map
    locations/index.html       directory of every place
    locations/<slug>/index.html one page per place
    locations/<legacy>.html    redirect stubs for URLs from the first version of the site
    404.html, sitemap.xml, robots.txt, assets/data/locations.json

The build is deterministic, needs no network access and no secrets. Templates
are rendered with Jinja2 autoescaping, so data can never inject markup.

Usage:  python tools/build.py [--prune]
"""
from __future__ import annotations

import argparse
from urllib.parse import urlparse
import json
import math
import re
import shutil
import sys
from pathlib import Path

from jinja2 import Environment, FileSystemLoader, StrictUndefined, select_autoescape

ROOT = Path(__file__).resolve().parent.parent
DATA_DIR = ROOT / "data"
TEMPLATE_DIR = ROOT / "templates" / "site"
LOCATIONS_DIR = ROOT / "locations"

BOROUGH_ORDER = ["Manhattan", "Brooklyn", "Queens", "Bronx", "Staten Island"]
IMAGE_SIZES = (480, 1200)


# --------------------------------------------------------------------------- helpers
def load_json(path: Path, default=None):
    if not path.exists():
        if default is not None:
            return default
        raise SystemExit(f"Missing required file: {path.relative_to(ROOT)}")
    with open(path, encoding="utf-8") as fh:
        return json.load(fh)


def slugify(text: str) -> str:
    text = text.lower().strip()
    text = re.sub(r"\s+", "-", text)
    text = re.sub(r"[^\w\-]+", "", text)
    text = re.sub(r"-{2,}", "-", text)
    return text.strip("-")


def borough_slug(name: str) -> str:
    return slugify(name) if name in BOROUGH_ORDER else "other"


def haversine_miles(lat1, lng1, lat2, lng2) -> float:
    r = 3958.8
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlmb = math.radians(lng2 - lng1)
    h = math.sin(dphi / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dlmb / 2) ** 2
    return 2 * r * math.asin(math.sqrt(h))


def paragraphs(text: str | None) -> list[str]:
    if not text:
        return []
    parts = [p.strip() for p in re.split(r"\n\s*\n|\n", text) if p.strip()]
    return parts


def summarize(text: str, limit: int = 150) -> str:
    text = " ".join((text or "").split())
    if len(text) <= limit:
        return text
    cut = text[: limit + 1]
    cut = cut[: cut.rfind(" ")] if " " in cut else cut[:limit]
    return cut.rstrip(" ,;:.") + "…"


def json_for_html(obj) -> str:
    """JSON that is safe inside a <script> data block (never closes the tag)."""
    return json.dumps(obj, ensure_ascii=False, separators=(",", ":")).replace("<", "\\u003c").replace("\u2028", "\\u2028").replace("\u2029", "\\u2029")


ATTRIBUTION_LINK = re.compile(r'<a\s+href="(?P<uri>[^"]+)"[^>]*>(?P<name>[^<]+)</a>', re.I)


def parse_attributions(raw: str | None) -> list[dict]:
    """Turn the HTML attribution strings cached from the Places API into data."""
    if not raw:
        return []
    out, seen = [], set()
    for chunk in raw.split(", "):
        chunk = chunk.strip()
        m = ATTRIBUTION_LINK.search(chunk)
        if m:
            uri, name = m.group("uri").strip(), m.group("name").strip()
            if not uri.startswith("https://"):
                uri = ""
        else:
            uri, name = "", re.sub(r"<[^>]+>", "", chunk).strip()
        if name and name.lower() not in seen:
            seen.add(name.lower())
            out.append({"name": name, "uri": uri})
    return out


def write_text(path: Path, content: str) -> bool:
    path.parent.mkdir(parents=True, exist_ok=True)
    if path.exists() and path.read_text(encoding="utf-8") == content:
        return False
    path.write_text(content, encoding="utf-8")
    return True


# --------------------------------------------------------------------------- data
def discover_photos(place: dict, manifest: dict) -> list[dict]:
    """Photos for a place, from locations/<slug>/images (photo_N first, then satellite)."""
    images_dir = LOCATIONS_DIR / place["slug"] / "images"
    if not images_dir.is_dir():
        return []

    def variant(src: Path, width: int) -> str:
        cand = src.with_name(f"{src.stem}-{width}.webp")
        return "/" + (cand if cand.exists() else src).relative_to(ROOT).as_posix()

    files = sorted(images_dir.glob("photo_*.jpg"), key=lambda p: int(re.sub(r"\D", "", p.stem) or 0))
    files += sorted(images_dir.glob("satellite*.jpg"))
    photos = []
    for i, src in enumerate(files, start=1):
        rel = src.relative_to(ROOT).as_posix()
        dims = manifest.get(rel, {})
        width, height = dims.get("width", 1200), dims.get("height", 800)
        is_sat = src.name.startswith("satellite")
        w1200 = min(width, 1200)
        photos.append({
            "src": variant(src, 1200),
            "thumb": variant(src, 480),
            "srcset": f"{variant(src, 480)} 480w, {variant(src, 1200)} {w1200}w",
            "original": "/" + rel,
            "width": w1200,
            "height": round(height * w1200 / width) if width else height,
            "alt": f"Satellite view of {place['name']}" if is_sat else f"{place['name']}, photo {i}",
            "caption": "Satellite view" if is_sat else f"Photo {i} · via Google Maps",
            "kind": "satellite" if is_sat else "photo",
        })
    return photos


def prepare_places(raw: list[dict], manifest: dict, photo_cache: dict, site: dict) -> list[dict]:
    places = []
    slugs = set()
    for loc in raw:
        if "lat" not in loc or "lng" not in loc:
            print(f"  skipping '{loc.get('name')}': no coordinates")
            continue
        slug = loc.get("slug") or slugify(loc["name"])
        if slug in slugs:
            raise SystemExit(f"Duplicate slug: {slug}")
        slugs.add(slug)
        borough = loc.get("borough") or "New York City"
        sv = loc.get("streetview") or {}
        sv_lat, sv_lng = sv.get("lat", loc["lat"]), sv.get("lng", loc["lng"])
        description = loc.get("description") or "No description yet."
        p = {
            "name": loc["name"],
            "slug": slug,
            "url": f"/locations/{slug}/",
            "description": description,
            "description_paragraphs": paragraphs(description),
            "history": loc.get("history") or "",
            "history_paragraphs": paragraphs(loc.get("history")),
            "note": loc.get("note") or "",
            "summary": summarize(description),
            "borough": borough,
            "borough_slug": borough_slug(borough),
            "neighborhood": loc.get("neighborhood") or "",
            "lat": float(loc["lat"]),
            "lng": float(loc["lng"]),
            "streetview": {"lat": float(sv_lat), "lng": float(sv_lng)},
            "roadview_url": f"https://roadview.planninglabs.nyc/view/{float(sv_lng):.7f}/{float(sv_lat):.7f}",
            "directions_url": f"https://www.google.com/maps/dir/?api=1&destination={loc['lat']},{loc['lng']}",
            "gmaps_url": f"https://www.google.com/maps/search/?api=1&query={loc['lat']},{loc['lng']}",
            "attributions": parse_attributions((photo_cache.get(loc["name"]) or {}).get("attributions")),
        }
        p["photos"] = discover_photos(p, manifest)
        real_photos = [ph for ph in p["photos"] if ph["kind"] == "photo"]
        p["photo_count"] = len(real_photos)
        first = p["photos"][0] if p["photos"] else None
        p["thumb"] = None
        if first:
            w = min(480, first["width"])
            p["thumb"] = {"src": first["thumb"], "width": w, "height": round(first["height"] * w / first["width"])}
        p["og_image"] = site["url"] + (first["original"] if first else site["og_image"])
        p["search_text"] = " ".join([p["name"], p["neighborhood"], p["borough"], description]).lower()
        places.append(p)

    places.sort(key=lambda x: x["name"].lower())
    for i, p in enumerate(places):
        p["prev"] = places[i - 1]
        p["next"] = places[(i + 1) % len(places)]
        others = [(haversine_miles(p["lat"], p["lng"], o["lat"], o["lng"]), o) for o in places if o is not p]
        others.sort(key=lambda t: t[0])
        p["nearby"] = [{"place": o, "miles": f"{max(d, 0.1):.1f}"} for d, o in others[:4]]
    return places


def group_boroughs(places: list[dict]) -> list[dict]:
    groups = []
    for name in BOROUGH_ORDER + ["New York City"]:
        members = [p for p in places if p["borough"] == name]
        if members:
            groups.append({"name": name, "slug": borough_slug(name), "count": len(members), "places": members})
    return groups


def tile_host(site: dict) -> str:
    """CSP source for the tile server, e.g. https://*.example.com for {s} subdomains."""
    url = site["tiles"]["url"]
    host = urlparse(url.replace("{s}", "subdomain")).netloc
    return "https://" + ("*." + host[len("subdomain."):] if "{s}" in url else host)


def build_csp(site: dict) -> str:
    ga = bool(site.get("ga_id"))
    directives = {
        "default-src": ["'self'"],
        "script-src": ["'self'", "https://giscus.app"] + (["https://www.googletagmanager.com"] if ga else []),
        "style-src": ["'self'"],
        "img-src": ["'self'", "data:", tile_host(site)] + (["https://*.google-analytics.com", "https://*.googletagmanager.com"] if ga else []),
        "font-src": ["'self'"],
        "connect-src": ["'self'", "https://giscus.app"] + (["https://*.google-analytics.com", "https://*.analytics.google.com", "https://*.googletagmanager.com", "https://www.google.com"] if ga else []),
        "frame-src": ["https://giscus.app", "https://roadview.planninglabs.nyc", "https://docs.google.com", "https://accounts.google.com"],
        "object-src": ["'none'"],
        "base-uri": ["'self'"],
        "form-action": ["'self'"],
        "upgrade-insecure-requests": [],
    }
    return "; ".join(f"{k} {' '.join(v)}".strip() for k, v in directives.items())


# --------------------------------------------------------------------------- rendering
def make_env() -> Environment:
    env = Environment(
        loader=FileSystemLoader(str(TEMPLATE_DIR)),
        autoescape=select_autoescape(["html", "xml", "svg"], default=True),
        undefined=StrictUndefined,
        trim_blocks=True,
        lstrip_blocks=True,
    )
    return env


def render_site(prune: bool = False) -> int:
    site = load_json(DATA_DIR / "site.json")
    raw = load_json(DATA_DIR / "locations.json")
    manifest = load_json(DATA_DIR / "images.json", default={})
    photo_cache = load_json(DATA_DIR / "photo_cache.json", default={})
    redirects = {k: v for k, v in load_json(DATA_DIR / "redirects.json", default={}).items() if not k.startswith("_")}

    places = prepare_places(raw, manifest, photo_cache, site)
    boroughs = group_boroughs(places)
    env = make_env()
    base_ctx = {
        "site": site,
        "places": places,
        "boroughs": boroughs,
        "csp": build_csp(site),
        "photo_total": sum(p["photo_count"] for p in places),
    }
    changed = 0
    pages: list[str] = []

    def page_ctx(title, description, path, **extra):
        ctx = {"title": title, "description": description, "canonical": site["url"] + path, "og_image": site["url"] + site["og_image"], "has_map": False, "jsonld": "", "noindex": False, "og_type": "website", "og_title": ""}
        ctx.update(extra)
        return ctx

    # Home
    places_json = json_for_html([{
        "name": p["name"], "slug": p["slug"], "url": p["url"], "borough": p["borough"], "boroughSlug": p["borough_slug"],
        "neighborhood": p["neighborhood"], "lat": p["lat"], "lng": p["lng"], "summary": p["summary"],
        "thumb": p["thumb"]["src"] if p["thumb"] else "", "search": p["search_text"],
    } for p in places])
    home_ld = json_for_html({
        "@context": "https://schema.org", "@type": "WebSite", "name": site["name"], "url": site["url"] + "/",
        "description": site["description"],
    })
    changed += write_text(ROOT / "index.html", env.get_template("index.html").render(
        **base_ctx, places_json=places_json,
        page=page_ctx(f"{site['name']} · {site['tagline']}", site["description"], "/", has_map=True, jsonld=home_ld)))
    pages.append("/")

    # Directory
    changed += write_text(LOCATIONS_DIR / "index.html", env.get_template("directory.html").render(
        **base_ctx, page=page_ctx(f"All places · {site['name']}", f"Every one of the {len(places)} places on {site['name']}, grouped by borough.", "/locations/")))
    pages.append("/locations/")

    # Places
    tpl = env.get_template("location.html")
    for p in places:
        path = p["url"]
        ld = json_for_html([{
            "@context": "https://schema.org", "@type": "TouristAttraction", "name": p["name"], "url": site["url"] + path,
            "description": p["summary"], "image": p["og_image"],
            "geo": {"@type": "GeoCoordinates", "latitude": p["lat"], "longitude": p["lng"]},
            "containedInPlace": {"@type": "Place", "name": f"{p['borough']}, New York City"},
        }, {
            "@context": "https://schema.org", "@type": "BreadcrumbList", "itemListElement": [
                {"@type": "ListItem", "position": 1, "name": "Home", "item": site["url"] + "/"},
                {"@type": "ListItem", "position": 2, "name": "Places", "item": site["url"] + "/locations/"},
                {"@type": "ListItem", "position": 3, "name": p["name"], "item": site["url"] + path},
            ],
        }])
        gallery_json = json_for_html([{k: ph[k] for k in ("src", "srcset", "width", "height", "alt", "caption")} for ph in p["photos"]])
        changed += write_text(LOCATIONS_DIR / p["slug"] / "index.html", tpl.render(
            **base_ctx, p=p, gallery_json=gallery_json,
            page=page_ctx(f"{p['name']} · {p['borough']} · {site['name']}", p["summary"], path, has_map=True, jsonld=ld, og_type="article", og_image=p["og_image"], og_title=p["name"])))
        pages.append(path)

    # Redirect stubs for the first version of the site (locations/<slug>.html)
    rtpl = env.get_template("redirect.html")
    stub_targets = {p["slug"]: p["url"] for p in places}
    for legacy, target_slug in redirects.items():
        stub_targets[legacy] = f"/locations/{target_slug}/" if target_slug else "/locations/"
    for legacy, target in stub_targets.items():
        changed += write_text(LOCATIONS_DIR / f"{legacy}.html", rtpl.render(site=site, target=target))

    # 404
    changed += write_text(ROOT / "404.html", env.get_template("404.html").render(
        **base_ctx, page=page_ctx(f"Page not found · {site['name']}", "That page is off the grid.", "/404.html", noindex=True)))

    # Sitemap, robots, open dataset
    sitemap = ['<?xml version="1.0" encoding="UTF-8"?>', '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">']
    for path in pages:
        sitemap.append(f"  <url><loc>{site['url']}{path}</loc></url>")
    sitemap.append("</urlset>\n")
    changed += write_text(ROOT / "sitemap.xml", "\n".join(sitemap))
    changed += write_text(ROOT / "robots.txt", f"User-agent: *\nAllow: /\nDisallow: /assets/vendor/\n\nSitemap: {site['url']}/sitemap.xml\n")
    dataset = {
        "name": site["name"], "url": site["url"], "license": "Descriptions CC BY 4.0; photos belong to their Google Maps contributors.",
        "count": len(places),
        "places": [{
            "name": p["name"], "slug": p["slug"], "url": site["url"] + p["url"], "borough": p["borough"], "neighborhood": p["neighborhood"],
            "lat": p["lat"], "lng": p["lng"], "description": p["description"], "history": p["history"],
            "photos": [site["url"] + ph["src"] for ph in p["photos"] if ph["kind"] == "photo"],
        } for p in places],
    }
    changed += write_text(ROOT / "assets" / "data" / "locations.json", json.dumps(dataset, ensure_ascii=False, indent=1) + "\n")

    # Optionally remove directories for places that no longer exist
    if prune:
        keep = {p["slug"] for p in places}
        for d in LOCATIONS_DIR.iterdir():
            if d.is_dir() and d.name not in keep:
                print(f"  pruning {d.relative_to(ROOT)}")
                shutil.rmtree(d)

    print(f"Built {len(places)} places, {len(stub_targets)} redirects, {len(pages)} sitemap entries ({changed} files changed).")
    return 0


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--prune", action="store_true", help="delete locations/<slug> folders that are no longer in the dataset")
    args = parser.parse_args()
    return render_site(prune=args.prune)


if __name__ == "__main__":
    sys.exit(main())
