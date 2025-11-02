// server/routes/suppliers.js
import express from "express";
const router = express.Router();

let MOCK_SUPPLIERS = [
  { id: 1, name: "Supplier A", phone: "+201234567", company: "A Co", balance: 1200.5 },
  { id: 2, name: "Supplier B", phone: "+201112233", company: "B Trading", balance: -200 }
];

router.get("/", async (req, res) => {
  res.json({ suppliers: MOCK_SUPPLIERS });
});

router.post("/", async (req, res) => {
  const { name, phone, company } = req.body;
  const s = { id: MOCK_SUPPLIERS.length + 1, name, phone, company, balance: 0 };
  MOCK_SUPPLIERS.push(s);
  res.status(201).json({ supplier: s });
});

router.get("/:id/invoices", async (req, res) => {
  // stub: return empty or mock invoice list
  res.json({ invoices: [] });
});

export default router;
