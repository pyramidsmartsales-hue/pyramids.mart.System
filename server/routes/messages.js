import express from "express";
import * as controller from "../controllers/messages.controller.js";
import uploadMiddleware from "../middlewares/upload.middleware.js";

const router = express.Router();

router.get("/", controller.listMessages);
router.post("/", uploadMiddleware.single("file"), controller.createMessage); // optional file
router.get("/:id", controller.getMessage);

export default router;
