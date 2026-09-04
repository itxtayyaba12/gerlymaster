const pool = require('../config/db');

exports.recordPayment = async (req, res, next) => {
  try {
    const { id } = req.params; // sale id
    const { amount } = req.body;
    if (!amount || amount <= 0) return res.status(400).json({ error: 'Enter a valid payment amount.' });

    const [saleRows] = await pool.query('SELECT * FROM sales WHERE id = ?', [id]);
    if (!saleRows.length) return res.status(404).json({ error: 'Sale not found.' });
    const sale = saleRows[0];

    const newPaid = Math.min(sale.paid + amount, sale.total);
    const newRemaining = sale.total - newPaid;
    const newStatus = newRemaining <= 0 ? 'Paid' : (newPaid > 0 ? 'Partial' : 'Pending');

    await pool.query('UPDATE sales SET paid=?, remaining=?, status=? WHERE id=?', [newPaid, newRemaining, newStatus, id]);
    const [updated] = await pool.query('SELECT * FROM sales WHERE id = ?', [id]);
    res.json(updated[0]);
  } catch (err) { next(err); }
};

exports.getPaymentSummary = async (req, res, next) => {
  try {
    const [[paidRow]] = await pool.query(`SELECT COALESCE(SUM(paid),0) AS total FROM sales WHERE status='Paid'`);
    const [[pendingRow]] = await pool.query(`SELECT COALESCE(SUM(remaining),0) AS total FROM sales WHERE status='Pending'`);
    const [[partialRow]] = await pool.query(`SELECT COALESCE(SUM(remaining),0) AS total FROM sales WHERE status='Partial'`);
    res.json({ collected: paidRow.total, pending: pendingRow.total, partial: partialRow.total });
  } catch (err) { next(err); }
};