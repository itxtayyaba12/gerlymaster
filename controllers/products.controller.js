const pool = require('../config/db');

// GET all products (with optional category filter)
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

// POST new product
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

// PUT update product
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

// DELETE product
exports.deleteProduct = async (req, res, next) => {
  try {
    const { id } = req.params;
    await pool.query('DELETE FROM products WHERE id = ?', [id]);
    res.json({ message: 'Product deleted successfully.' });
  } catch (err) { next(err); }
};

// GET low stock products
exports.getLowStock = async (req, res, next) => {
  try {
    const [rows] = await pool.query('SELECT * FROM products WHERE stock <= threshold');
    res.json(rows);
  } catch (err) { next(err); }
};