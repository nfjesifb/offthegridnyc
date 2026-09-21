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
  view: "list",
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
    assert.equal((content.match(/<!-- discovery:tools -->/g) || []).length, 1);
  }
});
