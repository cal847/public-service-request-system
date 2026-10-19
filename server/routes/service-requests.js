const express = require('express');
const db = require('../db');
const { requireAuth } = require('../middleware/auth');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const multer = require('multer');
const rateLimit = require('express-rate-limit');
const { CATEGORIES } = require('../utils/constants');
const { generateTrackingCode } = require('../utils/tracking');
const { request } = require('http');

const router = express.Router();

/* ---------- Uploads ---------- */
const UPLOAD_DIR = path.join(__dirname, '..', 'uploads');
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const IMAGE_TYPES = { 'image/jpeg': '.jpg', 'image/png': '.png', 'image/webp': '.webp' };

const upload = multer({
  storage: multer.diskStorage({
    destination: UPLOAD_DIR,
    filename: (req, file, cb) =>
      cb(null, crypto.randomBytes(16).toString('hex') + IMAGE_TYPES[file.mimetype]),
  }),
  limits: { fileSize: MAX_IMAGE_BYTES, files: 1, fields: 6 },
  fileFilter: (req, file, cb) => {
    if (!IMAGE_TYPES[file.mimetype]) {
      const err = new Error('Only JPG, PNG or WebP images are allowed.');
      err.code = 'BAD_TYPE';
      return cb(err);
    }
    cb(null, true);
  },
});

function looksLikeImage(filePath, mimetype) {
  const buf = Buffer.alloc(12);
  const fd = fs.openSync(filePath, 'r');
  try {
    fs.readSync(fd, buf, 0, 12, 0);
  } finally {
    fs.closeSync(fd);
  }
  if (mimetype === 'image/jpeg') return buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff;
  if (mimetype === 'image/png') {
    return buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
  }
  if (mimetype === 'image/webp') {
    return buf.toString('ascii', 0, 4) === 'RIFF' && buf.toString('ascii', 8, 12) === 'WEBP';
  }
  return false;
}

const removeFile = (filePath) => fs.unlink(filePath, () => {});

// Turns multer errors into JSON the form can display. 
function handleUpload(req, res, next) {
  upload.single('image')(req, res, (err) => {
    if (!err) return next();

    let message = null;
    if (err.code === 'LIMIT_FILE_SIZE') message = 'The photo is too large. Maximum size is 5 MB.';
    else if (err.code === 'BAD_TYPE') message = err.message;
    else if (err instanceof multer.MulterError) message = 'Could not read the upload. Try a different photo.';

    if (!message) {
      console.error(err);
      return res.status(500).json({ error: 'Something went wrong. Please try again.' });
    }
    res.status(400).json({ errors: { image: message } });
  });
}

const iso = (col) => `strftime('%Y-%m-%dT%H:%M:%SZ', ${col})`;

const mapRequest = (r) => ({
  trackingCode: r.tracking_code,
  category: r.category,
  location: r.location,
  description: r.description,
  status: r.status,
  createdAt: r.created_at,
  updatedAt: r.updated_at,
});

// 10 submissions per hour per signed-in user.
const submitLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'You have submitted several requests recently. Please try again later.' },
});

/* ---------- POST /api/service-requests (multipart/form-data) ---------- */
router.post('/', submitLimiter, handleUpload, (req, res) => {
  const file = req.file;

  const category = String(req.body.category || '').trim();
  const location = String(req.body.location || '').trim().replace(/\s+/g, ' ');
  const description = String(req.body.description || '').trim();

  const errors = {};
  if (!CATEGORIES.includes(category)) errors.category = 'Choose a category.';
  if (location.length < 3 || location.length > 120) {
    errors.location = 'Enter the location (3 to 120 characters).';
  }
  if (description.length < 10 || description.length > 1000) {
    errors.description = 'Describe the issue in 10 to 1000 characters.';
  }
  if (file && !looksLikeImage(file.path, file.mimetype)) {
    errors.image = 'That file is not a valid image.';
  }

  if (Object.keys(errors).length) {
    if (file) removeFile(file.path);
    return res.status(400).json({ errors });
  }

  try {
    const userId = req.session.user ? req.session.user.id : null;

    const created = db.transaction(() => {
      const info = db
        .prepare(
          `INSERT INTO requests (tracking_code, user_id, category, location, description, image_path)
           VALUES (?, ?, ?, ?, ?, ?)`
        )
        .run(
          generateTrackingCode(db), userId, category, location, description,
          file ? `/uploads/${file.filename}` : null
        );

      db.prepare(
        `INSERT INTO request_history (request_id, from_status, to_status, note, changed_by)
         VALUES (?, NULL, 'Pending', 'Request submitted.', ?)`
      ).run(info.lastInsertRowid, userId);

      return db
        .prepare(
          `SELECT tracking_code, category, location, description, status,
                  ${iso('created_at')} AS created_at, ${iso('updated_at')} AS updated_at
             FROM requests WHERE id = ?`
        )
        .get(info.lastInsertRowid);
    })();

    res.status(201).json({ request: mapRequest(created) });
  } catch (err) {
    if (file) removeFile(file.path);
    console.error(err);
    res.status(500).json({ error: 'Could not save your request. Please try again.' });
  }
});

/* ---------- GET /api/service-request/me -> the signed-in citizen's own requests ---------- */
router.get('/me', requireAuth, (req, res) => {
  const rows = db
    .prepare(
      `SELECT tracking_code, category, location, description, status,
              ${iso('created_at')} AS created_at, ${iso('updated_at')} AS updated_at
         FROM requests
        WHERE user_id = ?
        ORDER BY created_at DESC, id DESC`
    )
    .all(req.session.user.id);

  res.json({ requests: rows.map(mapRequest), count: rows.length });
});

module.exports = router;
