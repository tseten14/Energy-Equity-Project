/**
 * Server functions the pages call.
 *
 * Each function reads the snapshot, shapes it for one screen, and returns plain
 * JSON. The household, financials, and overview pages each have one function.
 */
import { createServerFn } from "@tanstack/react-start";

import { fetchMeasure, fetchMeasures, fetchObservations } from "@/server/measures";

import { CUSTOMER_CLASSES, type CustomerClass, type ShutoffService } from "./labels";
import { toYearly, yearOf } from "./series";
import type { Grain, Measure, MeasureSlug, Observation } from "./types";
import { formatMonth, formatValue } from "../lib/format";

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
  /** Date of the SEC share count used for an estimated market capitalization. */
  basisDate?: string;
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
    ...(measure.slug === "market_cap" && latest.dimension ? { basisDate: latest.dimension } : {}),
  };
}

async function requireMeasures<T extends MeasureSlug>(
  slugs: readonly T[],
): Promise<Record<T, Measure>> {
  const found = await fetchMeasures(slugs);
  return Object.fromEntries(
    slugs.map((slug) => {
      const measure = found.get(slug);
      if (!measure)
        throw new Error(`Measure ${slug} is not in the data snapshot. Run npm run seed.`);
      return [slug, measure];
    }),
  ) as Record<T, Measure>;
}

/** Map, income bands, shutoff months, and customer-class prices for /household. */
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
  "market_cap",
  "dividends_paid",
  "revenue_growth",
  "ceo_total_pay",
] as const;

/** One card per company series on /financials: latest value, prior year, and the yearly points. */
export const getFinancialsData = createServerFn({ method: "GET" }).handler(
  async (): Promise<MeasureSummary[]> => {
    const [measures, ...series] = await Promise.all([
      requireMeasures(FINANCIAL_MEASURES),
      ...FINANCIAL_MEASURES.map((slug) => fetchObservations(slug)),
    ]);
    return FINANCIAL_MEASURES.map((slug, i) => summarize(measures[slug], series[i] ?? []));
  },
);

export interface OverviewFinding {
  label: string;
  value: string;
  detail: string;
  measure: Measure;
}

export interface OverviewData {
  household: OverviewFinding[];
  financial: OverviewFinding[];
}

function longDate(iso: string): string | undefined {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return undefined;
  return new Intl.DateTimeFormat("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${iso}T00:00:00Z`));
}

function comparedWith(current: number, previous: number, when: string): string {
  const pct = (current / previous - 1) * 100;
  const amount = `${Math.abs(pct).toFixed(1)}%`;
  if (pct < -0.05) return ` That is ${amount} lower than ${when}.`;
  if (pct > 0.05) return ` That is ${amount} higher than ${when}.`;
  return ` That is about the same as ${when}.`;
}

/** Dated, sourced facts for the editorial overview at /. */
export const getOverviewData = createServerFn({ method: "GET" }).handler(
  async (): Promise<OverviewData> => {
    const [measures, pulse, burden, bills, electricShutoffs, market, dividends, growth, pay] =
      await Promise.all([
        requireMeasures([
          "mi_energy_insecurity",
          "energy_burden",
          "avg_yearly_bill",
          "shutoffs",
          "market_cap",
          "dividends_paid",
          "revenue_growth",
          "ceo_total_pay",
        ]),
        fetchObservations("mi_energy_insecurity", { geo: "any" }),
        fetchObservations("energy_burden", { geo: "none" }),
        fetchObservations("avg_yearly_bill", { dimension: "residential" }),
        fetchObservations("shutoffs", { dimension: "electric" }),
        fetchObservations("market_cap"),
        fetchObservations("dividends_paid"),
        fetchObservations("revenue_growth"),
        fetchObservations("ceo_total_pay"),
      ]);

    const pulseItems = [
      ["unable_to_pay", "Could not pay an energy bill in full"],
      ["forgo_necessities", "Went without necessities to pay an energy bill"],
      ["unsafe_temperature", "Kept the home at an unsafe temperature"],
    ] as const;
    const pulseFindings: OverviewFinding[] = pulseItems.flatMap(([key, label]) => {
      const row = pulse.find((item) => item.dimension === key && item.geoId === "MI");
      const national = pulse.find((item) => item.dimension === key && item.geoId === "US");
      return row
        ? [
            {
              label,
              value: formatValue(row.value, "percent"),
              detail: national
                ? `U.S. comparison: ${formatValue(national.value, "percent")}`
                : `Michigan statewide · ${yearOf(row.period)}`,
              measure: measures.mi_energy_insecurity,
            },
          ]
        : [];
    });

    const low = burden.find((row) => row.dimension === "0-30%");
    const overall = burden.find((row) => row.dimension === "all");
    const latestBill = bills.at(-1);
    const fullYears = toYearly(electricShutoffs, "sum");
    const latestShutoffs = fullYears.at(-1);
    const latestMarket = market.at(-1);
    const priorMarket = latestMarket
      ? market.find(
          (row) =>
            row.period === `${yearOf(latestMarket.period) - 1}${latestMarket.period.slice(4)}`,
        )
      : undefined;
    const latestDividends = dividends.at(-1);
    const latestGrowth = growth.at(-1);
    const latestPay = pay.at(-1);
    const shareCountAsOf = latestMarket?.dimension
      ? longDate(latestMarket.dimension)
      : undefined;
    const marketChange =
      latestMarket && priorMarket
        ? comparedWith(latestMarket.value, priorMarket.value, formatMonth(priorMarket.period))
        : "";

    return {
      household: [
        ...pulseFindings,
        ...(low && overall
          ? [
              {
                label: "Energy burden for very low-income households",
                value: formatValue(low.value, "percent"),
                detail: `DTE service area, ${yearOf(low.period)}. All households there: ${formatValue(overall.value, "percent")}.`,
                measure: measures.energy_burden,
              },
            ]
          : []),
        ...(latestBill
          ? [
              {
                label: "Average yearly electric bill for a home",
                value: formatValue(latestBill.value, "usd"),
                detail: `What a DTE Electric household paid in ${yearOf(latestBill.period)}.`,
                measure: measures.avg_yearly_bill,
              },
            ]
          : []),
        ...(latestShutoffs
          ? [
              {
                label: "Electric shutoffs for nonpayment",
                value: formatValue(latestShutoffs.value, "count"),
                detail: `DTE customers disconnected in ${latestShutoffs.year}.`,
                measure: measures.shutoffs,
              },
            ]
          : []),
      ],
      financial: [
        ...(latestMarket
          ? [
              {
                label: "Value of the whole company",
                value: formatValue(latestMarket.value, "usd"),
                detail: `Estimated for ${formatMonth(latestMarket.period)} from the share price and the share count reported on ${shareCountAsOf ?? "the latest filing"}.${marketChange}`,
                measure: measures.market_cap,
              },
            ]
          : []),
        ...(latestDividends
          ? [
              {
                label: "Dividends paid to all shareholders",
                value: formatValue(latestDividends.value, "usd"),
                detail: `Total cash DTE paid common shareholders in ${yearOf(latestDividends.period)}.`,
                measure: measures.dividends_paid,
              },
            ]
          : []),
        ...(latestGrowth
          ? [
              {
                label: "Year-over-year operating revenue growth",
                value: formatValue(latestGrowth.value, "percent"),
                detail: `How DTE's operating revenue changed in ${yearOf(latestGrowth.period)}.`,
                measure: measures.revenue_growth,
              },
            ]
          : []),
        ...(latestPay
          ? [
              {
                label: "CEO total compensation",
                value: formatValue(latestPay.value, "usd"),
                detail: `Total pay reported for DTE's CEO in ${yearOf(latestPay.period)}.`,
                measure: measures.ceo_total_pay,
              },
            ]
          : []),
      ],
    };
  },
);

export interface MichiganContext {
  measure: Measure;
  indicators: { key: string; michigan: number | null; us: number | null }[];
}

/** Statewide Household Pulse shares, with the matching U.S. figure beside each one. */
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
