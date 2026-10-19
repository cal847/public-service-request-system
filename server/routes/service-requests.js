const express = require('express');
const db = require('../db');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

/* GET /api/service-request/me -> requests belonging to the signed-in user */
router.get('/me', requireAuth, (req, res) => {
  const requests = db
    .prepare(
      `SELECT id, tracking_code, category, location, description, image_path,
              CASE status
                WHEN 'Pending' THEN 'pending'
                WHEN 'In Progress' THEN 'in-progress'
                WHEN 'Resolved' THEN 'resolved'
              END AS status,
              strftime('%Y-%m-%dT%H:%M:%SZ', created_at) AS created_at,
              strftime('%Y-%m-%dT%H:%M:%SZ', updated_at) AS updated_at
         FROM requests
        WHERE user_id = ?
        ORDER BY created_at DESC, id DESC`
    )
    .all(req.session.user.id);

  res.json(requests);
});

module.exports = router;
