let library;
function loadLibrary() {
  if (window.L) return Promise.resolve(window.L);
  if (library) return library;
  library = new Promise((resolve, reject) => {
    const css = document.createElement("link");
    css.rel = "stylesheet";
    css.href = "assets/vendor/leaflet/leaflet.css";
    document.head.append(css);
    const script = document.createElement("script");
    script.src = "assets/vendor/leaflet/leaflet.js";
    script.onload = () => resolve(window.L);
    script.onerror = () => {
      library = null;
      script.remove();
      reject(new Error("Map library unavailable"));
    };
    document.head.append(script);
  });
  return library;
}

export async function createExplorerMap(container, onSelect, onStatus) {
  const L = await loadLibrary();
  const map = L.map(container, { scrollWheelZoom: false }).setView(
    [40.746, -73.97],
    11,
  );
  const tiles = L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19,
    attribution:
      '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
  }).addTo(map);
  let failed = false;
  tiles.on("tileerror", () => {
    failed = true;
    onStatus(
      "Some map tiles couldn’t load. Place pins, the list, and directions are still available.",
    );
  });
  tiles.on("loading", () => {
    failed = false;
  });
  tiles.on("load", () => {
    if (!failed) onStatus("");
  });
  const markers = L.featureGroup().addTo(map);
  const icon = L.divIcon({
    className: "map-pin",
    iconSize: [28, 28],
    iconAnchor: [14, 28],
  });
  return {
    update(places) {
      map.invalidateSize();
      markers.clearLayers();
      for (const place of places) {
        const popup = document.createElement("div");
        const title = document.createElement("button");
        title.type = "button";
        title.textContent = place.name;
        title.addEventListener("click", () => onSelect(place.slug));
        const category = document.createElement("p");
        category.textContent = place.themeLabel;
        popup.append(category, title);
        L.marker([place.lat, place.lng], {
          icon,
          title: place.name,
          alt: place.name,
          keyboard: true,
        })
          .bindPopup(popup)
          .addTo(markers);
      }
      if (places.length)
        map.fitBounds(markers.getBounds(), {
          padding: [35, 35],
          maxZoom: 15,
          animate: false,
        });
    },
  };
}
