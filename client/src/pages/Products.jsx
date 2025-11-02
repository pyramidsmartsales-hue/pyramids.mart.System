// client/src/pages/Products.jsx
import React, { useEffect, useState } from "react";

/**
 * Products page (client-side only)
 * Uses VITE_API_URL for backend base url.
 */

const API = import.meta.env.VITE_API_URL || "";

function SmallInput({ label, value, onChange, type = "text" }) {
  return (
    <div className="flex flex-col">
      <label className="text-sm text-gray-600">{label}</label>
      <input type={type} value={value} onChange={onChange} className="border rounded px-2 py-1 mt-1" />
    </div>
  );
}

function ProductRow({ p, onEdit, onDelete }) {
  return (
    <tr>
      <td className="px-3 py-2 border-b">{p.name}</td>
      <td className="px-3 py-2 border-b">{p.barcode}</td>
      <td className="px-3 py-2 border-b">{p.category}</td>
      <td className="px-3 py-2 border-b">{p.unit}</td>
      <td className="px-3 py-2 border-b">{p.price}</td>
      <td className="px-3 py-2 border-b">{p.qty}</td>
      <td className="px-3 py-2 border-b">{p.expiry || "-"}</td>
      <td className="px-3 py-2 border-b">
        <div className="flex gap-2">
          <button onClick={() => onEdit(p)} className="px-2 py-1 bg-yellow-100 rounded">Edit</button>
          <button onClick={() => onDelete(p)} className="px-2 py-1 bg-red-100 rounded">Delete</button>
        </div>
      </td>
    </tr>
  );
}

export default function Products() {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ name: "", barcode: "", category: "", price: "", unit: "", qty: 0, expiry: "" });
  const [file, setFile] = useState(null);
  const [message, setMessage] = useState(null);

  useEffect(() => {
    fetchProducts();
    // eslint-disable-next-line
  }, []);

  async function fetchProducts() {
    setLoading(true); setMessage(null);
    try {
      const res = await fetch(`${API}/api/products`);
      if (!res.ok) throw new Error("Failed to fetch products");
      const json = await res.json();
      setProducts(json.products ?? []);
    } catch (err) {
      console.error(err);
      setMessage("Cannot load products (server may be mock).");
      setProducts([]);
    } finally {
      setLoading(false);
    }
  }

  function openAdd() {
    setEditing(null);
    setForm({ name: "", barcode: "", category: "", price: "", unit: "", qty: 0, expiry: "" });
    setFile(null);
    setFormOpen(true);
  }

  function openEdit(p) {
    setEditing(p);
    setForm({ name: p.name || "", barcode: p.barcode || "", category: p.category || "", price: p.price || "", unit: p.unit || "", qty: p.qty || 0, expiry: p.expiry || "" });
    setFormOpen(true);
  }

  async function saveProduct(e) {
    e.preventDefault();
    setMessage(null);
    try {
      const payload = { ...form, qty: Number(form.qty), price: Number(form.price) };
      let res;
      if (editing && editing.id) {
        res = await fetch(`${API}/api/products/${editing.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload)
        });
      } else {
        res = await fetch(`${API}/api/products`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload)
        });
      }
      if (!res.ok) throw new Error("Save failed");
      const json = await res.json();
      // upload image if server supports it
      if (file && json.product && json.product.id) {
        const fd = new FormData();
        fd.append("image", file);
        await fetch(`${API}/api/products/${json.product.id}/image`, { method: "POST", body: fd });
      }
      setFormOpen(false);
      fetchProducts();
    } catch (err) {
      console.error(err);
      setMessage("Failed to save product");
    }
  }

  async function deleteProduct(p) {
    if (!confirm(`Delete product "${p.name}"?`)) return;
    try {
      const res = await fetch(`${API}/api/products/${p.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Delete failed");
      fetchProducts();
    } catch (err) {
      console.error(err);
      setMessage("Failed to delete product");
    }
  }

  async function handleImport(e) {
    const input = e.target;
    if (!input.files || !input.files[0]) return;
    const f = input.files[0];
    const fd = new FormData();
    fd.append("file", f);
    try {
      const res = await fetch(`${API}/api/products/import`, { method: "POST", body: fd });
      if (!res.ok) throw new Error("Import failed");
      await res.json();
      setMessage("Import completed (check server).");
      fetchProducts();
    } catch (err) {
      console.error(err);
      setMessage("Import failed");
    } finally {
      input.value = "";
    }
  }

  function exportProducts() {
    window.location.href = `${API}/api/products/export`;
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Products Management</h1>
        <div className="flex items-center gap-3">
          <button onClick={openAdd} className="bg-green-600 text-white px-4 py-2 rounded">Add Product</button>
          <label className="px-3 py-2 border rounded cursor-pointer bg-white">
            Import (Excel)
            <input type="file" accept=".xlsx,.xls,.csv" onChange={handleImport} className="hidden" />
          </label>
          <button onClick={exportProducts} className="px-3 py-2 border rounded">Export</button>
        </div>
      </div>

      {message && <div className="text-sm text-red-600">{message}</div>}

      <div className="bg-white rounded-lg shadow overflow-auto">
        <table className="w-full text-left">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-3 py-2">Name</th>
              <th className="px-3 py-2">Barcode</th>
              <th className="px-3 py-2">Category</th>
              <th className="px-3 py-2">Unit</th>
              <th className="px-3 py-2">Price</th>
              <th className="px-3 py-2">Stock</th>
              <th className="px-3 py-2">Expiry</th>
              <th className="px-3 py-2">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading && <tr><td colSpan="8" className="p-4 text-center">Loading...</td></tr>}
            {!loading && products.length === 0 && <tr><td colSpan="8" className="p-4 text-center">No products</td></tr>}
            {!loading && products.map(p => <ProductRow key={p.id} p={p} onEdit={openEdit} onDelete={deleteProduct} />)}
          </tbody>
        </table>
      </div>

      {formOpen && (
        <div className="fixed inset-0 flex items-center justify-center bg-black/40 p-4 z-50">
          <div className="bg-white rounded-lg shadow p-6 w-full max-w-2xl">
            <h2 className="text-lg font-semibold mb-4">{editing ? "Edit Product" : "Add Product"}</h2>
            <form onSubmit={saveProduct} className="grid grid-cols-2 gap-4">
              <SmallInput label="Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              <SmallInput label="Barcode" value={form.barcode} onChange={(e) => setForm({ ...form, barcode: e.target.value })} />
              <SmallInput label="Category" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} />
              <SmallInput label="Unit" value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })} />
              <SmallInput label="Price" type="number" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} />
              <SmallInput label="Qty" type="number" value={form.qty} onChange={(e) => setForm({ ...form, qty: e.target.value })} />
              <SmallInput label="Expiry (YYYY-MM-DD)" value={form.expiry} onChange={(e) => setForm({ ...form, expiry: e.target.value })} />
              <div className="flex flex-col">
                <label className="text-sm text-gray-600">Image</label>
                <input type="file" accept="image/*" onChange={(e) => setFile(e.target.files && e.target.files[0])} />
              </div>

              <div className="col-span-2 flex justify-end gap-2 mt-2">
                <button type="button" onClick={() => setFormOpen(false)} className="px-4 py-2 border rounded">Cancel</button>
                <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded">Save</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
