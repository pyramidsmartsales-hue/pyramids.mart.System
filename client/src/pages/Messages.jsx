// client/src/pages/Messages.jsx
import React, { useContext, useEffect, useState } from "react";
import api, { API_BASE } from "../services/api";
import { SocketContext } from "../App";

export default function Messages() {
  const socket = useContext(SocketContext);
  const [message, setMessage] = useState("");
  const [file, setFile] = useState(null);

  const [clients, setClients] = useState([]);
  const [filtered, setFiltered] = useState([]);
  const [filterText, setFilterText] = useState("");
  const [selected, setSelected] = useState(new Set());
  const [selectAll, setSelectAll] = useState(false);

  const [messages, setMessages] = useState([]);
  const [loadingClients, setLoadingClients] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(true);

  const [sending, setSending] = useState(false);
  const [error, setError] = useState(null);
  const [successMsg, setSuccessMsg] = useState(null);

  useEffect(() => {
    fetchClients();
    fetchMessages();

    // listen to socket progress or updates if socket is available
    if (socket && socket.on) {
      socket.on("wa:progress", (p) => {
        console.log("wa progress:", p);
      });
    }
    return () => {
      if (socket && socket.off) {
        socket.off("wa:progress");
      }
    };
    // eslint-disable-next-line
  }, []);

  useEffect(() => {
    applyFilter(filterText);
    // eslint-disable-next-line
  }, [clients, filterText]);

  async function fetchClients() {
    setLoadingClients(true);
    setError(null);
    try {
      const res = await api.get("/api/clients");
      const data = res.data?.data ?? res.data ?? [];
      setClients(data);
      setFiltered(data);
    } catch (err) {
      console.error("fetchClients error:", err);
      setError("فشل جلب قائمة العملاء. تحقق من Console.");
    } finally {
      setLoadingClients(false);
    }
  }

  async function fetchMessages() {
    setLoadingMessages(true);
    try {
      const res = await api.get("/api/messages");
      const data = res.data?.data ?? res.data ?? [];
      setMessages(data);
    } catch (err) {
      console.error("fetchMessages error:", err);
    } finally {
      setLoadingMessages(false);
    }
  }

  function applyFilter(text) {
    if (!text) {
      setFiltered(clients);
      return;
    }
    const t = text.toLowerCase();
    setFiltered(
      clients.filter(
        (c) =>
          (c.name || "").toLowerCase().includes(t) ||
          (c.phone || "").toLowerCase().includes(t) ||
          (c.area || "").toLowerCase().includes(t)
      )
    );
  }

  function toggleSelection(id) {
    setSelected((prev) => {
      const s = new Set(prev);
      if (s.has(id)) s.delete(id);
      else s.add(id);
      // if user manually toggles, uncheck selectAll
      setSelectAll(false);
      return s;
    });
  }

  function onSelectAll() {
    if (selectAll) {
      setSelected(new Set());
      setSelectAll(false);
    } else {
      const ids = (filtered || clients).map((c) => c._id || c.id || c.phone);
      setSelected(new Set(ids));
      setSelectAll(true);
    }
  }

  async function sendBroadcast(e) {
    e.preventDefault();
    setError(null);
    setSuccessMsg(null);

    const recipients = Array.from(selected);
    if (recipients.length === 0) {
      setError("يرجى اختيار عميل واحد على الأقل لإرسال الرسالة.");
      return;
    }
    if (!message && !file) {
      setError("أدخل رسالة أو اختر ملفًا لإرساله.");
      return;
    }

    setSending(true);
    try {
      const form = new FormData();
      form.append("message", message);
      form.append("recipients", JSON.stringify(recipients));
      if (file) form.append("file", file);

      // إرسال multipart/form-data إلى السيرفر
      const res = await api.post("/api/messages", form, {
        headers: { "Content-Type": "multipart/form-data" },
        timeout: 60000,
      });

      console.log("broadcast response:", res.data);
      setSuccessMsg(res.data?.message || "تم الإرسال بنجاح.");
      setMessage("");
      setFile(null);
      setSelected(new Set());
      setSelectAll(false);

      // reload messages and clients if needed
      fetchMessages();
      // أرسل حدث socket اختياري للسيرفر/العملاء
      try {
        if (socket && socket.emit) {
          socket.emit("broadcast:sent", { count: recipients.length });
        }
      } catch (sErr) {
        console.warn("socket emit failed", sErr);
      }
    } catch (err) {
      console.error("broadcast failed:", err);
      const msg = err?.response?.data?.message || err?.message || "فشل إرسال البث";
      setError(String(msg));
    } finally {
      setSending(false);
    }
  }

  return (
    <div>
      <h2 className="text-2xl font-semibold mb-4">Messages</h2>

      <div className="bg-white p-4 rounded shadow-sm mb-4">
        <label className="block mb-2 text-sm text-gray-600">فلترة العملاء (اسم، هاتف، منطقة)</label>
        <div className="flex gap-2">
          <input
            className="flex-1 border rounded px-3 py-2"
            placeholder="ابحث باسم أو رقم أو منطقة..."
            value={filterText}
            onChange={(e) => setFilterText(e.target.value)}
          />
          <button type="button" onClick={onSelectAll} className="px-3 py-2 bg-gray-100 border rounded">
            {selectAll ? "إلغاء التحديد" : "تحديد الكل (نتائج الفلتر)"}
          </button>
          <button
            type="button"
            onClick={() => {
              setFilterText("");
              setSelected(new Set());
              setSelectAll(false);
            }}
            className="px-3 py-2 bg-gray-100 border rounded"
          >
            مسح
          </button>
        </div>
      </div>

      <div className="bg-white p-4 rounded shadow-sm mb-6">
        <div className="overflow-x-auto">
          {loadingClients ? (
            <div>جارٍ تحميل العملاء...</div>
          ) : (
            <table className="w-full">
              <thead>
                <tr className="text-left text-sm text-gray-600">
                  <th style={{ width: 80 }}>اختيار</th>
                  <th>#</th>
                  <th>الاسم</th>
                  <th>الهاتف</th>
                  <th>المنطقة</th>
                </tr>
              </thead>
              <tbody>
                {(filtered || []).length === 0 ? (
                  <tr>
                    <td colSpan="5" className="py-6 text-center text-gray-500">
                      لا توجد نتائج
                    </td>
                  </tr>
                ) : (
                  (filtered || []).map((c, i) => {
                    const id = c._id || c.id || c.phone;
                    return (
                      <tr key={id} className="border-t">
                        <td className="py-2">
                          <input
                            type="checkbox"
                            checked={selected.has(id)}
                            onChange={() => toggleSelection(id)}
                          />
                        </td>
                        <td className="py-2">{i + 1}</td>
                        <td className="py-2">{c.name}</td>
                        <td className="py-2">{c.phone}</td>
                        <td className="py-2">{c.area}</td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          )}
        </div>
      </div>

      <form onSubmit={sendBroadcast} className="bg-white p-4 rounded shadow-sm">
        <label className="block mb-2 text-sm text-gray-600">اكتب الرسالة</label>
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          className="w-full border rounded p-2 min-h-[120px]"
          placeholder="اكتب النص الذي تريده..."
        />

        <div className="mt-3">
          <input
            type="file"
            onChange={(e) => {
              setFile(e.target.files?.[0] ?? null);
            }}
          />
        </div>

        {error && <div className="mt-3 text-sm text-red-600 bg-red-50 p-2 rounded">{error}</div>}
        {successMsg && <div className="mt-3 text-sm text-green-700 bg-green-50 p-2 rounded">{successMsg}</div>}

        <div className="mt-4">
          <button type="submit" disabled={sending} className="px-4 py-2 bg-blue-600 text-white rounded">
            {sending ? "جارٍ الإرسال..." : "Send Broadcast"}
          </button>
        </div>

        <div className="mt-3 text-xs text-gray-500">
          API Base: <span className="font-mono">{API_BASE}</span>
        </div>
      </form>

      <div className="mt-6">
        <h3 className="text-lg font-medium mb-2">Broadcast history</h3>
        {loadingMessages ? (
          <div>جارٍ تحميل الرسائل...</div>
        ) : messages.length ? (
          <div className="space-y-2">
            {messages.map((m) => (
              <div key={m._id || m.id} className="p-3 bg-white rounded shadow">
                <div className="text-sm text-gray-500">{new Date(m.createdAt).toLocaleString()}</div>
                <div className="font-medium mt-1">{m.message || m.body || m.text}</div>
                <div className="text-xs text-gray-500 mt-1">Recipients: {Array.isArray(m.recipients) ? m.recipients.length : (m.recipients ? String(m.recipients) : "-")}</div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-gray-500">لا توجد رسائل سابقة.</div>
        )}
      </div>
    </div>
  );
}
