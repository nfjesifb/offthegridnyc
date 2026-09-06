"""Borough / neighborhood lookup using NYC's 2020 Neighborhood Tabulation Areas.

The GeoJSON is downloaded on demand from NYC Open Data and cached locally
(outside the repository).  No API key is required.
"""
from __future__ import annotations

import json
import os
import urllib.request
from functools import lru_cache
from pathlib import Path

NTA_URL = (
    "https://data.cityofnewyork.us/api/geospatial/9nt8-h7nd"
    "?method=export&format=GeoJSON"
)
CACHE_DIR = Path(os.environ.get("OTG_CACHE_DIR", Path(__file__).resolve().parent.parent / ".cache"))
CACHE_FILE = CACHE_DIR / "nta2020.geojson"

# NTA types that are not real neighborhoods (parks, cemeteries, airports, water...).
# We still return their borough, but use the label as a neighborhood only when
# nothing better is available.
NON_RESIDENTIAL_TYPES = {"5", "6", "7", "8", "9"}


def _point_in_ring(x: float, y: float, ring: list[list[float]]) -> bool:
    inside = False
    n = len(ring)
    j = n - 1
    for i in range(n):
        xi, yi = ring[i][0], ring[i][1]
        xj, yj = ring[j][0], ring[j][1]
        if (yi > y) != (yj > y):
            x_int = (xj - xi) * (y - yi) / ((yj - yi) or 1e-12) + xi
            if x < x_int:
                inside = not inside
        j = i
    return inside


def _point_in_polygon(x: float, y: float, polygon: list[list[list[float]]]) -> bool:
    if not polygon or not _point_in_ring(x, y, polygon[0]):
        return False
    return not any(_point_in_ring(x, y, hole) for hole in polygon[1:])


def _bbox(coords) -> tuple[float, float, float, float]:
    xs, ys = [], []
    stack = [coords]
    while stack:
        item = stack.pop()
        if isinstance(item[0], (int, float)):
            xs.append(item[0]); ys.append(item[1])
        else:
            stack.extend(item)
    return min(xs), min(ys), max(xs), max(ys)


@lru_cache(maxsize=1)
def load_features(path: Path | None = None) -> list[dict]:
    path = Path(path) if path else CACHE_FILE
    if not path.exists():
        path.parent.mkdir(parents=True, exist_ok=True)
        print(f"Downloading NTA boundaries to {path} ...")
        with urllib.request.urlopen(NTA_URL, timeout=180) as resp, open(path, "wb") as fh:
            fh.write(resp.read())
    with open(path, encoding="utf-8") as fh:
        data = json.load(fh)
    features = []
    for feat in data["features"]:
        geom = feat["geometry"]
        polys = [geom["coordinates"]] if geom["type"] == "Polygon" else geom["coordinates"]
        features.append({
            "props": feat["properties"],
            "polys": polys,
            "bbox": _bbox(geom["coordinates"]),
        })
    return features


def lookup(lat: float, lng: float, path: Path | None = None) -> dict | None:
    """Return {"borough":..., "neighborhood":..., "nta":...} for a point, or None."""
    for feat in load_features(path):
        minx, miny, maxx, maxy = feat["bbox"]
        if not (minx <= lng <= maxx and miny <= lat <= maxy):
            continue
        if any(_point_in_polygon(lng, lat, poly) for poly in feat["polys"]):
            props = feat["props"]
            return {
                "borough": props.get("boroname"),
                "neighborhood": props.get("ntaname"),
                "nta": props.get("nta2020"),
                "residential": props.get("ntatype") not in NON_RESIDENTIAL_TYPES,
            }
    return None


def nearest(lat: float, lng: float, path: Path | None = None) -> dict | None:
    """Fallback for points just outside every polygon (piers, waterfront)."""
    best, best_d = None, float("inf")
    for feat in load_features(path):
        minx, miny, maxx, maxy = feat["bbox"]
        cx, cy = (minx + maxx) / 2, (miny + maxy) / 2
        d = (cx - lng) ** 2 + (cy - lat) ** 2
        if d < best_d:
            best, best_d = feat, d
    if not best:
        return None
    props = best["props"]
    return {
        "borough": props.get("boroname"),
        "neighborhood": props.get("ntaname"),
        "nta": props.get("nta2020"),
        "residential": props.get("ntatype") not in NON_RESIDENTIAL_TYPES,
    }
