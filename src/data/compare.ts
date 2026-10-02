import type { MeasureSlug } from "./types";

interface CompareOption {
  measure: MeasureSlug;
  dimension: string;
  label: string;
}

// Energy burden is a single 2022 snapshot, so it cannot be lined up by year; price per kWh stands in for it.
export const HOUSEHOLD_OPTIONS = {
  avg_price_kwh: {
    measure: "avg_price_kwh",
    dimension: "residential",
    label: "Average price per kWh (homes)",
  },
  avg_yearly_bill: {
    measure: "avg_yearly_bill",
    dimension: "residential",
    label: "Average yearly bill (homes)",
  },
  electric_shutoffs: { measure: "shutoffs", dimension: "electric", label: "Electric shutoffs" },
  gas_shutoffs: { measure: "shutoffs", dimension: "gas", label: "Gas shutoffs" },
} as const satisfies Record<string, CompareOption>;

export const FINANCIAL_OPTIONS = {
  stock_price: { measure: "stock_price", dimension: "", label: "Stock price (year-end)" },
  dividends_per_share: {
    measure: "dividends_per_share",
    dimension: "",
    label: "Dividends per share",
  },
  revenue_growth: { measure: "revenue_growth", dimension: "", label: "Revenue growth rate" },
  ceo_total_pay: { measure: "ceo_total_pay", dimension: "", label: "CEO total pay" },
} as const satisfies Record<string, CompareOption>;

export type HouseholdOption = keyof typeof HOUSEHOLD_OPTIONS;
export type FinancialOption = keyof typeof FINANCIAL_OPTIONS;

export const HOUSEHOLD_KEYS = Object.keys(HOUSEHOLD_OPTIONS) as [
  HouseholdOption,
  ...HouseholdOption[],
];
export const FINANCIAL_KEYS = Object.keys(FINANCIAL_OPTIONS) as [
  FinancialOption,
  ...FinancialOption[],
];

/** Overlapping years needed before a correlation is shown. */
export const MIN_OVERLAP_YEARS = 4;
