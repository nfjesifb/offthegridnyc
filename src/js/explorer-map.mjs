let library;
export function loadMapLibrary() {
  if (window.L) return Promise.resolve(window.L);
  if (library) return library;
  library = new Promise((resolve, reject) => {
    const css = document.createElement("link");
    css.rel = "stylesheet";
    css.href = new URL(
      "../../assets/vendor/leaflet/leaflet.css",
      import.meta.url,
    );
    document.head.append(css);
    const script = document.createElement("script");
    script.src = new URL(
      "../../assets/vendor/leaflet/leaflet.js",
      import.meta.url,
    );
    script.onload = () => resolve(window.L);
    script.onerror = () => {
      library = null;
      script.remove();
      reject(new Error("Map unavailable"));
    };
    document.head.append(script);
  });
  return library;
}

export async function createExplorerMap(
  container,
  onSelect,
  onStatus,
  onBounds = () => {},
) {
  const L = await loadMapLibrary();
  const map = L.map(container, {
    zoomControl: false,
    scrollWheelZoom: true,
    zoomSnap: 0.25,
  }).setView([40.74, -73.98], 11);
  L.control.zoom({ position: "topright" }).addTo(map);
  const tiles = L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19,
    attribution:
      '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
  }).addTo(map);
  let failed = false;
  tiles.on("loading", () => {
    failed = false;
  });
  tiles.on("tileerror", () => {
    failed = true;
    onStatus(
      "Map tiles couldn’t load. Places, notes and directions are still available.",
    );
  });
  tiles.on("load", () => {
    if (!failed) onStatus("");
  });
  const markers = new Map();
  const group = L.featureGroup().addTo(map);
  let selected = null;
  const icon = L.divIcon({
    className: "map-marker",
    html: "<span></span>",
    iconSize: [15, 15],
    iconAnchor: [7.5, 7.5],
  });
  map.on("moveend", onBounds);
  const resize = new ResizeObserver(() => {
    map.invalidateSize({ pan: false });
  });
  resize.observe(container);
  const controller = {
    setPlaces(places, { fit = false } = {}) {
      const slugs = new Set(places.map((p) => p.slug));
      for (const [slug, marker] of markers)
        if (!slugs.has(slug)) {
          group.removeLayer(marker);
          markers.delete(slug);
        }
      for (const place of places) {
        if (markers.has(place.slug)) continue;
        const tooltip = document.createElement("span");
        tooltip.textContent = place.name;
        const marker = L.marker([place.lat, place.lng], {
          icon,
          title: place.name,
          alt: place.name,
          keyboard: true,
          riseOnHover: true,
        })
          .bindTooltip(tooltip, {
            direction: "top",
            offset: [0, -8],
            className: "place-tooltip",
          })
          .on("click", () => onSelect(place.slug))
          .addTo(group);
        markers.set(place.slug, marker);
      }
      controller.select(selected);
      if (fit) controller.fit();
      else onBounds();
    },
    fit() {
      if (markers.size)
        map.fitBounds(group.getBounds(), {
          padding: [36, 36],
          maxZoom: 15,
          animate: false,
        });
    },
    contains(place) {
      return map.getBounds().contains([place.lat, place.lng]);
    },
    select(slug) {
      selected = slug;
      for (const [id, marker] of markers) {
        marker.getElement()?.classList.toggle("is-selected", id === slug);
        marker.getElement()?.setAttribute("aria-pressed", String(id === slug));
        marker.setZIndexOffset(id === slug ? 1000 : 0);
      }
    },
    focus(place) {
      map.setView([place.lat, place.lng], Math.max(14, map.getZoom()), {
        animate: false,
      });
    },
    hover(slug, active) {
      markers.get(slug)?.getElement()?.classList.toggle("is-hovered", active);
    },
    restore(view) {
      map.setView([view.lat, view.lng], view.zoom, { animate: false });
    },
    view() {
      const c = map.getCenter();
      return { lat: c.lat, lng: c.lng, zoom: map.getZoom() };
    },
    destroy() {
      resize.disconnect();
      map.remove();
    },
  };
  return controller;
}
