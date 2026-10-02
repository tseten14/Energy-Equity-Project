import { MIN_OVERLAP_YEARS } from "@/data/compare";
import { DTE_COUNTIES } from "@/data/labels";
import { alignYears, describeCorrelation, pearson } from "@/data/series";
import type { MeasureSlug, YearPoint } from "@/data/types";

import { computeInsights, yearlySeries, type ComputedInsight } from "./insights";
import type { ParsedTable } from "./parse";
import {
  columnValues,
  countyFips,
  lowerFirst,
  numericStats,
  parseNumber,
  profileTable,
  tractGeoid,
  type ColumnProfile,
  type DatasetProfile,
} from "./profile";

/** A yearly series from the site's own data that uploads are compared against. */
export interface ReferenceSeries {
  measure: MeasureSlug;
  label: string;
  points: YearPoint[];
}

export interface RelateContext {
  yearly: ReferenceSeries[];
  /** Household energy burden (% of income) by 11-digit census tract GEOID. */
  tractBurden: Record<string, number>;
}

const MEASURE_KEYWORDS: Record<MeasureSlug, RegExp> = {
  energy_burden: /\b(energy burden|burden|income|ami|poverty|afford)/i,
  shutoffs: /\b(shut ?offs?|disconnect)/i,
  avg_yearly_bill: /\bbills?\b/i,
  // Words like "rate", "sales" and "growth" are too common alone, so they only count in an energy context.
  avg_price_kwh: /\b(prices?|cents)\b|per kwh|\b(electric|electricity|energy|utility) rates?\b/i,
  sales_kwh: /\b(kwh|mwh|gwh|consumption)\b|\b(electricity|energy|power) (use|usage|sales)\b/i,
  customers: /\b(customers?|meters?)\b/i,
  revenue: /\brevenues?\b/i,
  stock_price: /\b(stock|share price|closing price)\b/i,
  dividends_per_share: /\bdividends?\b/i,
  revenue_growth: /\brevenue growth\b/i,
  ceo_total_pay: /\b(ceo|compensation|executive pay)\b/i,
  mi_energy_insecurity: /\b(insecur\w*|unable to pay|forgo|unsafe temperature)/i,
};

/** Site measures whose topic a piece of text (a column or dataset name) mentions. */
export function topicMatches(text: string): MeasureSlug[] {
  return (Object.keys(MEASURE_KEYWORDS) as MeasureSlug[]).filter((slug) =>
    MEASURE_KEYWORDS[slug].test(text),
  );
}

const MIN_RELATION = 0.5;
const MIN_TRACT_MATCHES = 10;
const MIN_COUNTY_MATCHES = 5;

function yearlyRelations(
  table: ParsedTable,
  profile: DatasetProfile,
  ctx: RelateContext,
): ComputedInsight[] {
  const found = profile.columns
    .filter((c) => c.kind === "number")
    .flatMap((column) => {
      const series = yearlySeries(table, profile, column.name);
      if (!series) return [];
      return ctx.yearly.flatMap((ref) => {
        const aligned = alignYears(series.points, ref.points);
        if (aligned.length < MIN_OVERLAP_YEARS) return [];
        const r = pearson(
          aligned.map((y) => y.a),
          aligned.map((y) => y.b),
          MIN_OVERLAP_YEARS,
        );
        return r !== null && Math.abs(r) >= MIN_RELATION
          ? [{ column: column.name, ref, r, aligned }]
          : [];
      });
    })
    .sort((a, b) => Math.abs(b.r) - Math.abs(a.r))
    .slice(0, 3);

  return found.map(({ column, ref, r, aligned }) => {
    const from = aligned[0]!.year;
    const to = aligned.at(-1)!.year;
    return {
      kind: "relation",
      title: `${column} and ${lowerFirst(ref.label)} ${r > 0 ? "moved together" : "moved in opposite directions"}`,
      body:
        `Across the ${aligned.length} years both cover (${from}–${to}), they show ${describeCorrelation(r)} ` +
        `(correlation ${r.toFixed(2)}). Two series that both change steadily over time often line up like this, ` +
        `so treat it as a pattern, not proof that one causes the other.`,
      relatedMeasure: ref.measure,
      stats: { column, r, years: aligned.map((y) => y.year) },
    };
  });
}

/** Averages a numeric column by place, keeping only places in `known`. */
function valuesByPlace(
  table: ParsedTable,
  places: (string | null)[],
  column: ColumnProfile,
  known: Map<string, number>,
): { a: number; b: number }[] {
  const sums = new Map<string, { total: number; n: number }>();
  columnValues(table, column.name).forEach((cell, i) => {
    const place = places[i];
    const value = parseNumber(cell);
    if (!place || value === null || !known.has(place)) return;
    const entry = sums.get(place) ?? { total: 0, n: 0 };
    sums.set(place, { total: entry.total + value, n: entry.n + 1 });
  });
  return [...sums.entries()].map(([place, s]) => ({ a: s.total / s.n, b: known.get(place)! }));
}

function strongestColumn(
  table: ParsedTable,
  profile: DatasetProfile,
  places: (string | null)[],
  known: Map<string, number>,
  minPoints: number,
) {
  return profile.columns
    .filter((c) => c.kind === "number")
    .map((column) => {
      const pairs = valuesByPlace(table, places, column, known);
      const r = pearson(
        pairs.map((p) => p.a),
        pairs.map((p) => p.b),
        minPoints,
      );
      return { column: column.name, r };
    })
    .filter((c): c is { column: string; r: number } => c.r !== null)
    .sort((a, b) => Math.abs(b.r) - Math.abs(a.r))[0];
}

/** Describes a link across places, which is a comparison between places rather than a change over time. */
function placePattern(
  best: { column: string; r: number } | undefined,
  places: "tracts" | "counties",
): string {
  if (!best) return "";
  const strength = Math.abs(best.r) >= 0.7 ? "strong" : Math.abs(best.r) >= 0.4 ? "moderate" : null;
  const column = lowerFirst(best.column);
  const correlation = `correlation ${best.r.toFixed(2)}`;
  const finding = strength
    ? `${places === "tracts" ? "Tracts" : "Counties"} with higher ${column} tend to have ${best.r > 0 ? "higher" : "lower"} energy burden (a ${strength} pattern, ${correlation}).`
    : `Across those ${places}, ${column} shows no consistent link with energy burden (${correlation}).`;
  return ` ${finding} This is a pattern, not proof of cause.`;
}

function tractRelation(
  table: ParsedTable,
  profile: DatasetProfile,
  ctx: RelateContext,
): ComputedInsight | null {
  const column = profile.columns.find((c) => c.kind === "tract");
  if (!column) return null;
  const known = new Map(Object.entries(ctx.tractBurden));
  const places = columnValues(table, column.name).map(tractGeoid);
  const matched = [...new Set(places)].filter((g): g is string => g !== null && known.has(g));
  if (matched.length === 0) return null;

  const matchedMean = numericStats(matched.map((g) => known.get(g)!)).mean;
  const dteMedian = numericStats([...known.values()]).median;
  const best = strongestColumn(table, profile, places, known, MIN_TRACT_MATCHES);
  const share = matchedMean / dteMedian;
  const comparison =
    Math.abs(share - 1) < 0.05 ? "about the same as" : share > 1 ? "higher than" : "lower than";

  return {
    kind: "relation",
    title: `${matched.length.toLocaleString()} tracts in your file are in DTE's service area`,
    body:
      `Households in those tracts spend ${matchedMean.toFixed(1)}% of income on energy on average, ` +
      `${comparison} the typical DTE-area tract (${dteMedian.toFixed(1)}%).` +
      placePattern(best, "tracts"),
    relatedMeasure: "energy_burden",
    stats: {
      matched: matched.length,
      ...(best ? { column: best.column, r: best.r } : {}),
      chart: {
        kind: "bar",
        valueLabel: "Energy burden (% of income)",
        points: [
          { label: "Tracts in your file", value: matchedMean },
          { label: "Typical DTE-area tract", value: dteMedian },
        ],
      },
    },
  };
}

function countyRelation(
  table: ParsedTable,
  profile: DatasetProfile,
  ctx: RelateContext,
): ComputedInsight | null {
  const column = profile.columns.find((c) => c.kind === "county");
  if (!column) return null;
  const byCounty = new Map<string, number[]>();
  for (const [geoid, value] of Object.entries(ctx.tractBurden)) {
    const fips = geoid.slice(0, 5);
    byCounty.set(fips, [...(byCounty.get(fips) ?? []), value]);
  }
  const known = new Map([...byCounty].map(([fips, values]) => [fips, numericStats(values).mean]));
  const places = columnValues(table, column.name).map(countyFips);
  const matched = [...new Set(places)].filter((f): f is string => f !== null && known.has(f));
  if (matched.length === 0) return null;

  const best = strongestColumn(table, profile, places, known, MIN_COUNTY_MATCHES);
  const ranked = matched
    .map((fips) => ({ label: DTE_COUNTIES[fips.slice(2)] ?? fips, value: known.get(fips)! }))
    .sort((a, b) => b.value - a.value);
  const top = ranked[0]!;

  return {
    kind: "relation",
    title: `${matched.length} ${matched.length === 1 ? "county" : "counties"} in your file are in DTE's service area`,
    body:
      `Of those, ${top.label} County has the highest average tract energy burden ` +
      `(${top.value.toFixed(1)}% of income).` +
      placePattern(best, "counties"),
    relatedMeasure: "energy_burden",
    stats: {
      matched: matched.length,
      ...(best ? { column: best.column, r: best.r } : {}),
      chart: {
        kind: "bar",
        valueLabel: "Average tract energy burden (% of income)",
        points: ranked,
      },
    },
  };
}

export function relateDataset(
  table: ParsedTable,
  profile: DatasetProfile,
  ctx: RelateContext,
): ComputedInsight[] {
  const places = [tractRelation(table, profile, ctx), countyRelation(table, profile, ctx)];
  return [
    ...places.filter((i): i is ComputedInsight => i !== null),
    ...yearlyRelations(table, profile, ctx),
  ];
}

export interface DatasetAnalysis {
  profile: DatasetProfile;
  insights: ComputedInsight[];
  topics: MeasureSlug[];
}

/** Profiles a dataset, computes its statistics, and relates it to the site's measures. */
export function analyzeDataset(
  name: string,
  table: ParsedTable,
  ctx: RelateContext,
): DatasetAnalysis {
  const profile = profileTable(table);
  const stats = computeInsights(table, profile).map((insight) => ({
    ...insight,
    relatedMeasure: topicMatches(insight.stats.column ?? "")[0] ?? null,
  }));
  const topics = [...new Set([name, ...table.columns].flatMap(topicMatches))];
  return { profile, insights: [...stats, ...relateDataset(table, profile, ctx)], topics };
}
