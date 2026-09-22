import {
  SAVED_KEY,
  readSaved,
  filterPlaces,
  readState,
  stateURL,
  distanceMiles,
} from "./discovery-core.mjs";
import { createExplorerMap } from "./explorer-map.mjs";
import {
  element,
  action,
  placeContent,
  setupGallery,
  setupDialogs,
  toast,
  share,
} from "./place-ui.mjs";
const $ = (selector) => document.querySelector(selector);
const root = new URL("./", document.baseURI);
let places = [],
  themes = [],
  matches = [],
  inView = [],
  state,
  origin = null,
  controller;
let searchTimer,
  listScroll = 0;
let saved = readSaved({ getItem: (key) => localStorage.getItem(key) });

function syncURL(push = false) {
  const url = stateURL(root, state);
  if (url.href !== location.href)
    history[push ? "pushState" : "replaceState"](null, "", url);
}
function updateSaved() {
  $("#saved-count").textContent = saved.size;
  $("#saved-nav").setAttribute("aria-pressed", String(state.saved));
  const button = $("#save-place");
  if (button) {
    const active = saved.has(state.place);
    button.textContent = active ? "Saved" : "Save";
    button.setAttribute("aria-pressed", String(active));
  }
}
function toggleSave() {
  const slug = state.place;
  if (saved.has(slug)) saved.delete(slug);
  else saved.add(slug);
  try {
    localStorage.setItem(SAVED_KEY, JSON.stringify([...saved]));
    toast(
      saved.has(slug) ? "Saved in this browser." : "Removed from saved places.",
    );
  } catch {
    toast("Saved for this visit only. Browser storage is unavailable.");
  }
  updateSaved();
  if (state.saved) {
    matches = filterPlaces(places, state, saved, origin);
    controller?.setPlaces(matches);
    renderList();
  }
}
function renderList() {
  if (!state) return;
  inView =
    $("#in-view").checked && controller
      ? matches.filter((place) => controller.contains(place))
      : matches;
  $("#results-count").textContent =
    `${inView.length} of ${matches.length} ${state.saved ? "saved " : ""}places`;
  $("#place-list").replaceChildren(
    ...inView.map((place, index) => {
      const li = element("li");
      const row = action("", "place-row", () => selectPlace(place.slug, true));
      row.dataset.slug = place.slug;
      const text = element("span", "row-text");
      text.append(
        element("strong", "", place.name),
        element(
          "small",
          "",
          place.themeLabel +
            (origin && state.sort === "nearby"
              ? ` · ${distanceMiles(origin, place).toFixed(1)} mi`
              : ""),
        ),
      );
      row.append(
        element("span", "row-index", String(index + 1).padStart(2, "0")),
        text,
        element("span", "row-arrow", "↗"),
      );
      row.addEventListener("mouseenter", () =>
        controller?.hover(place.slug, true),
      );
      row.addEventListener("mouseleave", () =>
        controller?.hover(place.slug, false),
      );
      row.addEventListener("focus", () => controller?.hover(place.slug, true));
      row.addEventListener("blur", () => controller?.hover(place.slug, false));
      li.append(row);
      return li;
    }),
  );
  $("#place-list").setAttribute("aria-busy", "false");
  $("#empty-state").hidden = inView.length > 0;
  $("#empty-description").textContent =
    state.saved && !saved.size
      ? "Save a place from its details to keep it here."
      : matches.length
        ? "No matching places in this part of the map. Move the map or show all results."
        : "No places match. Try another search or clear the filters.";
  $("#share-results").disabled = !matches.length;
}
function renderFilters(fit = true) {
  matches = filterPlaces(places, state, saved, origin);
  $("#search").value = state.q;
  $("#theme").value = state.theme;
  $("#saved-note").hidden = !state.saved;
  $("#collection-note").hidden = state.collection === null;
  $("#reset").hidden = !(
    state.q ||
    state.theme ||
    state.saved ||
    state.collection !== null ||
    state.sort !== "curated"
  );
  updateSaved();
  controller?.setPlaces(matches, { fit });
  renderList();
}
function change(values, push = true) {
  clearTimeout(searchTimer);
  state = { ...state, ...values, place: null, viewport: null };
  closePlace(false);
  syncURL(push);
  renderFilters();
}
function reset() {
  change({ q: "", theme: "", saved: false, collection: null, sort: "curated" });
}
function selectPlace(slug, recenter = false, push = true) {
  const place = places.find((p) => p.slug === slug);
  if (!place) return;
  if (!state.place) listScroll = $(".sidebar").scrollTop;
  // Nearby links can cross a filter boundary. Show the new place on the map too.
  if (!matches.some((p) => p.slug === slug)) {
    state = { ...state, q: "", theme: "", saved: false, collection: null };
    renderFilters(false);
  }
  state.place = slug;
  state.viewport = null;
  $("#place-content").replaceChildren(
    placeContent(place, places, {
      isSaved: saved.has(slug),
      save: toggleSave,
      select: selectPlace,
      root,
    }),
  );
  $("#browse-panel").hidden = true;
  $("#selected-place").hidden = false;
  $("#workspace").classList.add("place-open");
  controller?.select(slug);
  if (recenter) controller?.focus(place);
  syncURL(push);
  $(".sidebar").scrollTop = 0;
  $("#place-content").querySelectorAll(".gallery").forEach(setupGallery);
  $("#place-title").focus({ preventScroll: true });
}
function closePlace(write = true) {
  if (state) state.place = null;
  $("#selected-place").hidden = true;
  $("#browse-panel").hidden = false;
  $("#workspace").classList.remove("place-open");
  controller?.select(null);
  $(".sidebar").scrollTop = listScroll;
  if (write) {
    syncURL();
    $("#search").focus({ preventScroll: true });
  }
}

setupDialogs();
$("#about-open").addEventListener("click", () =>
  $("#about-dialog").showModal(),
);
$("#panel-toggle").addEventListener("click", () => {
  const expanded = $("#workspace").classList.toggle("panel-expanded");
  $("#panel-toggle").setAttribute("aria-expanded", String(expanded));
  $("#panel-toggle").textContent = expanded
    ? "Show more map ↓"
    : "Expand places ↑";
});

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
      [...saved].filter((slug) => places.some((p) => p.slug === slug)),
    );
    state = readState(location.href, places, themes);
    for (const theme of themes) {
      const option = element("option", "", theme.label);
      option.value = theme.id;
      $("#theme").append(option);
    }
    $("#search").addEventListener("input", (event) => {
      state.q = event.target.value;
      clearTimeout(searchTimer);
      searchTimer = setTimeout(() => change({ q: state.q }, false), 140);
    });
    $("#theme").addEventListener("change", (event) =>
      change({ theme: event.target.value }),
    );
    $("#reset").addEventListener("click", reset);
    $("#leave-collection").addEventListener("click", reset);
    $("#empty-reset").addEventListener("click", () => {
      if (matches.length) {
        $("#in-view").checked = false;
        controller?.fit();
        renderList();
      } else reset();
    });
    $("#saved-nav").addEventListener("click", () =>
      change({ saved: !state.saved, q: "", theme: "", collection: null }),
    );
    $("#in-view").addEventListener("change", renderList);
    document.addEventListener("keydown", (event) => {
      if (
        event.key === "Escape" &&
        state.place &&
        !document.querySelector("dialog[open]")
      )
        closePlace();
    });
    $("#back-to-results").addEventListener("click", () => closePlace());
    $("#fit-map").addEventListener("click", () => controller?.fit());
    $("#surprise").addEventListener("click", () => {
      if (!matches.length) {
        toast("Clear the filters to find a place.");
        return;
      }
      selectPlace(
        matches[Math.floor(Math.random() * matches.length)].slug,
        true,
      );
    });
    $("#share-results").addEventListener("click", () =>
      share(
        stateURL(
          root,
          { ...state, place: null, viewport: controller?.view() },
          { share: true, saved },
        ),
      ),
    );
    $("#nearby").addEventListener("click", () => {
      if (!navigator.geolocation) {
        toast("Location unavailable. Search for a street or place instead.");
        return;
      }
      $("#nearby").disabled = true;
      $("#nearby").textContent = "Locating…";
      navigator.geolocation.getCurrentPosition(
        (position) => {
          origin = {
            lat: position.coords.latitude,
            lng: position.coords.longitude,
          };
          $("#nearby").disabled = false;
          $("#nearby").textContent = "Update location";
          change({ sort: "nearby" });
          $("#in-view").checked = false;
          renderList();
          if (matches.length) controller?.focus(matches[0]);
          toast(
            "Nearest first · straight-line distances. Your location stays in this session.",
          );
        },
        () => {
          $("#nearby").disabled = false;
          $("#nearby").textContent = "Near me";
          toast(
            "Location unavailable or permission denied. Search and map browsing still work.",
          );
        },
        { enableHighAccuracy: false, maximumAge: 300000, timeout: 10000 },
      );
    });
    window.addEventListener("storage", (event) => {
      if (event.key === SAVED_KEY || event.key === null) {
        saved = readSaved({ getItem: (key) => localStorage.getItem(key) });
        saved = new Set(
          [...saved].filter((slug) => places.some((p) => p.slug === slug)),
        );
        renderFilters(false);
      }
    });
    window.addEventListener("popstate", () => {
      clearTimeout(searchTimer);
      state = readState(location.href, places, themes);
      const slug = state.place;
      renderFilters(false);
      if (slug) selectPlace(slug, true, false);
      else {
        closePlace(false);
        if (state.viewport) controller?.restore(state.viewport);
      }
    });
    renderFilters(false);
    const initialPlace = state.place;
    if (initialPlace) selectPlace(initialPlace, false, false);
    try {
      controller = await createExplorerMap(
        $("#map"),
        (slug) => selectPlace(slug),
        (message) => {
          $("#map-status").textContent = message;
          $("#map-status").hidden = !message;
        },
        renderList,
      );
      $("#map-status").hidden = true;
      controller.setPlaces(matches, { fit: true });
      if (state.viewport) controller.restore(state.viewport);
      if (state.place) {
        controller.select(state.place);
        controller.focus(places.find((p) => p.slug === state.place));
      }
    } catch {
      $("#map-status").textContent =
        "The map couldn’t load. Browse the places here, or reload to retry.";
      $("#map-status").hidden = false;
      $("#fit-map").disabled = true;
    }
  } catch (error) {
    console.error(error);
    $("#results-count").textContent = "Places couldn’t load.";
    $("#place-list").setAttribute("aria-busy", "false");
    const fallback = element("p", "inline-note");
    const directory = element("a", "", "Browse all places →");
    directory.href = "browse/";
    fallback.append(directory);
    $("#place-list").replaceChildren(fallback);
    $("#map-status").textContent =
      "The place catalog is unavailable. Reload to retry, or use the complete directory.";
    document
      .querySelectorAll(
        "#search,#theme,#nearby,#surprise,#saved-nav,#share-results,#in-view,#fit-map",
      )
      .forEach((node) => {
        node.disabled = true;
      });
  }
}
start();
