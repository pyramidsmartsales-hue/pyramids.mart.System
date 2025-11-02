// client/src/pages/Sales.jsx
import React, { useEffect, useState } from "react";

const API = import.meta.env.VITE_API_URL || "";

export default function Sales() {
  const [cart, setCart] = useState([]);
  const [query, setQuery] = useState("");
  const [products, setProducts] = useState([]);
  const [message, setMessage] = useState(null);

  // New: customer phone & discount percent & points toggle
  const [customerPhone, setCustomerPhone] = useState("");
  const [discountPct, setDiscountPct] = useState(0);

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

  const subtotal = cart.reduce((s, i) => s + (i.price * (i.qty || 1)), 0);
  const totalAfterDiscount = subtotal * (1 - (Number(discountPct) || 0) / 100);

  // points simple rule: 1 point per KSh 100
  const pointsAwarded = Math.floor(totalAfterDiscount / 100);

  async function checkout(payment = "cash", discount = null) {
    try {
      const payload = {
        items: cart.map(i => ({ id: i.id, qty: i.qty, price: i.price })),
        payment,
        discountPct: discount !== null ? discount : Number(discountPct) || 0,
        customerPhone: customerPhone || null,
        pointsAwarded
      };
      const res = await fetch(`${API}/api/sales/checkout`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      if (!res.ok) throw new Error("Checkout failed");
      const json = await res.json();
      setMessage("Sale recorded. Invoice: " + (json.invoiceId || ""));
      setCart([]);
      setCustomerPhone("");
      setDiscountPct(0);
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

          <div className="mb-3">
            <label className="text-sm text-gray-600 block">Customer phone (optional)</label>
            <input value={customerPhone} onChange={(e)=>setCustomerPhone(e.target.value)} placeholder="+254..." className="w-full border rounded px-3 py-2"/>
          </div>

          <div className="space-y-2">
            {cart.length === 0 && <div className="text-sm text-gray-500">Cart is empty</div>}
            {cart.map(item => (
              <div key={item.id} className="flex justify-between items-center border-b py-2">
                <div>
                  <div className="font-medium">{item.name}</div>
                  <div className="text-sm text-gray-500">KSh {item.price} x <input type="number" value={item.qty} onChange={(e)=>changeQty(item.id, Number(e.target.value||0))} className="w-16 border rounded p-1 inline-block ml-2"/></div>
                </div>
                <div className="text-right">
                  <div className="font-medium">KSh {(item.price * item.qty).toFixed(2)}</div>
                  <button onClick={() => removeFromCart(item.id)} className="text-xs text-red-600 mt-1">Remove</button>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-4">
            <div className="flex justify-between">
              <div className="font-semibold">Subtotal:</div>
              <div className="font-bold">KSh {subtotal.toFixed(2)}</div>
            </div>

            <div className="mt-2">
              <label className="text-sm text-gray-600">Discount %</label>
              <input type="number" value={discountPct} onChange={(e)=>setDiscountPct(Number(e.target.value||0))} className="w-24 border rounded px-2 py-1 ml-2 inline-block"/>
            </div>

            <div className="flex justify-between mt-3">
              <div className="font-semibold">Total:</div>
              <div className="font-bold">KSh {totalAfterDiscount.toFixed(2)}</div>
            </div>

            <div className="mt-1 text-sm text-gray-500">Points awarded (rule: 1 point per KSh 100): {pointsAwarded}</div>

            <div className="mt-3 flex gap-2">
              <button onClick={() => checkout("cash", Number(discountPct || 0))} className="bg-green-600 text-white px-3 py-2 rounded">Pay Cash</button>
              <button onClick={() => checkout("card", Number(discountPct || 0))} className="bg-blue-600 text-white px-3 py-2 rounded">Pay Card</button>
              <button onClick={() => { setDiscountPct(10); }} className="px-3 py-2 border rounded">Apply 10% Discount</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
