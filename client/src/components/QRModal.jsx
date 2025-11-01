import React from "react";

export default function QRModal({ qr, onClose }) {
  if (!qr) return null;

  // allow copying the data URL or the underlying string
  const onCopy = async () => {
    try {
      await navigator.clipboard.writeText(qr);
      alert("QR data copied to clipboard");
    } catch (e) {
      console.warn("copy failed", e);
    }
  };

  const onDownload = () => {
    const a = document.createElement("a");
    a.href = qr;
    a.download = "whatsapp-qr.png";
    document.body.appendChild(a);
    a.click();
    a.remove();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white rounded-2xl p-6 w-[420px] max-w-[95%] shadow-xl">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-semibold">Scan QR with WhatsApp</h3>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700">Close</button>
        </div>

        <div className="flex flex-col items-center gap-4">
          <div className="bg-gray-100 p-3 rounded">
            <img src={qr} alt="whatsapp qr" className="w-64 h-64 object-contain" />
          </div>

          <div className="flex gap-2">
            <button onClick={onCopy} className="px-4 py-2 rounded bg-teal-600 text-white">Copy data</button>
            <button onClick={onDownload} className="px-4 py-2 rounded border">Download</button>
            <button onClick={onClose} className="px-4 py-2 rounded bg-gray-100">Done</button>
          </div>
        </div>
      </div>
    </div>
  );
}
