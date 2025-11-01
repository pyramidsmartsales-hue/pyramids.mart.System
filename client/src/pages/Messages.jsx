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

  const [sendResult, setSendResult] = useState(null); // to show from/results

  useEffect(() => {
    fetchClients();
    fetchMessages();

    // listen to socket progress or updates if socket is available
    if (socket && socket.on) {
      socket.on("wa:progress", (p) => {
        console.log("wa progress:", p);
      });
      socket.on("whatsapp:send_result", (payload) => {
        console.log("socket whatsapp:send_result", payload);
        // payload may contain { from, results }
        setSendResult(payload);
      });
    }
    return () => {
      if (socket && socket.off) {
        socket.off("wa:progress");
        socket.off("whatsapp:send_result");
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

  // Build normalized phone numbers array from selected ids
  function buildNumbersFromSelection() {
    const arr = [];
    for (const id of Array.from(selected)) {
      const c = clients.find((x) => (x._id || x.id || x.phone) === id);
      if (!c) continue;
      // assume phone stored in c.phone (fallbacks included)
      let p = c.phone || c.mobile || c.number || "";
      p = String(p || "").trim();
      // remove plus sign and any non-digits
      p = p.replace(/\D/g, "");
      if (p) arr.push(p);
    }
    return arr;
  }

  async function sendBroadcast(e) {
    e.preventDefault();
    setError(null);
    setSuccessMsg(null);
    setSendResult(null);

    const numbers = buildNumbersFromSelection();
    if (numbers.length === 0) {
      setError("يرجى اختيار عميل واحد على الأقل لإرسال الرسالة.");
      return;
    }
    if (!message && !file) {
      setError("أدخل رسالة أو اختر ملفًا لإرساله.");
      return;
    }

    setSending(true);
    try {
      // If there's a file, use multipart/form-data but include `numbers` as JSON string
      if (file) {
        const form = new FormData();
        form.append("message", message);
        form.append("numbers", JSON.stringify(numbers)); // IMPORTANT: send numbers field
        form.append("recipients", JSON.stringify([])); // keep recipients empty to avoid ambiguity
        form.append("file", file);

        console.log("Sending multipart payload (Messages page):", { numbers, message, fileName: file.name });

        const res = await api.post("/api/messages", form, {
          headers: { "Content-Type": "multipart/form-data" },
          timeout: 60000,
        });

        console.log("broadcast response (multipart):", res.data);
        setSuccessMsg(res.data?.message || "تم الإرسال بنجاح.");
        // If server returns structured result, capture it
        if (res.data?.results || res.data?.from) {
          setSendResult({ from: res.data.from || null, results: res.data.results || null, raw: res.data });
        }
      } else {
        // No file: send JSON body with numbers & message (same as Dashboard)
        const payload = { numbers, message };
        console.log("Sending JSON payload (Messages page):", payload);

        const res = await api.post("/api/messages", payload, { timeout: 60000 });
        console.log("broadcast response (json):", res.data);
        setSuccessMsg(res.data?.message || "تم الإرسال بنجاح.");
        if (res.data?.results || res.data?.from) {
          setSendResult({ from: res.data.from || null, results: res.data.results || null, raw: res.data });
        }
      }

      setMessage("");
      setFile(null);
      setSelected(new Set());
      setSelectAll(false);

      // reload messages and clients if needed
      fetchMessages();
      // emit a local socket event to notify others (optional)
      try {
        if (socket && socket.emit) {
          socket.emit("broadcast:sent", { count: numbers.length });
        }
      } catch (sErr) {
        console.warn("socket emit failed", sErr);
      }
    } catch (err) {
      console.error("broadcast failed:", err);
      const msg = err?.response?.data?.message || err?.response?.data || err?.message || "فشل إرسال البث";
      setError(String(msg));
      // if server returned structured error with details, show them
      if (err?.response?.data?.results || err?.response?.data?.from) {
        setSendResult({ from: err.response.data.from || null, results: err.response.data.results || null, raw: err.response.data });
      }
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

      {/* Show send_result if available */}
      {sendResult && (
        <div className="mt-4 p-3 bg-gray-50 rounded border">
          <h4 className="font-medium mb-2">Send result</h4>
          {sendResult.from && <div className="text-sm mb-1">From: <strong>{sendResult.from}</strong></div>}
          {sendResult.results ? (
            <div className="text-xs">
              {sendResult.results.map((r, idx) => (
                <div key={idx} className="mb-1">
                  <div><strong>to:</strong> {r.to}</div>
                  <div><strong>ok:</strong> {String(r.ok)}</div>
                  {r.ok ? <div><strong>id:</strong> {r.id}</div> : <div style={{ color: "red" }}><strong>error:</strong> {r.error || JSON.stringify(r)}</div>}
                </div>
              ))}
            </div>
          ) : (
            <pre style={{ whiteSpace: "pre-wrap", fontSize: 12 }}>{JSON.stringify(sendResult.raw || sendResult, null, 2)}</pre>
          )}
        </div>
      )}

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
