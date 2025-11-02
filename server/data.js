// server/data.js
/**
 * In-memory shared data store used by route modules.
 * This is intentionally simple (no DB) to enable consistent state across routes.
 */

export const DATA = {
  PRODUCTS: [
    { id: 1, name: "Rice 5kg", barcode: "1234567890123", category: "Groceries", price: 2500, unit: "bag", qty: 50, expiry: null, image: null, supplier: "Supplier A" },
    { id: 2, name: "Milk 1L", barcode: "9876543210987", category: "Dairy", price: 150, unit: "bottle", qty: 120, expiry: "2025-12-01", image: null, supplier: "Supplier B" }
  ],
  NEXT_PRODUCT_ID: 3,

  CLIENTS: [
    { id: 1, name: "Ahmed", phone: "+254712345678", area: "Nairobi", notes: "", points: 0 },
    { id: 2, name: "Fatima", phone: "+254723456789", area: "Nairobi", notes: "", points: 10 }
  ],
  NEXT_CLIENT_ID: 3,

  SUPPLIERS: [
    { id: 1, name: "Supplier A", phone: "+201234567", company: "A Co", balance: 1200.5 },
    { id: 2, name: "Supplier B", phone: "+201112233", company: "B Trading", balance: -200 }
  ],
  NEXT_SUPPLIER_ID: 3,

  SALES: [],
  NEXT_SALE_ID: 1,

  PURCHASES: [],
  NEXT_PURCHASE_ID: 1,

  EXPENSES: [],
  NEXT_EXPENSE_ID: 1
};

export function findProductById(id) {
  return DATA.PRODUCTS.find(p => Number(p.id) === Number(id));
}

export function adjustProductQty(id, delta) {
  const p = findProductById(id);
  if (!p) return false;
  p.qty = Number(p.qty || 0) + Number(delta || 0);
  return true;
}

export function findClientByPhone(phone) {
  if (!phone) return null;
  const normalized = String(phone).trim();
  return DATA.CLIENTS.find(c => (c.phone || "").trim() === normalized);
}
