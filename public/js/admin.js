/**
 * Admin dashboard: stats, request list, details and status updates.
 * User-supplied text is always inserted with textContent to prevent HTML injection attacks.
 */
(function () {
  'use strict';

  const NEXT_STATUS = { Pending: 'In Progress', 'In Progress': 'Resolved' };
  const STATUS_CLASS = { Pending: 'pending', 'In Progress': 'progress', Resolved: 'resolved' };
  const PAGES = {
    dashboard: ['Dashboard', 'Overview of all service requests'],
    requests: ['Requests', 'Review requests and update their status'],
  };

  const $ = (selector) => document.querySelector(selector);
  const $$ = (selector) => Array.from(document.querySelectorAll(selector));

  const state = {
    page: 1,
    pages: 1,
    total: 0,
    filters: { q: '', status: '', category: '' },
    requests: [],
    updating: null,
    ticket: 0,     
  };

  /* ---------- helpers ---------- */

  /** Tiny element builder. Strings become text nodes, so nothing is parsed as HTML. */
  // function h(tag, attrs, ...children) {
  //   const node = document.createElement(tag);
  //   for (const [key, value] of Object.entries(attrs || {})) {
  //     if (value == null || value === false) continue;
  //     if (key === 'class') node.className = value;
  //     else if (key === 'style') Object.entries(value).forEach(([p, v]) => node.style.setProperty(p, v));
  //     else node.setAttribute(key, value === true ? '' : value);
  //   }
  //   for (const child of children.flat()) {
  //     if (child == null || child === false) continue;
  //     node.append(child);
  //   }
  //   return node;
  // }

  const icon = (name) => h('span', { class: 'material-symbols-outlined icon', 'aria-hidden': 'true' }, name);
  const pill = (status) => h('span', { class: `pill pill-${STATUS_CLASS[status]}` }, status);
  const percent = (part, whole) => (whole ? Math.round((part / whole) * 100) : 0);

  const dateFmt = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  const dateTimeFmt = new Intl.DateTimeFormat('en-GB', {
    day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
  });
  const fmtDate = (iso) => dateFmt.format(new Date(iso));
  const fmtDateTime = (iso) => dateTimeFmt.format(new Date(iso));

  function timeAgo(iso) {
    const seconds = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
    if (seconds < 60) return 'just now';
    const minutes = seconds / 60;
    if (minutes < 60) return `${Math.floor(minutes)} min ago`;
    const hours = minutes / 60;
    if (hours < 24) return `${Math.floor(hours)} h ago`;
    const days = hours / 24;
    return days < 30 ? `${Math.floor(days)} d ago` : fmtDate(iso);
  }

  async function api(url, options = {}) {
    const res = await fetch(url, {
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      ...options,
    });
    const data = await res.json().catch(() => ({}));

    if (res.status === 401 || res.status === 403) {
      location.replace(res.status === 401 ? '../html/login.html' : '../html/admin.html');
      const err = new Error('Redirecting');
      err.handled = true;
      throw err;
    }
    if (!res.ok) throw new Error(data.error || 'Something went wrong. Please try again.');
    return data;
  }

  let toastTimer;
  function toast(message) {
    const el = $('#toast');
    el.textContent = message;
    el.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove('show'), 3200);
  }

  /* ---------- dashboard ---------- */

  function renderMetrics(s) {
    const cards = [
      ['inbox', 'Total requests', s.total, 'All time'],
      ['hourglass_empty', 'Pending', s.byStatus.Pending, 'Waiting for action'],
      ['engineering', 'In progress', s.byStatus['In Progress'], 'Being worked on'],
      ['task_alt', 'Resolved', s.resolved, `${percent(s.resolved, s.total)}% of all requests`],
    ];
    $('#metrics').replaceChildren(
      ...cards.map(([name, label, value, sub]) =>
        h('div', { class: 'metric' },
          h('div', { class: 'metric-icon' }, icon(name)),
          h('div', {},
            h('div', { class: 'metric-value' }, value),
            h('div', { class: 'metric-label' }, label),
            h('div', { class: 'metric-sub' }, sub)))
      )
    );
  }

  function renderOpenResolved(s) {
    const resolvedPct = percent(s.resolved, s.total);
    const donut = h('div', {
      class: s.total ? 'donut' : 'donut donut--empty',
      role: 'img',
      'aria-label': `${resolvedPct}% of requests resolved`,
      style: { '--p': resolvedPct },
    },
      h('div', { class: 'donut-center' }, h('strong', {}, `${resolvedPct}%`), h('span', {}, 'resolved')));

    const legend = h('div', { class: 'split-legend' },
      h('div', {}, h('span', { class: 'dot dot-open' }), h('strong', {}, s.open), 'open'),
      h('div', {}, h('span', { class: 'dot dot-resolved' }), h('strong', {}, s.resolved), 'resolved'));

    $('#openResolved').replaceChildren(donut, legend);
  }

  function renderTrend(trend) {
    const max = Math.max(1, ...trend.map((t) => t.count));
    $('#trend').replaceChildren(
      ...trend.map((t) =>
        h('div', { class: 'trend-col' },
          h('span', { class: 'trend-count' }, t.count),
          h('div', {
            class: 'trend-bar',
            style: { height: `${t.count ? Math.max(4, (t.count / max) * 100) : 0}%` },
            title: `${t.label}: ${t.count}`,
          }),
          h('span', { class: 'trend-label' }, t.label))
      )
    );
  }

  function renderCategories(list) {
    const sorted = [...list].sort((a, b) => b.total - a.total);
    const max = Math.max(1, ...sorted.map((c) => c.total));
    $('#categoryList').replaceChildren(
      ...sorted.map((c) =>
        h('div', {},
          h('div', { class: 'bar-row-head' },
            h('span', {}, c.category),
            h('span', {}, `${c.total} (${c.open} open)`)),
          h('div', { class: 'bar-track' },
            h('div', { class: 'bar-fill', style: { width: `${(c.total / max) * 100}%` } },
              h('span', { class: 'seg-resolved', style: { flex: c.resolved } }),
              h('span', { class: 'seg-open', style: { flex: c.open } }))))
      )
    );
  }

  function renderActivity(items) {
    const list = $('#activityList');
    if (!items.length) {
      list.replaceChildren(h('li', { class: 'empty' }, 'No activity yet.'));
      return;
    }
    list.replaceChildren(
      ...items.map((a) => {
        const created = a.fromStatus === null;
        const text = created
          ? `${a.actor || 'A citizen'} submitted ${a.trackingCode} (${a.category})`
          : `${a.trackingCode} moved to ${a.toStatus}`;
        return h('li', { class: 'activity-item' },
          h('div', { class: 'activity-icon' }, icon(created ? 'add_circle' : 'sync_alt')),
          h('div', {},
            h('div', { class: 'activity-text' }, text),
            h('div', { class: 'activity-time' }, timeAgo(a.createdAt))));
      })
    );
  }

  function fillCategoryFilter(categories) {
    const select = $('#fCategory');
    if (select.options.length > 1) return;
    categories.forEach((c) => select.append(h('option', { value: c.category }, c.category)));
  }

  async function loadStats() {
    try {
      const s = await api('/api/admin/stats');
      renderMetrics(s);
      renderOpenResolved(s);
      renderTrend(s.trend);
      renderCategories(s.byCategory);
      renderActivity(s.activity);
      fillCategoryFilter(s.byCategory);

      const badge = $('#pendingBadge');
      badge.textContent = s.byStatus.Pending;
      badge.hidden = s.byStatus.Pending === 0;
    } catch (err) {
      if (err.handled) return;
      $('#metrics').replaceChildren(h('p', { class: 'empty' }, err.message));
    }
  }

  /* ---------- requests table ---------- */

  function renderRows(list) {
    const body = $('#requestRows');
    if (!list.length) {
      body.replaceChildren(h('tr', {}, h('td', { colspan: '7', class: 'empty' }, 'No requests match your filters.')));
      return;
    }
    body.replaceChildren(
      ...list.map((r) => {
        const next = NEXT_STATUS[r.status];
        return h('tr', {},
          h('td', { class: 'code' }, r.trackingCode),
          h('td', {},
            h('div', {}, r.citizen.name || 'Guest'),
            h('div', { class: 'cell-sub' }, r.citizen.phone || r.citizen.email || 'No contact details found')),
          h('td', {}, r.category),
          h('td', { class: 'cell-loc' }, r.location),
          h('td', {}, pill(r.status)),
          h('td', { class: 'nowrap' }, fmtDate(r.createdAt)),
          h('td', {},
            h('div', { class: 'row-actions' },
              h('button', { type: 'button', class: 'btn btn-outline btn-sm', 'data-action': 'view', 'data-id': r.id }, 'View'),
              next && h('button', { type: 'button', class: 'btn btn-primary btn-sm', 'data-action': 'update', 'data-id': r.id },
                next === 'Resolved' ? 'Resolve' : 'Start work'))));
      })
    );
  }

  async function loadRequests() {
    const ticket = ++state.ticket;
    const params = new URLSearchParams({ page: state.page });
    Object.entries(state.filters).forEach(([key, value]) => value && params.set(key, value));

    try {
      const data = await api(`/api/admin/requests?${params}`);
      if (ticket !== state.ticket) return;

      state.requests = data.requests;
      state.page = data.page;
      state.pages = data.pages;
      state.total = data.total;

      renderRows(data.requests);
      $('#pagerInfo').textContent = `${data.total} request${data.total === 1 ? '' : 's'} · Page ${data.page} of ${data.pages}`;
      $('#prevPage').disabled = data.page <= 1;
      $('#nextPage').disabled = data.page >= data.pages;
    } catch (err) {
      if (err.handled) return;
      $('#requestRows').replaceChildren(h('tr', {}, h('td', { colspan: '7', class: 'empty' }, err.message)));
    }
  }

  /* ---------- details dialog ---------- */

  const detailsDialog = $('#detailsDialog');
  const statusDialog = $('#statusDialog');

  const detailRow = (label, value) => [h('dt', {}, label), h('dd', {}, value)];

  async function openDetails(id) {
    $('#detailsTitle').textContent = 'Request details';
    $('#detailsBody').replaceChildren(h('p', { class: 'empty' }, 'Loading…'));
    $('#detailsUpdate').hidden = true;
    if (!detailsDialog.open) detailsDialog.showModal();

    try {
      const { request: r, history } = await api(`/api/admin/requests/${id}`);

      $('#detailsTitle').textContent = r.trackingCode;
      const image = r.imagePath && r.imagePath.startsWith('/uploads/')
        ? h('img', { class: 'detail-image', src: r.imagePath, alt: `Photo submitted with request ${r.trackingCode}` })
        : null;

      $('#detailsBody').replaceChildren(
        h('div', { class: 'detail-head' }, pill(r.status), h('span', { class: 'cell-sub' }, `Submitted ${fmtDateTime(r.createdAt)}`)),
        h('dl', { class: 'detail-grid' },
          detailRow('Citizen', r.citizen.name),
          detailRow('Phone', r.citizen.phone || '—'),
          detailRow('Email', r.citizen.email),
          detailRow('Category', r.category),
          detailRow('Location', r.location),
          detailRow('Last updated', fmtDateTime(r.updatedAt)),
          detailRow('Description', r.description)),
        image,
        h('h3', { class: 'section-title' }, 'History'),
        h('div', { class: 'timeline' },
          history.map((e) =>
            h('div', { class: 'timeline-item' },
              h('strong', {}, e.fromStatus ? `${e.fromStatus} → ${e.toStatus}` : 'Submitted'),
              h('div', { class: 'timeline-meta' }, `${e.actor || 'System'} · ${fmtDateTime(e.createdAt)}`),
              e.note && h('p', { class: 'timeline-note' }, e.note))))
      );

      const updateBtn = $('#detailsUpdate');
      updateBtn.hidden = !NEXT_STATUS[r.status];
      updateBtn.onclick = () => openStatusDialog(r);
    } catch (err) {
      if (err.handled) return;
      $('#detailsBody').replaceChildren(h('p', { class: 'empty' }, err.message));
    }
  }

  /* ---------- status dialog ---------- */

  function openStatusDialog(request) {
    const next = NEXT_STATUS[request.status];
    if (!next) return;

    state.updating = request;
    $('#statusDesc').textContent = `${request.trackingCode} · ${request.category} · ${request.location}`;
    $('#statusMove').replaceChildren(pill(request.status), icon('arrow_forward'), pill(next));
    $('#statusNote').value = '';
    $('#statusError').hidden = true;
    $('#statusSave').disabled = false;
    $('#statusSave').textContent = 'Save status';

    if (!statusDialog.open) statusDialog.showModal();
    $('#statusNote').focus();
  }

  $('#statusForm').addEventListener('submit', async (event) => {
    event.preventDefault();
    const request = state.updating;
    if (!request) return;

    const note = $('#statusNote').value.trim();
    const errorBox = $('#statusError');
    if (note.length < 5) {
      errorBox.textContent = 'Write a short note for the citizen (at least 5 characters).';
      errorBox.hidden = false;
      return $('#statusNote').focus();
    }

    const save = $('#statusSave');
    save.disabled = true;
    save.textContent = 'Saving…';
    errorBox.hidden = true;

    const next = NEXT_STATUS[request.status];
    try {
      await api(`/api/admin/requests/${request.id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status: next, note }),
      });
      statusDialog.close();
      if (detailsDialog.open) detailsDialog.close();
      toast(`${request.trackingCode} is now ${next}`);
      await Promise.all([loadStats(), loadRequests()]);
    } catch (err) {
      if (err.handled) return;
      errorBox.textContent = err.message;
      errorBox.hidden = false;
      save.disabled = false;
      save.textContent = 'Save status';
    }
  });

  /* ---------- events ---------- */

  $('#requestRows').addEventListener('click', (event) => {
    const button = event.target.closest('button[data-action]');
    if (!button) return;
    const id = Number(button.dataset.id);
    if (button.dataset.action === 'view') return openDetails(id);
    const request = state.requests.find((r) => r.id === id);
    if (request) openStatusDialog(request);
  });

  // Filters (search is debounced)
  let searchTimer;
  $('#fSearch').addEventListener('input', (e) => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => {
      state.filters.q = e.target.value.trim();
      state.page = 1;
      loadRequests();
    }, 300);
  });
  $('#fStatus').addEventListener('change', (e) => { state.filters.status = e.target.value; state.page = 1; loadRequests(); });
  $('#fCategory').addEventListener('change', (e) => { state.filters.category = e.target.value; state.page = 1; loadRequests(); });
  $('#filters').addEventListener('submit', (e) => e.preventDefault());

  $('#prevPage').addEventListener('click', () => { if (state.page > 1) { state.page--; loadRequests(); } });
  $('#nextPage').addEventListener('click', () => { if (state.page < state.pages) { state.page++; loadRequests(); } });

  // Dialogs: Close buttons and clicking the dark backdrop
  $$('dialog').forEach((dialog) => {
    dialog.addEventListener('click', (e) => {
      if (e.target === dialog || e.target.closest('[data-close]')) dialog.close();
    });
  });

  // Mobile sidebar
  const shell = $('#shell');
  const menuBtn = $('#menuBtn');
  function setSidebar(open) {
    shell.classList.toggle('sidebar-open', open);
    menuBtn.setAttribute('aria-expanded', String(open));
  }
  menuBtn.addEventListener('click', () => setSidebar(!shell.classList.contains('sidebar-open')));
  $('#sidebarBackdrop').addEventListener('click', () => setSidebar(false));
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') setSidebar(false); });

  $('#signOut').addEventListener('click', async () => {
    try { await api('/api/auth/logout', { method: 'POST' }); } catch (err) { /* leave anyway */ }
    location.assign('login.html');
  });

  /* ---------- routing (#dashboard / #requests) ---------- */

  function route() {
    const page = location.hash === '#requests' ? 'requests' : 'dashboard';

    $$('.page').forEach((p) => p.classList.toggle('active', p.id === `page-${page}`));
    $$('.sb-item').forEach((link) => {
      const active = link.dataset.page === page;
      link.classList.toggle('active', active);
      if (active) link.setAttribute('aria-current', 'page');
      else link.removeAttribute('aria-current');
    });

    $('#pageTitle').textContent = PAGES[page][0];
    $('#pageSubtitle').textContent = PAGES[page][1];
    document.title = `${PAGES[page][0]} | Admin | Murang'a County Public Services`;

    setSidebar(false);
    if (page === 'requests') loadRequests();
  }
  window.addEventListener('hashchange', route);

  /* ---------- start ---------- */

  async function init() {
    try {
      const me = await api('/api/auth/me');
      if (me.user.role !== 'admin') return location.replace(me.redirect);

      $('#userName').textContent = me.user.name;
      $('#userInitials').textContent = me.user.name
        .split(/\s+/).slice(0, 2).map((w) => w[0]).join('').toUpperCase();
    } catch (err) {
      return; // api() already redirected to the login page
    }
    route();
    loadStats();
  }

  init();
})();