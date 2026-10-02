import "@tanstack/react-start/server-only";

import { getRequestHeader, getRequestIP } from "@tanstack/react-start/server";

import { FINANCIAL_OPTIONS, HOUSEHOLD_OPTIONS } from "@/data/compare";
import { toYearly } from "@/data/series";
import { MEASURE_SLUGS, type Measure, type MeasureSlug } from "@/data/types";
import type { ComputedInsight, InsightStats } from "@/lib/ingest/insights";
import type { Cell, DatasetFormat } from "@/lib/ingest/parse";
import type { DatasetProfile } from "@/lib/ingest/profile";
import type { RelateContext, ReferenceSeries } from "@/lib/ingest/relate";

import type { AiSummary } from "./ai-insights";
import type { Json } from "./database.types";
import { requireEnv } from "./env";
import { fetchMeasures, fetchObservations } from "./measures";
import { getSupabase } from "./supabase";

export const UPLOADS_PER_HOUR = 10;
const ROW_CHUNK = 1000;
const PREVIEW_ROWS = 50;

const REFERENCES = [
  ...Object.values(HOUSEHOLD_OPTIONS),
  { measure: "sales_kwh", dimension: "residential", label: "Electricity sold to homes" },
  { measure: "customers", dimension: "residential", label: "Residential customers" },
  { measure: "revenue", dimension: "residential", label: "Revenue from homes" },
  ...Object.values(FINANCIAL_OPTIONS),
] as const satisfies readonly { measure: MeasureSlug; dimension: string; label: string }[];

let cached: { at: number; value: Promise<{ ctx: RelateContext; measures: Measure[] }> } | undefined;

/** The site's own series that uploads are related to. Cached because they only change on a re-seed. */
export function loadRelateContext(): Promise<{ ctx: RelateContext; measures: Measure[] }> {
  if (!cached || Date.now() - cached.at > 60 * 60 * 1000) {
    const value = (async () => {
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
    cached = { at: Date.now(), value };
    value.catch(() => (cached = undefined));
  }
  return cached.value;
}

/**
 * A keyed hash of the uploader's IP, used only for rate limiting. Keying it with a server secret means the
 * stored value cannot be reversed by hashing every possible IPv4 address.
 */
export async function uploaderHash(): Promise<string> {
  const ip =
    getRequestHeader("cf-connecting-ip") ?? getRequestIP({ xForwardedFor: true }) ?? "unknown";
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(requireEnv("SUPABASE_SECRET_KEY")),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(`upload:${ip}`));
  return [...new Uint8Array(signature)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export async function recentUploadCount(hash: string): Promise<number> {
  const since = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const { count, error } = await getSupabase()
    .from("datasets")
    .select("id", { count: "exact", head: true })
    .eq("uploader_hash", hash)
    .gte("created_at", since);
  if (error) throw new Error(`Could not check upload limit: ${error.message}`);
  return count ?? 0;
}

const json = (value: unknown) => value as Json;

interface NewDataset {
  name: string;
  fileName: string;
  format: DatasetFormat;
  rows: Cell[][];
  profile: DatasetProfile;
  insights: ComputedInsight[];
  summary: AiSummary | null;
  uploaderHash: string;
}

/** Saves a dataset with its rows and insights. Nothing is left behind if any step fails. */
export async function storeDataset(input: NewDataset): Promise<string> {
  const supabase = getSupabase();
  const { data: dataset, error } = await supabase
    .from("datasets")
    .insert({
      name: input.name,
      file_name: input.fileName,
      format: input.format,
      row_count: input.rows.length,
      profile: json(input.profile),
      uploader_hash: input.uploaderHash,
    })
    .select("id")
    .single();
  if (error) throw new Error(`Could not save dataset: ${error.message}`);

  try {
    for (let start = 0; start < input.rows.length; start += ROW_CHUNK) {
      const chunk = input.rows.slice(start, start + ROW_CHUNK).map((row, i) => ({
        dataset_id: dataset.id,
        row_number: start + i,
        data: json(row),
      }));
      const { error: rowError } = await supabase.from("dataset_rows").insert(chunk);
      if (rowError) throw new Error(`Could not save rows: ${rowError.message}`);
    }

    const ai = input.summary
      ? [
          {
            kind: "ai",
            title: input.summary.headline,
            body: input.summary.bullets.join("\n"),
            related_measure: input.summary.relatedMeasure,
            stats: json({ caveats: input.summary.caveats } satisfies InsightStats),
          },
        ]
      : [];
    const insights = [
      ...ai,
      ...input.insights.map((i) => ({
        kind: i.kind,
        title: i.title,
        body: i.body,
        related_measure: i.relatedMeasure,
        stats: json(i.stats),
      })),
    ].map((row, position) => ({ ...row, position, dataset_id: dataset.id }));
    if (insights.length) {
      const { error: insightError } = await supabase.from("insights").insert(insights);
      if (insightError) throw new Error(`Could not save insights: ${insightError.message}`);
    }
  } catch (cause) {
    await supabase.from("datasets").delete().eq("id", dataset.id);
    throw cause;
  }
  return dataset.id;
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

interface DatasetRow {
  id: string;
  name: string;
  file_name: string;
  format: string;
  row_count: number;
  created_at: string;
  profile: Json;
}

function toSummary(row: DatasetRow): DatasetSummary {
  const profile = row.profile as unknown as DatasetProfile;
  return {
    id: row.id,
    name: row.name,
    fileName: row.file_name,
    format: row.format as DatasetFormat,
    rowCount: row.row_count,
    columnCount: profile.columns.length,
    createdAt: row.created_at,
  };
}

export async function fetchRecentDatasets(limit = 12): Promise<DatasetSummary[]> {
  const { data, error } = await getSupabase()
    .from("datasets")
    .select("id, name, file_name, format, row_count, created_at, profile")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw new Error(`Could not load uploads: ${error.message}`);
  return data.map(toSummary);
}

export async function fetchDataset(id: string): Promise<DatasetDetail | null> {
  const supabase = getSupabase();
  const [dataset, insights, rows] = await Promise.all([
    supabase
      .from("datasets")
      .select("id, name, file_name, format, row_count, created_at, profile")
      .eq("id", id)
      .maybeSingle(),
    supabase
      .from("insights")
      .select("id, kind, title, body, related_measure, stats")
      .eq("dataset_id", id)
      .order("position"),
    supabase
      .from("dataset_rows")
      .select("data")
      .eq("dataset_id", id)
      .order("row_number")
      .limit(PREVIEW_ROWS),
  ]);
  const failed = dataset.error ?? insights.error ?? rows.error;
  if (failed) throw new Error(`Could not load dataset: ${failed.message}`);
  if (!dataset.data) return null;

  const profile = dataset.data.profile as unknown as DatasetProfile;
  return {
    ...toSummary(dataset.data),
    profile,
    insights: (insights.data ?? []).map((i) => ({
      id: i.id,
      kind: i.kind as StoredInsight["kind"],
      title: i.title,
      body: i.body,
      relatedMeasure: i.related_measure as MeasureSlug | null,
      stats: i.stats as InsightStats | null,
    })),
    preview: {
      columns: profile.columns.map((c) => c.name),
      rows: (rows.data ?? []).map((r) => r.data as Cell[]),
    },
  };
}
