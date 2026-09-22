export const SAVED_KEY = "offthegridnyc.saved.v1";
export const normalize = (value) =>
  String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();

export function readSaved(storage) {
  try {
    const value = JSON.parse(storage.getItem(SAVED_KEY) || "[]");
    return new Set(
      Array.isArray(value)
        ? value.filter(
            (slug) => typeof slug === "string" && /^[a-z0-9-]+$/.test(slug),
          )
        : [],
    );
  } catch {
    return new Set();
  }
}

export function distanceMiles(origin, place) {
  const rad = (value) => (value * Math.PI) / 180;
  const dLat = rad(place.lat - origin.lat),
    dLng = rad(place.lng - origin.lng);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(rad(origin.lat)) *
      Math.cos(rad(place.lat)) *
      Math.sin(dLng / 2) ** 2;
  return 3958.8 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(Math.max(0, 1 - a)));
}

export function filterPlaces(places, state, saved = new Set(), origin = null) {
  const words = normalize(state.q).split(/\s+/).filter(Boolean);
  const results = places.filter((place) => {
    const text = normalize(
      [
        place.name,
        place.originalName,
        place.description,
        place.history,
        place.context,
        place.curatorNote,
        place.themeLabel,
      ].join(" "),
    );
    return (
      (!state.theme || place.theme === state.theme) &&
      (!state.saved || saved.has(place.slug)) &&
      (!state.collection || state.collection.includes(place.slug)) &&
      words.every((word) => text.includes(word))
    );
  });
  if (state.sort === "az") results.sort((a, b) => a.name.localeCompare(b.name));
  if (state.sort === "nearby" && origin)
    results.sort((a, b) => distanceMiles(origin, a) - distanceMiles(origin, b));
  return results;
}

export function readState(url, places, themes) {
  const params = new URL(url).searchParams;
  const known = new Set(places.map((place) => place.slug));
  const view = (params.get("map") || "").split(",").map(Number);
  const viewport =
    view.length === 3 &&
    view.every(Number.isFinite) &&
    view[0] >= -85 &&
    view[0] <= 85 &&
    view[1] >= -180 &&
    view[1] <= 180 &&
    view[2] >= 1 &&
    view[2] <= 19
      ? { lat: view[0], lng: view[1], zoom: view[2] }
      : null;
  return {
    viewport,
    q: (params.get("q") || "").slice(0, 200),
    theme: themes.some((theme) => theme.id === params.get("theme"))
      ? params.get("theme")
      : "",
    saved: params.get("saved") === "1",
    collection: params.has("collection")
      ? [
          ...new Set(
            params
              .get("collection")
              .split(",")
              .filter((slug) => known.has(slug)),
          ),
        ]
      : null,
    view: "map",
    sort: params.get("sort") === "az" ? "az" : "curated",
    place: known.has(params.get("place")) ? params.get("place") : null,
  };
}

export function stateURL(
  base,
  state,
  { share = false, saved = new Set() } = {},
) {
  const url = new URL(base);
  url.search = "";
  url.hash = "";
  if (state.q) url.searchParams.set("q", state.q);
  if (state.theme) url.searchParams.set("theme", state.theme);
  if (state.sort === "az") url.searchParams.set("sort", "az");
  let collection = state.collection;
  if (state.saved && share)
    collection = [...saved].filter(
      (slug) => !collection || collection.includes(slug),
    );
  else if (state.saved) url.searchParams.set("saved", "1");
  if (collection !== null && collection !== undefined)
    url.searchParams.set("collection", collection.join(","));
  if (state.viewport) {
    const { lat, lng, zoom } = state.viewport;
    url.searchParams.set("map", `${lat.toFixed(5)},${lng.toFixed(5)},${zoom}`);
  }
  if (state.place) url.searchParams.set("place", state.place);
  return url;
}
