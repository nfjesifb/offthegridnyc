/* Home page explorer: Leaflet map + searchable, filterable list of places. */
(function () {
  'use strict';
  var dataEl = document.getElementById('places-data');
  var mapEl = document.getElementById('map');
  if (!dataEl || !mapEl || typeof L === 'undefined') return;

  var places = JSON.parse(dataEl.textContent);
  var listEl = document.getElementById('place-list');
  var emptyEl = document.getElementById('place-list-empty');
  var countEl = document.getElementById('results-count');
  var statusEl = document.getElementById('explorer-status');
  var searchEl = document.getElementById('search');
  var filterEls = Array.prototype.slice.call(document.querySelectorAll('#borough-filters .filter-chip'));
  var toolsEl = document.getElementById('explorer-tools');
  var nearMeBtn = document.getElementById('near-me');
  var resetBtn = document.getElementById('reset-filters');
  var showMoreBtn = document.getElementById('show-more');
  var PAGE = 20;
  var desktop = window.matchMedia('(min-width: 1024px)');

  var state = { query: '', borough: 'all', origin: null, active: null, limit: PAGE };
  var bySlug = {};
  places.forEach(function (p) { bySlug[p.slug] = p; });

  /* ---------- Map ---------- */
  var map = L.map(mapEl, {
    center: [40.72, -73.96],
    zoom: 11,
    minZoom: 10,
    maxZoom: 19,
    zoomControl: false,
    maxBounds: [[40.3, -74.6], [41.1, -73.3]],
    maxBoundsViscosity: 0.8
  });
  L.control.zoom({ position: 'topright' }).addTo(map);
  L.tileLayer(mapEl.dataset.tilesUrl, {
    attribution: mapEl.dataset.tilesAttribution,
    maxZoom: parseInt(mapEl.dataset.tilesMaxZoom, 10) || 19,
    subdomains: mapEl.dataset.tilesSubdomains || 'abc'
  }).addTo(map);

  function icon(place, extra) {
    return L.divIcon({
      className: 'otg-marker otg-marker--' + place.boroughSlug + (extra ? ' ' + extra : ''),
      html: '<span class="otg-marker__pin"></span>',
      iconSize: [18, 18],
      iconAnchor: [9, 9],
      popupAnchor: [0, -10],
      tooltipAnchor: [0, -8]
    });
  }

  function el(tag, cls, text) {
    var node = document.createElement(tag);
    if (cls) node.className = cls;
    if (text != null) node.textContent = text;
    return node;
  }

  function popupContent(place) {
    var root = el('div', 'popup');
    if (place.thumb) {
      var img = el('img', 'popup__img');
      img.src = place.thumb;
      img.alt = '';
      img.width = 250;
      img.height = 156;
      root.appendChild(img);
    }
    var body = el('div', 'popup__body');
    body.appendChild(el('h3', 'popup__title', place.name));
    body.appendChild(el('p', 'popup__meta', place.borough + ' · ' + place.neighborhood));
    body.appendChild(el('p', 'popup__desc', place.summary));
    var links = el('div', 'popup__links');
    var details = el('a', null, 'Details →');
    details.href = place.url;
    var dirs = el('a', null, 'Directions');
    dirs.href = 'https://www.google.com/maps/dir/?api=1&destination=' + place.lat + ',' + place.lng;
    dirs.target = '_blank';
    dirs.rel = 'noopener noreferrer';
    links.appendChild(details);
    links.appendChild(dirs);
    body.appendChild(links);
    root.appendChild(body);
    return root;
  }

  var markers = {};
  var layer = L.featureGroup().addTo(map);
  places.forEach(function (place) {
    var marker = L.marker([place.lat, place.lng], { icon: icon(place), title: place.name, alt: place.name, riseOnHover: true });
    marker.bindTooltip(place.name, { direction: 'top', opacity: 0.95 });
    marker.bindPopup(function () { return popupContent(place); }, { maxWidth: 250, minWidth: 250, autoPanPadding: [48, 48] });
    marker.on('click', function () { select(place.slug, { fromMap: true }); });
    marker.on('popupclose', function () { if (state.active === place.slug) setActive(null); });
    markers[place.slug] = marker;
    marker.addTo(layer);
  });
  var allBounds = layer.getBounds();
  map.fitBounds(allBounds, { padding: [24, 24] });

  /* ---------- Cards ---------- */
  var cards = {};
  Array.prototype.slice.call(listEl.querySelectorAll('li[data-slug]')).forEach(function (li) {
    var slug = li.dataset.slug;
    cards[slug] = li;
    var actions = el('div', 'place-card__actions');
    var btn = el('button', 'place-card__map-btn', 'Show on map');
    btn.type = 'button';
    btn.addEventListener('click', function () { select(slug, { scrollMap: true }); });
    actions.appendChild(btn);
    var dist = el('span', 'place-card__distance');
    dist.hidden = true;
    actions.appendChild(dist);
    li.appendChild(actions);
    li.addEventListener('mouseenter', function () { hover(slug, true); });
    li.addEventListener('mouseleave', function () { hover(slug, false); });
    li.addEventListener('focusin', function () { hover(slug, true); });
    li.addEventListener('focusout', function () { hover(slug, false); });
  });

  function hover(slug, on) {
    var marker = markers[slug];
    var node = marker && marker.getElement();
    if (node) node.classList.toggle('is-hover', on);
  }

  function setActive(slug) {
    if (state.active && state.active !== slug) {
      var prev = markers[state.active];
      if (prev) prev.setIcon(icon(bySlug[state.active]));
      if (cards[state.active]) cards[state.active].classList.remove('is-active');
    }
    state.active = slug;
    if (slug) {
      markers[slug].setIcon(icon(bySlug[slug], 'is-active'));
      if (cards[slug]) cards[slug].classList.add('is-active');
      if (history.replaceState) history.replaceState(null, '', '#place=' + slug);
    } else if (history.replaceState && window.location.hash.indexOf('#place=') === 0) {
      history.replaceState(null, '', window.location.pathname + window.location.search);
    }
  }

  function select(slug, opts) {
    opts = opts || {};
    var place = bySlug[slug];
    var marker = markers[slug];
    if (!place || !marker) return;
    if (!map.hasLayer(marker)) { clearFilters(); }
    setActive(slug);
    if (!opts.fromMap) {
      map.flyTo([place.lat, place.lng], Math.max(map.getZoom(), 15), { duration: 0.6 });
      map.once('moveend', function () { marker.openPopup(); });
    }
    var card = cards[slug];
    if (card && !card.hidden) card.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    if (opts.scrollMap && window.innerWidth < 1024) mapEl.scrollIntoView({ block: 'start', behavior: 'smooth' });
  }

  /* ---------- Filtering & sorting ---------- */
  function distanceMiles(a, b) {
    var R = 3958.8, toRad = Math.PI / 180;
    var dLat = (b.lat - a.lat) * toRad, dLng = (b.lng - a.lng) * toRad;
    var h = Math.sin(dLat / 2) * Math.sin(dLat / 2) + Math.cos(a.lat * toRad) * Math.cos(b.lat * toRad) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
    return 2 * R * Math.asin(Math.sqrt(h));
  }

  function matches(place) {
    if (state.borough !== 'all' && place.boroughSlug !== state.borough) return false;
    if (!state.query) return true;
    return place.search.indexOf(state.query) !== -1;
  }

  function apply(opts) {
    opts = opts || {};
    var visible = places.filter(matches);
    if (state.origin) {
      visible.forEach(function (p) { p.distance = distanceMiles(state.origin, p); });
      visible.sort(function (a, b) { return a.distance - b.distance; });
    } else {
      visible.sort(function (a, b) { return a.name.localeCompare(b.name); });
    }
    var visibleSet = {};
    var cap = desktop.matches ? Infinity : state.limit;
    visible.forEach(function (p, i) {
      visibleSet[p.slug] = true;
      var card = cards[p.slug];
      if (card) {
        card.hidden = i >= cap;
        listEl.appendChild(card);
        var dist = card.querySelector('.place-card__distance');
        if (dist) {
          dist.hidden = !state.origin;
          if (state.origin) dist.textContent = (p.distance < 10 ? p.distance.toFixed(1) : Math.round(p.distance)) + ' mi';
        }
      }
      var marker = markers[p.slug];
      if (!map.hasLayer(marker)) marker.addTo(map);
    });
    places.forEach(function (p) {
      if (visibleSet[p.slug]) return;
      if (cards[p.slug]) cards[p.slug].hidden = true;
      if (map.hasLayer(markers[p.slug])) map.removeLayer(markers[p.slug]);
    });
    emptyEl.hidden = visible.length > 0;
    var shown = Math.min(visible.length, cap);
    if (showMoreBtn) {
      showMoreBtn.hidden = shown >= visible.length;
      showMoreBtn.textContent = 'Show more places (' + (visible.length - shown) + ' left)';
    }

    var filtered = state.query || state.borough !== 'all';
    var label;
    if (visible.length === 0) label = 'No places match';
    else if (shown < visible.length) label = 'Showing ' + shown + ' of ' + visible.length + (filtered ? ' matching' : '') + ' places' + (state.origin ? ', nearest first' : '');
    else if (visible.length === places.length && !state.origin) label = 'Showing all ' + places.length + ' places, A to Z';
    else label = 'Showing ' + visible.length + ' of ' + places.length + ' places' + (state.origin ? ', nearest first' : '');
    countEl.textContent = label;

    if (!opts.keepView) {
      if (visible.length && filtered) {
        map.fitBounds(L.latLngBounds(visible.map(function (p) { return [p.lat, p.lng]; })), { padding: [40, 40], maxZoom: 15 });
      } else if (!filtered && !state.origin) {
        map.fitBounds(allBounds, { padding: [24, 24] });
      }
    }
    if (state.active && !visibleSet[state.active]) { map.closePopup(); setActive(null); }
  }

  function clearFilters() {
    state.query = '';
    state.borough = 'all';
    if (searchEl) searchEl.value = '';
    filterEls.forEach(function (b) { b.setAttribute('aria-pressed', b.dataset.borough === 'all' ? 'true' : 'false'); });
  }

  var timer;
  if (searchEl) {
    searchEl.addEventListener('input', function () {
      clearTimeout(timer);
      timer = setTimeout(function () { state.query = searchEl.value.trim().toLowerCase(); state.limit = PAGE; apply(); }, 120);
    });
  }
  filterEls.forEach(function (btn) {
    btn.addEventListener('click', function () {
      state.borough = btn.dataset.borough;
      state.limit = PAGE;
      filterEls.forEach(function (b) { b.setAttribute('aria-pressed', b === btn ? 'true' : 'false'); });
      apply();
    });
  });
  if (toolsEl) toolsEl.hidden = false;
  if (showMoreBtn) showMoreBtn.addEventListener('click', function () { state.limit += PAGE; apply({ keepView: true }); });
  if (desktop.addEventListener) desktop.addEventListener('change', function () { apply({ keepView: true }); });
  if (resetBtn) {
    resetBtn.addEventListener('click', function () {
      clearFilters();
      state.limit = PAGE;
      state.origin = null;
      if (userMarker) { map.removeLayer(userMarker); userMarker = null; }
      statusEl.textContent = '';
      map.closePopup();
      setActive(null);
      apply();
      searchEl && searchEl.focus();
    });
  }

  /* ---------- Near me ---------- */
  var userMarker = null;
  if (nearMeBtn) {
    if (!('geolocation' in navigator)) nearMeBtn.hidden = true;
    nearMeBtn.addEventListener('click', function () {
      nearMeBtn.disabled = true;
      statusEl.textContent = 'Finding your location…';
      navigator.geolocation.getCurrentPosition(function (pos) {
        nearMeBtn.disabled = false;
        state.origin = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        var inNyc = state.origin.lat > 40.3 && state.origin.lat < 41.1 && state.origin.lng > -74.6 && state.origin.lng < -73.3;
        statusEl.textContent = inNyc ? 'Sorted by distance from you.' : 'You seem to be outside New York, so distances are large. Sorted by distance anyway.';
        if (userMarker) map.removeLayer(userMarker);
        userMarker = L.marker([state.origin.lat, state.origin.lng], {
          icon: L.divIcon({ className: 'otg-marker otg-marker--user', html: '<span class="otg-marker__pin"></span>', iconSize: [18, 18], iconAnchor: [9, 9] }),
          title: 'Your location', alt: 'Your location', interactive: false, zIndexOffset: 500
        }).addTo(map);
        apply({ keepView: true });
        if (inNyc) map.flyTo([state.origin.lat, state.origin.lng], 13, { duration: 0.8 });
      }, function (err) {
        nearMeBtn.disabled = false;
        statusEl.textContent = err.code === 1 ? 'Location access was denied. You can still search and filter.' : 'Could not determine your location right now.';
      }, { enableHighAccuracy: false, timeout: 10000, maximumAge: 300000 });
    });
  }

  /* ---------- Deep links: /#place=<slug> ---------- */
  function fromHash() {
    var m = /[#&]place=([\w-]+)/.exec(window.location.hash);
    if (m && bySlug[m[1]]) {
      select(m[1], { scrollMap: true });
      return true;
    }
    return false;
  }
  window.addEventListener('hashchange', fromHash);
  if (!fromHash()) apply({ keepView: true });
})();
