// client/src/pages/Suppliers.jsx
import React, { useEffect, useState } from "react";

const API = import.meta.env.VITE_API_URL || "";

export default function Suppliers() {
  const [suppliers, setSuppliers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState(null);

  useEffect(() => { fetchSuppliers(); }, []);

  async function fetchSuppliers() {
    setLoading(true); setMessage(null);
    try {
      const res = await fetch(`${API}/api/suppliers`);
      const json = await res.json();
      setSuppliers(json.suppliers || []);
    } catch (err) {
      console.error(err);
      setMessage("Cannot load suppliers");
    } finally { setLoading(false); }
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-semibold">Suppliers</h1>
        <div className="text-sm text-gray-500">Supplier details and purchase history</div>
      </div>

      {message && <div className="text-sm text-red-600">{message}</div>}

      <div className="bg-white rounded-lg shadow overflow-auto">
        <table className="w-full text-left">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-3 py-2">Name</th>
              <th className="px-3 py-2">Phone</th>
              <th className="px-3 py-2">Company</th>
              <th className="px-3 py-2">Balance</th>
              <th className="px-3 py-2">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading && <tr><td colSpan="5" className="p-4 text-center">Loading...</td></tr>}
            {!loading && suppliers.length === 0 && <tr><td colSpan="5" className="p-4 text-center">No suppliers</td></tr>}
            {!loading && suppliers.map(s => (
              <tr key={s.id}>
                <td className="px-3 py-2 border-b">{s.name}</td>
                <td className="px-3 py-2 border-b">{s.phone}</td>
                <td className="px-3 py-2 border-b">{s.company}</td>
                <td className="px-3 py-2 border-b">{s.balance}</td>
                <td className="px-3 py-2 border-b"><button className="px-2 py-1 border rounded">View</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
