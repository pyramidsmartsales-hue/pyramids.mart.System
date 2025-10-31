import express from "express";
import * as controller from "../controllers/templates.controller.js";

const router = express.Router();

router.get("/", controller.listTemplates);
router.post("/", controller.createTemplate);
router.put("/:id", controller.updateTemplate);
router.delete("/:id", controller.deleteTemplate);

export default router;
