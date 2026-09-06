/* Location page: mini map, photo gallery with lightbox, street view on demand, share. */
(function () {
  'use strict';

  /* ---------- Mini map ---------- */
  var mapEl = document.getElementById('place-map');
  if (mapEl && typeof L !== 'undefined') {
    var lat = parseFloat(mapEl.dataset.lat), lng = parseFloat(mapEl.dataset.lng);
    var map = L.map(mapEl, { center: [lat, lng], zoom: 15, scrollWheelZoom: false, zoomControl: true, attributionControl: true });
    L.tileLayer(mapEl.dataset.tilesUrl, {
      attribution: mapEl.dataset.tilesAttribution,
      maxZoom: parseInt(mapEl.dataset.tilesMaxZoom, 10) || 19,
      subdomains: mapEl.dataset.tilesSubdomains || 'abc'
    }).addTo(map);
    L.marker([lat, lng], {
      icon: L.divIcon({ className: 'otg-marker otg-marker--' + mapEl.dataset.borough + ' is-active', html: '<span class="otg-marker__pin"></span>', iconSize: [18, 18], iconAnchor: [9, 9] }),
      title: mapEl.dataset.name, alt: mapEl.dataset.name, keyboard: false
    }).addTo(map);
  }

  /* ---------- Gallery + lightbox ---------- */
  var galleryData = document.getElementById('gallery-data');
  var mainImg = document.getElementById('gallery-main-img');
  var caption = document.getElementById('gallery-caption');
  var lightbox = document.getElementById('lightbox');
  if (galleryData && mainImg && lightbox) {
    var photos = JSON.parse(galleryData.textContent);
    var thumbs = Array.prototype.slice.call(document.querySelectorAll('.gallery__thumb'));
    var lbImg = document.getElementById('lightbox-img');
    var lbCaption = document.getElementById('lightbox-caption');
    var index = 0;

    function show(i) {
      index = (i + photos.length) % photos.length;
      var p = photos[index];
      mainImg.src = p.src;
      mainImg.srcset = p.srcset;
      mainImg.alt = p.alt;
      mainImg.width = p.width;
      mainImg.height = p.height;
      if (caption) caption.textContent = p.caption;
      thumbs.forEach(function (t, j) { t.setAttribute('aria-pressed', j === index ? 'true' : 'false'); });
      if (lightbox.open) {
        lbImg.src = p.src;
        lbImg.alt = p.alt;
        lbCaption.textContent = p.caption + ' · ' + (index + 1) + ' of ' + photos.length;
        preload(index + 1);
      }
    }
    function preload(i) {
      var p = photos[(i + photos.length) % photos.length];
      if (p) { var img = new Image(); img.src = p.src; }
    }
    function open(i) {
      if (typeof lightbox.showModal !== 'function') { window.open(photos[i].src, '_blank', 'noopener'); return; }
      lightbox.showModal();
      show(i);
    }

    thumbs.forEach(function (t) { t.addEventListener('click', function () { show(parseInt(t.dataset.index, 10)); }); });
    document.querySelector('.gallery__open').addEventListener('click', function () { open(index); });
    lightbox.querySelector('.lightbox__close').addEventListener('click', function () { lightbox.close(); });
    lightbox.querySelector('.lightbox__prev').addEventListener('click', function () { show(index - 1); });
    lightbox.querySelector('.lightbox__next').addEventListener('click', function () { show(index + 1); });
    lightbox.addEventListener('click', function (e) { if (e.target === lightbox) lightbox.close(); });
    lightbox.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowRight') { e.preventDefault(); show(index + 1); }
      if (e.key === 'ArrowLeft') { e.preventDefault(); show(index - 1); }
    });
    var gallery = document.getElementById('gallery');
    gallery.addEventListener('keydown', function (e) {
      if (e.target.classList.contains('gallery__thumb')) {
        if (e.key === 'ArrowRight') { e.preventDefault(); thumbs[(index + 1) % thumbs.length].focus(); show(index + 1); }
        if (e.key === 'ArrowLeft') { e.preventDefault(); thumbs[(index - 1 + thumbs.length) % thumbs.length].focus(); show(index - 1); }
      }
    });
    var touchX = null;
    lightbox.addEventListener('touchstart', function (e) { touchX = e.changedTouches[0].clientX; }, { passive: true });
    lightbox.addEventListener('touchend', function (e) {
      if (touchX === null) return;
      var dx = e.changedTouches[0].clientX - touchX;
      if (Math.abs(dx) > 50) show(dx < 0 ? index + 1 : index - 1);
      touchX = null;
    }, { passive: true });
  }

  /* ---------- Street view (NYC Planning Labs Roadview), loaded on request ---------- */
  var sv = document.getElementById('streetview');
  var svBtn = document.getElementById('load-streetview');
  if (sv && svBtn) {
    svBtn.addEventListener('click', function () {
      var frame = document.createElement('iframe');
      frame.src = sv.dataset.src;
      frame.title = 'Street view of ' + sv.dataset.name;
      frame.loading = 'lazy';
      frame.referrerPolicy = 'no-referrer';
      frame.setAttribute('allow', 'fullscreen');
      frame.setAttribute('sandbox', 'allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox');
      var embed = sv.querySelector('.embed');
      embed.replaceChildren(frame);
      frame.focus();
    });
  }

  /* ---------- Share ---------- */
  var shareBtn = document.getElementById('share-button');
  var shareStatus = document.getElementById('share-status');
  if (shareBtn) {
    shareBtn.addEventListener('click', function () {
      var data = { title: shareBtn.dataset.title, url: shareBtn.dataset.url };
      if (navigator.share) {
        navigator.share(data).catch(function () {});
      } else if (navigator.clipboard) {
        navigator.clipboard.writeText(data.url).then(function () {
          shareStatus.textContent = 'Link copied';
          setTimeout(function () { shareStatus.textContent = ''; }, 2500);
        }, function () { shareStatus.textContent = data.url; });
      } else {
        shareStatus.textContent = data.url;
      }
    });
  }
})();
