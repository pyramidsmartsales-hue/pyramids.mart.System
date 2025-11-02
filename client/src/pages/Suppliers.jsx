// client/src/pages/Suppliers.jsx
import React, { useEffect, useState } from "react";

const API = import.meta.env.VITE_API_URL || "";

export default function Suppliers() {
  const [suppliers, setSuppliers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState(null);

  // new states for add supplier form
  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState({ name: "", phone: "", company: "", productsText: "" });

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

  async function onAddSupplier(e) {
    e.preventDefault();
    setMessage(null);
    try {
      const products = (form.productsText || "").split(",").map(s => s.trim()).filter(Boolean);
      const payload = { name: form.name, phone: form.phone, company: form.company, products };
      const res = await fetch(`${API}/api/suppliers`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      if (!res.ok) throw new Error("Add supplier failed");
      await fetchSuppliers();
      setForm({ name: "", phone: "", company: "", productsText: "" });
      setFormOpen(false);
    } catch (err) {
      console.error("Add supplier failed", err);
      setMessage("Failed to add supplier");
    }
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-semibold">Suppliers</h1>
        <div className="text-sm text-gray-500">Supplier details and purchase history</div>
      </div>

      {message && <div className="text-sm text-red-600">{message}</div>}

      <div className="flex justify-end">
        <button onClick={() => setFormOpen(true)} className="px-3 py-2 bg-green-600 text-white rounded">Add Supplier</button>
      </div>

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
                <td className="px-3 py-2 border-b">{s.balance ?? 0}</td>
                <td className="px-3 py-2 border-b"><button className="px-2 py-1 border rounded">View</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {formOpen && (
        <div className="fixed inset-0 flex items-center justify-center bg-black/40 p-4 z-50">
          <div className="bg-white rounded-lg shadow p-6 w-full max-w-md">
            <h2 className="text-lg font-semibold mb-4">Add Supplier</h2>
            <form onSubmit={onAddSupplier} className="space-y-3">
              <div>
                <label className="text-sm text-gray-600 block">Name</label>
                <input value={form.name} onChange={(e)=>setForm({...form,name:e.target.value})} className="w-full border rounded p-2"/>
              </div>
              <div>
                <label className="text-sm text-gray-600 block">Phone</label>
                <input value={form.phone} onChange={(e)=>setForm({...form,phone:e.target.value})} className="w-full border rounded p-2" placeholder="+254..." />
              </div>
              <div>
                <label className="text-sm text-gray-600 block">Company</label>
                <input value={form.company} onChange={(e)=>setForm({...form,company:e.target.value})} className="w-full border rounded p-2"/>
              </div>
              <div>
                <label className="text-sm text-gray-600 block">Products (comma separated)</label>
                <input value={form.productsText} onChange={(e)=>setForm({...form,productsText:e.target.value})} className="w-full border rounded p-2" placeholder="Rice 5kg, Milk 1L"/>
              </div>

              <div className="flex justify-end gap-2">
                <button type="button" onClick={()=>setFormOpen(false)} className="px-3 py-2 border rounded">Cancel</button>
                <button type="submit" className="px-3 py-2 bg-blue-600 text-white rounded">Save</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
