// client/src/pages/Purchases.jsx
import React, { useEffect, useState } from "react";

const API = import.meta.env.VITE_API_URL || "";

export default function Purchases() {
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(false);

  // new: expense form
  const [expFormOpen, setExpFormOpen] = useState(false);
  const [expenseForm, setExpenseForm] = useState({ date: "", amount: "", category: "", supplier: "", invoice_no: "", payment_method: "", notes: "" });
  const [message, setMessage] = useState(null);

  useEffect(() => { fetchInvoices(); }, []);

  async function fetchInvoices() {
    setLoading(true);
    try {
      const res = await fetch(`${API}/api/purchases`);
      if (!res.ok) throw new Error("Failed");
      const json = await res.json();
      setInvoices(json.invoices || []);
    } catch (err) {
      console.error(err);
      setInvoices([]);
    } finally { setLoading(false); }
  }

  async function saveExpense(e) {
    e.preventDefault();
    setMessage(null);
    try {
      const payload = {
        date: expenseForm.date || new Date().toISOString().slice(0,10),
        amount: Number(expenseForm.amount || 0),
        category: expenseForm.category || "General",
        supplier: expenseForm.supplier || null,
        invoice_no: expenseForm.invoice_no || null,
        payment_method: expenseForm.payment_method || null,
        notes: expenseForm.notes || ""
      };
      const res = await fetch(`${API}/api/expenses`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      if (!res.ok) throw new Error("Failed");
      setMessage("Expense recorded");
      setExpenseForm({ date: "", amount: "", category: "", supplier: "", invoice_no: "", payment_method: "", notes: "" });
      setExpFormOpen(false);
      // optionally refresh invoices/purchases
      fetchInvoices();
    } catch (err) {
      console.error(err);
      setMessage("Failed to save expense");
    }
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between">
        <h1 className="text-2xl font-semibold">Purchases & Invoices</h1>
        <div className="text-sm text-gray-500">Record and track supplier purchases</div>
      </div>

      <div className="flex gap-2">
        <button onClick={() => setExpFormOpen(true)} className="px-3 py-2 bg-green-600 text-white rounded">Add Expense</button>
      </div>

      {message && <div className="text-sm text-red-600">{message}</div>}

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

      {expFormOpen && (
        <div className="fixed inset-0 flex items-center justify-center bg-black/40 p-4 z-50">
          <div className="bg-white rounded-lg shadow p-6 w-full max-w-md">
            <h2 className="text-lg font-semibold mb-4">Add Expense</h2>
            <form onSubmit={saveExpense} className="space-y-3">
              <div>
                <label className="text-sm text-gray-600 block">Date</label>
                <input type="date" value={expenseForm.date} onChange={(e)=>setExpenseForm({...expenseForm,date:e.target.value})} className="w-full border rounded p-2"/>
              </div>
              <div>
                <label className="text-sm text-gray-600 block">Amount</label>
                <input value={expenseForm.amount} onChange={(e)=>setExpenseForm({...expenseForm,amount:e.target.value})} className="w-full border rounded p-2" />
              </div>
              <div>
                <label className="text-sm text-gray-600 block">Category</label>
                <input value={expenseForm.category} onChange={(e)=>setExpenseForm({...expenseForm,category:e.target.value})} className="w-full border rounded p-2" />
              </div>
              <div>
                <label className="text-sm text-gray-600 block">Supplier (optional)</label>
                <input value={expenseForm.supplier} onChange={(e)=>setExpenseForm({...expenseForm,supplier:e.target.value})} className="w-full border rounded p-2" />
              </div>
              <div>
                <label className="text-sm text-gray-600 block">Invoice # (optional)</label>
                <input value={expenseForm.invoice_no} onChange={(e)=>setExpenseForm({...expenseForm,invoice_no:e.target.value})} className="w-full border rounded p-2" />
              </div>
              <div>
                <label className="text-sm text-gray-600 block">Payment method</label>
                <input value={expenseForm.payment_method} onChange={(e)=>setExpenseForm({...expenseForm,payment_method:e.target.value})} className="w-full border rounded p-2" />
              </div>
              <div>
                <label className="text-sm text-gray-600 block">Notes</label>
                <input value={expenseForm.notes} onChange={(e)=>setExpenseForm({...expenseForm,notes:e.target.value})} className="w-full border rounded p-2" />
              </div>

              <div className="flex justify-end gap-2">
                <button type="button" onClick={()=>setExpFormOpen(false)} className="px-3 py-2 border rounded">Cancel</button>
                <button type="submit" className="px-3 py-2 bg-blue-600 text-white rounded">Save Expense</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
