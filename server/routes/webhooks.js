// server/routes/webhooks.js
import express from "express";
const router = express.Router();

const API_KEY = process.env.SHEETS_API_KEY || "change-me";

// استورد وظائف التعامل مع DB - أدناه أمثلة في server/services/sheetSyncService.js
import {
  upsertClientFromSheet,
  deleteClientByExternalId
} from "../services/sheetSyncService.js";

router.post("/sheets", express.json({ limit: '1mb' }), async (req, res) => {
  try {
    const headerKey = req.get("X-SYNC-API-KEY") || "";
    if (!API_KEY || headerKey !== API_KEY) {
      console.warn("[sheet-webhook] unauthorized - header mismatch");
      return res.status(401).json({ ok: false, error: "Unauthorized" });
    }

    const payload = req.body;
    console.log("[sheet-webhook] payload:", JSON.stringify({ type: payload.type, sheet: payload.sheet, external_id: payload.external_id || payload.data?.external_id, row: payload.row }));

    const type = payload.type;
    const data = payload.data || {};
    const externalId = (payload.external_id || data.external_id || "").toString();

    if (type === "create" || type === "update") {
      await upsertClientFromSheet(data);
      return res.json({ ok: true, handled: "upsert" });
    } else if (type === "delete") {
      if (!externalId) {
        console.warn("[sheet-webhook] delete requested but external_id missing, ignoring");
        return res.status(400).json({ ok: false, error: "external_id required for delete" });
      }
      const result = await deleteClientByExternalId(externalId);
      console.log("[sheet-webhook] delete result:", result);
      return res.json({ ok: true, handled: "delete", result });
    } else {
      console.warn("[sheet-webhook] unknown type:", type);
      return res.status(400).json({ ok: false, error: "unknown type" });
    }
  } catch (err) {
    console.error("[sheet-webhook] error:", err && (err.stack || err.message || err));
    return res.status(500).json({ ok: false, error: err.message || String(err) });
  }
});

export default router;
