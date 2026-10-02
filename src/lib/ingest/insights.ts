import type { MeasureSlug, YearPoint } from "@/data/types";
import { formatNumber } from "@/lib/format";

import type { ParsedTable } from "./parse";
import {
  columnValues,
  lowerFirst,
  parseDate,
  parseNumber,
  toText,
  type ColumnProfile,
  type DatasetProfile,
} from "./profile";

export interface InsightChart {
  kind: "line" | "bar";
  points: { label: string; value: number }[];
  valueLabel: string;
}

export interface InsightStats {
  column?: string;
  chart?: InsightChart;
  r?: number;
  years?: number[];
  matched?: number;
  /** Limits noted alongside an AI-written summary. */
  caveats?: string[];
}

export interface ComputedInsight {
  kind: "stat" | "relation";
  title: string;
  body: string;
  relatedMeasure: MeasureSlug | null;
  stats: InsightStats;
}

export type YearlyAgg = "value" | "sum" | "mean";

export interface YearlySeries {
  agg: YearlyAgg;
  points: YearPoint[];
  /** Years dropped because they were reported only in part. */
  partialYears: number[];
}

// Columns that read as amounts add up across rows in a year; anything else is averaged.
const SUM_HINT =
  /count|total|number|shutoff|disconnect|customer|household|revenue|sales|amount|kwh|mwh|spend|cost|paid|dollar|usd/i;

const AGG_PHRASE: Record<YearlyAgg, string> = {
  value: "It",
  sum: "The yearly total",
  mean: "The yearly average",
};

/** Groups a numeric column by the dataset's time column into one value per year. */
export function yearlySeries(
  table: ParsedTable,
  profile: DatasetProfile,
  column: string,
): YearlySeries | null {
  const time = profile.columns.find((c) => c.name === profile.timeColumn);
  if (!time) return null;
  const times = columnValues(table, time.name);
  const values = columnValues(table, column);

  const byYear = new Map<number, { values: number[]; periods: Set<string> }>();
  times.forEach((cell, i) => {
    const period = time.kind === "year" ? String(parseNumber(cell)) : parseDate(cell);
    const value = parseNumber(values[i] ?? null);
    if (!period || period === "null" || value === null) return;
    const year = Number(period.slice(0, 4));
    const entry = byYear.get(year) ?? { values: [], periods: new Set<string>() };
    entry.values.push(value);
    entry.periods.add(period.slice(0, 7));
    byYear.set(year, entry);
  });
  if (byYear.size === 0) return null;

  const single = [...byYear.values()].every((e) => e.values.length === 1);
  const agg: YearlyAgg = single ? "value" : SUM_HINT.test(column) ? "sum" : "mean";
  const fullYear = Math.max(...[...byYear.values()].map((e) => e.periods.size));
  const partialYears: number[] = [];
  const points: YearPoint[] = [];
  for (const [year, entry] of [...byYear.entries()].sort((a, b) => a[0] - b[0])) {
    if (agg === "sum" && time.kind === "date" && entry.periods.size < fullYear) {
      partialYears.push(year);
      continue;
    }
    const total = entry.values.reduce((s, v) => s + v, 0);
    points.push({ year, value: agg === "mean" ? total / entry.values.length : total });
  }
  return { agg, points, partialYears };
}

const pct = (v: number) => `${Math.abs(v).toFixed(1)}%`;

function trendInsight(column: string, series: YearlySeries): ComputedInsight | null {
  const { points } = series;
  const first = points[0];
  const last = points.at(-1);
  const previous = points.at(-2);
  if (!first || !last || !previous) return null;

  const change =
    first.value === 0 ? null : ((last.value - first.value) / Math.abs(first.value)) * 100;
  const span = last.year - first.year;
  const cagr =
    first.value > 0 && last.value > 0 && span > 1
      ? ((last.value / first.value) ** (1 / span) - 1) * 100
      : null;
  const peak = points.reduce((a, b) => (b.value > a.value ? b : a));
  const low = points.reduce((a, b) => (b.value < a.value ? b : a));
  const recent =
    previous.value === 0 ? null : ((last.value - previous.value) / Math.abs(previous.value)) * 100;

  const sentences = [
    `${AGG_PHRASE[series.agg]} went from ${formatNumber(first.value)} in ${first.year} to ${formatNumber(last.value)} in ${last.year}${
      cagr === null ? "" : `, about ${cagr >= 0 ? "+" : "−"}${pct(cagr)} a year on average`
    }.`,
    `The highest year was ${peak.year} (${formatNumber(peak.value)}) and the lowest was ${low.year} (${formatNumber(low.value)}).`,
    recent === null
      ? ""
      : `Most recently it ${recent >= 0 ? "rose" : "fell"} ${pct(recent)} from ${previous.year} to ${last.year}.`,
    series.partialYears.length
      ? `${series.partialYears.join(" and ")} ${series.partialYears.length === 1 ? "is" : "are"} left out because only part of the year is in the file.`
      : "",
  ];

  return {
    kind: "stat",
    title:
      change === null
        ? `${column}, ${first.year} to ${last.year}`
        : `${column} ${change >= 0 ? "rose" : "fell"} ${pct(change)} from ${first.year} to ${last.year}`,
    body: sentences.filter(Boolean).join(" "),
    relatedMeasure: null,
    stats: {
      column,
      years: points.map((p) => p.year),
      chart: {
        kind: "line",
        valueLabel: column,
        points: points.map((p) => ({ label: String(p.year), value: p.value })),
      },
    },
  };
}

function rankingInsight(
  table: ParsedTable,
  label: ColumnProfile,
  numeric: ColumnProfile | undefined,
): ComputedInsight {
  const labels = columnValues(table, label.name).map(toText);
  const values = numeric ? columnValues(table, numeric.name).map(parseNumber) : null;
  const totals = new Map<string, number>();
  labels.forEach((name, i) => {
    if (!name) return;
    const add = values ? values[i] : 1;
    if (add === null || add === undefined) return;
    totals.set(name, (totals.get(name) ?? 0) + add);
  });
  const ranked = [...totals.entries()].sort((a, b) => b[1] - a[1]);
  const grand = ranked.reduce((s, [, v]) => s + v, 0);
  const [topName, topValue] = ranked[0] ?? ["", 0];
  const lead = numeric ? formatNumber(topValue) : `${formatNumber(topValue)} rows`;
  const share =
    grand > 0 && ranked.length > 1 ? `, or ${pct((topValue / grand) * 100)} of the total` : "";
  const rest = ranked
    .slice(1, 3)
    .map(([name, v]) => `${name} (${formatNumber(v)})`)
    .join(" and ");

  return {
    kind: "stat",
    title: numeric
      ? `${topName} leads on ${lowerFirst(numeric.name)}`
      : `Most common ${lowerFirst(label.name)}: ${topName}`,
    body: `${topName}: ${lead}${share}.${rest ? ` Next come ${rest}.` : ""}`,
    relatedMeasure: null,
    stats: {
      column: numeric?.name ?? label.name,
      chart: {
        kind: "bar",
        valueLabel: numeric ? numeric.name : "Rows",
        points: ranked.slice(0, 10).map(([name, value]) => ({ label: name, value })),
      },
    },
  };
}

function distributionInsight(
  table: ParsedTable,
  column: ColumnProfile,
  label: ColumnProfile | undefined,
): ComputedInsight | null {
  const s = column.numeric;
  if (!s || s.min === s.max) return null;
  const values = columnValues(table, column.name).map(parseNumber);
  const spread = s.q3 - s.q1;
  const [lowFence, highFence] = [s.q1 - 1.5 * spread, s.q3 + 1.5 * spread];
  const outliers = values.flatMap((v, i) =>
    v !== null && (v < lowFence || v > highFence) ? [{ v, i }] : [],
  );
  const biggest = outliers.reduce<{ v: number; i: number } | null>(
    (a, b) => (!a || b.v > a.v ? b : a),
    null,
  );
  const biggestLabel =
    biggest && label ? toText(columnValues(table, label.name)[biggest.i] ?? null) : "";

  const bins = 8;
  const width = (s.max - s.min) / bins;
  const counts = Array.from({ length: bins }, () => 0);
  for (const v of values)
    if (v !== null) counts[Math.min(bins - 1, Math.floor((v - s.min) / width))]!++;

  return {
    kind: "stat",
    title: `${column.name}: typically around ${formatNumber(s.median)}`,
    body: [
      `Values run from ${formatNumber(s.min)} to ${formatNumber(s.max)}, with a median of ${formatNumber(s.median)} and an average of ${formatNumber(s.mean)}.`,
      outliers.length
        ? `${outliers.length} ${outliers.length === 1 ? "value stands" : "values stand"} well outside the usual range${
            biggestLabel ? `; the largest is ${biggestLabel} at ${formatNumber(biggest!.v)}` : ""
          }.`
        : "No values stand far outside the usual range.",
    ].join(" "),
    relatedMeasure: null,
    stats: {
      column: column.name,
      chart: {
        kind: "bar",
        valueLabel: "Rows",
        points: counts.map((count, i) => ({
          label: `${formatNumber(s.min + width * i)}–${formatNumber(s.min + width * (i + 1))}`,
          value: count,
        })),
      },
    },
  };
}

/** Plain-language statistics about a dataset, strongest findings first. */
export function computeInsights(table: ParsedTable, profile: DatasetProfile): ComputedInsight[] {
  const numeric = profile.columns.filter((c) => c.kind === "number");
  const label =
    profile.columns.find((c) => c.kind === "category") ??
    profile.columns.find((c) => c.kind === "county") ??
    profile.columns.find((c) => c.kind === "text" && c.distinct >= c.filled * 0.9);

  const trends = profile.timeColumn
    ? numeric.flatMap((c) => {
        const series = yearlySeries(table, profile, c.name);
        const insight = series ? trendInsight(c.name, series) : null;
        return insight ? [insight] : [];
      })
    : [];
  const rankings = label ? [rankingInsight(table, label, numeric[0])] : [];
  const distributions = numeric.flatMap((c) => {
    const insight = distributionInsight(table, c, label);
    return insight ? [insight] : [];
  });

  return [
    ...trends.slice(0, 3),
    ...rankings,
    ...distributions.slice(0, trends.length ? 1 : 3),
  ].slice(0, 6);
}
