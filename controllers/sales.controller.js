const pool = require('../config/db');

exports.getSales = async (req, res, next) => {
  try {
    const { status } = req.query;
    let sql = 'SELECT * FROM sales';
    const params = [];
    if (status) { sql += ' WHERE status = ?'; params.push(status); }
    sql += ' ORDER BY created_at DESC';
    const [sales] = await pool.query(sql, params);

    // attach items to each sale
    for (const sale of sales) {
      const [items] = await pool.query('SELECT * FROM sale_items WHERE sale_id = ?', [sale.id]);
      sale.items = items;
    }
    res.json(sales);
  } catch (err) { next(err); }
};

exports.createSale = async (req, res, next) => {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    const { client_id, items, discount, amount_paid, payment_method } = req.body;
    if (!client_id) return res.status(400).json({ error: 'Client is required.' });
    if (!items || !items.length) return res.status(400).json({ error: 'At least one product is required.' });

    let subtotal = 0, cost = 0;
    const resolvedItems = [];

    for (const item of items) {
      const [productRows] = await connection.query('SELECT * FROM products WHERE id = ?', [item.product_id]);
      if (!productRows.length) throw { status: 404, message: `Product ${item.product_id} not found.` };
      const product = productRows[0];
      if (product.stock < item.qty) throw { status: 400, message: `Not enough stock for ${product.name}.` };

      subtotal += product.selling_price * item.qty;
      cost += product.purchase_price * item.qty;
      resolvedItems.push({ product_id: product.id, name: product.name, qty: item.qty, price: product.selling_price, cost: product.purchase_price });

      // auto-update stock
      await connection.query('UPDATE products SET stock = stock - ? WHERE id = ?', [item.qty, product.id]);
    }

    const total = Math.max(subtotal - (discount || 0), 0);
    const paid = Math.min(amount_paid || 0, total);
    let status = 'Pending';
    if (paid >= total && total > 0) status = 'Paid';
    else if (paid > 0) status = 'Partial';

    const invoiceNo = 'INV-' + Date.now().toString().slice(-8);

    const [saleResult] = await connection.query(
      `INSERT INTO sales (invoice_no, client_id, subtotal, discount, total, cost, paid, remaining, status, payment_method)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [invoiceNo, client_id, subtotal, discount || 0, total, cost, paid, total - paid, status, payment_method || 'Cash']
    );

    for (const item of resolvedItems) {
      await connection.query(
        `INSERT INTO sale_items (sale_id, product_id, name, qty, price, cost) VALUES (?, ?, ?, ?, ?, ?)`,
        [saleResult.insertId, item.product_id, item.name, item.qty, item.price, item.cost]
      );
    }

    await connection.commit();
    const [newSale] = await pool.query('SELECT * FROM sales WHERE id = ?', [saleResult.insertId]);
    res.status(201).json(newSale[0]);
  } catch (err) {
    await connection.rollback();
    next(err);
  } finally {
    connection.release();
  }
};

exports.getSaleById = async (req, res, next) => {
  try {
    const { id } = req.params;
    const [sale] = await pool.query('SELECT * FROM sales WHERE id = ?', [id]);
    if (!sale.length) return res.status(404).json({ error: 'Sale not found.' });
    const [items] = await pool.query('SELECT * FROM sale_items WHERE sale_id = ?', [id]);
    res.json({ ...sale[0], items });
  } catch (err) { next(err); }
};

// DELETE a sale/invoice — restores stock, ALWAYS logs to deletion_logs.
// Reason (note) is mandatory only when role === 'administration'; Admin's own deletes are logged without a reason.
exports.deleteSale = async (req, res, next) => {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const { id } = req.params;
    const { role, note } = req.body || {};

    const [saleRows] = await connection.query('SELECT * FROM sales WHERE id = ?', [id]);
    if (!saleRows.length) {
      await connection.rollback();
      return res.status(404).json({ error: 'Invoice not found.' });
    }

    if (role === 'administration' && (!note || !note.trim())) {
      await connection.rollback();
      return res.status(400).json({ error: 'A reason (note) is required to delete this invoice.' });
    }

    await connection.query(
      `INSERT INTO deletion_logs (entity_type, entity_id, entity_name, deleted_by, note) VALUES (?, ?, ?, ?, ?)`,
      ['invoice', id, saleRows[0].invoice_no, role || 'admin', note || null]
    );

    // restore stock for every item in this sale before deleting it
    const [items] = await connection.query('SELECT * FROM sale_items WHERE sale_id = ?', [id]);
    for (const item of items) {
      await connection.query('UPDATE products SET stock = stock + ? WHERE id = ?', [item.qty, item.product_id]);
    }

    await connection.query('DELETE FROM sales WHERE id = ?', [id]); // sale_items auto-deleted via CASCADE
    await connection.commit();
    res.json({ message: 'Invoice deleted successfully.' });
  } catch (err) {
    await connection.rollback();
    next(err);
  } finally {
    connection.release();
  }
};