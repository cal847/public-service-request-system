const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');
const bcrypt = require('bcryptjs');

const dataDir = path.join(__dirname, 'data');
fs.mkdirSync(dataDir, { recursive: true });

const db = new Database(path.join(dataDir, 'app.db'));
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// Create user and service request tables
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    name          TEXT NOT NULL,
    email         TEXT NOT NULL UNIQUE,
    phone         TEXT UNIQUE,
    id_number     TEXT UNIQUE,
    password_hash TEXT NOT NULL,
    role          TEXT NOT NULL DEFAULT 'citizen' CHECK (role IN ('citizen', 'admin')),
    failed_attempts INTEGER NOT NULL DEFAULT 0,
    locked_at       TEXT,  
    created_at    TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS requests (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    tracking_code TEXT NOT NULL UNIQUE,  -- e.g. MRG-2026-A7K3QP (generated in the next step)
    user_id       INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    category      TEXT NOT NULL,
    location      TEXT NOT NULL,
    description   TEXT NOT NULL,
    image_path    TEXT,
    status        TEXT NOT NULL DEFAULT 'Pending'
                  CHECK (status IN ('Pending', 'In Progress', 'Resolved')),
    created_at    TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at    TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE INDEX IF NOT EXISTS idx_requests_user   ON requests(user_id);
  CREATE INDEX IF NOT EXISTS idx_requests_status ON requests(status);
`);

// Seed an admin account
function seedAdmin() {
  const exists = db.prepare("SELECT 1 FROM users WHERE role = 'admin'").get();
  if (exists) return;

  const email = (process.env.ADMIN_EMAIL || 'admin@muranga.go.ke').toLowerCase();
  const password = process.env.ADMIN_PASSWORD || 'service_request_admin';

  db.prepare(
    "INSERT INTO users (name, email, password_hash, role) VALUES (? , ?, ?, 'admin')"
  ).run('System Admin', email, bcrypt.hashSync(password, 12));

  console.log(`Seeded admin account: ${email}`);
}
seedAdmin();

module.exports = db;