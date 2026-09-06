/* Google Analytics loader. Kept in its own file so pages need no inline scripts
   (strict CSP) and so visitors who send a Do Not Track / Global Privacy Control
   signal are never tracked. */
(function () {
  'use strict';
  var script = document.currentScript;
  var id = script && script.dataset.gaId;
  if (!id) return;
  if (navigator.doNotTrack === '1' || window.doNotTrack === '1' || navigator.globalPrivacyControl === true) return;

  window.dataLayer = window.dataLayer || [];
  function gtag() { window.dataLayer.push(arguments); }
  window.gtag = gtag;
  gtag('js', new Date());
  gtag('config', id, { anonymize_ip: true, allow_google_signals: false, allow_ad_personalization_signals: false });

  var loader = document.createElement('script');
  loader.async = true;
  loader.src = 'https://www.googletagmanager.com/gtag/js?id=' + encodeURIComponent(id);
  document.head.appendChild(loader);
})();
