/**
 * The shape of src/server/data/verified.json, written by `npm run seed`.
 * Observations are tuples so the file stays small enough to bundle with the server.
 */
import type { AnnualAgg, Grain, MeasureSide, MeasureSlug, MeasureUnit } from "@/data/types";

export interface SnapshotSource {
  slug: string;
  publisher: string;
  title: string;
  url: string;
  dataYear: string;
  retrievedAt: string;
}

export interface SnapshotMeasure {
  slug: MeasureSlug;
  side: MeasureSide;
  label: string;
  unit: MeasureUnit;
  definition: string;
  annualAgg: AnnualAgg;
  sourceSlug: string;
}

/** [measure, period, grain, dimension, geoId, value]. Tuples keep the file small. */
export type SnapshotObservation = readonly [MeasureSlug, string, Grain, string, string, number];

export interface VerifiedSnapshot {
  sources: SnapshotSource[];
  measures: SnapshotMeasure[];
  observations: SnapshotObservation[];
}
