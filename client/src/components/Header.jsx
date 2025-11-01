// client/src/components/Header.jsx
import React from "react";

export default function Header({ connected, onShowQR, onDisconnect }) {
  return (
    <header className="flex items-center justify-between px-6 py-4 bg-gradient-to-r from-white to-gray-50 border-b">
      <div>
        <h2 className="text-lg font-semibold">Pyramids Mart — Broadcast</h2>
        <p className="text-sm text-gray-500">Manage clients, broadcasts and templates</p>
      </div>

      <div className="flex items-center gap-3">
        <button
          onClick={onShowQR}
          className="px-4 py-2 bg-amber-300 hover:bg-amber-200 text-amber-900 rounded-md shadow-sm font-medium"
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
