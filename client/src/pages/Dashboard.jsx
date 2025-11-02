// client/src/pages/Dashboard.jsx
import React, { useEffect, useState, useRef } from "react";
import axios from "axios";
import { io } from "socket.io-client";

/**
 * Dashboard component (uses VITE_API_URL)
 * Minimal edits: use /api/overview and add "send to all clients" feature.
 */

export default function Dashboard() {
  const [summary, setSummary] = useState(null);
  const [loadingSummary, setLoadingSummary] = useState(true);

  const [waConnected, setWaConnected] = useState(false);
  const [qrVisible, setQrVisible] = useState(false);
  const [qrSrc, setQrSrc] = useState("");
  const [sending, setSending] = useState(false);
  const [sendResult, setSendResult] = useState(null);
  const [sendAllResult, setSendAllResult] = useState(null);

  const [messageText, setMessageText] = useState("");
  const [numbersText, setNumbersText] = useState("");

  const socketRef = useRef(null);
  const base = import.meta.env.VITE_API_URL || "";

  // Fetch overview summary (replaces analytics/summary)
  useEffect(() => {
    const url = (base ? `${base}` : "") + "/api/overview";
    let mounted = true;
    setLoadingSummary(true);
    axios.get(url)
      .then(r => {
        // support various response shapes
        const payload = r.data ?? {};
        // try common keys
        const s = {
          totalSales: payload.totalSales ?? payload.data?.totalSales ?? payload.total_sales ?? null,
          netProfit: payload.netProfit ?? payload.data?.netProfit ?? payload.net_profit ?? null,
          expenses: payload.expenses ?? payload.data?.expenses ?? null,
          invoiceCount: payload.invoiceCount ?? payload.data?.invoiceCount ?? null
        };
        if (mounted) setSummary(s);
      })
      .catch((e) => {
        console.warn("dashboard overview fetch failed", e?.message || e);
        if (mounted) setSummary(null);
      })
      .finally(() => { if (mounted) setLoadingSummary(false); });

    return () => { mounted = false; };
  }, [base]);

  // Socket setup for whatsapp events (unchanged)
  useEffect(() => {
    const socketUrl = base || undefined;
    const socket = io(socketUrl, { autoConnect: true });
    socketRef.current = socket;

    socket.on("connect", () => {
      socket.emit("whatsapp:status", (res) => {
        if (res && typeof res.connected !== "undefined") setWaConnected(!!res.connected);
      });
    });

    socket.on("whatsapp:ready", () => setWaConnected(true));
    socket.on("whatsapp:authenticated", () => setWaConnected(true));
    socket.on("whatsapp:disconnected", () => setWaConnected(false));
    socket.on("whatsapp:auth_failure", () => setWaConnected(false));

    socket.on("whatsapp:qr", (payload) => {
      const src = (base ? `${base}` : "") + "/api/messages/qr.png?ts=" + Date.now();
      setQrSrc(src);
      setQrVisible(true);
    });

    socket.on("whatsapp:init_error", (data) => {
      console.warn("WhatsApp init error:", data);
      setWaConnected(false);
    });

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

  // Quick status check for whatsapp endpoint
  useEffect(() => {
    const check = async () => {
      try {
        const res = await axios.get((base ? `${base}` : "") + "/api/messages/status");
        setWaConnected(!!res.data?.connected);
      } catch (e) {
        setWaConnected(false);
      }
    };
    check();
  }, [base]);

  const handleShowQr = async () => {
    try {
      const res = await axios.get((base ? `${base}` : "") + "/api/messages/qr");
      if (res.data && res.data.qr) {
        setQrSrc((base ? `${base}` : "") + "/api/messages/qr.png?ts=" + Date.now());
        setQrVisible(true);
      } else {
        alert("No QR available currently.");
      }
    } catch (err) {
      console.error("Failed to fetch QR:", err);
      alert("Failed to fetch QR from server. Check server logs.");
    }
  };

  const closeQrModal = () => {
    setQrVisible(false);
  };

  const parseNumbersInput = (text) => {
    // Accept JSON array or comma/newline/semicolon separated list.
    if (!text || !text.trim()) return [];
    const trimmed = text.trim();

    // Try JSON parse first
    try {
      const parsed = JSON.parse(trimmed);
      if (Array.isArray(parsed)) return parsed.map(String);
    } catch (e) {
      // not JSON, fallthrough
    }

    // Split on commas, semicolons or newlines
    const parts = trimmed.split(/[\n,;]+/);
    return parts.map(p => p.trim()).filter(Boolean);
  };

  const handleSendBroadcast = async (e) => {
    e.preventDefault();
    const numbersArr = parseNumbersInput(numbersText);
    if (!numbersArr.length) {
      alert("Please enter numbers (comma or newline separated).");
      return;
    }
    if (!messageText.trim()) {
      alert("Please enter a message.");
      return;
    }

    setSending(true);
    setSendResult(null);

    try {
      const payload = { numbers: numbersArr, message: messageText.trim() };
      const res = await axios.post((base ? `${base}` : "") + "/api/messages", payload, { timeout: 60000 });
      setSendResult(res.data);
      if (res.data && res.data.ok) {
        alert("Sent. Check result below.");
      } else {
        alert("Server response: " + (res.data?.error || JSON.stringify(res.data)));
      }
    } catch (err) {
      console.error("Send broadcast failed:", err);
      if (err.response && err.response.status === 503) {
        alert("WhatsApp not connected (503).");
        setWaConnected(false);
      } else {
        alert("Send failed: " + (err.message || JSON.stringify(err)));
      }
    } finally {
      setSending(false);
    }
  };

  // NEW: send to all clients (fetch /api/clients then broadcast)
  const handleSendToAll = async () => {
    if (!confirm("Send this message to ALL clients? Make sure you want to broadcast.")) return;
    setSendAllResult(null);

    if (!messageText.trim()) {
      alert("Please enter a message to send.");
      return;
    }

    setSending(true);
    try {
      const clientsRes = await axios.get((base ? `${base}` : "") + "/api/clients", { timeout: 60000 });
      let clients = [];
      if (clientsRes.data) {
        clients = clientsRes.data.clients ?? clientsRes.data.data ?? clientsRes.data ?? [];
      }
      const numbers = Array.isArray(clients) ? clients.map(c => c.phone).filter(Boolean) : [];
      if (!numbers.length) {
        alert("No client phone numbers found to send to.");
        setSending(false);
        return;
      }

      const res = await axios.post((base ? `${base}` : "") + "/api/messages", { numbers, message: messageText.trim() }, { timeout: 120000 });
      setSendAllResult(res.data);
      if (res.data && res.data.ok) {
        alert("Broadcast sent to all clients (check results below).");
      } else {
        alert("Server response: " + (res.data?.error || JSON.stringify(res.data)));
      }
    } catch (err) {
      console.error("Send to all failed:", err);
      setSendAllResult({ ok: false, error: err.message || String(err) });
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-semibold mb-4">Dashboard</h2>
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

        <form onSubmit={handleSendBroadcast} className="space-y-3">
          <div>
            <label className="block text-sm font-medium text-gray-700">Numbers</label>
            <textarea
              rows={2}
              placeholder={'2547XXXXXXXX,2547YYYYYYYY or JSON array like: ["2547..","2547.."]'}
              value={numbersText}
              onChange={(e) => setNumbersText(e.target.value)}
              className="mt-1 block w-full border rounded p-2"
            />
            <p className="text-xs text-gray-500 mt-1">You can separate numbers with commas or new lines.</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">Message</label>
            <textarea
              rows={4}
              placeholder="Type message here"
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
              onClick={handleSendToAll}
              disabled={sending}
              className="px-3 py-2 rounded border"
            >
              {sending ? "Sending..." : "Send to all clients"}
            </button>

            <button
              type="button"
              onClick={() => { setMessageText(""); setNumbersText(""); setSendResult(null); setSendAllResult(null); }}
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

          {sendAllResult && (
            <div className="mt-3 p-3 bg-gray-50 rounded border text-sm">
              <strong>Send all result:</strong>
              <pre style={{ whiteSpace: "pre-wrap", marginTop: 8 }}>{JSON.stringify(sendAllResult, null, 2)}</pre>
            </div>
          )}
        </form>
      </div>

      <div className="mt-6 bg-white rounded-xl p-6 shadow-sm border">
        <h3 className="text-lg font-semibold mb-2">Recent activity</h3>
        <p className="text-sm text-gray-500">No recent activity yet.</p>
      </div>

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
