let map;
let kmlDoc;
let locMap = {};

// Map Style (Custom Dark/Urban Theme)
const mapStyle = [
  { elementType: "geometry", stylers: [{ color: "#212121" }] },
  { elementType: "labels.icon", stylers: [{ visibility: "off" }] },
  { elementType: "labels.text.fill", stylers: [{ color: "#757575" }] },
  { elementType: "labels.text.stroke", stylers: [{ color: "#212121" }] },
  {
    featureType: "administrative",
    elementType: "geometry",
    stylers: [{ color: "#757575" }],
  },
  {
    featureType: "administrative.country",
    elementType: "labels.text.fill",
    stylers: [{ color: "#9e9e9e" }],
  },
  {
    featureType: "administrative.land_parcel",
    stylers: [{ visibility: "off" }],
  },
  {
    featureType: "administrative.locality",
    elementType: "labels.text.fill",
    stylers: [{ color: "#bdbdbd" }],
  },
  {
    featureType: "poi",
    elementType: "labels.text.fill",
    stylers: [{ color: "#757575" }],
  },
  {
    featureType: "poi.park",
    elementType: "geometry",
    stylers: [{ color: "#181818" }],
  },
  {
    featureType: "poi.park",
    elementType: "labels.text.fill",
    stylers: [{ color: "#616161" }],
  },
  {
    featureType: "poi.park",
    elementType: "labels.text.stroke",
    stylers: [{ color: "#1b1b1b" }],
  },
  {
    featureType: "road",
    elementType: "geometry.fill",
    stylers: [{ color: "#2c2c2c" }],
  },
  {
    featureType: "road",
    elementType: "labels.text.fill",
    stylers: [{ color: "#8a8a8a" }],
  },
  {
    featureType: "road.arterial",
    elementType: "geometry",
    stylers: [{ color: "#373737" }],
  },
  {
    featureType: "road.highway",
    elementType: "geometry",
    stylers: [{ color: "#3c3c3c" }],
  },
  {
    featureType: "road.highway.controlled_access",
    elementType: "geometry",
    stylers: [{ color: "#4e4e4e" }],
  },
  {
    featureType: "road.local",
    elementType: "labels.text.fill",
    stylers: [{ color: "#616161" }],
  },
  {
    featureType: "transit",
    elementType: "labels.text.fill",
    stylers: [{ color: "#757575" }],
  },
  {
    featureType: "water",
    elementType: "geometry",
    stylers: [{ color: "#000000" }],
  },
  {
    featureType: "water",
    elementType: "labels.text.fill",
    stylers: [{ color: "#3d3d3d" }],
  },
];

const iconMap = {
  'icon-1899-0288D1': 'img/icons/blue-dot.png',
  'icon-1899-E65100': 'img/icons/orange-dot.png',
  'icon-1899-FAD165': 'img/icons/yellow-dot.png',
  'icon-1899-558B2F': 'img/icons/green-dot.png',
  'icon-1899-A52714': 'img/icons/brown-dot.png',
  'icon-1899-616161': 'img/icons/grey-dot.png',
  'icon-1899-FFEA00': 'img/icons/ltblue-dot.png',
};

async function fetchKML() {
  try {
    const response = await fetch('offthegridnyc.kml');
    const kmlText = await response.text();
    const parser = new DOMParser();
    kmlDoc = parser.parseFromString(kmlText, 'application/xml');
    const parseError = kmlDoc.querySelector('parsererror');
    if (parseError) {
      console.error('Error parsing KML:', parseError.textContent);
      return;
    }
  } catch (error) {
    console.error('Error fetching or parsing KML:', error);
  }
}

async function fetchLocations() {
  try {
    const response = await fetch('locations.json');
    const locationsData = await response.json();
    locMap = locationsData.reduce((map, loc) => {
      const slugKey = loc.name.toLowerCase().replace(/\W+/g, '-');
      map[slugKey] = loc;
      return map;
    }, {});
  } catch (error) {
    console.error('Error fetching locations.json:', error);
  }
}

async function initMap() {
  map = new google.maps.Map(document.getElementById('map'), {
    center: { lat: 40.75, lng: -73.98 },
    zoom: 12,
    mapId: 'b58947e633f1fb21',
    styles: mapStyle,
    gestureHandling: 'greedy',
    mapTypeControl: false,
    fullscreenControl: false,
    streetViewControl: false,
    backgroundColor: '#111111', // Match dark theme
  });

  await Promise.all([fetchKML(), fetchLocations()]);

  if (!kmlDoc) {
    console.error('KML document not loaded.');
    return;
  }

  const markers = {};
  const infoWindow = new google.maps.InfoWindow();

  kmlDoc.querySelectorAll('Placemark').forEach(pm => {
    const name = pm.querySelector('name')?.textContent;
    const coordsNode = pm.querySelector('Point > coordinates');
    if (!name || !coordsNode) return;

    const coords = coordsNode.textContent.trim().split(',');
    if (coords.length < 2) return;

    const [lng, lat] = coords.map(Number);
    const sid = pm.querySelector('styleUrl')?.textContent.slice(1);

    const markerOpts = {
      position: { lat, lng },
      map,
      title: name,
      gmpClickable: true
    };

    // Custom icon logic
    if (sid && iconMap[sid]) {
      const iconElement = document.createElement('img');
      iconElement.src = iconMap[sid];
      iconElement.style.width = '30px';
      iconElement.style.height = 'auto';
      markerOpts.content = iconElement;
    }

    const marker = new google.maps.marker.AdvancedMarkerElement(markerOpts);

    if (!markerOpts.content) {
      const simplePin = document.createElement('div');
      simplePin.className = 'w-3 h-3 bg-nyc-accent rounded-full border-2 border-white shadow-md';
      marker.content = simplePin;
    }

    const slug = name.toLowerCase().replace(/\W+/g, '-');
    const loc = locMap[slug] || {};
    const locationUrl = loc.slug ? `locations/${loc.slug}/index.html` : `locations/${slug}/index.html`;
    const satelliteImagePath = loc.satellite_image_local;

    const maxLength = 100;
    let popupDescription = loc.description || "No description available.";
    if (popupDescription.length > maxLength) {
      popupDescription = popupDescription.substring(0, maxLength) + "...";
    }

    const satelliteImageHtml = satelliteImagePath
      ? `<img src="${satelliteImagePath}" alt="Satellite view" class="w-full max-w-[200px] h-auto mt-2 rounded">`
      : '';

    let photoThumbnailHtml = '';
    if (loc.hasPhotos && loc.slug) {
      const thumbnailUrl = `/locations/${loc.slug}/images/photo_1.jpg`;
      photoThumbnailHtml = `
          <img src="${thumbnailUrl}" alt="${name}" class="w-full max-w-[200px] h-auto mt-2 mb-2 rounded">
        `;
    }

    const infoWindowContent = `
      <div class="p-4 max-w-xs font-sans text-sm text-gray-800">
        <h3 class="text-lg font-serif font-bold mb-2 text-nyc-black">${name}</h3>
        ${photoThumbnailHtml} 
        <p class="mb-2 text-gray-600 leading-relaxed">
          ${popupDescription}
        </p>
        ${satelliteImageHtml}
        <div class="mt-3 flex flex-col gap-2">
          <a href="${locationUrl}" target="_blank" class="text-nyc-blue font-medium hover:underline">More Details →</a>
          <a href="https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}" target="_blank" class="text-nyc-blue font-medium hover:underline">Get Directions</a>
        </div>
      </div>`;

    marker.addListener('gmp-click', () => {
      infoWindow.close();
      infoWindow.setContent(infoWindowContent);
      infoWindow.open(map, marker);
    });

    markers[name] = marker;
  });
}

window.initMap = initMap;
