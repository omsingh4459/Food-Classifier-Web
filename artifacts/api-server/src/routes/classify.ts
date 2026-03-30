import { Router, type IRouter } from "express";
import multer from "multer";
import fetch from "node-fetch";
import FormData from "form-data";
import { db, classificationsTable } from "@workspace/db";
import { desc, sql } from "drizzle-orm";
import {
  ClassifyFoodResponse,
  GetClassificationHistoryResponse,
  GetClassificationStatsResponse,
} from "@workspace/api-zod";

const router: IRouter = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

const ML_SERVICE_URL = process.env.ML_SERVICE_URL || "http://localhost:8001";

router.post("/classify", upload.single("image"), async (req, res): Promise<void> => {
  if (!req.file) {
    res.status(400).json({ error: "No image file provided" });
    return;
  }

  if (!req.file.mimetype.startsWith("image/")) {
    res.status(400).json({ error: "File must be an image" });
    return;
  }

  try {
    const form = new FormData();
    form.append("image", req.file.buffer, {
      filename: req.file.originalname || "image.jpg",
      contentType: req.file.mimetype,
    });

    const mlResponse = await fetch(`${ML_SERVICE_URL}/classify`, {
      method: "POST",
      body: form,
      headers: form.getHeaders(),
    });

    if (!mlResponse.ok) {
      const errorText = await mlResponse.text();
      req.log.error({ status: mlResponse.status, error: errorText }, "ML service error");
      res.status(500).json({ error: "Classification failed" });
      return;
    }

    const result = await mlResponse.json() as {
      predicted_class: string;
      confidence: number;
      all_predictions: Array<{ label: string; confidence: number }>;
      processing_time_ms: number;
    };

    await db.insert(classificationsTable).values({
      predicted_class: result.predicted_class,
      confidence: result.confidence,
    });

    const parsed = ClassifyFoodResponse.parse(result);
    res.json(parsed);
  } catch (err) {
    req.log.error({ err }, "Failed to classify image");
    res.status(500).json({ error: "Classification service unavailable" });
  }
});

router.get("/classify/history", async (req, res): Promise<void> => {
  const history = await db
    .select()
    .from(classificationsTable)
    .orderBy(desc(classificationsTable.created_at))
    .limit(20);

  const parsed = GetClassificationHistoryResponse.parse(history);
  res.json(parsed);
});

router.get("/classify/stats", async (req, res): Promise<void> => {
  const results = await db
    .select({
      total_classifications: sql<number>`count(*)::int`,
      pizza_count: sql<number>`count(*) filter (where ${classificationsTable.predicted_class} = 'pizza')::int`,
      steak_count: sql<number>`count(*) filter (where ${classificationsTable.predicted_class} = 'steak')::int`,
      sushi_count: sql<number>`count(*) filter (where ${classificationsTable.predicted_class} = 'sushi')::int`,
      avg_confidence: sql<number>`coalesce(avg(${classificationsTable.confidence}), 0)::float`,
    })
    .from(classificationsTable);

  const stats = results[0] ?? {
    total_classifications: 0,
    pizza_count: 0,
    steak_count: 0,
    sushi_count: 0,
    avg_confidence: 0,
  };

  const parsed = GetClassificationStatsResponse.parse(stats);
  res.json(parsed);
});

export default router;
