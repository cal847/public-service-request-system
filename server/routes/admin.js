/**
 * Admin route. Defines the following API endpoints:
 * 1. GET api/admin/stats -> computes and returns performance statistics
 * 2. GET /api/admin/requests?status=&category=&q=&page= -> returns user service requests on the admin dashboard
 * 3. GET /api/admin/requests/:id -> returns a single request's information
 * 4. PATCH /api/admin/requests/:id/status -> updates services status and response
 */
const express = require('express');
const db = require('../db');
const { requireAdmin } = require('../middleware/auth');
const { CATEGORIES, STATUSES, NEXT_STATUS } = require('../utils/constants');

const router = express.Router();
router.use(requireAdmin); // every route below is admin-only

const PAGE_SIZE = 15;

// Converts UTC(YYYY-MM-DD HH:MM:SS) format to ISO
const iso = (col) => `strftime('%Y-%m-%dT%H:%M:%SZ', ${col})`;

const REQUEST_SELECT = `
  SELECT r.id, r.tracking_code, r.category, r.location, r.description, r.image_path, r.status,
         ${iso('r.created_at')} AS created_at, ${iso('r.updated_at')} AS updated_at,
         u.name AS citizen_name, u.email AS citizen_email, u.phone AS citizen_phone
    FROM requests r
    LEFT JOIN users u ON u.id = r.user_id`;

const mapRequest = (r) => ({
  id: r.id,
  trackingCode: r.tracking_code,
  category: r.category,
  location: r.location,
  description: r.description,
  imagePath: r.image_path,
  status: r.status,
  createdAt: r.created_at,
  updatedAt: r.updated_at,
  citizen: { name: r.citizen_name, email: r.citizen_email, phone: r.citizen_phone },
});

const parseId = (value) => {
  const id = Number.parseInt(value, 10);
  return Number.isInteger(id) && id > 0 ? id : null;
};

/* GET /api/admin/stats */
router.get('/stats', (req, res) => {
  const byStatus = Object.fromEntries(STATUSES.map((s) => [s, 0]));
  db.prepare('SELECT status, COUNT(*) AS n FROM requests GROUP BY status')
    .all()
    .forEach((row) => { byStatus[row.status] = row.n; });

  const total = STATUSES.reduce((sum, s) => sum + byStatus[s], 0);
  const resolved = byStatus.Resolved;

  const categoryRows = db
    .prepare(
      `SELECT category, COUNT(*) AS total,
              SUM(CASE WHEN status = 'Resolved' THEN 1 ELSE 0 END) AS resolved
         FROM requests GROUP BY category`
    )
    .all();
  const byCategory = CATEGORIES.map((category) => {
    const row = categoryRows.find((r) => r.category === category);
    const t = row ? row.total : 0;
    const done = row ? row.resolved : 0;
    return { category, total: t, resolved: done, open: t - done };
  });

  const monthRows = db
    .prepare(
      `SELECT strftime('%Y-%m', created_at) AS month, COUNT(*) AS n
         FROM requests
        WHERE created_at >= date('now', 'start of month', '-5 months')
        GROUP BY month`
    )
    .all();
  const monthCounts = Object.fromEntries(monthRows.map((r) => [r.month, r.n]));
  const now = new Date();
  const trend = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1));
    const key = d.toISOString().slice(0, 7);
    trend.push({
      month: key,
      label: d.toLocaleString('en-GB', { month: 'short', timeZone: 'UTC' }),
      count: monthCounts[key] || 0,
    });
  }

  const activity = db
    .prepare(
      `SELECT h.id, h.from_status, h.to_status, ${iso('h.created_at')} AS created_at,
              r.tracking_code, r.category, u.name AS actor
         FROM request_history h
         JOIN requests r ON r.id = h.request_id
         LEFT JOIN users u ON u.id = h.changed_by
        ORDER BY h.id DESC
        LIMIT 8`
    )
    .all()
    .map((a) => ({
      id: a.id,
      fromStatus: a.from_status,
      toStatus: a.to_status,
      createdAt: a.created_at,
      trackingCode: a.tracking_code,
      category: a.category,
      actor: a.actor,
    }));

  res.json({ total, open: total - resolved, resolved, byStatus, byCategory, trend, activity });
});

/* GET /api/admin/requests?status=&category=&q=&page= */
router.get('/requests', (req, res) => {
  const { status, category } = req.query;
  const q = String(req.query.q || '').trim().slice(0, 100);

  const where = [];
  const params = [];

  if (STATUSES.includes(status)) { where.push('r.status = ?'); params.push(status); }
  if (CATEGORIES.includes(category)) { where.push('r.category = ?'); params.push(category); }
  if (q) {
    const like = `%${q.replace(/[\\%_]/g, '\\$&')}%`;
    where.push(
      `(r.tracking_code LIKE ? ESCAPE '\\' OR u.name LIKE ? ESCAPE '\\'
        OR r.location LIKE ? ESCAPE '\\' OR r.description LIKE ? ESCAPE '\\')`
    );
    params.push(like, like, like, like);
  }
  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';

  const total = db
    .prepare(`SELECT COUNT(*) AS n FROM requests r LEFT JOIN users u ON u.id = r.user_id ${whereSql}`)
    .get(...params).n;

  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const page = Math.min(Math.max(1, Number.parseInt(req.query.page, 10) || 1), pages);

  const rows = db
    .prepare(`${REQUEST_SELECT} ${whereSql} ORDER BY r.created_at DESC, r.id DESC LIMIT ? OFFSET ?`)
    .all(...params, PAGE_SIZE, (page - 1) * PAGE_SIZE);

  res.json({ requests: rows.map(mapRequest), total, page, pages });
});

/* GET /api/admin/requests/:id -> one request + its status history */
router.get('/requests/:id', (req, res) => {
  const id = parseId(req.params.id);
  if (!id) return res.status(400).json({ error: 'Invalid request id.' });

  const row = db.prepare(`${REQUEST_SELECT} WHERE r.id = ?`).get(id);
  if (!row) return res.status(404).json({ error: 'Request not found.' });

  const history = db
    .prepare(
      `SELECT h.from_status, h.to_status, h.note, ${iso('h.created_at')} AS created_at, u.name AS actor
         FROM request_history h
         LEFT JOIN users u ON u.id = h.changed_by
        WHERE h.request_id = ?
        ORDER BY h.id`
    )
    .all(id)
    .map((h) => ({
      fromStatus: h.from_status,
      toStatus: h.to_status,
      note: h.note,
      createdAt: h.created_at,
      actor: h.actor,
    }));

  res.json({ request: mapRequest(row), history });
});

/* PATCH /api/admin/requests/:id/status  { status, note } */
router.patch('/requests/:id/status', (req, res) => {
  const id = parseId(req.params.id);
  if (!id) return res.status(400).json({ error: 'Invalid request id.' });

  const current = db.prepare('SELECT id, status FROM requests WHERE id = ?').get(id);
  if (!current) return res.status(404).json({ error: 'Request not found.' });

  const next = NEXT_STATUS[current.status];
  if (!next) return res.status(409).json({ error: 'This request is already resolved.' });

  if (req.body.status !== next) {
    return res.status(400).json({ error: `Status can only move from ${current.status} to ${next}.` });
  }

  const note = String(req.body.note || '').trim();
  if (note.length < 5 || note.length > 500) {
    return res.status(400).json({ error: 'Add a note for the citizen (5 to 500 characters).' });
  }

  db.transaction(() => {
    db.prepare("UPDATE requests SET status = ?, updated_at = datetime('now') WHERE id = ?").run(next, id);
    db.prepare(
      'INSERT INTO request_history (request_id, from_status, to_status, note, changed_by) VALUES (?, ?, ?, ?, ?)'
    ).run(id, current.status, next, note, req.session.user.id);
  })();

  res.json({ request: mapRequest(db.prepare(`${REQUEST_SELECT} WHERE r.id = ?`).get(id)) });
});

module.exports = router;