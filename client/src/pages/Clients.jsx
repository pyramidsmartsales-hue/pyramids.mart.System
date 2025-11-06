// client/src/Clients.jsx
import React, { useEffect, useState, useCallback } from "react";
import socket from "./socket";

/**
 * Clients component
 * - يستدعي /api/clients للحصول على البيانات
 * - يستمع لحدث 'clients:sync' عبر socket ليعيد تحميل البيانات تلقائياً
 *
 * ملاحظة: تأكد أن REACT_APP_API_URL (أو VITE_API_URL) مضبوطة أثناء البناء إذا كان الـ API على دومين مختلف.
 */

export default function Clients() {
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const apiBase = process.env.REACT_APP_API_URL || ""; // اتركها فارغة إذا السيرفر والفرونت على نفس الأصل

  const fetchClients = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${apiBase}/api/clients`);
      if (!res.ok) {
        const txt = await res.text().catch(() => "");
        throw new Error(`Failed to fetch clients: ${res.status} ${txt}`);
      }
      const data = await res.json();
      setClients(Array.isArray(data) ? data : (data?.clients || []));
    } catch (err) {
      console.error("fetchClients error:", err);
      setError(err.message || "Error fetching clients");
    } finally {
      setLoading(false);
    }
  }, [apiBase]);

  useEffect(() => {
    // initial load
    fetchClients();

    // handle realtime sync events
    const handler = (payload) => {
      console.log("clients:sync event received:", payload);
      // simple strategy: always re-fetch full list on any sync event
      fetchClients();
    };

    socket.on("clients:sync", handler);

    return () => {
      socket.off("clients:sync", handler);
    };
  }, [fetchClients]);

  return (
    <div style={{ padding: 12 }}>
      <h2>العملاء</h2>

      {loading && <div>جارٍ التحميل...</div>}
      {error && <div style={{ color: "red" }}>خطأ: {error}</div>}

      <table style={{ width: "100%", borderCollapse: "collapse", marginTop: 12 }}>
        <thead>
          <tr>
            <th style={{ borderBottom: "1px solid #ddd", textAlign: "left", padding: 6 }}>#</th>
            <th style={{ borderBottom: "1px solid #ddd", textAlign: "left", padding: 6 }}>الاسم</th>
            <th style={{ borderBottom: "1px solid #ddd", textAlign: "left", padding: 6 }}>الهاتف</th>
            <th style={{ borderBottom: "1px solid #ddd", textAlign: "left", padding: 6 }}>المدينة</th>
            <th style={{ borderBottom: "1px solid #ddd", textAlign: "left", padding: 6 }}>حالة المزامنة</th>
          </tr>
        </thead>
        <tbody>
          {clients.length === 0 && !loading ? (
            <tr>
              <td colSpan={5} style={{ padding: 8 }}>لا توجد بيانات</td>
            </tr>
          ) : (
            clients.map((c, i) => (
              <tr key={c._id || c.external_id || i}>
                <td style={{ borderBottom: "1px solid #f0f0f0", padding: 6 }}>{i + 1}</td>
                <td style={{ borderBottom: "1px solid #f0f0f0", padding: 6 }}>{c.name}</td>
                <td style={{ borderBottom: "1px solid #f0f0f0", padding: 6 }}>{c.phone}</td>
                <td style={{ borderBottom: "1px solid #f0f0f0", padding: 6 }}>{c.city || c.region || ""}</td>
                <td style={{ borderBottom: "1px solid #f0f0f0", padding: 6 }}>{c.last_synced_by || c.sync_status || ""}</td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
