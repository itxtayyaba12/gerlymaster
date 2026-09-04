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
    await pool.query('DELETE FROM clients WHERE id = ?', [id]);
    res.json({ message: 'Client deleted successfully.' });
  } catch (err) { next(err); }
};

// client's own sales history + stats
exports.getClientHistory = async (req, res, next) => {
  try {
    const { id } = req.params;
    const [sales] = await pool.query('SELECT * FROM sales WHERE client_id = ? ORDER BY created_at DESC', [id]);
    res.json(sales);
  } catch (err) { next(err); }
};