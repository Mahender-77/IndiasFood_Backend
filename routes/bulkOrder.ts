import express from "express";
import { submitBulkOrder } from "../controllers/bulkOrderController";

const router = express.Router();

router.post("/", submitBulkOrder);

export default router;
