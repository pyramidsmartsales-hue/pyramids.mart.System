import Client from "../models/Client.model.js";

export async function listClients(req, res) {
  try {
    const { q, area, limit = 100 } = req.query;
    const filter = {};
    if (q) {
      const re = new RegExp(q, "i");
      filter.$or = [{ name: re }, { phone: re }, { notes: re }];
    }
    if (area) filter.area = area;
    const data = await Client.find(filter).sort({ createdAt: -1 }).limit(Number(limit));
    res.json({ ok: true, data });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
}

export async function createClient(req, res) {
  try {
    const { name, phone, area, notes } = req.body;
    if (!name || !phone) return res.status(400).json({ ok: false, error: "name and phone required" });
    const item = await Client.create({ name, phone, area, notes });
    res.json({ ok: true, data: item });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
}

export async function getClient(req, res) {
  try {
    const item = await Client.findById(req.params.id);
    if (!item) return res.status(404).json({ ok: false, error: "not_found" });
    res.json({ ok: true, data: item });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
}

export async function updateClient(req, res) {
  try {
    const item = await Client.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!item) return res.status(404).json({ ok: false, error: "not_found" });
    res.json({ ok: true, data: item });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
}

export async function deleteClient(req, res) {
  try {
    const item = await Client.findByIdAndDelete(req.params.id);
    res.json({ ok: true, data: item });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
}
