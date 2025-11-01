import React, { useEffect, useState, useRef } from "react";
import axios from "axios";
import { io } from "socket.io-client";

/**
 * Dashboard component
 * - Show QR button + modal (requests /api/messages/qr.png)
 * - status icon (polls /api/messages/status on load and listens to socket events)
 * - Send Broadcast form: numbers (CSV or JSON array) + message -> POST /api/messages
 *
 * Assumes VITE_API_URL is set in environment (e.g. https://pyramids-mart-system.onrender.com)
 * If VITE_API_URL is empty, it will use the same origin.
 */

export default function Dashboard() {
  // analytics summary kept from original
  const [summary, setSummary] = useState(null);
  const [loadingSummary, setLoadingSummary] = useState(true);

  // whatsapp states
  const [waConnected, setWaConnected] = useState(false);
  const [qrVisible, setQrVisible] = useState(false);
  const [qrSrc, setQrSrc] = useState("");
  const [sending, setSending] = useState(false);
  const [sendResult, setSendResult] = useState(null);

  const [messageText, setMessageText] = useState("");
  const [numbersText, setNumbersText] = useState(""); // comma separated or JSON array

  // socket ref to avoid reconnect loops
  const socketRef = useRef(null);

  // base API url from env
  const base = import.meta.env.VITE_API_URL || "";

  // load analytics summary (original code)
  useEffect(() => {
    const url = `${base}/api/analytics/summary`;
    let mounted = true;
    setLoadingSummary(true);
    axios.get(url)
      .then(r => { if (mounted) setSummary(r.data?.data ?? null); })
      .catch((e) => { console.warn("dashboard summary fetch failed", e?.message || e); })
      .finally(() => { if (mounted) setLoadingSummary(false); });

    return () => { mounted = false; };
  }, [base]);

  // initialize socket and status on mount
  useEffect(() => {
    // connect socket.io (use base if provided, otherwise same origin)
    const socketUrl = base || undefined;
    const socket = io(socketUrl, { autoConnect: true });
    socketRef.current = socket;

    // socket event handlers
    socket.on("connect", () => {
      // console.log("socket connected", socket.id);
      // request immediate status (optional)
      socket.emit("whatsapp:status", (res) => {
        if (res && typeof res.connected !== "undefined") setWaConnected(!!res.connected);
      });
    });

    socket.on("whatsapp:ready", () => setWaConnected(true));
    socket.on("whatsapp:authenticated", () => setWaConnected(true));
    socket.on("whatsapp:disconnected", () => setWaConnected(false));
    socket.on("whatsapp:auth_failure", () => setWaConnected(false));

    // when server emits QR text, request PNG from server and show modal
    socket.on("whatsapp:qr", (payload) => {
      // payload.qr exists but we prefer to fetch server PNG (qr.png) which we added on backend
      // cache-bust using timestamp
      const src = `${base || ""}/api/messages/qr.png?ts=${Date.now()}`;
      setQrSrc(src);
      setQrVisible(true);
    });

    // fallback: if server emits an init error
    socket.on("whatsapp:init_error", (data) => {
      console.warn("WhatsApp init error:", data);
      setWaConnected(false);
    });

    // cleanup on unmount
    return () => {
      if (socket) {
        socket.off("whatsapp:ready");
        socket.off("whatsapp:authenticated");
        socket.off("whatsapp:disconnected");
        socket.off("whatsapp:qr");
        socket.off("whatsapp:init_error");
        socket.disconnect();
      }
      socketRef.current = null;
    };
  }, [base]);

  // initial status check via HTTP (in case socket not connected yet)
  useEffect(() => {
    const check = async () => {
      try {
        const res = await axios.get(`${base}/api/messages/status`);
        setWaConnected(!!res.data?.connected);
      } catch (e) {
        setWaConnected(false);
      }
    };
    check();
  }, [base]);

  // helper to open QR (manual by clicking Show QR)
  const handleShowQr = async () => {
    try {
      const res = await axios.get(`${base}/api/messages/qr`);
      if (res.data && res.data.qr) {
        setQrSrc(`${base}/api/messages/qr.png?ts=${Date.now()}`);
        setQrVisible(true);
      } else {
        alert("لا يوجد QR حالياً — تأكد من لوجات السيرفر أو اعد تشغيل واتساب على السيرفر.");
      }
    } catch (err) {
      console.error("Failed to fetch QR:", err);
      alert("فشل جلب QR من السيرفر. راجع لوجات السيرفر.");
    }
  };

  // close QR modal
  const closeQrModal = () => {
    setQrVisible(false);
  };

  // parse numbers input into array of E.164 or numeric strings
  const parseNumbersInput = (text) => {
    // allow JSON array (e.g. ["2547..","2547.."]) or CSV
    text = (text || "").trim();
    if (!text) return [];
    try {
      const parsed = JSON.parse(text);
      if (Array.isArray(parsed)) return parsed.map(String);
    } catch (e) { /* not JSON */ }
    // split by comma, newline, or space
    const parts = text.split(/[\n,;]+/).map(s => s.trim()).filter(Boolean);
    return parts;
  };

  // send broadcast
  const handleSendBroadcast = async (e) => {
    e.preventDefault();
    const numbersArr = parseNumbersInput(numbersText);
    if (!numbersArr.length) {
      alert("المرجو إدخال أرقام (مفصولة بفاصلة أو سطر جديد). مثال: 2547XXXXXXXX,2547YYYYYYYY");
      return;
    }
    if (!messageText.trim()) {
      alert("المرجو كتابة نص الرسالة.");
      return;
    }

    setSending(true);
    setSendResult(null);

    try {
      const payload = {
        numbers: numbersArr,
        message: messageText.trim()
      };
      const res = await axios.post(`${base}/api/messages`, payload);
      setSendResult(res.data);
      if (res.data && res.data.ok) {
        alert("تم إرسال الرسالة (راجع نتائج الإرسال في الأسفل).");
        // optionally clear inputs
        // setMessageText("");
        // setNumbersText("");
      } else {
        alert("الاستجابة من الخادم: " + (res.data?.error || JSON.stringify(res.data)));
      }
    } catch (err) {
      console.error("Send broadcast failed:", err);
      if (err.response && err.response.status === 503) {
        alert("WhatsApp غير متصل الآن (503). افتح QR وامسحه ثم حاول مرة أخرى.");
        setWaConnected(false);
      } else {
        alert("فشل إرسال الرسالة: " + (err.message || JSON.stringify(err)));
      }
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-semibold mb-4">Dashboard</h2>

      {/* top summary (original) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="p-4 bg-white rounded-xl shadow-sm border">
          <div className="text-sm text-gray-500">Total clients</div>
          <div className="text-3xl font-bold">{loadingSummary ? "..." : (summary?.totalClients ?? "—")}</div>
        </div>

        <div className="p-4 bg-white rounded-xl shadow-sm border">
          <div className="text-sm text-gray-500">Messages today</div>
          <div className="text-3xl font-bold">{loadingSummary ? "..." : (summary?.messagesToday ?? "—")}</div>
        </div>

        <div className="p-4 bg-white rounded-xl shadow-sm border">
          <div className="text-sm text-gray-500">Placeholder</div>
          <div className="text-3xl font-bold">—</div>
        </div>
      </div>

      {/* WhatsApp controls */}
      <div className="mt-6 bg-white rounded-xl p-6 shadow-sm border">
        <div className="flex items-center gap-3 mb-4">
          <button
            id="showQrBtn"
            onClick={handleShowQr}
            className="px-4 py-2 rounded bg-blue-600 text-white hover:bg-blue-700"
          >
            Show QR
          </button>

          <span
            id="waStatusIcon"
            title={waConnected ? "WhatsApp connected" : "WhatsApp not connected"}
            style={{
              marginLeft: 8,
              fontSize: 18,
              verticalAlign: "middle",
              color: waConnected ? "#16a34a" : "#e11d48"
            }}
          >
            ●
          </span>

          <div className="ml-4 text-sm text-gray-600">
            {waConnected ? "Connected" : "Not connected"}
          </div>
        </div>

        {/* Broadcast form */}
        <form onSubmit={handleSendBroadcast} className="space-y-3">
          <div>
            <label className="block text-sm font-medium text-gray-700">Numbers</label>
            <textarea
              rows={2}
              placeholder="2547XXXXXXXX,2547YYYYYYYY أو JSON array مثل: [\"2547..\",\"2547..\"]"
              value={numbersText}
              onChange={(e) => setNumbersText(e.target.value)}
              className="mt-1 block w-full border rounded p-2"
            />
            <p className="text-xs text-gray-500 mt-1">يمكن فصل الأرقام بفواصل أو أسطر جديدة.</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">Message</label>
            <textarea
              rows={4}
              placeholder="اكتب الرسالة هنا"
              value={messageText}
              onChange={(e) => setMessageText(e.target.value)}
              className="mt-1 block w-full border rounded p-2"
            />
          </div>

          <div className="flex items-center gap-3">
            <button
              type="submit"
              disabled={sending}
              className={`px-4 py-2 rounded text-white ${sending ? "bg-gray-400" : "bg-green-600 hover:bg-green-700"}`}
            >
              {sending ? "Sending..." : "Send Broadcast"}
            </button>

            <button
              type="button"
              onClick={() => { setMessageText(""); setNumbersText(""); setSendResult(null); }}
              className="px-3 py-2 rounded border"
            >
              Reset
            </button>
          </div>

          {sendResult && (
            <div className="mt-3 p-3 bg-gray-50 rounded border text-sm">
              <strong>Send result:</strong>
              <pre style={{ whiteSpace: "pre-wrap", marginTop: 8 }}>{JSON.stringify(sendResult, null, 2)}</pre>
            </div>
          )}
        </form>
      </div>

      {/* Recent activity (kept from original) */}
      <div className="mt-6 bg-white rounded-xl p-6 shadow-sm border">
        <h3 className="text-lg font-semibold mb-2">Recent activity</h3>
        <p className="text-sm text-gray-500">No recent activity yet.</p>
      </div>

      {/* QR Modal */}
      {qrVisible && (
        <div
          id="qrModal"
          role="dialog"
          aria-hidden={!qrVisible}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.5)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000
          }}
        >
          <div style={{ position: "relative", background: "#fff", padding: 16, borderRadius: 8, textAlign: "center", maxWidth: 380, width: "90%" }}>
            <button
              id="closeQr"
              onClick={closeQrModal}
              style={{ position: "absolute", right: 12, top: 8, background: "transparent", border: 0, fontSize: 22, cursor: "pointer" }}
            >
              ×
            </button>

            <h3 style={{ marginBottom: 12 }}>Scan QR with WhatsApp</h3>
            <div style={{ marginBottom: 12 }}>
              <img id="qrImage" src={qrSrc} alt="WhatsApp QR" style={{ width: 300, height: 300, objectFit: "contain" }} />
            </div>
            <p style={{ fontSize: 13, color: "#444" }}>If QR not showing or invalid, check server logs and ensure the server generated a QR.</p>
          </div>
        </div>
      )}
    </div>
  );
}
