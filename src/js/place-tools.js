import { SAVED_KEY, readSaved } from "./discovery-core.mjs";
const panel = document.querySelector(".otg-tools");
if (panel) {
  const slug = panel.dataset.slug;
  const storage = { getItem: (key) => localStorage.getItem(key) };
  let saved = readSaved(storage);
  const save = panel.querySelector("[data-save-place]");
  const status = panel.querySelector('[role="status"]');
  const sync = () => {
    const active = saved.has(slug);
    save.textContent = active ? "♥ Saved" : "♡ Save this place";
    save.setAttribute("aria-pressed", String(active));
  };
  save.addEventListener("click", () => {
    if (saved.has(slug)) saved.delete(slug);
    else saved.add(slug);
    try {
      localStorage.setItem(SAVED_KEY, JSON.stringify([...saved]));
      status.textContent = saved.has(slug)
        ? "Saved in this browser for your next detour."
        : "Removed from your saved places.";
    } catch {
      status.textContent =
        "Your selection will last for this visit only. Browser storage is unavailable.";
    }
    sync();
  });
  panel
    .querySelector("[data-share-place]")
    .addEventListener("click", async () => {
      const url = new URL(location.href);
      url.search = "";
      url.hash = "";
      if (navigator.share) {
        try {
          await navigator.share({ title: document.title, url: url.href });
          return;
        } catch (error) {
          if (error.name === "AbortError") return;
        }
      }
      try {
        await navigator.clipboard.writeText(url.href);
        status.textContent = "Link copied. Pass along a good find.";
      } catch {
        const input = panel.querySelector(".otg-share-url");
        input.hidden = false;
        input.value = url.href;
        input.focus();
        input.select();
        status.textContent =
          "Copy the selected link with your browser or keyboard.";
      }
    });
  window.addEventListener("storage", (event) => {
    if (event.key === SAVED_KEY || event.key === null) {
      saved = readSaved(storage);
      sync();
    }
  });
  sync();
  fetch("../../assets/data/places.json")
    .then((response) => {
      if (!response.ok) throw new Error("Catalog unavailable");
      return response.json();
    })
    .then(({ places }) => {
      const place = places.find((place) => place.slug === slug);
      if (!place) return;
      const related = panel.querySelector(".otg-related");
      for (const next of places
        .filter((next) => next.theme === place.theme && next.slug !== slug)
        .slice(0, 3)) {
        const link = document.createElement("a");
        link.href = "../../" + next.url;
        link.textContent = `Next detour: ${next.name} ↗`;
        related.append(link);
      }
    })
    .catch(() => {
      /* The story and core actions remain usable without related places. */
    });
}
