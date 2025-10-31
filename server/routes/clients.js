import express from "express";
import * as controller from "../controllers/clients.controller.js";

const router = express.Router();

router.get("/", controller.listClients);
router.post("/", controller.createClient);
router.get("/:id", controller.getClient);
router.put("/:id", controller.updateClient);
router.delete("/:id", controller.deleteClient);

export default router;
