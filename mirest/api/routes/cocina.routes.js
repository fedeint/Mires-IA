import { Router } from "express";
import * as ctrl from "../controllers/cocina.controller.js";

const router = Router();

router.get("/", ctrl.list);
router.post("/", ctrl.create);

export default router;
