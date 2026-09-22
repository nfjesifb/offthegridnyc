import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import {
  filterPlaces,
  readState,
  stateURL,
  readSaved,
  distanceMiles,
} from "../src/js/discovery-core.mjs";
const { places, themes } = JSON.parse(
  readFileSync(new URL("../assets/data/places.json", import.meta.url)),
);
const base = "https://offthegridnyc.com/";
const defaults = {
  q: "",
  theme: "",
  saved: false,
  collection: null,
  sort: "curated",
  view: "map",
};

test("catalog has unique slugs, valid coordinates and real page/photo paths", () => {
  assert.equal(new Set(places.map((p) => p.slug)).size, places.length);
  assert.ok(places.length >= 85);
  for (const place of places) {
    assert.ok(/^[a-z0-9-]+$/.test(place.slug));
    assert.ok(
      place.lat >= 40 && place.lat < 42 && place.lng > -75 && place.lng < -73,
    );
    assert.ok(themes.some((t) => t.id === place.theme));
    assert.ok(
      existsSync(new URL("../" + place.url, import.meta.url)),
      place.url,
    );
    if (place.image)
      assert.ok(
        existsSync(new URL("../" + place.image, import.meta.url)),
        place.image,
      );
  }
});
test("search is case-insensitive and combines words and themes", () => {
  const results = filterPlaces(places, {
    ...defaults,
    q: "  ELEVATED   acre ",
  });
  assert.equal(results.length, 1);
  assert.equal(results[0].slug, "elevated-acre");
  assert.equal(
    filterPlaces(places, { ...defaults, q: "elevated", theme: "houses" })
      .length,
    0,
  );
  assert.ok(filterPlaces(places, { ...defaults, q: "garden" }).length > 1);
});
test("shared collections preserve empty vs all and ignore unknown slugs", () => {
  const state = readState(
    base +
      "?collection=invalid,elevated-acre,elevated-acre&theme=bad&place=bad",
    places,
    themes,
  );
  assert.deepEqual(state.collection, ["elevated-acre"]);
  assert.equal(state.theme, "");
  assert.equal(state.place, null);
  assert.equal(
    filterPlaces(places, readState(base + "?collection=", places, themes))
      .length,
    0,
  );
});
test("saved share links work without the recipient local storage", () => {
  const saved = new Set(["elevated-acre", "pomander-walk"]);
  const url = stateURL(
    base,
    { ...defaults, saved: true, view: "map" },
    { share: true, saved },
  );
  assert.equal(url.searchParams.has("saved"), false);
  const state = readState(url, places, themes);
  assert.equal(state.view, "map");
  assert.equal(filterPlaces(places, state).length, 2);
});
test("shared saved/filter intersections round trip", () => {
  const state = {
    ...defaults,
    q: "acre",
    saved: true,
    collection: ["elevated-acre"],
    sort: "az",
  };
  const url = stateURL(base, state, {
    share: true,
    saved: new Set(["elevated-acre", "pomander-walk"]),
  });
  assert.equal(filterPlaces(places, readState(url, places, themes)).length, 1);
  assert.equal(url.searchParams.get("sort"), "az");
});
test("malformed and unavailable storage cannot break discovery", () => {
  for (const value of ["{", "{}", "null", '[1,null,"ok","../../bad"]']) {
    const result = readSaved({ getItem: () => value });
    assert.deepEqual([...result], value.includes('"ok"') ? ["ok"] : []);
  }
  assert.equal(
    readSaved({
      getItem: () => {
        throw new Error("denied");
      },
    }).size,
    0,
  );
});
test("nearby sorting is stable and does not mutate the catalog", () => {
  const before = places.map((p) => p.slug);
  const origin = { lat: places[0].lat, lng: places[0].lng };
  const results = filterPlaces(
    places,
    { ...defaults, sort: "nearby" },
    new Set(),
    origin,
  );
  assert.equal(results[0].slug, places[0].slug);
  assert.equal(distanceMiles(origin, places[0]), 0);
  for (let i = 1; i < results.length; i++)
    assert.ok(
      distanceMiles(origin, results[i]) >=
        distanceMiles(origin, results[i - 1]),
    );
  assert.deepEqual(
    places.map((p) => p.slug),
    before,
  );
});
test("all detail pages expose canonical metadata and discovery controls", () => {
  for (const place of places) {
    const content = readFileSync(
      new URL("../" + place.url, import.meta.url),
      "utf8",
    );
    assert.ok(content.includes(`data-slug="${place.slug}"`));
    assert.ok(content.includes(`rel="canonical" href="${base}${place.url}"`));
    assert.equal((content.match(/id="context-map"/g) || []).length, 1);
    assert.ok(content.includes('id="save-place"'));
    assert.ok(content.includes('id="share-place"'));
    assert.ok(content.includes('class="description"'));
    assert.ok(place.description.trim().length > 50, place.slug);
    for (const field of ["description", "context", "curatorNote"]) {
      assert.ok(
        !/<[^>]+>/.test(place[field]),
        `${place.slug}: raw markup in ${field}`,
      );
      assert.ok(
        !place[field].includes("\uFFFD"),
        `${place.slug}: damaged text in ${field}`,
      );
    }
    for (const photo of place.photos)
      assert.ok(existsSync(new URL("../" + photo, import.meta.url)), photo);
    if (!place.photos.length)
      assert.ok(!content.includes('class="gallery"'), place.slug);
    if (place.descriptionOrigin === "sourced")
      assert.ok(place.sources.length > 0, place.slug);
  }
});

test("shared viewport round trips and rejects malformed coordinates", () => {
  const viewport = { lat: 40.74, lng: -73.98, zoom: 13.25 };
  const url = stateURL(base, { ...defaults, viewport });
  assert.deepEqual(readState(url, places, themes).viewport, viewport);
  for (const invalid of [
    "NaN,0,12",
    "90,0,12",
    "40,-200,12",
    "40,-74,99",
    "40,-74",
  ]) {
    assert.equal(
      readState(base + "?map=" + invalid, places, themes).viewport,
      null,
    );
  }
});
test("known mismatched photos stay out of the catalog", () => {
  for (const slug of [
    "temple-court",
    "colonial-gardens",
    "greenwich-mews",
    "skytrack",
    "sutton-square",
  ]) {
    const place = places.find((p) => p.slug === slug);
    assert.deepEqual(place.photos, []);
    assert.equal(place.image, null);
  }
});
