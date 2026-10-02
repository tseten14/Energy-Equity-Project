/**
 * Shared shapes for a verified figure.
 *
 * A measure is one named series (for example residential price per kWh).
 * An observation is one number in that series: a period, an optional breakdown
 * such as customer class, an optional place, and the value.
 */
export type MeasureSide = "household" | "financial" | "context";
export type MeasureUnit = "percent" | "usd" | "usd_per_share" | "cents_per_kwh" | "kwh" | "count";
export type AnnualAgg = "sum" | "mean" | "last";
export type Grain = "month" | "quarter" | "year";

export const MEASURE_SLUGS = [
  "energy_burden",
  "shutoffs",
  "avg_yearly_bill",
  "avg_price_kwh",
  "sales_kwh",
  "customers",
  "revenue",
  "stock_price",
  "dividends_per_share",
  "revenue_growth",
  "ceo_total_pay",
  "mi_energy_insecurity",
] as const;

export type MeasureSlug = (typeof MEASURE_SLUGS)[number];

export interface Source {
  publisher: string;
  title: string;
  url: string;
  dataYear: string;
  retrievedAt: string;
}

export interface Measure {
  slug: MeasureSlug;
  side: MeasureSide;
  label: string;
  unit: MeasureUnit;
  definition: string;
  annualAgg: AnnualAgg;
  source: Source | null;
}

export interface Observation {
  period: string;
  grain: Grain;
  dimension: string;
  geoId: string;
  value: number;
}

export interface MeasureSeries {
  measure: Measure;
  observations: Observation[];
}

export interface YearPoint {
  year: number;
  value: number;
}
