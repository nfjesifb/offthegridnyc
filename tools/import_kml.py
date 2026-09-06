"""Merge coordinates from Google My Maps KML exports into data/locations.json.

Usage:
    python tools/import_kml.py                # merge data/offthegridnyc.kml (+ street view KML)
    python tools/import_kml.py --geo          # also (re)assign borough / neighborhood

The JSON file is the canonical dataset for the site. KML files are only an
import source (for example after editing the public Google My Map).  Names are
matched case-insensitively; unknown placemarks are appended as new locations.
Entries with "geo_auto": false keep their hand-edited borough and neighborhood.
"""
from __future__ import annotations

import argparse
import json
import re
import sys
import xml.etree.ElementTree as ET
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DATA_FILE = ROOT / "data" / "locations.json"
KML_FILE = ROOT / "data" / "offthegridnyc.kml"
SV_KML_FILE = ROOT / "data" / "offthegridnycstreetview.kml"
NS = {"k": "http://www.opengis.net/kml/2.2"}


def slugify(text: str) -> str:
    text = text.lower().strip()
    text = re.sub(r"\s+", "-", text)
    text = re.sub(r"[^\w\-]+", "", text)
    text = re.sub(r"-{2,}", "-", text)
    return text.strip("-")


def parse_kml(path: Path) -> dict[str, dict]:
    out: dict[str, dict] = {}
    if not path.exists():
        return out
    root = ET.parse(path).getroot()
    for pm in root.iter("{http://www.opengis.net/kml/2.2}Placemark"):
        name_el = pm.find("k:name", NS)
        coords_el = pm.find(".//k:Point/k:coordinates", NS)
        if name_el is None or coords_el is None or not (name_el.text or "").strip():
            continue
        try:
            lng, lat, *_ = (float(v) for v in coords_el.text.strip().split(","))
        except ValueError:
            continue
        desc_el = pm.find("k:description", NS)
        out[name_el.text.strip().lower()] = {
            "name": name_el.text.strip(),
            "lat": round(lat, 7),
            "lng": round(lng, 7),
            "note": (desc_el.text or "").strip() if desc_el is not None else "",
        }
    return out


def load_json(path: Path) -> list[dict]:
    if not path.exists():
        return []
    with open(path, encoding="utf-8") as fh:
        return json.load(fh)


def save_json(path: Path, data: list[dict]) -> None:
    with open(path, "w", encoding="utf-8") as fh:
        json.dump(data, fh, indent=2, ensure_ascii=False)
        fh.write("\n")


def merge(locations: list[dict], kml: dict, sv: dict, assign_geo: bool) -> list[dict]:
    seen: set[str] = set()
    merged: list[dict] = []
    for loc in locations:
        key = loc["name"].strip().lower()
        if key in seen:
            print(f"  dropping duplicate entry: {loc['name']}")
            continue
        seen.add(key)
        merged.append(loc)

    for key, pm in kml.items():
        if key not in seen:
            print(f"  new placemark from KML: {pm['name']}")
            merged.append({"name": pm["name"], "description": pm["note"], "history": ""})
            seen.add(key)

    for loc in merged:
        key = loc["name"].strip().lower()
        loc.setdefault("slug", slugify(loc["name"]))
        if key in kml:
            loc["lat"], loc["lng"] = kml[key]["lat"], kml[key]["lng"]
            if kml[key]["note"] and not loc.get("note"):
                loc["note"] = kml[key]["note"]
        if key in sv:
            loc["streetview"] = {"lat": sv[key]["lat"], "lng": sv[key]["lng"]}
        if assign_geo and "lat" in loc and loc.get("geo_auto", True):
            from geo import lookup, nearest  # local import: downloads data lazily
            hit = lookup(loc["lat"], loc["lng"]) or nearest(loc["lat"], loc["lng"])
            if hit:
                loc["borough"] = hit["borough"]
                loc["neighborhood"] = hit["neighborhood"]
                loc["geo_auto"] = True
    return merged


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--kml", type=Path, default=KML_FILE)
    parser.add_argument("--streetview-kml", type=Path, default=SV_KML_FILE)
    parser.add_argument("--geo", action="store_true", help="assign borough/neighborhood from NYC NTA boundaries")
    args = parser.parse_args()

    sys.path.insert(0, str(Path(__file__).resolve().parent))
    locations = load_json(DATA_FILE)
    kml = parse_kml(args.kml)
    sv = parse_kml(args.streetview_kml)
    print(f"Loaded {len(locations)} locations, {len(kml)} KML placemarks, {len(sv)} street-view placemarks")
    merged = merge(locations, kml, sv, args.geo)
    missing = [l["name"] for l in merged if "lat" not in l]
    if missing:
        print(f"WARNING: {len(missing)} locations have no coordinates: {missing}")
    save_json(DATA_FILE, merged)
    print(f"Wrote {len(merged)} locations to {DATA_FILE.relative_to(ROOT)}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
