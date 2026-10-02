import "@tanstack/react-start/server-only";

import type { Grain, Measure, MeasureSlug, Observation } from "@/data/types";

import { getSupabase } from "./supabase";

const PAGE_SIZE = 1000;

export async function fetchMeasures(
  slugs: readonly MeasureSlug[],
): Promise<Map<MeasureSlug, Measure>> {
  const { data, error } = await getSupabase()
    .from("measures")
    .select(
      "slug, side, label, unit, definition, annual_agg, sources (publisher, title, url, data_year, retrieved_at)",
    )
    .in("slug", [...slugs]);
  if (error) throw new Error(`Could not load measures: ${error.message}`);

  return new Map(
    data.map((row) => [
      row.slug as MeasureSlug,
      {
        slug: row.slug as MeasureSlug,
        side: row.side as Measure["side"],
        label: row.label,
        unit: row.unit as Measure["unit"],
        definition: row.definition,
        annualAgg: row.annual_agg as Measure["annualAgg"],
        source: row.sources
          ? {
              publisher: row.sources.publisher,
              title: row.sources.title,
              url: row.sources.url,
              dataYear: row.sources.data_year,
              retrievedAt: row.sources.retrieved_at,
            }
          : null,
      },
    ]),
  );
}

export async function fetchMeasure(slug: MeasureSlug): Promise<Measure> {
  const measure = (await fetchMeasures([slug])).get(slug);
  if (!measure) throw new Error(`Measure ${slug} is not in the database. Run npm run seed.`);
  return measure;
}

interface ObservationFilter {
  dimension?: string;
  /** "none" keeps area-wide rows, "any" keeps only rows tied to a place (tract, state). */
  geo?: "none" | "any";
}

/** All observations for a measure, paged past PostgREST's row limit and sorted by period. */
export async function fetchObservations(
  slug: MeasureSlug,
  filter: ObservationFilter = {},
): Promise<Observation[]> {
  const rows: Observation[] = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    let query = getSupabase()
      .from("observations")
      .select("period, grain, dimension, geo_id, value")
      .eq("measure_slug", slug);
    if (filter.dimension !== undefined) query = query.eq("dimension", filter.dimension);
    if (filter.geo === "none") query = query.eq("geo_id", "");
    if (filter.geo === "any") query = query.neq("geo_id", "");

    const { data, error } = await query
      .order("period")
      .order("dimension")
      .order("geo_id")
      .range(from, from + PAGE_SIZE - 1);
    if (error) throw new Error(`Could not load ${slug} observations: ${error.message}`);

    rows.push(
      ...data.map((r) => ({
        period: r.period,
        grain: r.grain as Grain,
        dimension: r.dimension,
        geoId: r.geo_id,
        value: Number(r.value),
      })),
    );
    if (data.length < PAGE_SIZE) return rows;
  }
}
