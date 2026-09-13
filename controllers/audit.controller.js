const pool = require('../config/db');

exports.getDeletionLogs = async (req, res, next) => {
  try {
    const [rows] = await pool.query('SELECT * FROM deletion_logs ORDER BY created_at DESC');
    res.json(rows);
  } catch (err) { next(err); }
};