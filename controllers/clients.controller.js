const pool = require('../config/db');

exports.getClients = async (req, res, next) => {
  try {
    const [rows] = await pool.query('SELECT * FROM clients ORDER BY name ASC');
    res.json(rows);
  } catch (err) { next(err); }
};

exports.createClient = async (req, res, next) => {
  try {
    const { name, cnic, phone, email, address } = req.body;
    if (!name) return res.status(400).json({ error: 'Client name is required.' });

    const cnicDigits = (cnic || '').replace(/\D/g, '');
    if (cnicDigits.length !== 13) {
      return res.status(400).json({ error: 'ID card number (CNIC) must be exactly 13 digits.' });
    }

    const [existing] = await pool.query('SELECT id FROM clients WHERE cnic = ?', [cnicDigits]);
    if (existing.length) {
      return res.status(409).json({ error: 'This ID card number is already registered to another client.' });
    }

    const [result] = await pool.query(
      `INSERT INTO clients (name, cnic, phone, email, address) VALUES (?, ?, ?, ?, ?)`,
      [name, cnicDigits, phone || '', email || '', address || '']
    );
    const [newClient] = await pool.query('SELECT * FROM clients WHERE id = ?', [result.insertId]);
    res.status(201).json(newClient[0]);
  } catch (err) { next(err); }
};

exports.updateClient = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { name, cnic, phone, email, address } = req.body;

    const cnicDigits = (cnic || '').replace(/\D/g, '');
    if (cnicDigits.length !== 13) {
      return res.status(400).json({ error: 'ID card number (CNIC) must be exactly 13 digits.' });
    }

    const [existing] = await pool.query('SELECT id FROM clients WHERE cnic = ? AND id != ?', [cnicDigits, id]);
    if (existing.length) {
      return res.status(409).json({ error: 'This ID card number is already registered to another client.' });
    }

    await pool.query(
      `UPDATE clients SET name=?, cnic=?, phone=?, email=?, address=? WHERE id=?`,
      [name, cnicDigits, phone, email, address, id]
    );
    const [updated] = await pool.query('SELECT * FROM clients WHERE id = ?', [id]);
    if (!updated.length) return res.status(404).json({ error: 'Client not found.' });
    res.json(updated[0]);
  } catch (err) { next(err); }
};

exports.deleteClient = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { role, note } = req.body || {};

    const [rows] = await pool.query('SELECT name FROM clients WHERE id = ?', [id]);
    const clientName = rows.length ? rows[0].name : `Client #${id}`;

    if (role === 'administration' && (!note || !note.trim())) {
      return res.status(400).json({ error: 'A reason (note) is required to delete this client.' });
    }

    await pool.query(
      `INSERT INTO deletion_logs (entity_type, entity_id, entity_name, deleted_by, note) VALUES (?, ?, ?, ?, ?)`,
      ['client', id, clientName, role || 'admin', note || null]
    );

    await pool.query('DELETE FROM clients WHERE id = ?', [id]);
    res.json({ message: 'Client deleted successfully.' });
  } catch (err) { next(err); }
};

exports.getClientHistory = async (req, res, next) => {
  try {
    const { id } = req.params;
    const [sales] = await pool.query('SELECT * FROM sales WHERE client_id = ? ORDER BY created_at DESC', [id]);
    res.json(sales);
  } catch (err) { next(err); }
};

exports.getClientFullHistory = async (req, res, next) => {
  try {
    const { id } = req.params;

    const [clientRows] = await pool.query('SELECT * FROM clients WHERE id = ?', [id]);
    if (!clientRows.length) return res.status(404).json({ error: 'Client not found.' });

    const [daily] = await pool.query(`
      SELECT DATE(s.created_at) AS sale_date,
             SUM(si.qty) AS qty,
             SUM(si.qty * si.price) AS revenue,
             SUM(si.qty * (si.price - si.cost)) AS profit
      FROM sale_items si
      JOIN sales s ON s.id = si.sale_id
      WHERE s.client_id = ? AND s.created_at >= NOW() - INTERVAL 30 DAY
      GROUP BY DATE(s.created_at)
      ORDER BY sale_date ASC
    `, [id]);

    const [yearly] = await pool.query(`
      SELECT YEAR(s.created_at) AS year,
             SUM(si.qty) AS qty,
             SUM(si.qty * si.price) AS revenue,
             SUM(si.qty * (si.price - si.cost)) AS profit
      FROM sale_items si
      JOIN sales s ON s.id = si.sale_id
      WHERE s.client_id = ? AND s.created_at >= NOW() - INTERVAL 5 YEAR
      GROUP BY YEAR(s.created_at)
      ORDER BY year ASC
    `, [id]);

    const [[totals]] = await pool.query(`
      SELECT COUNT(DISTINCT si.sale_id) AS totalOrders,
             COALESCE(SUM(si.qty),0) AS totalItems,
             COALESCE(SUM(si.qty * si.price),0) AS totalRevenue,
             COALESCE(SUM(si.qty * (si.price - si.cost)),0) AS totalProfit
      FROM sale_items si
      JOIN sales s ON s.id = si.sale_id
      WHERE s.client_id = ?
    `, [id]);

    const [sales] = await pool.query('SELECT * FROM sales WHERE client_id = ? ORDER BY created_at DESC', [id]);
    for (const sale of sales) {
      const [items] = await pool.query('SELECT * FROM sale_items WHERE sale_id = ?', [sale.id]);
      sale.items = items;
    }

    res.json({ client: clientRows[0], daily, yearly, totals, transactions: sales });
  } catch (err) { next(err); }
};