// server/routes/sheetsTest.js
import express from "express";
import { readSheet } from "../services/sheetsSync.js";

const router = express.Router();

/**
 * GET /api/sheets/test-read?sheet=Clients
 * Attempts to read first 10 rows from the given sheet tab and returns result or error.
 */
router.get("/test-read", async (req, res) => {
  const sheet = req.query.sheet || "Clients";
  try {
    const rows = await readSheet(sheet);
    // return first 10 rows and row count
    return res.json({ ok: true, sheet, rowCount: rows.length, sample: rows.slice(0, 10) });
  } catch (err) {
    // return detailed error for debugging
    return res.status(500).json({
      ok: false,
      message: "sheets read failed",
      error: err && (err.message || err.toString ? err.toString() : err),
      stack: err && err.stack ? err.stack : undefined
    });
  }
});

export default router;
