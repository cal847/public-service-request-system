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

  function normalise(text) {
    return text.toLowerCase().replace(/[^a-z0-9\s]/g, '').replace(/\s+/g, ' ').trim();
  }

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

// Service Request Form
(function () {
  'use strict';

  var form = document.getElementById('requestForm');
  if (!form) return;

  var $ = function (id) { return document.getElementById(id); };
  var alertBox = $('requestAlert');
  var success = $('requestSuccess');
  var submitBtn = $('submitRequest');
  var imageInput = $('image');
  var preview = $('uploadPreview');
  var previewImg = $('previewImg');
  var previewUrl = null;

  var MAX_BYTES = 5 * 1024 * 1024;
  var IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
  var CATEGORIES = ['Streetlight', 'Water', 'Garbage collection', 'Roads', 'Other'];

  var dateFmt = new Intl.DateTimeFormat('en-GB', { dateStyle: 'long', timeStyle: 'short' });

  /* ---------- helpers ---------- */
  function setFieldError(name, message) {
    var out = form.querySelector('[data-error-for="' + name + '"]');
    var input = form.elements[name];
    if (out) out.textContent = message || '';
    if (input) {
      if (message) input.setAttribute('aria-invalid', 'true');
      else input.removeAttribute('aria-invalid');
    }
  }

  function clearErrors() {
    ['category', 'location', 'description', 'image'].forEach(function (n) { setFieldError(n, ''); });
    alertBox.hidden = true;
    alertBox.textContent = '';
  }

  function showAlert(message) {
    alertBox.textContent = message;
    alertBox.hidden = false;
    alertBox.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }

  function showErrors(errors) {
    var first = null;
    Object.keys(errors).forEach(function (name) {
      setFieldError(name, errors[name]);
      if (!first && form.elements[name]) first = form.elements[name];
    });
    if (first) first.focus();
  }

  function showForm() {
    success.hidden = true;
    form.hidden = false;
  }

  /* ---------- description counter ---------- */
  var description = $('description');
  var counter = $('description-count');
  function updateCount() { counter.textContent = description.value.length + ' / 1000'; }
  description.addEventListener('input', updateCount);

  /* ---------- photo preview ---------- */
  function clearPreview() {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    previewUrl = null;
    previewImg.removeAttribute('src');
    preview.hidden = true;
    imageInput.value = '';
  }

  imageInput.addEventListener('change', function () {
    setFieldError('image', '');
    var file = imageInput.files[0];
    if (!file) return clearPreview();

    if (IMAGE_TYPES.indexOf(file.type) === -1) {
      clearPreview();
      return setFieldError('image', 'Choose a JPG, PNG or WebP image.');
    }
    if (file.size > MAX_BYTES) {
      clearPreview();
      return setFieldError('image', 'The photo is too large. Maximum size is 5 MB.');
    }

    if (previewUrl) URL.revokeObjectURL(previewUrl);
    previewUrl = URL.createObjectURL(file);
    previewImg.src = previewUrl;
    preview.hidden = false;
  });

  $('removeImage').addEventListener('click', function () {
    clearPreview();
    imageInput.focus();
  });

  /* ---------- submit ---------- */
  form.addEventListener('submit', function (e) {
    e.preventDefault();
    clearErrors();

    var values = {
      category: form.elements.category.value,
      location: form.elements.location.value.trim().replace(/\s+/g, ' '),
      description: form.elements.description.value.trim()
    };
    var file = imageInput.files[0];

    var errors = {};
    if (CATEGORIES.indexOf(values.category) === -1) errors.category = 'Choose a category.';
    if (values.location.length < 3) errors.location = 'Enter the location (at least 3 characters).';
    if (values.description.length < 10) errors.description = 'Describe the issue in at least 10 characters.';
    if (file && IMAGE_TYPES.indexOf(file.type) === -1) errors.image = 'Choose a JPG, PNG or WebP image.';
    if (file && file.size > MAX_BYTES) errors.image = 'The photo is too large. Maximum size is 5 MB.';
    if (Object.keys(errors).length) return showErrors(errors);

    var body = new FormData();
    body.append('category', values.category);
    body.append('location', values.location);
    body.append('description', values.description);
    if (file) body.append('image', file);

    submitBtn.disabled = true;
    submitBtn.textContent = 'Submitting…';

    // No Content-Type header here: the browser adds the multipart boundary itself.
    fetch('/api/service-requests', { method: 'POST', credentials: 'same-origin', body: body })
      .then(function (res) {
        return res.json().catch(function () { return {}; }).then(function (data) {
          return { ok: res.ok, status: res.status, data: data };
        });
      })
      .then(function (r) {
        if (r.ok) return showSuccess(r.data.request);
        if (r.data.errors) showErrors(r.data.errors);
        else showAlert(r.data.error || 'Could not submit your request. Please try again.');
      })
      .catch(function () {
        showAlert('Cannot reach the server. Check your connection and try again.');
      })
      .then(function () {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Submit request';
      });
  });

  /* ---------- success ---------- */
  function showSuccess(request) {
    $('trackingCode').textContent = request.trackingCode;
    $('successMeta').textContent = request.category + ' · ' + dateFmt.format(new Date(request.createdAt));
    $('copyStatus').textContent = '';

    form.reset();
    updateCount();
    clearPreview();

    form.hidden = true;
    success.hidden = false;
    success.focus();

    // Lets other scripts (for example the "track my requests" list) refresh.
    document.dispatchEvent(new CustomEvent('request:created', { detail: request }));
  }

  $('copyCode').addEventListener('click', function () {
    var code = $('trackingCode').textContent;
    var status = $('copyStatus');
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(code).then(
        function () { status.textContent = 'Tracking code copied.'; },
        function () { status.textContent = 'Could not copy. Select the code and press Ctrl+C.'; }
      );
    } else {
      status.textContent = 'Select the code and press Ctrl+C to copy it.';
    }
  });

  $('newRequest').addEventListener('click', function () {
    showForm();
    form.elements.category.focus();
  });
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

  // Track a request by its tracking code
  (function () {
    'use strict';

    var form = document.getElementById('trackSearch');
    var modal = document.getElementById('trackModal')
    if (!form || !modal) return;

    var $ = function (id) {
      return document.getElementById(id);
    };
    var lastResult = null;

    var input = document.getElementById('trackInput');
    var box = document.getElementById('trackResult');
    var dateFmt = new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium' });
    var PILL = { 'Pending': 'is-pending', 'In Progress': 'is-progress', 'Resolved': 'is-resolved' };
    var timer = null;
    var ticket = 0;

    function normalise(value) {
      var raw = String(value).toUpperCase().replace(/[^A-Z0-9]/g, '');
      var m = raw.match(/^MCG(\d{4})([A-Z2-9]{6})$/);
      return m ? 'MCG-' + m[1] + '-' + m[2] : null;
    }

    // Elements are built with textContent, so nothing from the server is parsed as HTML. 
    function el(tag, className, text) {
      var node = document.createElement(tag);
      if (className) node.className = className;
      if (text != null) node.textContent = text;
      return node;
    }

    function pill(status) {
      return el('span', 'tr-pill ' + (PILL[status] || 'is-pending'), status);
    }

    function show(nodes) {
      box.replaceChildren.apply(box, nodes);
      box.hidden = false;
    }

    function hideBox() { box.hidden = true; }
    function reset() { ticket++; hideBox(); box.replaceChildren(); }

    function showMessage(title, detail) {
      var nodes = [el('p', 'tr-empty', title)];
      if (detail) nodes.push(el('p', 'tr-meta', detail));
      show(nodes);
    }

    function showNotFound() {
      showMessage('No request found', 'Check the tracking code and try again.');
    }

    function showFound(data) {
      lastResult = data;
      var r = data.request;

      var open = el('button', 'tr-open');
      open.type = 'button';
      open.setAttribute('aria-haspopup', 'dialog');
      open.append(el('span', 'tr-code', r.trackingCode), pill(r.status));
      open.addEventListener('click', openModal);

      show([open, el('p', 'tr-meta')]);
    }

    function openModal() {
      if (!lastResult) return;
      var r = lastResult.request;
      var latest = r.latestUpdate;

      $('trackModalTitle').textContent = r.trackingCode;
      $('tmStatus').replaceChildren(pill(r.status), el('span', 'cat', r.category));
      $('tmSubmitted').textContent = dateFmt.format(new Date(r.createdAt));
      $('tmResponded').textContent = latest ? dateFmt.format(new Date(latest.createdAt)) : 'N/A';

      var noteText = latest && latest.note ? latest.note :  'No response from the county yet. Please check back soon.';
      $('tmMessage').textContent = noteText;
      $('tmMessage').classList.toggle('is-empty', !latest || !latest.note);

      if (!modal.open) modal.showModal();
    }

    function closeModal() { if (modal.open) modal.close(); }
    $('trackModalClose').addEventListener('click', closeModal);
    $('trackModalDone').addEventListener('click', closeModal);
    modal.addEventListener('click', function (e) { if (e.target === modal) closeModal(); }); 


    function search(value) {
      var code = normalise(value);
      if (!code) {
        return showMessage('Enter the tracking code...');
      }

      var mine = ++ticket;
      showMessage('searching…');

      fetch('/api/service-requests/track/' + encodeURIComponent(code), { credentials: 'same-origin' })
        .then(function (res) {
          return res.json().catch(function () { return {}; }).then(function (data) {
            return { ok: res.ok, status: res.status, data: data };
          });
        })
        .then(function (r) {
          if (mine !== ticket) return;
          if (r.ok) return showFound(r.data);
          if (r.status === 404) return showNotFound();
          showMessage(r.data.error || 'Something went wrong. Please try again.');
        })
        .catch(function () {
          if (mine === ticket) showMessage('Cannot reach the server', 'Check your connection and try again.');
        });
    }

    // Results appear as soon as a full code has been typed or pasted.
    input.addEventListener('input', function () {
      clearTimeout(timer);
      if (!input.value.trim()) return reset();
      if (!normalise(input.value)) return reset(); // still typing a partial code
      timer = setTimeout(function () { search(input.value); }, 350);
    });

    // Enter searches right away, and explains what is wrong with an incomplete code.
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      clearTimeout(timer);
      if (!input.value.trim()) return reset();
      search(input.value);
    });

    input.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') { input.value = ''; reset(); }
    });
    
    document.addEventListener('click', function (e) {
      if (!form.contains(e.target)) hideBox();
    });
    input.addEventListener('focus', function () {
      if (box.childNodes.length) box.hidden = false;
    });

  })();

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

    const loadingCard = document.createElement('article');
    loadingCard.className = 'about-card';
    loadingCard.style.cssText = 'grid-column:1/-1;text-align:center;padding:3rem;';

    const loadingIcon = document.createElement('span');
    loadingIcon.className = 'material-symbols-outlined';
    loadingIcon.style.cssText = 'font-size:3rem;color:var(--green);animation:spin 1s linear infinite;';
    loadingIcon.textContent = 'progress_activity';

    const loadingTitle = document.createElement('h3');
    loadingTitle.style.marginTop = '1rem';
    loadingTitle.textContent = 'Loading your requests...';

    loadingCard.append(loadingIcon, loadingTitle);
    trackContainer.replaceChildren(loadingCard);

    try {
      const res = await fetch('/api/service-requests/me', { 
        method: 'GET',
        credentials: 'include'
      });

      if (!res.ok) throw new Error('Failed to fetch requests');

      const data = await res.json();
      const requests = data.requests;

      if (!Array.isArray(requests)) throw new Error('Invalid requests response');

      if (requests.length === 0) {
        const emptyCard = document.createElement('article');
        emptyCard.className = 'about-card';
        emptyCard.style.cssText = 'grid-column:1/-1;text-align:center;';

        const emptyIcon = document.createElement('span');
        emptyIcon.className = 'about-icon';

        const emptyIconSymbol = document.createElement('span');
        emptyIconSymbol.className = 'material-symbols-outlined';
        emptyIconSymbol.setAttribute('aria-hidden', 'true');
        emptyIconSymbol.textContent = 'inbox';
        emptyIcon.append(emptyIconSymbol);

        const emptyTitle = document.createElement('h3');
        emptyTitle.textContent = 'No Active Requests';

        const emptyMessage = document.createElement('p');
        emptyMessage.textContent =
          'You currently have no service requests in progress. Submit a new request to get started.';

        const submitLink = document.createElement('a');
        submitLink.href = '#request';
        submitLink.className = 'primary-button main-button';
        submitLink.style.cssText = 'margin-top:1rem;text-decoration:underline;display:inline-block;';
        submitLink.textContent = 'Submit New Request';

        emptyCard.append(emptyIcon, emptyTitle, emptyMessage, submitLink);
        trackContainer.replaceChildren(emptyCard);
        return;
      }

      const statusConfig = {
        pending: { label: 'Pending', color: '#d97706', icon: 'pending_actions' },
        'in-progress': { label: 'In Progress', color: '#2563eb', icon: 'settings_motion_mode' },
        resolved: { label: 'Resolved', color: '#16a34a', icon: 'check_circle' }
      };
      const cards = requests.map(req => {
        const statusKey = String(req.status || 'Pending').toLowerCase().replace(/\s+/g, '-');
        const status = statusConfig[statusKey] || statusConfig.pending;
        const date = new Date(req.createdAt).toLocaleDateString('en-KE', {
          year: 'numeric',
          month: 'short',
          day: 'numeric'
        });

        const card = document.createElement('article');
        card.className = 'about-card';
        card.dataset.status = statusKey;
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

        const trackingCode = document.createElement('p');
        trackingCode.textContent = `Tracking code: ${req.trackingCode}`;

        const response = document.createElement('p');
        response.textContent = req.latestUpdate
          ? `Message from the county: ${req.latestUpdate.note}`
          : 'No update from the county yet.';

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
        card.append(badge, title, trackingCode, description, details, response);

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