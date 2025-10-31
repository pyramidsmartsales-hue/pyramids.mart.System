import Template from "../models/Template.model.js";

export async function listTemplates(req, res) {
  try {
    const data = await Template.find().sort({ createdAt: -1 });
    res.json({ ok: true, data });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
}

export async function createTemplate(req, res) {
  try {
    const { name, body } = req.body;
    if (!name || !body) return res.status(400).json({ ok: false, error: "name and body required" });
    const t = await Template.create({ name, body });
    res.json({ ok: true, data: t });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
}

export async function updateTemplate(req, res) {
  try {
    const t = await Template.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!t) return res.status(404).json({ ok: false, error: "not_found" });
    res.json({ ok: true, data: t });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
}

export async function deleteTemplate(req, res) {
  try {
    const t = await Template.findByIdAndDelete(req.params.id);
    res.json({ ok: true, data: t });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
}
