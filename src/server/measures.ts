/**
 * Reads the verified snapshot into memory once, then serves measures and observations.
 * Server-only: the JSON file is not shipped to the browser as a module the pages import.
 */
import "@tanstack/react-start/server-only";

import type { Measure, MeasureSlug, Observation, Source } from "@/data/types";

import snapshotJson from "./data/verified.json";
import type { VerifiedSnapshot } from "./snapshot";

const snapshot = snapshotJson as unknown as VerifiedSnapshot;

const sources = new Map<string, Source>(
  snapshot.sources.map((s) => [
    s.slug,
    {
      publisher: s.publisher,
      title: s.title,
      url: s.url,
      dataYear: s.dataYear,
      retrievedAt: s.retrievedAt,
    },
  ]),
);

const measures = new Map<MeasureSlug, Measure>(
  snapshot.measures.map(({ sourceSlug, additionalSourceSlugs, ...m }) => [
    m.slug,
    {
      ...m,
      source: sources.get(sourceSlug) ?? null,
      additionalSources: (additionalSourceSlugs ?? []).flatMap((slug) => {
        const source = sources.get(slug);
        return source ? [source] : [];
      }),
    },
  ]),
);

const observations: (Observation & { measure: MeasureSlug })[] = snapshot.observations
  .map(([measure, period, grain, dimension, geoId, value]) => ({
    measure,
    period,
    grain,
    dimension,
    geoId,
    value,
  }))
  .sort(
    (a, b) =>
      a.period.localeCompare(b.period) ||
      a.dimension.localeCompare(b.dimension) ||
      a.geoId.localeCompare(b.geoId),
  );

export async function fetchMeasures(
  slugs: readonly MeasureSlug[],
): Promise<Map<MeasureSlug, Measure>> {
  return new Map(
    slugs.flatMap((slug) => {
      const measure = measures.get(slug);
      return measure ? [[slug, measure] as const] : [];
    }),
  );
}

export async function fetchMeasure(slug: MeasureSlug): Promise<Measure> {
  const measure = measures.get(slug);
  if (!measure) throw new Error(`Measure ${slug} is not in the data snapshot. Run npm run seed.`);
  return measure;
}

interface ObservationFilter {
  dimension?: string;
  /** "none" keeps area-wide rows, "any" keeps only rows tied to a place (tract, state). */
  geo?: "none" | "any";
}

/** All observations for a measure, sorted by period. */
export async function fetchObservations(
  slug: MeasureSlug,
  filter: ObservationFilter = {},
): Promise<Observation[]> {
  return observations
    .filter(
      (o) =>
        o.measure === slug &&
        (filter.dimension === undefined || o.dimension === filter.dimension) &&
        (filter.geo !== "none" || o.geoId === "") &&
        (filter.geo !== "any" || o.geoId !== ""),
    )
    .map(({ measure: _, ...o }) => o);
}
