// client/src/components/QRModal.jsx
import React from "react";

export default function QRModal({ qr, onClose }) {
  if (!qr) return null;

  // إذا كانت القيمة بالفعل data URL (صورة)، استخدمها مباشرة.
  // وإلا نستخدم Google Chart API لإنشاء صورة QR من النص.
  const isDataUrl = typeof qr === "string" && qr.startsWith("data:");
  const chartUrl = (typeof qr === "string" && !isDataUrl)
    ? `https://chart.googleapis.com/chart?cht=qr&chs=360x360&chl=${encodeURIComponent(qr)}&choe=UTF-8`
    : null;

  const imageSrc = isDataUrl ? qr : chartUrl;

  // نسخ النص الخام إلى الحافظة
  const onCopy = async () => {
    try {
      await navigator.clipboard.writeText(qr);
      alert("QR data copied to clipboard");
    } catch (e) {
      console.warn("copy failed", e);
      alert("Copy failed");
    }
  };

  // تنزيل الصورة (إذا كانت data URL نحفظها مباشرة، وإلا نفتح رابط google chart)
  const onDownload = async () => {
    try {
      if (isDataUrl) {
        const a = document.createElement("a");
        a.href = qr;
        a.download = "whatsapp-qr.png";
        document.body.appendChild(a);
        a.click();
        a.remove();
        return;
      }

      // محاولة تحميل الصورة من google chart وخلق blob (ممكن يعمل بدون CORS مشاكل عادة)
      const res = await fetch(imageSrc);
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
      // كحل احتياطي افتح الصورة في تبويب جديد ليتمكن المستخدم من حفظها يدويا
      window.open(imageSrc, "_blank");
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white rounded-2xl p-6 w-[440px] max-w-[95%] shadow-xl">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-semibold">Scan QR with WhatsApp</h3>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700">Close</button>
        </div>

        <div className="flex flex-col items-center gap-4">
          <div className="bg-gray-100 p-3 rounded">
            {imageSrc ? (
              // نعرض الصورة المولّدة (من google chart أو data URL)
              <img src={imageSrc} alt="whatsapp qr" className="w-64 h-64 object-contain" />
            ) : (
              // لو لم يتوفر مصدر صورة نعرض النص الخام داخل <pre>
              <pre style={{ width: 256, height: 256, overflow: "auto", padding: 12, background: "#fff" }}>
                {String(qr)}
              </pre>
            )}
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
