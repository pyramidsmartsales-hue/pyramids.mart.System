// QRModal.jsx
import React from "react";

export default function QRModal({ qr, onClose }) {
  if (!qr) return null;

  const isDataUrl = typeof qr === "string" && qr.startsWith("data:");
  const rawText = String(qr);

  // استخدم api.qrserver.com لإنشاء صورة QR إذا لم تكن data URL
  const qrServerUrl = !isDataUrl
    ? `https://api.qrserver.com/v1/create-qr-code/?size=360x360&data=${encodeURIComponent(rawText)}`
    : null;

  const imageSrc = isDataUrl ? rawText : qrServerUrl;

  const onCopy = async () => {
    try {
      await navigator.clipboard.writeText(rawText);
      alert("QR data copied to clipboard");
    } catch (e) {
      console.warn("copy failed", e);
      alert("Copy failed");
    }
  };

  const onDownload = async () => {
    try {
      if (!imageSrc) {
        alert("No image available to download");
        return;
      }

      // نحاول جلب الصورة من الخادم كـ blob ثم تنزيلها
      const res = await fetch(imageSrc);
      if (!res.ok) throw new Error(`Fetch failed: ${res.status}`);

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "whatsapp-qr.png";
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error("download failed", err);
      // كخطة بديلة: افتح الصورة في تبويب جديد حتى يتمكن المستخدم من حفظها يدويا
      try {
        window.open(imageSrc, "_blank");
      } catch (e) {
        alert("Cannot download or open image. See console for details.");
      }
    }
  };

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 1000,
      display: "flex", alignItems: "center", justifyContent: "center",
      backgroundColor: "rgba(0,0,0,0.5)"
    }}>
      <div style={{
        background: "#fff", borderRadius: 12, padding: 20,
        width: 460, maxWidth: "96%", boxShadow: "0 10px 30px rgba(0,0,0,0.2)"
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
          <h3 style={{ margin: 0 }}>Scan QR with WhatsApp</h3>
          <button onClick={onClose} style={{ background: "transparent", border: "none", cursor: "pointer" }}>Close</button>
        </div>

        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12 }}>
          <div style={{ background: "#f7f7f7", padding: 12, borderRadius: 8 }}>
            {imageSrc ? (
              <img src={imageSrc} alt="whatsapp qr" style={{ width: 320, height: 320, objectFit: "contain", display: "block" }} />
            ) : (
              <pre style={{ width: 320, height: 320, overflow: "auto", padding: 12, background: "#fff" }}>{rawText}</pre>
            )}
          </div>

          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={onCopy} style={{ padding: "8px 14px", background: "#059669", color: "#fff", border: "none", borderRadius: 6, cursor: "pointer" }}>
              Copy data
            </button>
            <button onClick={onDownload} style={{ padding: "8px 14px", borderRadius: 6, border: "1px solid #ddd", cursor: "pointer" }}>
              Download
            </button>
            <button onClick={onClose} style={{ padding: "8px 14px", borderRadius: 6, border: "1px solid #ddd", background: "#f3f4f6", cursor: "pointer" }}>
              Done
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
