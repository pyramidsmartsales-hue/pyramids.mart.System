// server/services/whatsapp.service.js
import fs from "fs";
import path from "path";

/**
 * This file provides sendBroadcast({ numbers, message, file })
 * It expects that there is a `client` object (whatsapp-web.js client) available.
 *
 * If your project has an `initWhatsApp` function that creates the client and stores it
 * in this module scope, keep that code and ensure `client` gets assigned.
 *
 * The sendBroadcast function is defensive: checks client ready state, validates numbers,
 * logs errors to console for debugging, and returns per-number results.
 */

// --- PLACEHOLDER FOR CLIENT ---
// If your code already creates a `client` (e.g., in initWhatsApp) and exports it,
// make sure the variable below points to it. If not, initWhatsApp in this file.
let client = null;

// Optionally export a setter for the client so other modules can set it
export function setWhatsappClient(c) {
  client = c;
}

function formatNumberToId(number) {
  // Remove non-digits, leading plus etc.
  let digits = String(number).replace(/\D/g, "");
  // If number length seems local without country code, this function won't guess.
  // Consumer should provide full international numbers (e.g. 2547xxxx or 2010xxxx).
  // Append @c.us for whatsapp-web.js (classic)
  return `${digits}@c.us`;
}

/**
 * Send broadcast.
 * @param {Object} param0
 * @param {string[]} param0.numbers
 * @param {string} param0.message
 * @param {Object|null} param0.file info: { path, mimetype, originalname }
 * @returns {Promise<Array<{number, ok, message?, error?}>>}
 */
export async function sendBroadcast({ numbers = [], message = "", file = null }) {
  if (!client) {
    const err = new Error("WhatsApp client not initialized on server.");
    console.error(err);
    throw err;
  }

  if (!client.info || !client.info.wid) {
    // some clients have .ready boolean or emit 'ready'; do a defensive check
    // If your client object has a different ready check, adapt.
    console.warn("WhatsApp client might not be ready. client.info:", client.info);
  }

  const results = [];

  // Validate numbers array
  if (!Array.isArray(numbers)) numbers = [];

  for (const n of numbers) {
    const item = { number: n, ok: false };
    try {
      const id = formatNumberToId(n);
      if (!id || id.length < 6) {
        item.error = "Invalid phone number format";
        console.warn("Skipping invalid number:", n);
        results.push(item);
        continue;
      }

      if (file) {
        // send file then text if needed (whatsapp-web.js expects a MessageMedia or a path)
        // we will send file as attachment and then optionally message as caption.
        // Try to send as a file path (whatsapp-web.js supports MessageMedia.fromFilePath).
        if (typeof client.sendMessage !== "function") {
          throw new Error("WhatsApp client.sendMessage not available");
        }

        // If whatsapp-web.js MessageMedia available:
        let media;
        try {
          // dynamic import to avoid crash if library missing
          const { MessageMedia } = await import("whatsapp-web.js");
          media = await MessageMedia.fromFilePath(path.resolve(file.path));
          await client.sendMessage(id, media, { caption: message || undefined });
        } catch (errFile) {
          // fallback: send text that file exists (less ideal)
          console.warn("Failed to send media via MessageMedia:", errFile && errFile.message ? errFile.message : errFile);
          if (message) {
            await client.sendMessage(id, message);
          } else {
            throw errFile;
          }
        }
      } else {
        // no file, just send text
        await client.sendMessage(id, message);
      }

      item.ok = true;
      results.push(item);
    } catch (err) {
      // log full error for debugging
      console.error(`Failed to send to ${n}:`, err && err.stack ? err.stack : err);
      item.ok = false;
      item.error = err && err.message ? err.message : String(err);
      results.push(item);
    }
  }

  return results;
}

// If your project has an init function that builds the client, keep it and set the client via setWhatsappClient.
// Example (DO NOT overwrite if you already have):
export function initWhatsAppClientFromExisting(clientInstance) {
  setWhatsappClient(clientInstance);
  // add handler for client errors to log them
  try {
    if (clientInstance.on) {
      clientInstance.on("ready", () => console.info("WhatsApp client ready"));
      clientInstance.on("auth_failure", (err) => console.error("WhatsApp auth failure:", err));
      clientInstance.on("disconnected", (reason) => console.warn("WhatsApp disconnected:", reason));
      clientInstance.on("qr", (qr) => console.info("WhatsApp QR received"));
    }
  } catch (e) {
    console.warn("Could not attach event listeners to whatsapp client:", e && e.message ? e.message : e);
  }
}
