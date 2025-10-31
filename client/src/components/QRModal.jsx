import React from "react";

export default function QRModal({ qr, onClose }) {
  if (!qr) return null;
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white p-6 rounded shadow">
        <h3 className="font-bold mb-4">Scan WhatsApp QR</h3>
        <div>
          <img src={`https://api.qrserver.com/v1/create-qr-code/?data=${encodeURIComponent(qr)}&size=300x300`} alt="qr" />
        </div>
        <div className="mt-4 text-right">
          <button onClick={onClose} className="px-3 py-1 bg-gray-200 rounded">Close</button>
        </div>
      </div>
    </div>
  );
}
