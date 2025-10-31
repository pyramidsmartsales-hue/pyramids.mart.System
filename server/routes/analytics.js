import express from "express";
import Client from "../models/Client.model.js";
import Message from "../models/Message.model.js";

const router = express.Router();

router.get("/summary", async (req, res) => {
  try {
    const totalClients = await Client.countDocuments();
    const messagesToday = await Message.countDocuments({ createdAt: { $gte: new Date(new Date().setHours(0,0,0,0)) }});
    res.json({ ok: true, data: { totalClients, messagesToday }});
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

export default router;
