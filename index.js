(function () {
  'use strict';

  var root = document.documentElement;

  // Mobile Navigation
  var menuToggle = document.getElementById('menuToggle');
  var mainNav = document.getElementById('mainNav');

  menuToggle.addEventListener('click', function () {
    var open = mainNav.classList.toggle('open');
    menuToggle.setAttribute('aria-expanded', String(open));
    menuToggle.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
  });

  // Search
  var searchForm = document.getElementById('searchForm');
  var searchBtn = document.getElementById('searchBtn');
  var searchInput = document.getElementById('searchInput');
  var serviceList = document.getElementById('serviceList');
  var notFound = document.getElementById('notFound');
  var statusEl = document.getElementById('searchStatus');
  var services = Array.prototype.slice.call(serviceList.querySelectorAll('.service'));

  function normalise(text) {
    return text.toLowerCase().replace(/[^a-z0-9\s]/g, '').replace(/\s+/g, ' ').trim();
  }

  function runSearch() {
    var query = normalise(searchInput.value);
    var terms = query ? query.split(' ') : [];
    var matches = 0;

    services.forEach(function (item) {
      var name = normalise(item.getAttribute('data-name'));
      var hit = terms.every(function (t) { return name.indexOf(t) !== -1; });
      item.hidden = !hit;
      if (hit) matches++;
    });

    serviceList.classList.toggle('filtered', terms.length > 0);

    if (terms.length === 0) {
      notFound.hidden = true;
      serviceList.hidden = false;
      statusEl.textContent = '';
    } else if (matches === 0) {
      serviceList.hidden = true;
      notFound.hidden = false;
      statusEl.textContent = 'Service not available';
    } else {
      serviceList.hidden = false;
      notFound.hidden = true;
      statusEl.textContent = matches + (matches === 1 ? ' service found' : ' services found');
    }
  }

  function setSearchOpen(open) {
    searchForm.classList.toggle('open', open);
    searchBtn.setAttribute('aria-expanded', String(open));
    searchInput.tabIndex = open ? 0 : -1;
    if (open) {
      searchInput.focus();
    } else {
      searchInput.value = '';
      runSearch();
    }
  }

  searchBtn.addEventListener('click', function () {
    var isOpen = searchForm.classList.contains('open');
    if (!isOpen) {
      setSearchOpen(true);
    } else if (searchInput.value.trim()) {
      runSearch();
      searchInput.focus();
    } else {
      setSearchOpen(false);
    }
  });

  searchInput.addEventListener('input', runSearch);

  searchForm.addEventListener('submit', function (e) {
    e.preventDefault();
    runSearch();
  });

  searchInput.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') {
      setSearchOpen(false);
      searchBtn.focus();
    }
  });

  // Accessibility Menu
  var STORAGE_KEY = 'mcps-a11y';
  var FEATURES = ['contrast', 'gray', 'links', 'readable', 'spacing', 'cursor', 'motion'];
  var MIN_SIZE = 80, MAX_SIZE = 160, STEP = 10;

  var a11yToggle = document.getElementById('a11yToggle');
  var a11yMenu = document.getElementById('a11yMenu');
  var a11yClose = document.getElementById('a11yClose');
  var a11yReset = document.getElementById('a11yReset');
  var sizeUp = document.getElementById('sizeUp');
  var sizeDown = document.getElementById('sizeDown');
  var sizeValue = document.getElementById('sizeValue');
  var optionButtons = Array.prototype.slice.call(document.querySelectorAll('.a11y-opt'));

  var state = { size: 100, features: {} };

  function load() {
    try {
      var saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
      if (saved && typeof saved === 'object') {
        state.size = Math.min(MAX_SIZE, Math.max(MIN_SIZE, Number(saved.size) || 100));
        state.features = saved.features || {};
      }
    } catch (err) { /* storage unavailable or corrupted: use defaults */ }
  }

  function save() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch (err) { /* ignore */ }
  }

  function apply() {
    root.style.fontSize = state.size + '%';
    sizeValue.textContent = state.size + '%';
    sizeDown.disabled = state.size <= MIN_SIZE;
    sizeUp.disabled = state.size >= MAX_SIZE;

    FEATURES.forEach(function (name) {
      root.classList.toggle('a11y-' + name, !!state.features[name]);
    });
    optionButtons.forEach(function (btn) {
      btn.setAttribute('aria-pressed', String(!!state.features[btn.getAttribute('data-feature')]));
    });
  }

  function openMenu() {
    a11yMenu.hidden = false;
    a11yToggle.setAttribute('aria-expanded', 'true');
    a11yMenu.querySelector('button, [href]').focus();
  }

  function closeMenu(returnFocus) {
    a11yMenu.hidden = true;
    a11yToggle.setAttribute('aria-expanded', 'false');
    if (returnFocus) a11yToggle.focus();
  }

  a11yToggle.addEventListener('click', function () {
    if (a11yMenu.hidden) openMenu(); else closeMenu(false);
  });
  a11yClose.addEventListener('click', function () { closeMenu(true); });

  document.addEventListener('click', function (e) {
    if (!a11yMenu.hidden && !document.getElementById('a11y').contains(e.target)) closeMenu(false);
  });

  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && !a11yMenu.hidden) closeMenu(true);
  });

  // Keeps keyboard focus inside the open menu
  a11yMenu.addEventListener('keydown', function (e) {
    if (e.key !== 'Tab') return;
    var focusable = Array.prototype.slice.call(a11yMenu.querySelectorAll('button:not([disabled])'));
    var first = focusable[0];
    var last = focusable[focusable.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  });

  sizeUp.addEventListener('click', function () {
    state.size = Math.min(MAX_SIZE, state.size + STEP); apply(); save();
  });
  sizeDown.addEventListener('click', function () {
    state.size = Math.max(MIN_SIZE, state.size - STEP); apply(); save();
  });

  optionButtons.forEach(function (btn) {
    btn.addEventListener('click', function () {
      var name = btn.getAttribute('data-feature');
      state.features[name] = !state.features[name];
      apply(); save();
    });
  });

  a11yReset.addEventListener('click', function () {
    state = { size: 100, features: {} };
    apply(); save();
  });

  load();
  apply();
})();