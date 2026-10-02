import type { MeasureSlug } from "./types";

/** Plain-English labels for the dimensions stored in `observations.dimension`. */

export const AMI_BANDS = [
  { key: "0-30%", label: "Very low income", detail: "under 30% of area median income" },
  { key: "30-60%", label: "Low income", detail: "30–60% of area median income" },
  { key: "60-80%", label: "Moderate income", detail: "60–80% of area median income" },
  { key: "80-100%", label: "Middle income", detail: "80–100% of area median income" },
  { key: "100-150%", label: "Above median", detail: "100–150% of area median income" },
  { key: "150%+", label: "High income", detail: "over 150% of area median income" },
] as const;

export const CUSTOMER_CLASSES = [
  { key: "residential", label: "Homes" },
  { key: "commercial", label: "Businesses" },
  { key: "industrial", label: "Factories and industry" },
  { key: "all", label: "All customers" },
] as const;

export type CustomerClass = (typeof CUSTOMER_CLASSES)[number]["key"];

export const SHUTOFF_SERVICES = [
  { key: "electric", label: "Electric" },
  { key: "gas", label: "Gas" },
  { key: "combination", label: "Both electric and gas" },
] as const;

export type ShutoffService = (typeof SHUTOFF_SERVICES)[number]["key"];

/** Where each measure is shown on the site, for linking uploaded data back to it. */
export const MEASURE_PAGES: Record<
  MeasureSlug,
  { label: string; to: "/household" | "/financials" | "/compare" }
> = {
  energy_burden: { label: "Energy burden", to: "/household" },
  shutoffs: { label: "Shutoffs", to: "/household" },
  avg_yearly_bill: { label: "Average yearly bill", to: "/household" },
  avg_price_kwh: { label: "Price per kWh", to: "/household" },
  sales_kwh: { label: "Electricity sold", to: "/household" },
  customers: { label: "Customers", to: "/household" },
  revenue: { label: "Revenue by customer type", to: "/household" },
  stock_price: { label: "Stock price", to: "/financials" },
  dividends_per_share: { label: "Dividends per share", to: "/financials" },
  revenue_growth: { label: "Revenue growth", to: "/financials" },
  ceo_total_pay: { label: "CEO pay", to: "/financials" },
  mi_energy_insecurity: { label: "Michigan energy insecurity", to: "/compare" },
};

/** Michigan counties (3-digit FIPS) in the DTE Electric service area used for the tract map. */
export const DTE_COUNTIES: Record<string, string> = {
  "017": "Bay",
  "023": "Branch",
  "049": "Genesee",
  "057": "Gratiot",
  "063": "Huron",
  "065": "Ingham",
  "073": "Isabella",
  "087": "Lapeer",
  "091": "Lenawee",
  "093": "Livingston",
  "099": "Macomb",
  "111": "Midland",
  "115": "Monroe",
  "117": "Montcalm",
  "125": "Oakland",
  "145": "Saginaw",
  "147": "St. Clair",
  "151": "Sanilac",
  "155": "Shiawassee",
  "157": "Tuscola",
  "161": "Washtenaw",
  "163": "Wayne",
};

export const PULSE_INDICATORS = [
  { key: "unable_to_pay", label: "Could not pay an energy bill in full" },
  { key: "forgo_necessities", label: "Went without food, medicine or other needs to pay one" },
  { key: "unsafe_temperature", label: "Kept the home at an unsafe temperature" },
] as const;
