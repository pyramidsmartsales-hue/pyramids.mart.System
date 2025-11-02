// client/src/pages/Clients.jsx
import React, { useEffect, useState } from "react";

const API = import.meta.env.VITE_API_URL || "";

export default function Clients() {
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ name: "", phone: "", area: "", notes: "" });
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchClients();
  }, []);

  async function fetchClients() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API}/api/clients`);
      if (!res.ok) throw new Error("Failed");
      const json = await res.json();
      const data = json.data?.data ?? json.data ?? json.clients ?? json;
      setClients(Array.isArray(data) ? data : []);
    } catch (e) {
      console.error("fetch clients failed", e);
      setError("فشل تحميل قائمة العملاء. تحقق من وحدة التحكم (Console).");
    } finally {
      setLoading(false);
    }
  }

  function onChange(e) {
    setForm(prev => ({ ...prev, [e.target.name]: e.target.value }));
  }

  // ensure international code present; default +254 if missing (you can change default)
  function normalizePhone(phone) {
    if (!phone) return "";
    const p = phone.trim();
    if (p.startsWith("+")) return p;
    // if starts with 0 replace with +254 (common for Kenya) - this is heuristic
    if (p.startsWith("0")) return "+254" + p.slice(1);
    // if looks like local number length 9 or 10, prefix +254
    if (/^\d{9,10}$/.test(p)) return "+254" + p;
    // otherwise return as-is
    return p;
  }

  async function onAdd(e) {
    e.preventDefault();
    setSaving(true);
    setError(null);

    if (!form.name || !form.phone) {
      setError("يجب إدخال الاسم ورقم الهاتف.");
      setSaving(false);
      return;
    }

    try {
      const payload = {
        name: form.name,
        phone: normalizePhone(form.phone),
        area: form.area || "",
        notes: form.notes || "",
        points: 0 // init points
      };

      const res = await fetch(`${API}/api/clients`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      if (!res.ok) throw new Error("Failed to add");
      await fetchClients();
      setForm({ name: "", phone: "", area: "", notes: "" });
    } catch (err) {
      console.error("Add client failed:", err);
      const msg = err?.message || "فشل الحفظ";
      setError(String(msg));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <h2 className="text-2xl font-semibold mb-4">العملاء</h2>

      <form onSubmit={onAdd} className="bg-white p-4 rounded shadow-sm mb-4 grid grid-cols-1 md:grid-cols-8 gap-3 items-end">
        <div className="md:col-span-2">
          <label className="text-sm text-gray-600 block mb-1">الاسم</label>
          <input name="name" value={form.name} onChange={onChange} className="w-full border rounded px-3 py-2" />
        </div>

        <div className="md:col-span-2">
          <label className="text-sm text-gray-600 block mb-1">الهاتف</label>
          <input name="phone" value={form.phone} onChange={onChange} className="w-full border rounded px-3 py-2" placeholder="+249..." />
        </div>

        <div className="md:col-span-2">
          <label className="text-sm text-gray-600 block mb-1">المنطقة</label>
          <input name="area" value={form.area} onChange={onChange} className="w-full border rounded px-3 py-2" />
        </div>

        <div className="md:col-span-2">
          <label className="text-sm text-gray-600 block mb-1">ملاحظات</label>
          <input name="notes" value={form.notes} onChange={onChange} className="w-full border rounded px-3 py-2" />
        </div>

        <div className="md:col-span-8 flex gap-2">
          <button type="submit" disabled={saving} className="ml-auto px-4 py-2 bg-green-600 text-white rounded">
            {saving ? "جارٍ الحفظ..." : "إضافة عميل"}
          </button>
        </div>
      </form>

      {error && <div className="mb-4 text-sm text-red-600 bg-red-50 p-2 rounded">{error}</div>}

      <div className="bg-white rounded p-4 shadow-sm">
        {loading ? (
          <div>جارٍ تحميل العملاء...</div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="text-left text-sm text-gray-600">
                <th>#</th>
                <th>الاسم</th>
                <th>الهاتف</th>
                <th>المنطقة</th>
                <th>ملاحظات</th>
                <th>نقاط</th>
              </tr>
            </thead>
            <tbody>
              {clients && clients.length ? clients.map((c, i) => (
                <tr key={c._id || c.id || i} className="border-t">
                  <td className="py-2">{i+1}</td>
                  <td className="py-2">{c.name}</td>
                  <td className="py-2">{c.phone}</td>
                  <td className="py-2">{c.area}</td>
                  <td className="py-2">{c.notes}</td>
                  <td className="py-2">{c.points ?? 0}</td>
                </tr>
              )) : (
                <tr><td colSpan="6" className="py-6 text-center text-gray-500">لا يوجد عملاء بعد.</td></tr>
              )}
            </tbody>
          </table>
        )}
      </div>

      <div className="mt-4 text-xs text-gray-500">عنوان API الحالي: <span className="font-mono">{API}</span></div>
    </div>
  );
}
