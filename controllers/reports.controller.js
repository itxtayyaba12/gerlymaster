const pool = require('../config/db');

exports.profitByProduct = async (req, res, next) => {
  try {
    const [rows] = await pool.query(`
      SELECT name, SUM((price - cost) * qty) AS profit
      FROM sale_items
      GROUP BY name
      ORDER BY profit DESC
      LIMIT 10
    `);
    res.json(rows);
  } catch (err) { next(err); }
};

exports.profitByCustomer = async (req, res, next) => {
  try {
    const [rows] = await pool.query(`
      SELECT c.name AS client_name, SUM(s.total - s.cost) AS profit
      FROM sales s
      JOIN clients c ON c.id = s.client_id
      GROUP BY c.name
      ORDER BY profit DESC
      LIMIT 10
    `);
    res.json(rows);
  } catch (err) { next(err); }
};

// Profit for last 24h / 7d / 1m / 6m — auto-usable by dashboard
exports.profitByTimeframe = async (req, res, next) => {
  try {
    const ranges = {
      '24h': 'INTERVAL 24 HOUR',
      '7d': 'INTERVAL 7 DAY',
      '1m': 'INTERVAL 1 MONTH',
      '6m': 'INTERVAL 6 MONTH'
    };
    const result = {};
    for (const [key, interval] of Object.entries(ranges)) {
      const [[row]] = await pool.query(`
        SELECT COUNT(*) AS count, COALESCE(SUM(total),0) AS revenue, COALESCE(SUM(cost),0) AS cost
        FROM sales
        WHERE created_at >= NOW() - ${interval}
      `);
      result[key] = {
        count: row.count,
        revenue: Number(row.revenue),
        cost: Number(row.cost),
        profit: Number(row.revenue) - Number(row.cost)
      };
    }
    res.json(result);
  } catch (err) { next(err); }
};

exports.dashboardSummary = async (req, res, next) => {
  try {
    const [[salesRow]] = await pool.query('SELECT COALESCE(SUM(total),0) AS total, COALESCE(SUM(cost),0) AS cost FROM sales');
    const [[stockRow]] = await pool.query('SELECT COALESCE(SUM(stock),0) AS total FROM products');
    const [[clientsRow]] = await pool.query('SELECT COUNT(*) AS total FROM clients');
    const [[pendingRow]] = await pool.query(`SELECT COALESCE(SUM(remaining),0) AS total FROM sales WHERE status != 'Paid'`);
    const [[lowStockRow]] = await pool.query('SELECT COUNT(*) AS total FROM products WHERE stock <= threshold');

    res.json({
      totalSales: Number(salesRow.total),
      totalProfit: Number(salesRow.total) - Number(salesRow.cost),
      totalStock: Number(stockRow.total),
      totalClients: Number(clientsRow.total),
      pendingPayments: Number(pendingRow.total),
      lowStockCount: Number(lowStockRow.total)
    });
  } catch (err) { next(err); }
};