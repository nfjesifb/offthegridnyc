"""Local admin tool: add, edit and delete places, then rebuild the site.

Security model
--------------
* Listens on 127.0.0.1 only. It is a local editing tool, not a public server.
* The password comes from the OTG_ADMIN_PASSWORD environment variable (12+
  characters) and is compared in constant time. There is no default password.
* A fresh random session secret is generated on every start unless
  OTG_SECRET_KEY is set; sessions are HttpOnly, SameSite=Strict cookies.
* Every state-changing request carries a per-session CSRF token.
* Failed logins are throttled per client address.
* All input is validated (lengths, borough list, coordinates inside NYC).
* Nothing is executed through a shell: the site builder is imported and called.

Run with:  OTG_ADMIN_PASSWORD='a long passphrase' npm run admin
"""
from __future__ import annotations

import hmac
import json
import os
import re
import secrets
import sys
import time
from functools import wraps
from pathlib import Path

from flask import Flask, abort, flash, jsonify, redirect, render_template, request, session, url_for

ROOT = Path(__file__).resolve().parent.parent
DATA_FILE = ROOT / "data" / "locations.json"
sys.path.insert(0, str(Path(__file__).resolve().parent))
import build as site_build  # noqa: E402
import geo  # noqa: E402

BOROUGHS = site_build.BOROUGH_ORDER
LAT_RANGE, LNG_RANGE = (40.3, 41.1), (-74.6, -73.3)
MAX_FAILED_LOGINS, LOCKOUT_SECONDS = 5, 15 * 60

PASSWORD = os.environ.get("OTG_ADMIN_PASSWORD", "")
if len(PASSWORD) < 12:
    sys.exit("Refusing to start: set OTG_ADMIN_PASSWORD to a passphrase of at least 12 characters.")

app = Flask(
    __name__,
    template_folder=str(ROOT / "templates"),
    static_folder=str(ROOT / "assets"),
    static_url_path="/assets",
)
app.config.update(
    SECRET_KEY=os.environ.get("OTG_SECRET_KEY") or secrets.token_hex(32),
    SESSION_COOKIE_HTTPONLY=True,
    SESSION_COOKIE_SAMESITE="Strict",
    SESSION_COOKIE_SECURE=os.environ.get("OTG_ADMIN_HTTPS") == "1",
    PERMANENT_SESSION_LIFETIME=8 * 3600,
    MAX_CONTENT_LENGTH=256 * 1024,
)
_failed_logins: dict[str, list[float]] = {}


# --------------------------------------------------------------------------- helpers
def load_places() -> list[dict]:
    with open(DATA_FILE, encoding="utf-8") as fh:
        return json.load(fh)


def save_places(places: list[dict]) -> None:
    tmp = DATA_FILE.with_suffix(".json.tmp")
    with open(tmp, "w", encoding="utf-8") as fh:
        json.dump(places, fh, indent=2, ensure_ascii=False)
        fh.write("\n")
    os.replace(tmp, DATA_FILE)


def unique_slug(name: str, places: list[dict], current: str | None = None) -> str:
    base = site_build.slugify(name) or "place"
    taken = {p["slug"] for p in places if p["slug"] != current}
    slug, n = base, 2
    while slug in taken:
        slug, n = f"{base}-{n}", n + 1
    return slug


def parse_coord(value: str, rng: tuple[float, float], label: str) -> float:
    try:
        num = float(value)
    except (TypeError, ValueError):
        raise ValueError(f"{label} must be a number")
    if not rng[0] <= num <= rng[1]:
        raise ValueError(f"{label} must be inside New York City ({rng[0]} to {rng[1]})")
    return round(num, 7)


def text_field(name: str, limit: int, required: bool = False) -> str:
    value = (request.form.get(name) or "").strip()
    value = re.sub(r"[\x00-\x08\x0b\x0c\x0e-\x1f]", "", value)
    if required and not value:
        raise ValueError(f"{name.replace('_', ' ').capitalize()} is required")
    if len(value) > limit:
        raise ValueError(f"{name.replace('_', ' ').capitalize()} is too long (max {limit} characters)")
    return value


def place_from_form(existing: dict | None, places: list[dict]) -> dict:
    place = dict(existing or {})
    place["name"] = text_field("name", 120, required=True)
    place["description"] = text_field("description", 4000, required=True)
    place["history"] = text_field("history", 6000)
    place["note"] = text_field("note", 2000)
    borough = request.form.get("borough", "")
    if borough not in BOROUGHS:
        raise ValueError("Pick a borough")
    place["borough"] = borough
    place["neighborhood"] = text_field("neighborhood", 120)
    place["lat"] = parse_coord(request.form.get("lat"), LAT_RANGE, "Latitude")
    place["lng"] = parse_coord(request.form.get("lng"), LNG_RANGE, "Longitude")
    place["streetview"] = {
        "lat": parse_coord(request.form.get("sv_lat") or request.form.get("lat"), LAT_RANGE, "Street view latitude"),
        "lng": parse_coord(request.form.get("sv_lng") or request.form.get("lng"), LNG_RANGE, "Street view longitude"),
    }
    place["geo_auto"] = request.form.get("geo_auto") == "1"
    place["slug"] = existing["slug"] if existing else unique_slug(place["name"], places)
    for key in ("history", "note"):
        if not place[key]:
            place.pop(key, None)
    return place


def login_required(view):
    @wraps(view)
    def wrapped(*args, **kwargs):
        if not session.get("logged_in"):
            return redirect(url_for("login"))
        return view(*args, **kwargs)
    return wrapped


@app.context_processor
def inject_csrf():
    return {"csrf_token": lambda: session.setdefault("csrf", secrets.token_urlsafe(32))}


@app.before_request
def verify_csrf():
    if request.method == "POST":
        token = session.get("csrf", "")
        sent = request.form.get("csrf", "")
        if not token or not hmac.compare_digest(token, sent):
            abort(400, "Invalid or missing CSRF token")


@app.after_request
def security_headers(resp):
    resp.headers["Content-Security-Policy"] = (
        "default-src 'self'; img-src 'self' data: https://tile.openstreetmap.org; "
        "frame-src https://roadview.planninglabs.nyc; frame-ancestors 'none'; form-action 'self'; base-uri 'self'; object-src 'none'"
    )
    resp.headers["X-Content-Type-Options"] = "nosniff"
    resp.headers["X-Frame-Options"] = "DENY"
    resp.headers["Referrer-Policy"] = "no-referrer"
    resp.headers["Cache-Control"] = "no-store"
    return resp


# --------------------------------------------------------------------------- auth
@app.route("/")
def index():
    return redirect(url_for("dashboard" if session.get("logged_in") else "login"))


@app.route("/login", methods=["GET", "POST"])
def login():
    if request.method == "POST":
        addr = request.remote_addr or "?"
        now = time.time()
        recent = [t for t in _failed_logins.get(addr, []) if now - t < LOCKOUT_SECONDS]
        if len(recent) >= MAX_FAILED_LOGINS:
            abort(429, "Too many failed attempts. Try again later.")
        if hmac.compare_digest(request.form.get("password", ""), PASSWORD):
            session.clear()
            session["logged_in"] = True
            session["csrf"] = secrets.token_urlsafe(32)
            _failed_logins.pop(addr, None)
            return redirect(url_for("dashboard"))
        recent.append(now)
        _failed_logins[addr] = recent
        flash("Wrong password.", "error")
    return render_template("admin/login.html")


@app.route("/logout", methods=["POST"])
def logout():
    session.clear()
    return redirect(url_for("login"))


# --------------------------------------------------------------------------- places
@app.route("/dashboard")
@login_required
def dashboard():
    places = sorted(load_places(), key=lambda p: p["name"].lower())
    photos = {p["slug"]: len(list((ROOT / "locations" / p["slug"] / "images").glob("photo_*.jpg"))) if (ROOT / "locations" / p["slug"] / "images").is_dir() else 0 for p in places}
    return render_template("admin/dashboard.html", places=places, photos=photos)


@app.route("/places/new", methods=["GET", "POST"])
@login_required
def new_place():
    places = load_places()
    if request.method == "POST":
        try:
            place = place_from_form(None, places)
        except ValueError as exc:
            flash(str(exc), "error")
            return render_template("admin/form.html", place=request.form, boroughs=BOROUGHS, is_new=True), 400
        places.append(place)
        save_places(places)
        flash(f"Added “{place['name']}”. Rebuild the site to publish it.", "ok")
        return redirect(url_for("dashboard"))
    return render_template("admin/form.html", place={}, boroughs=BOROUGHS, is_new=True)


@app.route("/places/<slug>/edit", methods=["GET", "POST"])
@login_required
def edit_place(slug):
    places = load_places()
    existing = next((p for p in places if p["slug"] == slug), None)
    if existing is None:
        abort(404)
    if request.method == "POST":
        try:
            updated = place_from_form(existing, places)
        except ValueError as exc:
            flash(str(exc), "error")
            return render_template("admin/form.html", place=request.form, boroughs=BOROUGHS, is_new=False, slug=slug), 400
        places[places.index(existing)] = updated
        save_places(places)
        flash(f"Saved “{updated['name']}”.", "ok")
        return redirect(url_for("dashboard"))
    form = dict(existing)
    form["sv_lat"] = existing.get("streetview", {}).get("lat", existing.get("lat"))
    form["sv_lng"] = existing.get("streetview", {}).get("lng", existing.get("lng"))
    return render_template("admin/form.html", place=form, boroughs=BOROUGHS, is_new=False, slug=slug)


@app.route("/places/<slug>/delete", methods=["POST"])
@login_required
def delete_place(slug):
    places = load_places()
    remaining = [p for p in places if p["slug"] != slug]
    if len(remaining) == len(places):
        abort(404)
    save_places(remaining)
    flash("Deleted. Run a rebuild with pruning to remove its page and photos.", "ok")
    return redirect(url_for("dashboard"))


@app.route("/api/geo")
@login_required
def api_geo():
    try:
        lat = parse_coord(request.args.get("lat"), LAT_RANGE, "Latitude")
        lng = parse_coord(request.args.get("lng"), LNG_RANGE, "Longitude")
    except ValueError as exc:
        return jsonify({"error": str(exc)}), 400
    try:
        hit = geo.lookup(lat, lng) or geo.nearest(lat, lng)
    except Exception as exc:  # network problems downloading the boundaries
        return jsonify({"error": f"Boundary lookup failed: {exc}"}), 502
    return jsonify(hit or {"error": "No match"})


@app.route("/rebuild", methods=["POST"])
@login_required
def rebuild():
    prune = request.form.get("prune") == "1"
    try:
        site_build.render_site(prune=prune)
    except SystemExit as exc:
        flash(f"Build failed: {exc}", "error")
    except Exception as exc:  # surface template/data errors to the editor
        flash(f"Build failed: {exc}", "error")
    else:
        flash("Site rebuilt. Run `npm run build:css` if you changed templates, then commit and push.", "ok")
    return redirect(url_for("dashboard"))


if __name__ == "__main__":
    port = int(os.environ.get("OTG_ADMIN_PORT", "5000"))
    print(f"Admin tool on http://127.0.0.1:{port}/ (local only)")
    app.run(host="127.0.0.1", port=port, debug=False)
