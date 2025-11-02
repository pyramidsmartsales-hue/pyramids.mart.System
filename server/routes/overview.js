// server/routes/overview.js
import express from "express";
const router = express.Router();

/**
 * Overview endpoint
 * GET /api/overview?start=YYYY-MM-DD&end=YYYY-MM-DD
 *
 * NOTE:
 * - This implementation returns safe mock/default data so it won't break your app.
 * - Replace the mock logic with real DB queries (Postgres / Mongo / Sequelize / Mongoose)
 *   according to your project's DB layer.
 *
 * Example response shape:
 * {
 *   totalSales: 12345.67,
 *   expenses: 2345.67,
 *   invoiceCount: 42,
 *   netProfit: 9999.99,
 *   salesTrend: [ { date: '2025-11-01', sales: 200 }, ... ],
 *   topProducts: [ { name: 'Rice', qty: 120 }, ... ]
 * }
 */

router.get("/", async (req, res) => {
  try {
    const start = req.query.start || new Date().toISOString().slice(0, 10);
    const end = req.query.end || start;

    // =======  MOCK / DEFAULT DATA (SAFE)  =======
    // Replace the following block with real DB queries.
    // Example (pseudo):
    // const totalSales = await db.query('SELECT SUM(total_amount) FROM sales WHERE date BETWEEN $1 AND $2', [start, end]);
    // ...
    const mockResponse = {
      totalSales: 0,
      expenses: 0,
      invoiceCount: 0,
      netProfit: 0,
      salesTrend: [
        // sample trend entries (empty by default)
        // { date: start, sales: 0 }
      ],
      topProducts: []
    };

    // send the mock response
    return res.json(mockResponse);
  } catch (err) {
    console.error("Overview route error:", err && err.message ? err.message : err);
    return res.status(500).json({ error: "Server error" });
  }
});

export default router;
