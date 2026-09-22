import { distanceMiles } from "./discovery-core.mjs";
export const element = (tag, className, text) => {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
};
export const action = (text, className, callback) => {
  const node = element("button", className, text);
  node.type = "button";
  node.addEventListener("click", callback);
  return node;
};
export const link = (text, url, className, external = false) => {
  const node = element("a", className, text);
  node.href = url;
  if (external) {
    node.target = "_blank";
    node.rel = "noopener noreferrer";
  }
  return node;
};
let toastTimer;
export function toast(text) {
  const node = document.querySelector("#toast");
  node.textContent = text;
  node.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    node.hidden = true;
  }, 4200);
}

export async function share(url, title = "Off The Grid NYC") {
  if (navigator.share) {
    try {
      await navigator.share({ title, url: String(url) });
      return;
    } catch (error) {
      if (error.name === "AbortError") return;
    }
  }
  try {
    await navigator.clipboard.writeText(String(url));
    toast("Link copied.");
  } catch {
    const input = document.querySelector("#share-url");
    input.value = String(url);
    document.querySelector("#share-status").textContent = "";
    document.querySelector("#share-dialog").showModal();
    input.focus();
    input.select();
  }
}
export function setupDialogs() {
  document.querySelectorAll("dialog").forEach((dialog) => {
    dialog
      .querySelector(".dialog-close")
      .addEventListener("click", () => dialog.close());
    dialog.addEventListener("click", (event) => {
      const r = dialog.getBoundingClientRect();
      if (
        event.target === dialog &&
        (event.clientX < r.left ||
          event.clientX > r.right ||
          event.clientY < r.top ||
          event.clientY > r.bottom)
      )
        dialog.close();
    });
  });
  document.querySelector("#copy-link")?.addEventListener("click", async () => {
    const input = document.querySelector("#share-url");
    try {
      await navigator.clipboard.writeText(input.value);
      document.querySelector("#share-status").textContent = "Link copied.";
    } catch {
      input.focus();
      input.select();
      document.querySelector("#share-status").textContent =
        "Select and copy the link using your browser or keyboard.";
    }
  });
}
export function setupGallery(gallery) {
  const track = gallery.querySelector(".gallery-track");
  const images = [...track.querySelectorAll("img")];
  const previous = gallery.querySelector(".gallery-prev"),
    next = gallery.querySelector(".gallery-next");
  const sync = () => {
    const count = track.querySelectorAll("img:not([hidden])").length;
    const index = Math.min(
      Math.round(track.scrollLeft / (track.clientWidth || 1)),
      Math.max(0, count - 1),
    );
    gallery.querySelector(".gallery-count").textContent =
      `${index + 1} / ${count}`;
    previous.disabled = index === 0;
    next.disabled = index >= count - 1;
  };
  previous.addEventListener("click", () =>
    track.scrollBy({ left: -track.clientWidth, behavior: "instant" }),
  );
  next.addEventListener("click", () =>
    track.scrollBy({ left: track.clientWidth, behavior: "instant" }),
  );
  track.addEventListener("scroll", sync);
  sync();
  for (const image of images) {
    const failed = () => {
      image.hidden = true;
      if (!track.querySelector("img:not([hidden])")) gallery.hidden = true;
      sync();
    };
    image.addEventListener("error", failed, { once: true });
    if (image.complete && !image.naturalWidth) failed();
  }
}
export function photoGallery(place) {
  if (!place.photos.length) return null;
  const gallery = element("figure", "gallery"),
    track = element("div", "gallery-track");
  track.tabIndex = 0;
  track.setAttribute("aria-label", `Photos of ${place.name}`);
  for (const [i, photo] of place.photos.entries()) {
    const image = element("img");
    image.src = photo;
    image.alt = `${place.name} · photo ${i + 1}`;
    image.loading = i ? "lazy" : "eager";
    image.decoding = "async";
    track.append(image);
  }
  const nav = element("figcaption", "gallery-nav"),
    controls = element("span");
  const prev = action("←", "gallery-prev", () => {}),
    next = action("→", "gallery-next", () => {});
  prev.setAttribute("aria-label", "Previous photo");
  next.setAttribute("aria-label", "Next photo");
  controls.append(prev, next);
  nav.append(element("span", "gallery-count"), controls);
  gallery.append(track, nav);
  if (place.credits.length) {
    const credits = element("details", "credits");
    credits.append(element("summary", "", "Photo credits"));
    place.credits.forEach((credit, i) => {
      if (i) credits.append(", ");
      credits.append(
        credit.url
          ? link(credit.name, credit.url, "", true)
          : document.createTextNode(credit.name),
      );
    });
    gallery.append(credits);
  }
  return gallery;
}
function section(title, copy) {
  const s = element("section", "content-section");
  s.append(element("h2", "", title), element("p", "", copy));
  return s;
}
export function placeContent(place, places, { isSaved, save, select, root }) {
  const content = document.createDocumentFragment();
  const category = element("p", "place-category", place.themeLabel),
    title = element("h1", "", place.name);
  title.id = "place-title";
  title.tabIndex = -1;
  const actions = element("div", "place-actions");
  const saveButton = action(isSaved ? "Saved" : "Save", "", save);
  saveButton.id = "save-place";
  saveButton.setAttribute("aria-pressed", String(isSaved));
  const placeURL = new URL(place.url, root);
  actions.append(
    saveButton,
    action("Share", "", () => share(placeURL, place.name)),
    link(
      "Directions ↗",
      `https://www.google.com/maps/dir/?api=1&destination=${place.lat},${place.lng}`,
      "",
      true,
    ),
  );
  content.append(category, title, actions);
  const gallery = photoGallery(place);
  if (gallery) content.append(gallery);
  content.append(element("p", "description", place.description));
  if (place.descriptionOrigin === "curator")
    content.append(
      element("p", "source-label", "From the curator's original map notes."),
    );
  if (place.context || place.history) {
    const background = section("Background", place.context || place.history);
    if (!place.context)
      background.append(
        element(
          "p",
          "source-label",
          "Original AI-assisted background; not independently verified.",
        ),
      );
    content.append(background);
  }
  if (place.curatorNote)
    content.append(section("From the original map", place.curatorNote));
  if (place.sources.length) {
    const sources = element("section", "content-section"),
      list = element("ul", "source-list");
    sources.append(element("h2", "", "Sources"));
    for (const source of place.sources) {
      const li = element("li");
      li.append(link(source.title + " ↗", source.url, "", true));
      list.append(li);
    }
    sources.append(list);
    content.append(sources);
  }
  const links = element("div", "place-links");
  links.append(
    link("Full place page ↗", place.url),
    link(
      "Street View ↗",
      `https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=${place.lat},${place.lng}`,
      "",
      true,
    ),
  );
  content.append(links);
  content.append(
    element(
      "p",
      "access-note",
      "Check access before visiting. Homes and shared residential spaces may be private; pins are reference points, not confirmed entrances.",
    ),
  );
  const nearby = places
    .filter((p) => p.slug !== place.slug)
    .map((p) => ({ ...p, distance: distanceMiles(place, p) }))
    .sort((a, b) => a.distance - b.distance)
    .slice(0, 4);
  const nearbySection = element("section", "content-section"),
    list = element("ul", "nearby-links");
  nearbySection.append(element("h2", "", "Nearby places"));
  for (const other of nearby) {
    const li = element("li"),
      b = action("", "", () => select(other.slug, true));
    b.append(
      element("span", "", other.name),
      element("small", "", `${other.distance.toFixed(1)} mi ↗`),
    );
    li.append(b);
    list.append(li);
  }
  nearbySection.append(
    list,
    element(
      "p",
      "source-label",
      "Straight-line distances, not walking routes.",
    ),
  );
  content.append(nearbySection);
  return content;
}
