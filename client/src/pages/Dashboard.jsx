// client/src/pages/Dashboard.jsx
import React, { useEffect, useState, useRef } from "react";
import axios from "axios";
import { io } from "socket.io-client";

/**
 * Dashboard (linked with WhatsApp Web)
 * - Uses /api/whatsapp-web/* instead of /api/messages/*
 * - Displays QR and connection status in real time
 * - Allows sending messages via WhatsApp Web
 */

export default function Dashboard() {
  const [waConnected, setWaConnected] = useState(false);
  const [qrVisible, setQrVisible] = useState(false);
  const [qrSrc, setQrSrc] = useState("");
  const [sending, setSending] = useState(false);
  const [sendResult, setSendResult] = useState(null);
  const [clients, setClients] = useState([]);
  const [selectedClients, setSelectedClients] = useState(new Set());
  const [messageText, setMessageText] = useState("");

  const base = import.meta.env.VITE_API_URL || "";
  const socketRef = useRef(null);

  // Connect socket.io to receive live QR and status
  useEffect(() => {
    const socketUrl = base || undefined;
    const socket = io(socketUrl, { autoConnect: true });
    socketRef.current = socket;

    socket.on("connect", () => console.log("Socket connected"));
    socket.on("whatsapp:qr", (data) => {
      if (data && data.qrDataUrl) {
        setQrSrc(data.qrDataUrl);
        setQrVisible(true);
      }
    });
    socket.on("whatsapp:status", (data) => {
      setWaConnected(!!data?.connected);
    });
    socket.on("whatsapp:disconnected", () => setWaConnected(false));

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, [base]);

  // Periodic status check (backup)
  useEffect(() => {
    const fetchStatus = async () => {
      try {
        const res = await axios.get(`${base}/api/whatsapp-web/status`);
        setWaConnected(!!res.data?.connected);
      } catch {
        setWaConnected(false);
      }
    };
    fetchStatus();
  }, [base]);

  // Load clients
  useEffect(() => {
    (async () => {
      try {
        const res = await axios.get(`${base}/api/clients`);
        const list = res.data?.clients ?? res.data ?? [];
        setClients(list);
      } catch {
        setClients([]);
      }
    })();
  }, [base]);

  // Select / deselect clients
  const toggleClient = (id) => {
    setSelectedClients((prev) => {
      const copy = new Set(prev);
      copy.has(id) ? copy.delete(id) : copy.add(id);
      return copy;
    });
  };

  const selectAll = () => setSelectedClients(new Set(clients.map((c) => c.id || c._id)));
  const clearSelection = () => setSelectedClients(new Set());

  // Show QR manually
  const handleShowQr = async () => {
    try {
      const res = await axios.get(`${base}/api/whatsapp-web/qr`);
      if (res.data?.qr) {
        setQrSrc(res.data.qr);
        setQrVisible(true);
      } else {
        alert("No QR available. Wait for WhatsApp client to generate one.");
      }
    } catch {
      alert("Failed to fetch QR.");
    }
  };

  // Send messages to selected clients
  const handleSend = async (e) => {
    e.preventDefault();
    if (!messageText.trim()) return alert("Enter message text.");
    if (selectedClients.size === 0) return alert("Select clients to send.");

    setSending(true);
    setSendResult(null);

    try {
      const numbers = Array.from(selectedClients).map((id) => {
        const c = clients.find((x) => x.id === id || x._id === id);
        return c?.phone;
      }).filter(Boolean);

      const results = [];
      for (const n of numbers) {
        const res = await axios.post(`${base}/api/whatsapp-web/send`, {
          to: n,
          message: messageText.trim(),
        });
        results.push(res.data);
      }

      setSendResult(results);
      alert("Messages sent successfully.");
    } catch (err) {
      console.error("Send failed:", err);
      alert("Error sending messages.");
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="p-6 space-y-6">
      <h2 className="text-2xl font-semibold mb-4">Dashboard (WhatsApp Web)</h2>

      <div className="p-4 bg-white rounded-xl shadow-sm border flex items-center justify-between">
        <div>
          <div className="text-gray-600 text-sm">WhatsApp Web Status:</div>
          <div className="text-xl font-bold">{waConnected ? "Connected ✅" : "Not Connected ❌"}</div>
        </div>
        <button
          onClick={handleShowQr}
          className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
        >
          Show QR
        </button>
      </div>

      <form onSubmit={handleSend} className="bg-white p-6 rounded-xl shadow-sm border space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Message</label>
          <textarea
            rows={3}
            value={messageText}
            onChange={(e) => setMessageText(e.target.value)}
            className="w-full border rounded p-2"
            placeholder="Type your message..."
          />
        </div>
        <div className="flex gap-3">
          <button
            type="submit"
            disabled={sending}
            className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
          >
            {sending ? "Sending..." : "Send"}
          </button>
          <button
            type="button"
            onClick={() => { setMessageText(""); setSendResult(null); }}
            className="px-4 py-2 border rounded"
          >
            Reset
          </button>
        </div>

        {sendResult && (
          <div className="mt-4 bg-gray-50 border rounded p-3 text-sm">
            <b>Results:</b>
            <pre>{JSON.stringify(sendResult, null, 2)}</pre>
          </div>
        )}
      </form>

      <div className="bg-white rounded-xl p-6 shadow-sm border">
        <div className="flex justify-between mb-3">
          <h3 className="text-lg font-semibold">Clients</h3>
          <div className="flex gap-2">
            <button onClick={selectAll} className="px-3 py-1 border rounded">Select all</button>
            <button onClick={clearSelection} className="px-3 py-1 border rounded">Clear</button>
          </div>
        </div>

        <div className="max-h-64 overflow-auto border rounded">
          <table className="w-full text-left">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-3 py-2">#</th>
                <th className="px-3 py-2">Select</th>
                <th className="px-3 py-2">Name</th>
                <th className="px-3 py-2">Phone</th>
              </tr>
            </thead>
            <tbody>
              {clients.map((c, i) => {
                const id = c.id ?? c._id ?? `${i}`;
                const selected = selectedClients.has(id);
                return (
                  <tr key={id} className="border-t">
                    <td className="px-3 py-2">{i + 1}</td>
                    <td className="px-3 py-2">
                      <input
                        type="checkbox"
                        checked={selected}
                        onChange={() => toggleClient(id)}
                      />
                    </td>
                    <td className="px-3 py-2">{c.name}</td>
                    <td className="px-3 py-2">{c.phone}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {qrVisible && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white p-4 rounded-xl text-center relative">
            <button
              onClick={() => setQrVisible(false)}
              className="absolute top-2 right-3 text-xl font-bold"
            >
              ×
            </button>
            <h3 className="text-lg font-semibold mb-2">Scan QR with WhatsApp</h3>
            {qrSrc ? (
              <img src={qrSrc} alt="QR" className="w-72 h-72 mx-auto" />
            ) : (
              <p>No QR available</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
