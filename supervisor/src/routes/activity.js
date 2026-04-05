const { Router } = require('express');
const db = require('../db');

const router = Router();

// GET /api/activity?limit=50&site_id=...
router.get('/', (req, res) => {
  const limit = Math.min(Number(req.query.limit) || 50, 200);
  const siteId = req.query.site_id;

  const rows = siteId
    ? db.prepare(
        'SELECT * FROM activity WHERE site_id = ? ORDER BY created_at DESC LIMIT ?'
      ).all(siteId, limit)
    : db.prepare(
        'SELECT * FROM activity ORDER BY created_at DESC LIMIT ?'
      ).all(limit);

  res.json(rows);
});

module.exports = router;
