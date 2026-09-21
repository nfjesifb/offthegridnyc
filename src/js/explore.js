import {
  SAVED_KEY,
  readSaved,
  distanceMiles,
  filterPlaces,
  readState,
  stateURL,
} from "./discovery-core.mjs";
import { createExplorerMap } from "./explorer-map.mjs";

const $ = (selector) => document.querySelector(selector);
const node = (tag, className, text) => {
  const element = document.createElement(tag);
  if (className) element.className = className;
  if (text !== undefined) element.textContent = text;
  return element;
};
const button = (text, className, action) => {
  const element = node("button", className, text);
  element.type = "button";
  element.addEventListener("click", action);
  return element;
};
const link = (text, href, className) => {
  const element = node("a", className, text);
  element.href = href;
  return element;
};
const rootURL = new URL("./", document.baseURI);
let places = [],
  themes = [],
  results = [],
  state,
  origin = null,
  visible = 12,
  mapController,
  mapLoading;
let saved = readSaved({ getItem: (key) => localStorage.getItem(key) });
let toastTimer, searchTimer, lastFocus;

function toast(message) {
  $("#toast").textContent = message;
  $("#toast").hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    $("#toast").hidden = true;
  }, 4500);
}
function syncURL(push = false) {
  const url = stateURL(rootURL, state);
  if (url.href !== location.href)
    history[push ? "pushState" : "replaceState"](null, "", url);
}
function saveButton(place, compact = false) {
  const element = button("", compact ? "save-button" : "button secondary", () =>
    toggleSave(place),
  );
  element.dataset.save = place.slug;
  element.dataset.compact = String(compact);
  updateSaveButton(element);
  return element;
}
function updateSaveButton(element) {
  const active = saved.has(element.dataset.save);
  const place = places.find((place) => place.slug === element.dataset.save);
  element.setAttribute("aria-pressed", String(active));
  element.setAttribute(
    "aria-label",
    `${active ? "Unsave" : "Save"} ${place.name}`,
  );
  element.textContent =
    element.dataset.compact === "true"
      ? active
        ? "♥"
        : "♡"
      : active
        ? "♥ Saved"
        : "♡ Save place";
}
function toggleSave(place) {
  if (saved.has(place.slug)) saved.delete(place.slug);
  else saved.add(place.slug);
  let persistent = true;
  try {
    localStorage.setItem(SAVED_KEY, JSON.stringify([...saved]));
  } catch {
    persistent = false;
  }
  document.querySelectorAll("[data-save]").forEach(updateSaveButton);
  $("#saved-count").textContent = saved.size;
  if (state.saved) render();
  toast(
    persistent
      ? saved.has(place.slug)
        ? "Saved for your next detour."
        : "Place removed from your saved list."
      : "Saved for this visit only. Browser storage is unavailable.",
  );
}
function imageFor(place, className) {
  const image = node("img", className);
  image.src = place.image;
  image.alt = place.name;
  image.loading = "lazy";
  image.decoding = "async";
  image.addEventListener("error", () => image.replaceWith(placeholder()), {
    once: true,
  });
  return image;
}
function placeholder() {
  const box = node("div", "card-placeholder");
  box.append(node("span", "", "↗"), node("small", "", "A closer look at NYC"));
  return box;
}
function makeCard(place) {
  const card = node("article", "place-card");
  card.dataset.slug = place.slug;
  const visual = node("div", "card-visual");
  const photoLink = link("", place.url, "card-image-link");
  photoLink.tabIndex = -1;
  photoLink.setAttribute("aria-hidden", "true");
  photoLink.append(place.image ? imageFor(place) : placeholder());
  visual.append(photoLink, saveButton(place, true));
  const body = node("div", "card-body");
  const heading = node("h3");
  heading.append(link(place.name, place.url, "card-title"));
  const bottom = node("div", "card-bottom");
  const preview = button("Take a look ↗", "", () => openPlace(place.slug));
  preview.setAttribute("aria-label", `Preview ${place.name}`);
  bottom.append(preview);
  if (origin && state.sort === "nearby")
    bottom.append(
      node(
        "span",
        "distance",
        `${distanceMiles(origin, place).toFixed(1)} mi away`,
      ),
    );
  else if (place.image)
    bottom.append(link("Photo credits", place.url, "photo-credit"));
  body.append(
    node("p", "card-theme", place.themeLabel),
    heading,
    node("p", "card-description", place.description),
    bottom,
  );
  card.append(visual, body);
  return card;
}
function render() {
  results = filterPlaces(places, state, saved, origin);
  const focusedSave = document.activeElement?.dataset.save;
  $("#place-grid").replaceChildren(...results.slice(0, visible).map(makeCard));
  $("#place-grid").setAttribute("aria-busy", "false");
  if (focusedSave) {
    const replacement = [
      ...$("#place-grid").querySelectorAll("[data-save]"),
    ].find((element) => element.dataset.save === focusedSave);
    (replacement || $("#saved-nav")).focus({ preventScroll: true });
  }
  $("#results-count").textContent =
    `${results.length} ${state.saved ? "saved " : ""}${results.length === 1 ? "place" : "places"}${state.collection !== null ? " in this shared collection" : " to discover"}${state.sort === "nearby" && origin ? " · straight-line distances" : ""}`;
  $("#saved-count").textContent = saved.size;
  $("#saved-nav").setAttribute("aria-pressed", String(state.saved));
  $("#saved-note").hidden = !state.saved;
  $("#collection-note").hidden = state.collection === null;
  $("#collection-text").textContent =
    "Someone shared a little of the city with you. Save any places you want to keep.";
  $("#reset").hidden = !(
    state.q ||
    state.theme ||
    state.saved ||
    state.collection !== null ||
    state.sort !== "curated"
  );
  $("#share-results").disabled = results.length === 0;
  $("#load-more").hidden = visible >= results.length;
  $("#load-more").textContent =
    `Show ${Math.min(12, results.length - visible)} more places`;
  $("#empty-state").hidden = results.length > 0;
  $("#empty-title").textContent =
    state.saved && !saved.size
      ? "Your next detour starts here."
      : "A different detour?";
  $("#empty-description").textContent =
    state.saved && !saved.size
      ? "Tap the heart on a place to keep it here. No account needed."
      : "No places match this selection. Try a broader search or clear your filters.";
  $("#search").value = state.q;
  $("#sort").value = state.sort;
  document
    .querySelectorAll("[data-theme]")
    .forEach((element) =>
      element.setAttribute(
        "aria-pressed",
        String(element.dataset.theme === state.theme),
      ),
    );
  document
    .querySelectorAll("[data-view]")
    .forEach((element) =>
      element.setAttribute(
        "aria-pressed",
        String(element.dataset.view === state.view),
      ),
    );
  $("#map-panel").hidden = state.view !== "map";
  $("#explorer-layout").classList.toggle("map-layout", state.view === "map");
  if (state.view === "map") updateMap();
}
async function updateMap() {
  if (mapController) {
    mapController.update(results);
    return;
  }
  if (mapLoading) return;
  mapLoading = true;
  try {
    mapController = await createExplorerMap($("#map"), openPlace, (message) => {
      $("#map-status").textContent = message;
      $("#map-status").hidden = !message;
    });
    $("#map-status").hidden = true;
    if (state.view === "map") mapController.update(results);
  } catch {
    $("#map-status").hidden = false;
    $("#map-status").textContent =
      "The map couldn’t load. Browse the places here or open the original map below. Switch to List and back to retry.";
  } finally {
    mapLoading = false;
  }
}
function change(values, push = true) {
  clearTimeout(searchTimer);
  state = { ...state, ...values };
  visible = 12;
  syncURL(push);
  render();
}
function reset() {
  change({ q: "", theme: "", saved: false, collection: null, sort: "curated" });
}
function openPlace(slug, push = true) {
  const place = places.find((place) => place.slug === slug);
  if (!place) return;
  if (!$("#place-dialog").open) lastFocus = document.activeElement;
  const content = $("#dialog-content");
  content.replaceChildren();
  if (place.image) content.append(imageFor(place, "dialog-image"));
  const body = node("div", "dialog-body");
  const title = node("h2", "", place.name);
  title.id = "dialog-title";
  body.append(
    node("p", "eyebrow", place.themeLabel),
    title,
    node("p", "", place.description),
  );
  if (place.image)
    body.append(
      link("View photo credits & more photos", place.url, "photo-credit"),
    );
  const actions = node("div", "dialog-actions");
  const directions = link(
    "Directions ↗",
    `https://www.google.com/maps/dir/?api=1&destination=${place.lat},${place.lng}`,
    "button secondary",
  );
  directions.target = "_blank";
  directions.rel = "noopener noreferrer";
  actions.append(
    link("Read the story ↗", place.url, "button primary"),
    saveButton(place),
    directions,
  );
  body.append(
    actions,
    button("Share this place ↗", "text-button", () =>
      share(stateURL(rootURL, { place: slug }), place.name),
    ),
    node(
      "p",
      "visit-note",
      "Human-curated, with AI-assisted descriptions. Verify details and current access before visiting. Some places are private; enjoy them from public streets.",
    ),
  );
  content.append(body);
  state.place = slug;
  syncURL(push);
  if (!$("#place-dialog").open) $("#place-dialog").showModal();
  $("#place-dialog .dialog-close").focus();
}
async function share(url, title = "Off The Grid NYC") {
  if (navigator.share) {
    try {
      await navigator.share({ title, url: url.href });
      return;
    } catch (error) {
      if (error.name === "AbortError") return;
    }
  }
  try {
    await navigator.clipboard.writeText(url.href);
    toast("Link copied. Pass along a good find.");
  } catch {
    $("#share-url").value = url.href;
    $("#share-status").textContent = "";
    $("#share-dialog").showModal();
    $("#share-url").focus();
    $("#share-url").select();
  }
}

async function start() {
  try {
    const response = await fetch("assets/data/places.json");
    if (!response.ok) throw new Error("Catalog unavailable");
    const data = await response.json();
    places = data.places;
    themes = data.themes;
    if (!Array.isArray(places) || !places.length || !Array.isArray(themes))
      throw new Error("Invalid catalog");
    saved = new Set(
      [...saved].filter((slug) => places.some((place) => place.slug === slug)),
    );
    state = readState(location.href, places, themes);
    for (const theme of [{ id: "", label: "All discoveries" }, ...themes]) {
      const chip = button(theme.label, "theme-chip", () =>
        change({ theme: theme.id }),
      );
      chip.dataset.theme = theme.id;
      $("#themes").append(chip);
    }
    $("#search").addEventListener("input", (event) => {
      const q = event.target.value.slice(0, 200);
      state.q = q;
      clearTimeout(searchTimer);
      searchTimer = setTimeout(() => change({ q }, false), 160);
    });
    $("#sort").addEventListener("change", (event) =>
      change({ sort: event.target.value }),
    );
    $("#saved-nav").addEventListener("click", () => {
      change({ saved: !state.saved, collection: null, q: "", theme: "" });
      $("#explore").scrollIntoView();
    });
    $("#reset").addEventListener("click", reset);
    $("#empty-reset").addEventListener("click", reset);
    $("#leave-collection").addEventListener("click", reset);
    document
      .querySelectorAll("[data-view]")
      .forEach((element) =>
        element.addEventListener("click", () =>
          change({ view: element.dataset.view }),
        ),
      );
    document.querySelectorAll("[data-surprise]").forEach((element) =>
      element.addEventListener("click", () => {
        const options = results.filter((place) => place.slug !== state.place);
        if (!options.length) {
          toast("Clear your filters to discover somewhere new.");
          return;
        }
        openPlace(options[Math.floor(Math.random() * options.length)].slug);
      }),
    );
    $("#load-more").addEventListener("click", () => {
      const firstNew = visible;
      visible += 12;
      render();
      $("#place-grid")
        .children[firstNew]?.querySelector(".card-title")
        ?.focus({ preventScroll: true });
    });
    $("#share-results").addEventListener("click", () =>
      share(
        stateURL(rootURL, { ...state, place: null }, { share: true, saved }),
      ),
    );
    $("#nearby").addEventListener("click", () => {
      if (!navigator.geolocation) {
        toast(
          "Location isn’t available in this browser. Search for a place or neighborhood instead.",
        );
        return;
      }
      const nearby = $("#nearby");
      nearby.disabled = true;
      nearby.textContent = "Locating…";
      navigator.geolocation.getCurrentPosition(
        (position) => {
          origin = {
            lat: position.coords.latitude,
            lng: position.coords.longitude,
          };
          $('#sort option[value="nearby"]').disabled = false;
          nearby.disabled = false;
          nearby.textContent = "◎ Update location";
          change({ sort: "nearby" });
          toast(
            "Sorted by straight-line distance. Your location stays in this browser session.",
          );
        },
        () => {
          nearby.disabled = false;
          nearby.textContent = "◎ Near me";
          toast(
            "Location unavailable or permission denied. You can still search and explore every place.",
          );
        },
        { enableHighAccuracy: false, timeout: 10000, maximumAge: 300000 },
      );
    });
    window.addEventListener("storage", (event) => {
      if (event.key === SAVED_KEY || event.key === null) {
        saved = readSaved({ getItem: (key) => localStorage.getItem(key) });
        saved = new Set(
          [...saved].filter((slug) =>
            places.some((place) => place.slug === slug),
          ),
        );
        render();
        document.querySelectorAll("[data-save]").forEach(updateSaveButton);
      }
    });
    window.addEventListener("popstate", () => {
      clearTimeout(searchTimer);
      state = readState(location.href, places, themes);
      visible = 12;
      render();
      if (state.place) openPlace(state.place, false);
      else if ($("#place-dialog").open) $("#place-dialog").close();
    });
    render();
    if (state.place) openPlace(state.place, false);
    else if (location.search)
      $("#explore").scrollIntoView({ behavior: "instant" });
  } catch (error) {
    console.error(error);
    $("#place-grid").setAttribute("aria-busy", "false");
    $("#results-count").textContent = "The explorer couldn’t load.";
    const notice = node(
      "p",
      "notice",
      "You can still explore the complete guide: ",
    );
    notice.append(link("Browse all places →", "browse/"));
    $("#place-grid").replaceChildren(notice);
    $("#search").disabled = true;
    $("#nearby").disabled = true;
    $("#share-results").disabled = true;
    document
      .querySelectorAll("[data-surprise], [data-view], #saved-nav, #sort")
      .forEach((element) => {
        element.disabled = true;
      });
  }
}
for (const dialog of document.querySelectorAll("dialog")) {
  dialog
    .querySelector(".dialog-close")
    .addEventListener("click", () => dialog.close());
  dialog.addEventListener("click", (event) => {
    const box = dialog.getBoundingClientRect();
    if (
      event.target === dialog &&
      (event.clientX < box.left ||
        event.clientX > box.right ||
        event.clientY < box.top ||
        event.clientY > box.bottom)
    )
      dialog.close();
  });
}
$("#place-dialog").addEventListener("close", () => {
  if (state?.place) {
    state.place = null;
    syncURL();
  }
  if (lastFocus?.isConnected) lastFocus.focus({ preventScroll: true });
});
$("#copy-link").addEventListener("click", async () => {
  try {
    await navigator.clipboard.writeText($("#share-url").value);
    $("#share-status").textContent = "Link copied.";
  } catch {
    $("#share-url").focus();
    $("#share-url").select();
    $("#share-status").textContent =
      "Select the link and copy it using your browser or keyboard.";
  }
});
start();
