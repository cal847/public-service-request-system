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

/* ---------- Dark mode ---------- */
(function () {
  var KEY = 'mcps-theme';
  var root = document.documentElement;
  var btn = document.getElementById('themeToggle');
  if (!btn) return;
  var icon = btn.querySelector('.material-symbols-outlined');

  function apply(theme) {
    var dark = theme === 'dark';
    if (dark) root.setAttribute('data-theme', 'dark');
    else root.removeAttribute('data-theme');
    btn.setAttribute('aria-pressed', String(dark));
    btn.setAttribute('aria-label', dark ? 'Switch to light mode' : 'Switch to dark mode');
    icon.textContent = dark ? 'light_mode' : 'dark_mode';
  }

  apply(root.getAttribute('data-theme') === 'dark' ? 'dark' : 'light');

  btn.addEventListener('click', function () {
    var next = root.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
    apply(next);
    try { localStorage.setItem(KEY, next); } catch (e) {}
  });

  // Auth toggler: Changes homepage UI based on authentication
  (function () {
    const AUTH_STATUS_URL = '/api/auth/me';
    const LOGOUT_URL = '/api/auth/logout';     
    
    const authBtn = document.getElementById('auth-btn');
    const authText = document.getElementById('auth-text');
    const authIcon = document.getElementById('auth-icon');
    const navTrack = document.getElementById('nav-track');
    const aboutSection = document.getElementById('about')
    const trackSection = document.getElementById('track')

    async function checkAuthStatus() {
      try {
        const res = await fetch(AUTH_STATUS_URL, { credentials: 'include' });
        
        if (!res.ok) throw new Error('Not authenticated');
        
        const data = await res.json();
        updateAuthUI(true, data.user.role || 'citizen');

        // Load user service requests on authentication
        loadServiceRequests();

      } catch (err) {
        // User is not logged in or session expired
        updateAuthUI(false);
      } finally {
        if (authBtn) authBtn.style.pointerEvents = 'auto';
      }
    }

    function updateAuthUI(isLoggedIn) {
      if (!authBtn || !navTrack) return;

      aboutSection.hidden = isLoggedIn;
      trackSection.hidden = !isLoggedIn;

      if (isLoggedIn) {
        authText.textContent = 'Log Out';
        authIcon.textContent = 'logout';
        authBtn.removeAttribute('href');
        authBtn.style.cursor = 'pointer';
        navTrack.textContent = 'Track Service Requests';
        navTrack.href = '#track';
      } else {
        authText.textContent = 'Sign In';
        authIcon.textContent = 'fingerprint';
        authBtn.setAttribute('href', '../html/login.html');
        navTrack.textContent = 'About';
        navTrack.href = '#about';
      }
    }

    // Handles logout
    if (authBtn) {
      authBtn.addEventListener('click', async function (e) {
        if (authText.textContent === 'Log Out') {
          e.preventDefault();
          
          try {
            const res = await fetch(LOGOUT_URL, { 
              method: 'POST', 
              credentials: 'include' 
            });

            if (!res.ok) throw new Error('Logout request failed');

            updateAuthUI(false);
            window.location.href = '../html/index.html';
          } catch (err) {
            console.error('Logout failed:', err);
            alert('Could not log out. Please try again.');
          }
        }
      });

    checkAuthStatus()
    }
  })();

  // Fetches User Service Requests and renders them
  const trackContainer = document.getElementById('track-requests-container');

  async function loadServiceRequests() {
    if (!trackContainer) return;

    trackContainer.innerHTML = `
      <article class="about-card" style="grid-column: 1 / -1; text-align: center; padding: 3rem;">
        <span class="material-symbols-outlined" style="font-size: 3rem; color: var(--green); animation: spin 1s linear infinite;">progress_activity</span>
        <h3 style="margin-top: 1rem;">Loading your requests...</h3>
      </article>
    `;

    try {
      const res = await fetch('/api/service-requests/me', { 
        method: 'GET',
        credentials: 'include'
      });

      if (!res.ok) throw new Error('Failed to fetch requests');

      const requests = await res.json();

      if (!Array.isArray(requests)) throw new Error('Invalid requests response');

      if (requests.length === 0) {
        trackContainer.innerHTML = `
          <article class="about-card" style="grid-column: 1 / -1; text-align: center;">
            <span class="about-icon"><span class="material-symbols-outlined" aria-hidden="true">inbox</span></span>
            <h3>No Active Requests</h3>
            <p>You currently have no service requests in progress. Submit a new request to get started.</p>
            <a href="../html/submit-request.html" class="primary-button main-button" style="margin-top: 1rem; text-decoration: none; display: inline-block;">Submit New Request</a>
          </article>
        `;
        return;
      }

      const statusConfig = {
        pending: { label: 'Pending', color: '#d97706', icon: 'pending_actions' },
        'in-progress': { label: 'In Progress', color: '#2563eb', icon: 'settings_motion_mode' },
        resolved: { label: 'Resolved', color: '#16a34a', icon: 'check_circle' }
      };
      const cards = requests.map(req => {
        const status = statusConfig[req.status] || statusConfig.pending;
        const date = new Date(req.created_at).toLocaleDateString('en-KE', {
          year: 'numeric',
          month: 'short',
          day: 'numeric'
        });

        const card = document.createElement('article');
        card.className = 'about-card';
        card.dataset.status = req.status || 'pending';
        card.style.position = 'relative';
        card.style.overflow = 'hidden';

        const badge = document.createElement('div');
        badge.style.cssText =
          `position:absolute;top:1rem;right:1rem;background:${status.color}20;` +
          `color:${status.color};padding:.25rem .75rem;border-radius:999px;` +
          'font-size:.85rem;font-weight:600;display:flex;align-items:center;gap:.25rem;';

        const badgeIcon = document.createElement('span');
        badgeIcon.className = 'material-symbols-outlined';
        badgeIcon.style.fontSize = '1rem';
        badgeIcon.textContent = status.icon;

        const badgeLabel = document.createElement('span');
        badgeLabel.textContent = status.label;
        badge.append(badgeIcon, badgeLabel);

        const title = document.createElement('h3');
        title.style.marginTop = '0.5rem';
        title.textContent = req.category || 'Service Request';

        const description = document.createElement('p');
        description.style.cssText =
          'color:var(--dm-text-soft,#666);font-size:.95rem;line-height:1.5;margin-bottom:1rem;';
        description.textContent = req.description || 'No description provided.';

        const details = document.createElement('div');
        details.style.cssText =
          'display:flex;justify-content:space-between;align-items:center;font-size:.85rem;' +
          'color:#888;border-top:1px solid var(--green-border,#eee);padding-top:.75rem;';

        const location = document.createElement('span');
        location.style.cssText = 'display:flex;align-items:center;gap:.25rem;';

        const locationIcon = document.createElement('span');
        locationIcon.className = 'material-symbols-outlined';
        locationIcon.style.fontSize = '1rem';
        locationIcon.textContent = 'location_on';

        const locationText = document.createElement('span');
        locationText.textContent = req.location || "Murang'a County";
        location.append(locationIcon, locationText);

        const dateText = document.createElement('span');
        dateText.textContent = date;
        details.append(location, dateText);
        card.append(badge, title, description, details);

        return card;
      });

      trackContainer.replaceChildren(...cards);

      attachTrackFilters();

    } catch (err) {
      console.error('Error loading requests:', err);
      const errorCard = document.createElement('article');
      errorCard.className = 'about-card';
      errorCard.style.cssText =
        'grid-column:1/-1;text-align:center;border-color:#dc3545;';

      const errorIcon = document.createElement('span');
      errorIcon.className = 'about-icon';
      errorIcon.style.cssText = 'background:#fee2e2;color:#dc3545;';

      const errorIconText = document.createElement('span');
      errorIconText.className = 'material-symbols-outlined';
      errorIconText.textContent = 'error';
      errorIcon.append(errorIconText);

      const errorTitle = document.createElement('h3');
      errorTitle.textContent = 'Failed to Load Requests';

      const errorMessage = document.createElement('p');
      errorMessage.textContent =
        'Unable to fetch your service requests. Please check your connection and try again.';

      const retryButton = document.createElement('button');
      retryButton.className = 'secondary-button main-button';
      retryButton.style.marginTop = '1rem';
      retryButton.textContent = 'Retry';
      retryButton.addEventListener('click', loadServiceRequests);

      errorCard.append(errorIcon, errorTitle, errorMessage, retryButton);
      trackContainer.replaceChildren(errorCard);
    }
  }

  // Filter Logic
  function attachTrackFilters() {
    const trackFilters = document.querySelectorAll('.track-filter-btn');
    trackFilters.forEach(btn => {
      btn.addEventListener('click', function() {
        trackFilters.forEach(b => {
          b.classList.remove('active');
          b.setAttribute('aria-selected', 'false');
        });
        this.classList.add('active');
        this.setAttribute('aria-selected', 'true');

        const status = this.getAttribute('data-status');
        const cards = trackContainer.querySelectorAll('.about-card');
        
        cards.forEach(card => {
          const cardStatus = card.getAttribute('data-status');
          if (status === 'all' || status === cardStatus) {
            card.style.display = 'block'; 
          } else {
            card.style.display = 'none';
          }
        });
      });
    });
  }

  // Follow the system setting until the visitor picks a theme themselves 
  if (window.matchMedia) {
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', function (e) {
      var saved = null;
      try { saved = localStorage.getItem(KEY); } catch (err) {}
      if (!saved) apply(e.matches ? 'dark' : 'light');
    });
  }
})();