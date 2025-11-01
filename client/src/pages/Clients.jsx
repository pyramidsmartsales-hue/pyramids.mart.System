import React, { useEffect, useState } from "react";
import api, { API_BASE } from "../services/api";

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
      const res = await api.get("/api/clients");
      const data = res.data?.data ?? res.data ?? [];
      setClients(data);
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
        phone: form.phone,
        area: form.area || "",
        notes: form.notes || ""
      };

      const res = await api.post("/api/clients", payload);
      console.log("Add client response:", res.data);

      setForm({ name: "", phone: "", area: "", notes: "" });
      await fetchClients();
    } catch (err) {
      console.error("Add client failed:", err);
      const msg = err?.response?.data?.message ||
                  err?.response?.data ||
                  err.message ||
                  "فشل الحفظ";
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
                </tr>
              )) : (
                <tr><td colSpan="5" className="py-6 text-center text-gray-500">لا يوجد عملاء بعد.</td></tr>
              )}
            </tbody>
          </table>
        )}
      </div>

      <div className="mt-4 text-xs text-gray-500">عنوان API الحالي: <span className="font-mono">{API_BASE}</span></div>
    </div>
  );
}
