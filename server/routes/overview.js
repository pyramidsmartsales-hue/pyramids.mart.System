// server/routes/overview.js
import express from "express";
import { DATA } from "../data.js";

const router = express.Router();

router.get("/", async (req, res) => {
  try {
    const start = req.query.start || new Date().toISOString().slice(0, 10);
    const end = req.query.end || start;

    // total sales computed from DATA.SALES
    const totalSales = DATA.SALES.reduce((s, sale) => s + Number(sale.total || 0), 0);

    // expenses computed from DATA.EXPENSES
    const totalExpenses = DATA.EXPENSES.reduce((s, ex) => s + Number(ex.amount || 0), 0);

    const invoiceCount = DATA.SALES.length;

    const netProfit = totalSales - totalExpenses;

    // salesTrend: aggregate sales by date string (yyyy-mm-dd)
    const trendMap = {};
    for (const sale of DATA.SALES) {
      const d = (sale.date || "").slice(0, 10) || new Date().toISOString().slice(0, 10);
      if (!trendMap[d]) trendMap[d] = { date: d, sales: 0, expenses: 0, netProfit: 0 };
      trendMap[d].sales += Number(sale.total || 0);
    }

    // map expenses into same trend map by date
    for (const ex of DATA.EXPENSES) {
      const d = (ex.date || "").slice(0, 10) || new Date().toISOString().slice(0, 10);
      if (!trendMap[d]) trendMap[d] = { date: d, sales: 0, expenses: 0, netProfit: 0 };
      trendMap[d].expenses += Number(ex.amount || 0);
    }

    // compute netProfit per day
    const salesTrend = Object.values(trendMap).sort((a, b) => a.date.localeCompare(b.date)).map(row => {
      return { ...row, netProfit: (Number(row.sales || 0) - Number(row.expenses || 0)) };
    });

    // topProducts: aggregate sold quantities from DATA.SALES items
    const prodAgg = {};
    for (const sale of DATA.SALES) {
      for (const it of sale.items || []) {
        const pid = Number(it.id || it.productId || 0);
        const qty = Number(it.qty || 0);
        if (!prodAgg[pid]) prodAgg[pid] = { productId: pid, qty: 0, name: it.name || it.productName || `#${pid}` };
        prodAgg[pid].qty += qty;
      }
    }
    const topProducts = Object.values(prodAgg).sort((a, b) => b.qty - a.qty).slice(0, 20);

    res.json({
      totalSales,
      expenses: totalExpenses,
      invoiceCount,
      netProfit,
      salesTrend,
      topProducts
    });
  } catch (err) {
    console.error("overview error", err);
    res.status(500).json({ error: "server error" });
  }
});

export default router;
