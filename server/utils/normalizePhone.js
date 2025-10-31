export default function normalizePhone(raw) {
  if (!raw) return raw;
  return String(raw).replace(/[^\d]/g, "");
}
