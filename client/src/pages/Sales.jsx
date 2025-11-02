// client/src/pages/Sales.jsx
import React, { useEffect, useState } from "react";

const API = import.meta.env.VITE_API_URL || "";

export default function Sales() {
  const [cart, setCart] = useState([]);
  const [query, setQuery] = useState("");
  const [products, setProducts] = useState([]);
  const [message, setMessage] = useState(null);

  useEffect(() => { fetchProducts(); }, []);

  async function fetchProducts() {
    try {
      const res = await fetch(`${API}/api/products`);
      const json = await res.json();
      setProducts(json.products || []);
    } catch (e) { console.warn(e); }
  }

  function addToCart(p) {
    setCart((c) => {
      const idx = c.findIndex(it => it.id === p.id);
      if (idx === -1) return [...c, { ...p, qty: 1 }];
      const copy = [...c];
      copy[idx].qty += 1;
      return copy;
    });
  }

  function removeFromCart(id) {
    setCart(c => c.filter(it => it.id !== id));
  }

  function changeQty(id, qty) {
    setCart(c => c.map(it => it.id === id ? { ...it, qty } : it));
  }

  const filtered = products.filter(p => !query || p.name.toLowerCase().includes(query.toLowerCase()) || (p.barcode || "").includes(query));

  const total = cart.reduce((s, i) => s + (i.price * (i.qty || 1)), 0);

  async function checkout(payment = "cash", discount = 0) {
    try {
      const payload = { items: cart.map(i => ({ id: i.id, qty: i.qty, price: i.price })), payment, discount };
      const res = await fetch(`${API}/api/sales/checkout`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      if (!res.ok) throw new Error("Checkout failed");
      const json = await res.json();
      setMessage("Sale recorded. Invoice: " + (json.invoiceId || ""));
      setCart([]);
    } catch (err) {
      console.error(err);
      setMessage("Checkout failed");
    }
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-semibold">Sales (POS)</h1>
        <div className="text-sm text-gray-500">Quick cashier interface</div>
      </div>

      {message && <div className="text-sm text-red-600">{message}</div>}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="md:col-span-2 bg-white rounded-lg shadow p-4">
          <div className="flex gap-2 mb-3">
            <input placeholder="Search by name or barcode" value={query} onChange={(e) => setQuery(e.target.value)} className="border rounded p-2 flex-1"/>
            <button onClick={() => setQuery("")} className="px-3 py-2 border rounded">Clear</button>
          </div>

          <div className="grid grid-cols-2 gap-2 max-h-80 overflow-auto">
            {filtered.map(p => (
              <button key={p.id} onClick={() => addToCart(p)} className="text-left p-2 border rounded hover:bg-gray-50">
                <div className="font-medium">{p.name}</div>
                <div className="text-sm text-gray-500">{p.barcode} • {p.price}</div>
              </button>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-4">
          <h2 className="font-semibold mb-2">Cart</h2>
          <div className="space-y-2">
            {cart.length === 0 && <div className="text-sm text-gray-500">Cart is empty</div>}
            {cart.map(item => (
              <div key={item.id} className="flex justify-between items-center border-b py-2">
                <div>
                  <div className="font-medium">{item.name}</div>
                  <div className="text-sm text-gray-500">{item.price} x <input type="number" value={item.qty} onChange={(e)=>changeQty(item.id, Number(e.target.value||0))} className="w-16 border rounded p-1 inline-block ml-2"/></div>
                </div>
                <div className="text-right">
                  <div className="font-medium">{(item.price * item.qty).toFixed(2)}</div>
                  <button onClick={() => removeFromCart(item.id)} className="text-xs text-red-600 mt-1">Remove</button>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-4">
            <div className="flex justify-between">
              <div className="font-semibold">Total:</div>
              <div className="font-bold">${total.toFixed(2)}</div>
            </div>
            <div className="mt-3 flex gap-2">
              <button onClick={() => checkout("cash", 0)} className="bg-green-600 text-white px-3 py-2 rounded">Pay Cash</button>
              <button onClick={() => checkout("card", 0)} className="bg-blue-600 text-white px-3 py-2 rounded">Pay Card</button>
              <button onClick={() => checkout("cash", 10)} className="px-3 py-2 border rounded">Apply 10% Discount</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
