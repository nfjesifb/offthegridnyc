/* Shared behaviour for every page: navigation, on-demand embeds, list filters. */
(function () {
  'use strict';

  var $ = function (sel, root) { return (root || document).querySelector(sel); };
  var $$ = function (sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); };

  /* ---------- Mobile navigation ---------- */
  var toggle = $('#nav-toggle');
  var nav = $('#site-nav');
  if (toggle && nav) {
    toggle.addEventListener('click', function () {
      var open = nav.classList.toggle('is-open');
      toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && nav.classList.contains('is-open')) {
        nav.classList.remove('is-open');
        toggle.setAttribute('aria-expanded', 'false');
        toggle.focus();
      }
    });
    nav.addEventListener('click', function (e) {
      if (e.target.tagName === 'A') {
        nav.classList.remove('is-open');
        toggle.setAttribute('aria-expanded', 'false');
      }
    });
  }

  /* Search forms are JavaScript-driven; never navigate on submit. */
  $$('form[data-no-submit]').forEach(function (form) {
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      if (form.hasAttribute('data-redirect-search')) {
        var q = $('input[type="search"]', form).value.trim();
        window.location.href = '/locations/' + (q ? '?q=' + encodeURIComponent(q) : '');
      }
    });
  });

  /* ---------- Submission form (Google Forms), loaded on request ---------- */
  var loadForm = $('#load-form');
  var formEmbed = $('#submit-form-embed');
  if (loadForm && formEmbed) {
    loadForm.addEventListener('click', function () {
      if (formEmbed.querySelector('iframe')) { formEmbed.scrollIntoView({ behavior: 'smooth', block: 'start' }); return; }
      var iframe = document.createElement('iframe');
      iframe.src = loadForm.dataset.src;
      iframe.title = 'Submit a location';
      iframe.loading = 'lazy';
      iframe.referrerPolicy = 'no-referrer';
      iframe.setAttribute('sandbox', 'allow-scripts allow-forms allow-same-origin allow-popups allow-popups-to-escape-sandbox');
      formEmbed.appendChild(iframe);
      formEmbed.hidden = false;
      loadForm.textContent = 'Scroll to the form';
      formEmbed.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  }

  /* ---------- Simple client-side filtering (directory page) ---------- */
  $$('[data-filter-input]').forEach(function (input) {
    var key = input.dataset.filterInput;
    var target = $('[data-filter-target="' + key + '"]');
    if (!target) return;
    var items = $$('[data-search]', target);
    var groups = $$('[data-filter-group]', target);
    var empty = $('[data-filter-empty]');
    var status = $('#' + key + '-status');
    var timer;

    function apply() {
      var q = input.value.trim().toLowerCase();
      var shown = 0;
      items.forEach(function (item) {
        var match = !q || item.dataset.search.indexOf(q) !== -1;
        item.hidden = !match;
        if (match) shown++;
      });
      groups.forEach(function (group) {
        var visible = $$('[data-search]', group).filter(function (i) { return !i.hidden; }).length;
        group.hidden = visible === 0;
        var count = $('[data-group-count]', group);
        if (count) count.textContent = visible + (visible === 1 ? ' place' : ' places');
      });
      if (empty) empty.hidden = shown > 0;
      if (status) status.textContent = q ? shown + ' of ' + items.length + ' places match “' + input.value.trim() + '”' : '';
    }
    input.addEventListener('input', function () { clearTimeout(timer); timer = setTimeout(apply, 120); });

    var params = new URLSearchParams(window.location.search);
    if (params.get('q')) { input.value = params.get('q'); apply(); }
  });

  /* ---------- giscus comments, loaded when the section scrolls into view ---------- */
  var comments = $('#comments');
  var container = $('#giscus-container');
  if (comments && container) {
    var loaded = false;
    var load = function () {
      if (loaded) return;
      loaded = true;
      var s = document.createElement('script');
      s.src = 'https://giscus.app/client.js';
      s.async = true;
      s.crossOrigin = 'anonymous';
      s.setAttribute('data-repo', comments.dataset.giscusRepo);
      s.setAttribute('data-repo-id', comments.dataset.giscusRepoId);
      s.setAttribute('data-category', comments.dataset.giscusCategory);
      s.setAttribute('data-category-id', comments.dataset.giscusCategoryId);
      s.setAttribute('data-mapping', 'specific');
      s.setAttribute('data-term', comments.dataset.giscusTerm);
      s.setAttribute('data-strict', '0');
      s.setAttribute('data-reactions-enabled', '1');
      s.setAttribute('data-emit-metadata', '0');
      s.setAttribute('data-input-position', 'bottom');
      s.setAttribute('data-theme', 'light');
      s.setAttribute('data-lang', 'en');
      s.setAttribute('data-loading', 'lazy');
      container.appendChild(s);
    };
    if ('IntersectionObserver' in window) {
      var io = new IntersectionObserver(function (entries) {
        if (entries.some(function (e) { return e.isIntersecting; })) { load(); io.disconnect(); }
      }, { rootMargin: '200px' });
      io.observe(comments);
    } else {
      load();
    }
  }
})();
