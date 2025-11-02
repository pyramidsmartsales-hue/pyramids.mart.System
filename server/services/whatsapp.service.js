// server/services/whatsapp.service.js

/**
 * WhatsApp Service
 * يدير عمليات الاتصال والإرسال عبر واتساب (أو يرجع بيانات وهمية في حال عدم توفر اتصال فعلي)
 */

export async function getStatus() {
  // في حال توفر عميل واتساب فعلي
  if (global.WA_CLIENT && global.WA_CLIENT.isConnected) {
    return { connected: true };
  }

  // وضع وهمي افتراضي
  return { connected: false };
}

export async function getQr() {
  if (global.WA_CLIENT && global.WA_CLIENT.getQr) {
    const qr = await global.WA_CLIENT.getQr();
    return qr || null;
  }

  // رد وهمي
  return null;
}

export async function sendMessage(number, message) {
  try {
    if (global.WA_CLIENT && global.WA_CLIENT.sendMessage) {
      await global.WA_CLIENT.sendMessage(number, message);
      return { ok: true };
    }
    // وضع وهمي افتراضي
    return { ok: true, mock: true, note: "No real WhatsApp client connected" };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

export async function sendBroadcast(numbers, message) {
  if (!Array.isArray(numbers)) {
    return { ok: false, error: "numbers must be array" };
  }

  const results = [];
  for (const number of numbers) {
    const r = await sendMessage(number, message);
    results.push({ number, ...r });
  }
  return results;
}
