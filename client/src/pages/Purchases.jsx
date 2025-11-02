// client/src/pages/Purchases.jsx
import React, { useEffect, useState } from "react";

export default function Purchases() {
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => { fetchInvoices(); }, []);

  async function fetchInvoices() {
    setLoading(true);
    try {
      const res = await fetch("/api/purchases");
      const json = await res.json();
      setInvoices(json.invoices || []);
    } catch (err) {
      console.error(err);
    } finally { setLoading(false); }
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between">
        <h1 className="text-2xl font-semibold">Purchases & Invoices</h1>
        <div className="text-sm text-gray-500">Record and track supplier purchases</div>
      </div>

      <div className="bg-white rounded-lg shadow overflow-auto">
        <table className="w-full text-left">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-3 py-2">Invoice #</th>
              <th className="px-3 py-2">Supplier</th>
              <th className="px-3 py-2">Date</th>
              <th className="px-3 py-2">Total</th>
              <th className="px-3 py-2">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading && <tr><td colSpan="5" className="p-4 text-center">Loading...</td></tr>}
            {!loading && invoices.length === 0 && <tr><td colSpan="5" className="p-4 text-center">No invoices</td></tr>}
            {!loading && invoices.map(inv => (
              <tr key={inv.id}>
                <td className="px-3 py-2 border-b">{inv.number}</td>
                <td className="px-3 py-2 border-b">{inv.supplier}</td>
                <td className="px-3 py-2 border-b">{inv.date}</td>
                <td className="px-3 py-2 border-b">{inv.total}</td>
                <td className="px-3 py-2 border-b"><button className="px-2 py-1 border rounded">View</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
