import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { fetchMeasure, fetchMeasures, fetchObservations } from "@/server/measures";

import {
  FINANCIAL_KEYS,
  FINANCIAL_OPTIONS,
  HOUSEHOLD_KEYS,
  HOUSEHOLD_OPTIONS,
  MIN_OVERLAP_YEARS,
} from "./compare";
import { CUSTOMER_CLASSES, type CustomerClass, type ShutoffService } from "./labels";
import { alignYears, pearson, toYearly, yearOf } from "./series";
import type { Grain, Measure, MeasureSlug, Observation, YearPoint } from "./types";

export interface Point {
  period: string;
  value: number;
}

export interface MeasureSummary {
  measure: Measure;
  grain: Grain;
  series: Point[];
  latest: Point;
  /** The value one year before `latest`, when reported. */
  previous: Point | null;
}

const CLASS_MEASURES = [
  "avg_yearly_bill",
  "avg_price_kwh",
  "sales_kwh",
  "customers",
  "revenue",
] as const;
type ClassMeasure = (typeof CLASS_MEASURES)[number];

export type ShutoffMonth = { period: string } & Partial<Record<ShutoffService, number>>;
export type ClassRow = { key: CustomerClass } & Record<ClassMeasure, number>;

export interface HouseholdData {
  burden: {
    measure: Measure;
    overall: number | null;
    bands: { key: string; value: number }[];
    tracts: Record<string, number>;
  };
  shutoffs: { measure: Measure; months: ShutoffMonth[] };
  classes: {
    year: number;
    measures: Record<ClassMeasure, Measure>;
    rows: ClassRow[];
    bills: ({ year: number } & Partial<Record<CustomerClass, number>>)[];
  };
}

const toPoint = (o: Observation): Point => ({ period: o.period, value: o.value });

function summarize(measure: Measure, observations: Observation[]): MeasureSummary {
  const latest = observations.at(-1);
  if (!latest) throw new Error(`No observations for ${measure.slug}`);
  const yearEarlier = `${yearOf(latest.period) - 1}${latest.period.slice(4)}`;
  const previous = observations.find((o) => o.period === yearEarlier);
  return {
    measure,
    grain: latest.grain,
    series: observations.map(toPoint),
    latest: toPoint(latest),
    previous: previous ? toPoint(previous) : null,
  };
}

async function requireMeasures<T extends MeasureSlug>(
  slugs: readonly T[],
): Promise<Record<T, Measure>> {
  const found = await fetchMeasures(slugs);
  return Object.fromEntries(
    slugs.map((slug) => {
      const measure = found.get(slug);
      if (!measure) throw new Error(`Measure ${slug} is not in the database. Run npm run seed.`);
      return [slug, measure];
    }),
  ) as Record<T, Measure>;
}

export const getHouseholdData = createServerFn({ method: "GET" }).handler(
  async (): Promise<HouseholdData> => {
    const [
      burdenMeasure,
      burdenAreas,
      burdenTracts,
      shutoffMeasure,
      shutoffRows,
      classMeasures,
      ...classSeries
    ] = await Promise.all([
      fetchMeasure("energy_burden"),
      fetchObservations("energy_burden", { geo: "none" }),
      fetchObservations("energy_burden", { geo: "any" }),
      fetchMeasure("shutoffs"),
      fetchObservations("shutoffs"),
      requireMeasures(CLASS_MEASURES),
      ...CLASS_MEASURES.map((slug) => fetchObservations(slug)),
    ]);

    const months = new Map<string, ShutoffMonth>();
    for (const o of shutoffRows) {
      const month = months.get(o.period) ?? { period: o.period };
      month[o.dimension as ShutoffService] = o.value;
      months.set(o.period, month);
    }

    const values = new Map<string, number>();
    CLASS_MEASURES.forEach((slug, i) => {
      for (const o of classSeries[i] ?? [])
        values.set(`${slug}|${yearOf(o.period)}|${o.dimension}`, o.value);
    });
    const years = [...new Set((classSeries[0] ?? []).map((o) => yearOf(o.period)))].sort(
      (a, b) => a - b,
    );
    const year = years.at(-1) ?? 0;
    const value = (slug: ClassMeasure, y: number, key: string) => values.get(`${slug}|${y}|${key}`);

    return {
      burden: {
        measure: burdenMeasure,
        overall: burdenAreas.find((o) => o.dimension === "all")?.value ?? null,
        bands: burdenAreas
          .filter((o) => o.dimension !== "all")
          .map((o) => ({ key: o.dimension, value: o.value })),
        tracts: Object.fromEntries(burdenTracts.map((o) => [o.geoId, o.value])),
      },
      shutoffs: { measure: shutoffMeasure, months: [...months.values()] },
      classes: {
        year,
        measures: classMeasures,
        rows: CUSTOMER_CLASSES.flatMap(({ key }) => {
          const cells = CLASS_MEASURES.map((slug) => [slug, value(slug, year, key)] as const);
          if (cells.some(([, v]) => v === undefined)) return [];
          return [{ key, ...Object.fromEntries(cells) } as ClassRow];
        }),
        bills: years.map((y) => ({
          year: y,
          ...Object.fromEntries(
            CUSTOMER_CLASSES.flatMap(({ key }) => {
              const bill = value("avg_yearly_bill", y, key);
              return bill === undefined ? [] : [[key, bill]];
            }),
          ),
        })),
      },
    };
  },
);

const FINANCIAL_MEASURES = [
  "stock_price",
  "dividends_per_share",
  "revenue_growth",
  "ceo_total_pay",
] as const;

export const getFinancialsData = createServerFn({ method: "GET" }).handler(
  async (): Promise<MeasureSummary[]> => {
    const [measures, ...series] = await Promise.all([
      requireMeasures(FINANCIAL_MEASURES),
      ...FINANCIAL_MEASURES.map((slug) => fetchObservations(slug)),
    ]);
    return FINANCIAL_MEASURES.map((slug, i) => summarize(measures[slug], series[i] ?? []));
  },
);

export interface CompareSide {
  label: string;
  measure: Measure;
  points: YearPoint[];
}

export interface CompareData {
  household: CompareSide;
  financial: CompareSide;
  overlap: number[];
  correlation: number | null;
}

export const compareInput = z.object({
  household: z.enum(HOUSEHOLD_KEYS),
  financial: z.enum(FINANCIAL_KEYS),
});

async function compareSide(option: {
  measure: MeasureSlug;
  dimension: string;
  label: string;
}): Promise<CompareSide> {
  const [measure, observations] = await Promise.all([
    fetchMeasure(option.measure),
    fetchObservations(option.measure, { dimension: option.dimension, geo: "none" }),
  ]);
  return { label: option.label, measure, points: toYearly(observations, measure.annualAgg) };
}

export const getCompareSeries = createServerFn({ method: "GET" })
  .validator(compareInput)
  .handler(async ({ data }): Promise<CompareData> => {
    const [household, financial] = await Promise.all([
      compareSide(HOUSEHOLD_OPTIONS[data.household]),
      compareSide(FINANCIAL_OPTIONS[data.financial]),
    ]);
    const aligned = alignYears(household.points, financial.points);
    return {
      household,
      financial,
      overlap: aligned.map((p) => p.year),
      correlation: pearson(
        aligned.map((p) => p.a),
        aligned.map((p) => p.b),
        MIN_OVERLAP_YEARS,
      ),
    };
  });

export interface MichiganContext {
  measure: Measure;
  indicators: { key: string; michigan: number | null; us: number | null }[];
}

export const getMichiganContext = createServerFn({ method: "GET" }).handler(
  async (): Promise<MichiganContext> => {
    const [measure, rows] = await Promise.all([
      fetchMeasure("mi_energy_insecurity"),
      fetchObservations("mi_energy_insecurity", { geo: "any" }),
    ]);
    const keys = [...new Set(rows.map((r) => r.dimension))];
    const pick = (key: string, geo: string) =>
      rows.find((r) => r.dimension === key && r.geoId === geo)?.value ?? null;
    return {
      measure,
      indicators: keys.map((key) => ({ key, michigan: pick(key, "MI"), us: pick(key, "US") })),
    };
  },
);

export interface Headlines {
  burden: { measure: Measure; veryLow: number; overall: number };
  price: { measure: Measure; first: YearPoint; latest: YearPoint };
  shutoffs: { measure: Measure; year: number; total: number };
  ceoPay: { measure: Measure; latest: YearPoint };
}

export const getHeadlines = createServerFn({ method: "GET" }).handler(
  async (): Promise<Headlines> => {
    const [measures, burden, price, shutoffs, pay] = await Promise.all([
      requireMeasures(["energy_burden", "avg_price_kwh", "shutoffs", "ceo_total_pay"]),
      fetchObservations("energy_burden", { geo: "none" }),
      fetchObservations("avg_price_kwh", { dimension: "residential" }),
      fetchObservations("shutoffs"),
      fetchObservations("ceo_total_pay"),
    ]);

    const prices = toYearly(price, "mean");
    const shutoffYears = new Map<number, number>();
    for (const service of new Set(shutoffs.map((o) => o.dimension))) {
      const rows = shutoffs.filter((o) => o.dimension === service);
      for (const p of toYearly(rows, "sum"))
        shutoffYears.set(p.year, (shutoffYears.get(p.year) ?? 0) + p.value);
    }
    const shutoffYear = Math.max(...shutoffYears.keys());
    const payYears = toYearly(pay, "sum");
    const band = (key: string) => burden.find((o) => o.dimension === key)?.value ?? Number.NaN;

    return {
      burden: { measure: measures.energy_burden, veryLow: band("0-30%"), overall: band("all") },
      price: { measure: measures.avg_price_kwh, first: prices[0]!, latest: prices.at(-1)! },
      shutoffs: {
        measure: measures.shutoffs,
        year: shutoffYear,
        total: shutoffYears.get(shutoffYear) ?? 0,
      },
      ceoPay: { measure: measures.ceo_total_pay, latest: payYears.at(-1)! },
    };
  },
);
