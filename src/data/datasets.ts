import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { FORMATS, LIMITS } from "@/lib/ingest/limits";
import { analyzeDataset } from "@/lib/ingest/relate";
import { summarizeDataset } from "@/server/ai-insights";
import {
  UPLOADS_PER_HOUR,
  claimUploadSlot,
  fetchDataset,
  fetchRecentDatasets,
  loadRelateContext,
  storeDataset,
} from "@/server/datasets";

export type { DatasetDetail, DatasetSummary, StoredInsight } from "@/server/datasets";

const cell = z.union([
  z.string().max(LIMITS.cellLength),
  z.number().finite(),
  z.boolean(),
  z.null(),
]);

// The browser parses files, but nothing it sends is trusted: every limit is checked again here.
export const ingestInput = z
  .object({
    name: z.string().trim().min(1).max(120),
    fileName: z.string().trim().min(1).max(200),
    format: z.enum(FORMATS),
    columns: z.array(z.string().trim().min(1).max(LIMITS.headerLength)).min(1).max(LIMITS.columns),
    rows: z.array(z.array(cell).max(LIMITS.columns)).min(1).max(LIMITS.rows),
  })
  .superRefine((data, ctx) => {
    if (new Set(data.columns).size !== data.columns.length) {
      ctx.addIssue({ code: "custom", message: "Column names must be unique.", path: ["columns"] });
    }
    if (data.rows.some((row) => row.length !== data.columns.length)) {
      ctx.addIssue({
        code: "custom",
        message: "Every row needs one value per column.",
        path: ["rows"],
      });
    }
    const size = data.rows.reduce((sum, row) => sum + JSON.stringify(row).length, 0);
    if (size > LIMITS.bytes)
      ctx.addIssue({ code: "custom", message: "The data is too large.", path: ["rows"] });
  });

export const ingestDataset = createServerFn({ method: "POST" })
  .validator(ingestInput)
  .handler(async ({ data }): Promise<{ id: string }> => {
    if (!claimUploadSlot()) {
      throw new Error(`You can upload ${UPLOADS_PER_HOUR} files an hour. Please try again later.`);
    }

    const { ctx, measures } = await loadRelateContext();
    const table = { columns: data.columns, rows: data.rows };
    const { profile, insights, topics } = analyzeDataset(data.name, table, ctx);
    const summary = await summarizeDataset({
      name: data.name,
      profile,
      insights,
      topics,
      measures,
    });

    const id = await storeDataset({
      name: data.name,
      fileName: data.fileName,
      format: data.format,
      rows: data.rows,
      profile,
      insights,
      summary,
    });
    return { id };
  });

export const getDataset = createServerFn({ method: "GET" })
  .validator(z.object({ id: z.string().uuid() }))
  .handler(({ data }) => fetchDataset(data.id));

export const listRecentDatasets = createServerFn({ method: "GET" }).handler(() =>
  fetchRecentDatasets(),
);
