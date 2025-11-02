// src/pages/Overview.jsx
import React, { useEffect, useState } from "react";
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid
} from "recharts";

const API = import.meta.env.VITE_API_URL || "";

function KpiCard({ title, value, icon }) {
  return (
    <div className="bg-white rounded-lg shadow p-4">
      <div className="flex justify-between items-center">
        <div>
          <div className="text-sm text-gray-500">{title}</div>
          <div className="mt-2 text-2xl font-bold">{value}</div>
        </div>
        <div className="text-3xl">{icon}</div>
      </div>
    </div>
  );
}

export default function Overview() {
  const todayISO = new Date().toISOString().slice(0, 10);
  const [start, setStart] = useState(todayISO);
  const [end, setEnd] = useState(todayISO);
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState({
    totalSales: 0,
    netProfit: 0,
    expenses: 0,
    invoiceCount: 0,
    salesTrend: [],
    topProducts: []
  });
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchOverview(start, end);
    // eslint-disable-next-line
  }, []);

  async function fetchOverview(s = start, e = end) {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API}/api/overview?start=${s}&end=${e}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      setData({
        totalSales: json.totalSales ?? 0,
        netProfit: json.netProfit ?? 0,
        expenses: json.expenses ?? 0,
        invoiceCount: json.invoiceCount ?? 0,
        salesTrend: json.salesTrend ?? [],
        topProducts: json.topProducts ?? []
      });
    } catch (err) {
      console.error(err);
      setError("Failed to load overview data.");
    } finally {
      setLoading(false);
    }
  }

  function quickRange(option) {
    const now = new Date();
    let s = new Date();
    let e = new Date();
    if (option === "today") s = e = now;
    if (option === "week") s = new Date(now.setDate(now.getDate() - 6));
    if (option === "month") s = new Date(now.getFullYear(), now.getMonth(), 1);
    const toISO = d => d.toISOString().slice(0, 10);
    const sISO = toISO(s), eISO = toISO(e);
    setStart(sISO); setEnd(eISO);
    fetchOverview(sISO, eISO);
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-semibold">Overview</h1>
        <div className="flex items-center gap-3">
          <input type="date" value={start} onChange={e => setStart(e.target.value)} className="border rounded p-2" />
          <span>to</span>
          <input type="date" value={end} onChange={e => setEnd(e.target.value)} className="border rounded p-2" />
          <button onClick={() => fetchOverview()} className="bg-blue-600 text-white px-4 py-2 rounded">Apply</button>
          <button onClick={() => quickRange("today")} className="px-3 py-1 border rounded">Today</button>
          <button onClick={() => quickRange("week")} className="px-3 py-1 border rounded">This week</button>
          <button onClick={() => quickRange("month")} className="px-3 py-1 border rounded">This month</button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <KpiCard title="Total Sales" value={`$${Number(data.totalSales).toLocaleString()}`} icon="💰" />
        <KpiCard title="Net Profit" value={`$${Number(data.netProfit).toLocaleString()}`} icon="📈" />
        <KpiCard title="Expenses" value={`$${Number(data.expenses).toLocaleString()}`} icon="🧾" />
        <KpiCard title="Invoices" value={data.invoiceCount} icon="🧮" />
      </div>

      <div className="bg-white rounded-lg shadow p-4">
        <div className="flex justify-between items-center mb-3">
          <h2 className="font-medium">Sales Trend</h2>
          {loading && <span className="text-sm text-gray-500">Loading...</span>}
        </div>
        {error && <div className="text-red-600 mb-2">{error}</div>}
        <div style={{ height: 300 }}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data.salesTrend}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" />
              <YAxis />
              <Tooltip />
              <Line type="monotone" dataKey="sales" stroke="#2563eb" strokeWidth={2} dot={{ r: 2 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-white rounded-lg shadow p-4">
          <h3 className="font-medium mb-2">Top Selling Products</h3>
          <ul>
            {data.topProducts.length === 0 && <li className="text-gray-500">No data</li>}
            {data.topProducts.map((p, i) => (
              <li key={i} className="flex justify-between py-1 border-b">
                <span>{p.name}</span>
                <span className="font-semibold">{p.qty}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="bg-white rounded-lg shadow p-4">
          <h3 className="font-medium mb-2">Notes</h3>
          <ul className="text-sm text-gray-600">
            <li>- Use the date filter to view specific periods.</li>
            <li>- Make sure sales and expenses are recorded for the selected period.</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
