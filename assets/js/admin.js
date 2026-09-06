/* Admin tool behaviour: map pickers, boundary lookup, delete confirmation. */
(function () {
  'use strict';
  document.querySelectorAll('form[data-confirm]').forEach(function (form) {
    form.addEventListener('submit', function (e) { if (!window.confirm(form.dataset.confirm)) e.preventDefault(); });
  });

  var pickerEl = document.getElementById('map-picker');
  if (!pickerEl || typeof L === 'undefined') return;
  var NYC = [40.7306, -73.9352];
  var TILES = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
  var ATTR = '&copy; OpenStreetMap contributors';

  function picker(el, latInput, lngInput, onMove) {
    var lat = parseFloat(el.dataset.lat), lng = parseFloat(el.dataset.lng);
    var has = !isNaN(lat) && !isNaN(lng);
    var map = L.map(el, { center: has ? [lat, lng] : NYC, zoom: has ? 16 : 11 });
    L.tileLayer(TILES, { maxZoom: 19, attribution: ATTR }).addTo(map);
    var marker = L.marker(has ? [lat, lng] : NYC, { draggable: true }).addTo(map);
    function set(ll, fly) {
      marker.setLatLng(ll);
      latInput.value = ll.lat.toFixed(7);
      lngInput.value = ll.lng.toFixed(7);
      if (fly) map.setView(ll, Math.max(map.getZoom(), 15));
      onMove && onMove(ll);
    }
    map.on('click', function (e) { set(e.latlng); });
    marker.on('dragend', function () { set(marker.getLatLng()); });
    function fromInputs() {
      var a = parseFloat(latInput.value), b = parseFloat(lngInput.value);
      if (!isNaN(a) && !isNaN(b)) set(L.latLng(a, b), true);
    }
    latInput.addEventListener('change', fromInputs);
    lngInput.addEventListener('change', fromInputs);
    return { map: map, set: set, marker: marker };
  }

  var svEl = document.getElementById('sv-picker');
  var sync = document.getElementById('sync-sv');
  var preview = document.getElementById('sv-preview');
  var svLat = document.getElementById('sv_lat'), svLng = document.getElementById('sv_lng');
  var svPicker;

  function updatePreview() {
    if (preview && svLat.value && svLng.value) preview.href = 'https://roadview.planninglabs.nyc/view/' + svLng.value + '/' + svLat.value;
  }
  var mainPicker = picker(pickerEl, document.getElementById('lat'), document.getElementById('lng'), function (ll) {
    if (sync.checked && svPicker) svPicker.set(ll, true);
    updatePreview();
  });
  svPicker = picker(svEl, svLat, svLng, updatePreview);
  var same = svLat.value === document.getElementById('lat').value && svLng.value === document.getElementById('lng').value;
  sync.checked = !svLat.value || same;
  function applySync() {
    if (sync.checked) {
      svPicker.set(mainPicker.marker.getLatLng(), true);
      svPicker.marker.dragging.disable();
      svEl.style.opacity = '0.6';
    } else {
      svPicker.marker.dragging.enable();
      svEl.style.opacity = '1';
    }
  }
  sync.addEventListener('change', applySync);
  applySync();
  updatePreview();

  var geoBtn = document.getElementById('auto-geo');
  var geoStatus = document.getElementById('geo-status');
  if (geoBtn) {
    geoBtn.addEventListener('click', function () {
      var lat = document.getElementById('lat').value, lng = document.getElementById('lng').value;
      if (!lat || !lng) { geoStatus.textContent = 'Place the pin first.'; return; }
      geoStatus.textContent = 'Looking up…';
      fetch('/api/geo?lat=' + encodeURIComponent(lat) + '&lng=' + encodeURIComponent(lng), { credentials: 'same-origin' })
        .then(function (r) { return r.json(); })
        .then(function (data) {
          if (data.error) { geoStatus.textContent = data.error; return; }
          document.getElementById('borough').value = data.borough;
          document.getElementById('neighborhood').value = data.neighborhood;
          geoStatus.textContent = data.borough + ' · ' + data.neighborhood;
        })
        .catch(function () { geoStatus.textContent = 'Lookup failed.'; });
    });
  }
})();
