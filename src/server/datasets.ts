import "@tanstack/react-start/server-only";

import { mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";

import { getRequestHeader, getRequestIP } from "@tanstack/react-start/server";

import { FINANCIAL_OPTIONS, HOUSEHOLD_OPTIONS } from "@/data/compare";
import { toYearly } from "@/data/series";
import { MEASURE_SLUGS, type Measure, type MeasureSlug } from "@/data/types";
import type { ComputedInsight, InsightStats } from "@/lib/ingest/insights";
import type { Cell, DatasetFormat } from "@/lib/ingest/parse";
import type { DatasetProfile } from "@/lib/ingest/profile";
import type { RelateContext, ReferenceSeries } from "@/lib/ingest/relate";

import type { AiSummary } from "./ai-insights";
import { fetchMeasures, fetchObservations } from "./measures";

export const UPLOADS_PER_HOUR = 10;
const PREVIEW_ROWS = 50;
const HOUR = 60 * 60 * 1000;

/** Uploads live outside the source tree and are git-ignored. */
const UPLOADS_DIR = join(process.cwd(), ".data", "uploads");

const REFERENCES = [
  ...Object.values(HOUSEHOLD_OPTIONS),
  { measure: "sales_kwh", dimension: "residential", label: "Electricity sold to homes" },
  { measure: "customers", dimension: "residential", label: "Residential customers" },
  { measure: "revenue", dimension: "residential", label: "Revenue from homes" },
  ...Object.values(FINANCIAL_OPTIONS),
] as const satisfies readonly { measure: MeasureSlug; dimension: string; label: string }[];

let context: Promise<{ ctx: RelateContext; measures: Measure[] }> | undefined;

/** The site's own series that uploads are related to. Built once, since the snapshot is fixed. */
export function loadRelateContext(): Promise<{ ctx: RelateContext; measures: Measure[] }> {
  context ??= (async () => {
    const [measures, tracts, ...series] = await Promise.all([
      fetchMeasures(MEASURE_SLUGS),
      fetchObservations("energy_burden", { geo: "any" }),
      ...REFERENCES.map((r) =>
        fetchObservations(r.measure, { dimension: r.dimension, geo: "none" }),
      ),
    ]);
    const yearly: ReferenceSeries[] = REFERENCES.map((r, i) => ({
      measure: r.measure,
      label: r.label,
      points: toYearly(series[i] ?? [], measures.get(r.measure)?.annualAgg ?? "sum"),
    }));
    return {
      ctx: { yearly, tractBurden: Object.fromEntries(tracts.map((o) => [o.geoId, o.value])) },
      measures: [...measures.values()],
    };
  })();
  return context;
}

/** Upload times per client IP. Held in memory only, so no IP address is ever written to disk. */
const uploadTimes = new Map<string, number[]>();

/** Records an upload for the current client, or returns false if it is over the hourly limit. */
export function claimUploadSlot(): boolean {
  const ip =
    getRequestHeader("cf-connecting-ip") ?? getRequestIP({ xForwardedFor: true }) ?? "unknown";
  const now = Date.now();
  const recent = (uploadTimes.get(ip) ?? []).filter((t) => now - t < HOUR);
  if (recent.length >= UPLOADS_PER_HOUR) return false;
  uploadTimes.set(ip, [...recent, now]);
  return true;
}

export interface DatasetSummary {
  id: string;
  name: string;
  fileName: string;
  format: DatasetFormat;
  rowCount: number;
  columnCount: number;
  createdAt: string;
}

export interface StoredInsight {
  id: string;
  kind: "stat" | "relation" | "ai";
  title: string;
  body: string;
  relatedMeasure: MeasureSlug | null;
  stats: InsightStats | null;
}

export interface DatasetDetail extends DatasetSummary {
  profile: DatasetProfile;
  insights: StoredInsight[];
  preview: { columns: string[]; rows: Cell[][] };
}

interface NewDataset {
  name: string;
  fileName: string;
  format: DatasetFormat;
  rows: Cell[][];
  profile: DatasetProfile;
  insights: ComputedInsight[];
  summary: AiSummary | null;
}

const detailPath = (id: string) => join(UPLOADS_DIR, `${id}.json`);
const rowsPath = (id: string) => join(UPLOADS_DIR, `${id}.rows.json`);

/** Saves a dataset with its rows and insights. Nothing is left behind if any step fails. */
export async function storeDataset(input: NewDataset): Promise<string> {
  const id = crypto.randomUUID();
  const ai: Omit<StoredInsight, "id">[] = input.summary
    ? [
        {
          kind: "ai",
          title: input.summary.headline,
          body: input.summary.bullets.join("\n"),
          relatedMeasure: input.summary.relatedMeasure,
          stats: { caveats: input.summary.caveats },
        },
      ]
    : [];
  const detail: DatasetDetail = {
    id,
    name: input.name,
    fileName: input.fileName,
    format: input.format,
    rowCount: input.rows.length,
    columnCount: input.profile.columns.length,
    createdAt: new Date().toISOString(),
    profile: input.profile,
    insights: [...ai, ...input.insights].map((insight, position) => ({
      id: `${id}-${position}`,
      kind: insight.kind,
      title: insight.title,
      body: insight.body,
      relatedMeasure: insight.relatedMeasure,
      stats: insight.stats,
    })),
    preview: {
      columns: input.profile.columns.map((c) => c.name),
      rows: input.rows.slice(0, PREVIEW_ROWS),
    },
  };

  await mkdir(UPLOADS_DIR, { recursive: true });
  try {
    // The detail file goes last: a dataset only appears in listings once its rows are saved.
    await writeFile(rowsPath(id), JSON.stringify(input.rows));
    await writeFile(detailPath(id), JSON.stringify(detail));
  } catch (cause) {
    await Promise.all([rm(rowsPath(id), { force: true }), rm(detailPath(id), { force: true })]);
    throw cause;
  }
  return id;
}

async function readDetail(path: string): Promise<DatasetDetail | null> {
  try {
    return JSON.parse(await readFile(path, "utf8")) as DatasetDetail;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw error;
  }
}

export async function fetchRecentDatasets(limit = 12): Promise<DatasetSummary[]> {
  const files = await readdir(UPLOADS_DIR).catch(() => [] as string[]);
  const details = await Promise.all(
    files
      .filter((f) => f.endsWith(".json") && !f.endsWith(".rows.json"))
      .map((f) => readDetail(join(UPLOADS_DIR, f))),
  );
  return details
    .filter((d): d is DatasetDetail => d !== null)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, limit)
    .map(({ profile: _p, insights: _i, preview: _r, ...summary }) => summary);
}

export function fetchDataset(id: string): Promise<DatasetDetail | null> {
  return readDetail(detailPath(id));
}
