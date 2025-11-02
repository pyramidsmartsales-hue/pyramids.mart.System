// client/src/components/Header.jsx
import React from "react";

export default function Header({ connected, onShowQR, onDisconnect }) {
  return (
    <header
      className="flex items-center justify-between px-6 py-4 border-b"
      style={{ background: "linear-gradient(90deg, var(--card) 0%, var(--bg) 100%)" }}
    >
      <div>
        {/* Title changed to Broadcasts */}
        <h2 className="text-lg font-semibold" style={{ color: "var(--primary)" }}>
          Pyramids Mart — <span style={{ color: "var(--accent)" }}>Broadcasts</span>
        </h2>
        <p className="text-sm text-gray-500">Manage clients, broadcasts and templates</p>
      </div>

      <div className="flex items-center gap-3">
        <button
          onClick={onShowQR}
          style={{
            padding: "8px 14px",
            borderRadius: 8,
            background: "var(--accent)",
            color: "#000",
            border: "none",
            fontWeight: 600,
            cursor: "pointer",
            boxShadow: "0 2px 6px rgba(0,0,0,0.08)"
          }}
        >
          Show QR
        </button>

        {connected ? (
          <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-green-100 text-green-700 text-sm font-medium">
            ● Connected
          </span>
        ) : (
          <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-red-50 text-red-600 text-sm font-medium">
            ● Disconnected
          </span>
        )}
      </div>
    </header>
  );
}
