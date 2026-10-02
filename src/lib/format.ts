/** Formats a verified figure for a card, an axis tick, or a sentence. */
import type { MeasureUnit } from "@/data/types";

const integer = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });
const compact = new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 });
const dollars = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});
const cents = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 2,
});
const compactDollars = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  notation: "compact",
  maximumFractionDigits: 1,
});

const decimals = new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 });

/** For numbers whose unit is unknown, such as values in an uploaded file. */
export function formatNumber(value: number): string {
  const abs = Math.abs(value);
  if (abs >= 1e6) return compact.format(value);
  if (abs >= 100) return integer.format(value);
  return decimals.format(value);
}

export function formatValue(value: number, unit: MeasureUnit, { short = false } = {}): string {
  switch (unit) {
    case "percent":
      return `${value.toFixed(1)}%`;
    case "usd":
      return short || Math.abs(value) >= 1e6 ? compactDollars.format(value) : dollars.format(value);
    case "usd_per_share":
      return cents.format(value);
    case "cents_per_kwh":
      return `${value.toFixed(short ? 1 : 2)}¢`;
    case "kwh":
      return `${compact.format(value)} kWh`;
    case "count":
      return short ? compact.format(value) : integer.format(value);
  }
}

/** Difference between two values, phrased for the unit: percentage points for percents. */
export function formatChange(current: number, previous: number, unit: MeasureUnit): string {
  const diff = current - previous;
  const sign = diff > 0 ? "+" : diff < 0 ? "−" : "±";
  if (unit === "percent") return `${sign}${Math.abs(diff).toFixed(1)} pts`;
  if (previous === 0) return `${sign}${formatValue(Math.abs(diff), unit, { short: true })}`;
  return `${sign}${Math.abs((diff / previous) * 100).toFixed(1)}%`;
}

const monthYear = new Intl.DateTimeFormat("en-US", {
  month: "short",
  year: "numeric",
  timeZone: "UTC",
});
const monthOnly = new Intl.DateTimeFormat("en-US", { month: "short", timeZone: "UTC" });

export const formatMonth = (period: string) => monthYear.format(new Date(`${period}T00:00:00Z`));
export const formatMonthShort = (period: string) =>
  monthOnly.format(new Date(`${period}T00:00:00Z`));

export function formatPeriod(period: string, grain: "month" | "quarter" | "year"): string {
  return grain === "year" ? period.slice(0, 4) : formatMonth(period);
}
