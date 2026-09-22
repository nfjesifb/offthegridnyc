import { SAVED_KEY, readSaved } from "./discovery-core.mjs";
import { createExplorerMap } from "./explorer-map.mjs";
import { setupDialogs, setupGallery, toast, share } from "./place-ui.mjs";
const slug = document.body.dataset.slug;
const storage = { getItem: (key) => localStorage.getItem(key) };
let saved = readSaved(storage);
const save = document.querySelector("#save-place");
const sync = () => {
  const active = saved.has(slug);
  save.textContent = active ? "Saved" : "Save";
  save.setAttribute("aria-pressed", String(active));
};
save.addEventListener("click", () => {
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
  sync();
});
document
  .querySelector("#share-place")
  .addEventListener("click", () =>
    share(new URL(location.pathname, location.origin), document.title),
  );
window.addEventListener("storage", (event) => {
  if (event.key === SAVED_KEY || event.key === null) {
    saved = readSaved(storage);
    sync();
  }
});
sync();
setupDialogs();
document.querySelectorAll(".gallery").forEach(setupGallery);
async function loadContext() {
  const status = document.querySelector("#context-map-status");
  try {
    const response = await fetch("../../assets/data/places.json");
    if (!response.ok) throw new Error("Catalog unavailable");
    const { places } = await response.json();
    const place = places.find((p) => p.slug === slug);
    if (!place) throw new Error("Place unavailable");
    const controller = await createExplorerMap(
      document.querySelector("#context-map"),
      () => {},
      (text) => {
        status.textContent = text;
      },
    );
    controller.setPlaces([place], { fit: true });
    controller.select(slug);
  } catch {
    status.textContent =
      "The map couldn’t load. Directions and Street View links above are still available.";
  }
}
loadContext();
let commentsLoaded = false;
document.querySelector("#discussion").addEventListener("toggle", (event) => {
  if (!event.target.open || commentsLoaded) return;
  commentsLoaded = true;
  const script = document.createElement("script");
  script.src = "https://giscus.app/client.js";
  script.async = true;
  script.crossOrigin = "anonymous";
  const options = {
    repo: "nfjesifb/offthegridnyc",
    "repo-id": "R_kgDOOCIF_w",
    category: "Announcements",
    "category-id": "DIC_kwDOOCIF_84CpfwD",
    mapping: "pathname",
    strict: "0",
    "reactions-enabled": "1",
    "emit-metadata": "0",
    "input-position": "top",
    theme: "light",
    lang: "en",
  };
  for (const [key, value] of Object.entries(options))
    script.setAttribute("data-" + key, value);
  document.querySelector("#comments").append(script);
});
