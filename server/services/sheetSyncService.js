// server/services/sheetSyncService.js
// عدّل الكود ليتوافق مع DB لديك: Mongo (Mongoose) أو MySQL/Knex أو أي ORM تستخدمه.

import { randomUUID } from "crypto";

/* ---------------------- مثال MONGOOSE ----------------------
import Client from "../models/Client.js";

export async function upsertClientFromSheet(data){
  if (!data.external_id) data.external_id = randomUUID();
  const update = { ...data, updated_at: new Date().toISOString() };
  const doc = await Client.findOneAndUpdate({ external_id: data.external_id }, update, { upsert: true, new: true, setDefaultsOnInsert: true });
  return doc;
}

export async function deleteClientByExternalId(externalId){
  const res = await Client.deleteOne({ external_id: externalId });
  return res;
}
----------------------------------------------------------- */

/* ---------------------- مثال MYSQL (knex) -----------------
import db from "../db/knex.js"; // عدّل حسب تهيئتك

export async function upsertClientFromSheet(data){
  const ext = data.external_id || randomUUID();
  const row = {
    external_id: ext,
    name: data.name || null,
    phone: data.phone || null,
    area: data.area || null,
    notes: data.notes || null,
    updated_at: new Date().toISOString()
  };

  const updated = await db('clients').where('external_id', ext).update(row);
  if (!updated) await db('clients').insert(row);
  return row;
}

export async function deleteClientByExternalId(externalId){
  const deleted = await db('clients').where('external_id', externalId).del();
  return { deleted };
}
----------------------------------------------------------- */

/* ---------------- Generic fallback (no DB) ---------------
If you don't want to commit DB code yet, you can log the action:
export async function upsertClientFromSheet(data){
  console.log('[sheetSyncService] upsert stub', data);
  return { stub: true };
}
export async function deleteClientByExternalId(externalId){
  console.log('[sheetSyncService] delete stub', externalId);
  return { stub: true };
}
----------------------------------------------------------- */

export async function upsertClientFromSheet(data){
  // افعل هنا ما يناسبك: ربط للسطر أعلاه حسب DB المستخدمة
  throw new Error("Implement upsertClientFromSheet for your DB");
}

export async function deleteClientByExternalId(externalId){
  throw new Error("Implement deleteClientByExternalId for your DB");
}
