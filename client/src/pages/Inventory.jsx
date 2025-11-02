// client/src/pages/Inventory.jsx
import React, { useEffect, useState } from "react";

const API = import.meta.env.VITE_API_URL || "";

export default function Inventory() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState(null);

  useEffect(() => { fetchItems(); }, []);

  async function fetchItems() {
    setLoading(true); setMessage(null);
    try {
      const res = await fetch(`${API}/api/inventory`);
      if (!res.ok) throw new Error("Failed");
      const json = await res.json();
      setItems(json.items || []);
    } catch (err) {
      console.error(err);
      setMessage("Cannot load inventory (server may be mock).");
    } finally { setLoading(false); }
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-semibold">Inventory</h1>
        <div className="text-sm text-gray-500">Track stock across branches</div>
      </div>

      {message && <div className="text-red-600">{message}</div>}

      <div className="bg-white rounded-lg shadow overflow-auto">
        <table className="w-full text-left">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-3 py-2">Product</th>
              <th className="px-3 py-2">Barcode</th>
              <th className="px-3 py-2">Branch</th>
              <th className="px-3 py-2">Stock</th>
              <th className="px-3 py-2">Expected</th>
              <th className="px-3 py-2">Expiry</th>
            </tr>
          </thead>
          <tbody>
            {loading && <tr><td colSpan="6" className="p-4 text-center">Loading...</td></tr>}
            {!loading && items.length === 0 && <tr><td colSpan="6" className="p-4 text-center">No inventory data</td></tr>}
            {!loading && items.map((it) => (
              <tr key={`${it.productId}-${it.branch}`}>
                <td className="px-3 py-2 border-b">{it.productName}</td>
                <td className="px-3 py-2 border-b">{it.barcode}</td>
                <td className="px-3 py-2 border-b">{it.branch}</td>
                <td className="px-3 py-2 border-b">{it.stock}</td>
                <td className="px-3 py-2 border-b">{it.expected}</td>
                <td className="px-3 py-2 border-b">{it.expiry || "-"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
