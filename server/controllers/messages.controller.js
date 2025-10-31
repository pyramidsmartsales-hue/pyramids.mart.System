import Message from "../models/Message.model.js";
import Client from "../models/Client.model.js";
import whatsappService from "../services/whatsapp.service.js";

export async function listMessages(req, res) {
  try {
    const data = await Message.find().sort({ createdAt: -1 }).limit(200);
    res.json({ ok: true, data });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
}

export async function createMessage(req, res) {
  try {
    const { body, subject, scheduledAt, recipients } = req.body;
    let rcpts = [];
    if (recipients) {
      const ids = Array.isArray(recipients) ? recipients : JSON.parse(recipients);
      const clients = await Client.find({ _id: { $in: ids } });
      rcpts = clients.map(c => ({ clientId: c._id, phone: c.phone }));
    } else {
      // send to all
      const clients = await Client.find({});
      rcpts = clients.map(c => ({ clientId: c._id, phone: c.phone }));
    }

    const mediaUrl = req.file ? `/uploads/${req.file.filename}` : undefined;

    const message = await Message.create({
      subject,
      body,
      mediaUrl,
      scheduledAt: scheduledAt ? new Date(scheduledAt) : null,
      recipients: rcpts
    });

    // If scheduledAt is null or in past, process now via whatsapp service
    if (!message.scheduledAt || message.scheduledAt <= new Date()) {
      whatsappService.broadcastMessage(message).catch(err => {
        console.error("broadcast error", err);
      });
    }

    res.json({ ok: true, data: message });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
}

export async function getMessage(req, res) {
  try {
    const msg = await Message.findById(req.params.id);
    if (!msg) return res.status(404).json({ ok: false, error: "not_found" });
    res.json({ ok: true, data: msg });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
}
