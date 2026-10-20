/**
 * Auth router: it defines the authentication API endpoints. They include:
 * 1. POST /api/auth/register -> user registration
 * 2. POST /api/auth/login  -> login endpoint
 * 3. POST /api/auth/logout -> logs out users
 * 4. GET /api/auth/me -> shows a citizen's account plus thei service requests
 */

const express = require('express');
const bcrypt = require('bcryptjs');
const rateLimit = require('express-rate-limit');

const db = require('../db');
const { requireAuth } = require('../middleware/auth');
const { normalisePhone, validateRegistration } = require('../utils/validators');

const router = express.Router();

// Limits sign in attempts to a maximum 5 attempts per 15 minutes per IP
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many attempts. Please try again in 15 minutes.' },
});

// Limits to 3 login attempts, after which account is locked and unlocks in 1hr
const MAX_ADMIN_ATTEMPTS = 3;
const LOCKED_MESSAGE = 'This account has been locked after too many failed attempts. Please contact support for account recovery.';
const LOCK_DURATION_MS = 60 * 60 * 1000;

const DUMMY_HASH = bcrypt.hashSync('not-a-real-password', 12);

const homeFor = (role) => (role === 'admin' ? '../html/admin.html' : '../html/index.html');

const publicUser = (u) => ({
  id: u.id, name: u.name, email: u.email, phone: u.phone, role: u.role, createdAt: u.created_at,
});

const exists = (column, value) =>
  !!db.prepare(`SELECT 1 FROM users WHERE ${column} = ?`).get(value);

function startSession(req, res, user, status = 200) {
  req.session.regenerate((err) => {
    if (err) return res.status(500).json({ error: 'Could not start a session.' });
    req.session.user = { id: user.id, name: user.name, role: user.role };
    res.status(status).json({ user: publicUser(user), redirect: homeFor(user.role) });
  });
}

function recordAdminFailure(userId) {
  db.prepare(
    `UPDATE users
        SET failed_attempts = failed_attempts + 1,
            locked_at = CASE WHEN failed_attempts + 1 >= ? THEN datetime('now') ELSE locked_at END
      WHERE id = ?`
  ).run(MAX_ADMIN_ATTEMPTS, userId);

  return !!db.prepare('SELECT locked_at FROM users WHERE id = ?').get(userId).locked_at;
}

function lockMinutesLeft(user) {
  if (!user.locked_at) return 0;
  const lockedAt = new Date(user.locked_at.replace(' ', 'T') + 'Z').getTime();
  const msLeft = lockedAt + LOCK_DURATION_MS - Date.now();
  return msLeft > 0 ? Math.ceil(msLeft / 60000) : 0;
}

/* POST /api/auth/register */
router.post('/register', limiter, (req, res) => {
  const { errors, values } = validateRegistration(req.body);
  if (Object.keys(errors).length) return res.status(400).json({ errors });

  const taken = {};
  if (exists('email', values.email)) taken.email = 'An account with this email already exists.';
  if (exists('phone', values.phone)) taken.phone = 'This phone number is already registered.';
  if (exists('id_number', values.idNumber)) taken.idNumber = 'This ID number is already registered.';
  if (Object.keys(taken).length) return res.status(409).json({ errors: taken });

  try {
    const hash = bcrypt.hashSync(values.password, 12);
    const info = db
      .prepare(
        `INSERT INTO users (name, email, phone, id_number, password_hash)
         VALUES (?, ?, ?, ?, ?)`
      )
      .run(values.name, values.email, values.phone, values.idNumber, hash);

    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(info.lastInsertRowid);
    startSession(req, res, user, 201);
  } catch (err) {
    if (err.code === 'SQLITE_CONSTRAINT_UNIQUE') {
      return res.status(409).json({ errors: { email: 'An account with these details already exists.' } });
    }
    console.error(err);
    res.status(500).json({ error: 'Something went wrong. Please try again.' });
  }
});

/* POST /api/auth/login */
router.post('/login', limiter, async (req, res) => {
  const identifier = String(req.body.identifier || '').trim();
  const password = String(req.body.password || '');
  if (!identifier || !password) {
    return res.status(400).json({ error: 'Enter your email or phone number and your password.' });
  }

  let user = null;
  if (identifier.includes('@')) {
    user = db.prepare('SELECT * FROM users WHERE email = ?').get(identifier.toLowerCase());
  } else {
    const phone = normalisePhone(identifier);
    if (phone) user = db.prepare('SELECT * FROM users WHERE phone = ?').get(phone);
  }

  const isAdmin = !!user && user.role === 'admin';

  // A locked admin account stays locked, even for the correct password.
  if (isAdmin && user.locked_at) {
    const minutes = lockMinutesLeft(user);

    // Still locked: refuse, even for the correct password.
    if (minutes > 0) return res.status(423).json({ error: lockedMessage(minutes) });

    // Clears the lock after the hour finishes
    db.prepare('UPDATE users SET failed_attempts = 0, locked_at = NULL WHERE id = ?').run(user.id);
    user.failed_attempts = 0;
    user.locked_at = null;
  }

  const ok = await bcrypt.compare(password, user ? user.password_hash : DUMMY_HASH);
  if (!user || !ok) {
    return res.status(401).json({ error: 'Incorrect email/phone number or password.' });
  }

  // Successful admin sign-in clears earlier failed attempts.
  if (isAdmin && user.failed_attempts > 0) {
    db.prepare('UPDATE users SET failed_attempts = 0 WHERE id = ?').run(user.id);
  }

  startSession(req, res, user);
});

/* POST /api/auth/logout */
router.post('/logout', (req, res) => {
  req.session.destroy(() => {
    res.clearCookie('connect.sid');
    res.json({ ok: true });
  });
});

/* GET /api/auth/me -> signed-in user (+ request count for citizens) */
router.get('/me', requireAuth, (req, res) => {
  const { id, role } = req.session.user;
  const user = db
    .prepare('SELECT id, name, email, phone, role, created_at FROM users WHERE id = ?')
    .get(id);

  if (!user) {
    return req.session.destroy(() => res.status(401).json({ error: 'Please sign in.' }));
  }

  const body = { user: publicUser(user), redirect: homeFor(role) };
  if (role === 'citizen') {
    body.requestCount = db
      .prepare('SELECT COUNT(*) AS n FROM requests WHERE user_id = ?')
      .get(id).n;
  }
  res.json(body);
});

module.exports = router;