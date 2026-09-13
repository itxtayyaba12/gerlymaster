const pool = require('../config/db');

exports.getProducts = async (req, res, next) => {
  try {
    const { category } = req.query;
    let sql = 'SELECT * FROM products';
    const params = [];
    if (category) { sql += ' WHERE category = ?'; params.push(category); }
    sql += ' ORDER BY name ASC';
    const [rows] = await pool.query(sql, params);
    res.json(rows);
  } catch (err) { next(err); }
};

exports.createProduct = async (req, res, next) => {
  try {
    const { name, category, purchase_price, selling_price, stock, threshold } = req.body;
    if (!name) return res.status(400).json({ error: 'Product name is required.' });

    const [result] = await pool.query(
      `INSERT INTO products (name, category, purchase_price, selling_price, stock, threshold)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [name, category || 'Uncategorized', purchase_price || 0, selling_price || 0, stock || 0, threshold || 5]
    );
    const [newProduct] = await pool.query('SELECT * FROM products WHERE id = ?', [result.insertId]);
    res.status(201).json(newProduct[0]);
  } catch (err) { next(err); }
};

exports.updateProduct = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { name, category, purchase_price, selling_price, stock, threshold } = req.body;

    await pool.query(
      `UPDATE products SET name=?, category=?, purchase_price=?, selling_price=?, stock=?, threshold=?
       WHERE id=?`,
      [name, category, purchase_price, selling_price, stock, threshold, id]
    );
    const [updated] = await pool.query('SELECT * FROM products WHERE id = ?', [id]);
    if (!updated.length) return res.status(404).json({ error: 'Product not found.' });
    res.json(updated[0]);
  } catch (err) { next(err); }
};

exports.deleteProduct = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { role, note } = req.body || {};

    const [rows] = await pool.query('SELECT name FROM products WHERE id = ?', [id]);
    const productName = rows.length ? rows[0].name : `Product #${id}`;

    if (role === 'administration' && (!note || !note.trim())) {
      return res.status(400).json({ error: 'A reason (note) is required to delete this item.' });
    }

    await pool.query(
      `INSERT INTO deletion_logs (entity_type, entity_id, entity_name, deleted_by, note) VALUES (?, ?, ?, ?, ?)`,
      ['product', id, productName, role || 'admin', note || null]
    );

    await pool.query('DELETE FROM products WHERE id = ?', [id]);
    res.json({ message: 'Product deleted successfully.' });
  } catch (err) { next(err); }
};

exports.getProductSalesHistory = async (req, res, next) => {
  try {
    const { id } = req.params;

    const [product] = await pool.query('SELECT * FROM products WHERE id = ?', [id]);
    if (!product.length) return res.status(404).json({ error: 'Product not found.' });

    const [daily] = await pool.query(`
      SELECT DATE(s.created_at) AS sale_date,
             SUM(si.qty) AS qty,
             SUM(si.qty * si.price) AS revenue,
             SUM(si.qty * (si.price - si.cost)) AS profit
      FROM sale_items si
      JOIN sales s ON s.id = si.sale_id
      WHERE si.product_id = ? AND s.created_at >= NOW() - INTERVAL 30 DAY
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
      WHERE si.product_id = ? AND s.created_at >= NOW() - INTERVAL 5 YEAR
      GROUP BY YEAR(s.created_at)
      ORDER BY year ASC
    `, [id]);

    const [[totals]] = await pool.query(`
      SELECT COALESCE(SUM(si.qty),0) AS totalQty,
             COALESCE(SUM(si.qty * si.price),0) AS totalRevenue,
             COALESCE(SUM(si.qty * (si.price - si.cost)),0) AS totalProfit,
             COUNT(DISTINCT si.sale_id) AS totalOrders
      FROM sale_items si
      WHERE si.product_id = ?
    `, [id]);

    res.json({ product: product[0], daily, yearly, totals });
  } catch (err) { next(err); }
};

exports.getLowStock = async (req, res, next) => {
  try {
    const [rows] = await pool.query('SELECT * FROM products WHERE stock <= threshold');
    res.json(rows);
  } catch (err) { next(err); }
};