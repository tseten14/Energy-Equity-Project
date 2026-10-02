import { DTE_COUNTIES } from "@/data/labels";

import type { Cell, ParsedTable } from "./parse";

export type ColumnKind =
  "number" | "year" | "date" | "tract" | "county" | "category" | "text" | "empty";

export interface NumericStats {
  min: number;
  max: number;
  mean: number;
  median: number;
  q1: number;
  q3: number;
  sum: number;
}

export interface ColumnProfile {
  name: string;
  kind: ColumnKind;
  filled: number;
  missing: number;
  distinct: number;
  examples: string[];
  numeric?: NumericStats;
  /** Most common values, for category columns. */
  top?: { value: string; count: number }[];
  /** First and last value, for year and date columns. */
  range?: { from: string; to: string };
}

export interface DatasetProfile {
  rowCount: number;
  columns: ColumnProfile[];
  /** The column used as the time axis, if any. */
  timeColumn: string | null;
}

const MATCH_SHARE = 0.9;

/** Reads numbers written the way people write them: "1,234", "$5.20", "12%", "(300)". */
export function parseNumber(value: Cell): number | null {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value !== "string") return null;
  let text = value
    .trim()
    .replace(/[$,\s]/g, "")
    .replace(/%$/, "");
  const negative = /^\(.*\)$/.test(text);
  if (negative) text = text.slice(1, -1);
  if (!/^[-+]?(\d+\.?\d*|\.\d+)(e[-+]?\d+)?$/i.test(text)) return null;
  const n = Number(text);
  return negative ? -n : n;
}

/** ISO dates (2024-05-01, 2024-05) and US dates (5/1/2024), returned as YYYY-MM-DD. */
export function parseDate(value: Cell): string | null {
  if (typeof value !== "string") return null;
  const iso = /^(\d{4})-(\d{1,2})(?:-(\d{1,2}))?(?:[T ].*)?$/.exec(value.trim());
  const us = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(value.trim());
  const [y, m, d] = iso ? [iso[1], iso[2], iso[3] ?? "1"] : us ? [us[3], us[1], us[2]] : [];
  if (!y || !m || !d) return null;
  const month = Number(m);
  const day = Number(d);
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  return `${y}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

export const toText = (value: Cell) => (value === null ? "" : String(value));

/** For using a column name mid-sentence, leaving acronyms such as "kWh" or "CEO" alone. */
export const lowerFirst = (text: string) =>
  /^[A-Z][a-z]/.test(text) ? text.charAt(0).toLowerCase() + text.slice(1) : text;

const countyNames = new Map(
  Object.entries(DTE_COUNTIES).map(([fips, name]) => [name.toLowerCase(), fips]),
);

/** Five-digit Michigan county FIPS for a county code or name in DTE's area, if it is one. */
export function countyFips(value: Cell): string | null {
  const text = toText(value).trim().toLowerCase();
  if (/^26\d{3}$/.test(text)) return text;
  if (/^\d{3}$/.test(text) && DTE_COUNTIES[text]) return `26${text}`;
  const fips = countyNames.get(text.replace(/\s+county$/, ""));
  return fips ? `26${fips}` : null;
}

/** Eleven-digit census tract GEOID, tolerating a dropped leading zero or a "1400000US" prefix. */
export function tractGeoid(value: Cell): string | null {
  const text = toText(value)
    .trim()
    .replace(/^1400000US/i, "");
  if (/^\d{11}$/.test(text)) return text;
  if (/^\d{10}$/.test(text)) return `0${text}`;
  return null;
}

function quantile(sorted: number[], q: number): number {
  const pos = (sorted.length - 1) * q;
  const lo = Math.floor(pos);
  const hi = Math.ceil(pos);
  return sorted[lo]! + (sorted[hi]! - sorted[lo]!) * (pos - lo);
}

export function numericStats(values: number[]): NumericStats {
  const sorted = [...values].sort((a, b) => a - b);
  const sum = sorted.reduce((s, v) => s + v, 0);
  return {
    min: sorted[0]!,
    max: sorted.at(-1)!,
    mean: sum / sorted.length,
    median: quantile(sorted, 0.5),
    q1: quantile(sorted, 0.25),
    q3: quantile(sorted, 0.75),
    sum,
  };
}

function inferKind(name: string, values: Cell[]): ColumnKind {
  if (values.length === 0) return "empty";
  const share = (test: (v: Cell) => boolean) => values.filter(test).length / values.length;
  const header = name.toLowerCase();

  if (share((v) => tractGeoid(v) !== null) >= MATCH_SHARE && /geoid|tract|fips|geo/.test(header))
    return "tract";
  // Without a telling header, only unique 11-digit Michigan codes count; large totals can also be 11 digits.
  const unique = new Set(values.map(toText)).size >= values.length * MATCH_SHARE;
  if (unique && share((v) => /^26\d{9}$/.test(toText(v))) >= MATCH_SHARE) return "tract";
  // Statewide files list counties outside DTE's area too, so one match plus a county header is enough.
  const countyHeader = /^(county|fips)\b|\b(county|fips)$|county[ _]?(name|fips|code)/.test(header);
  const notAmounts = share((v) => parseNumber(v) === null || /^\d{3}$|^26\d{3}$/.test(toText(v)));
  if (countyHeader && notAmounts >= MATCH_SHARE && values.some((v) => countyFips(v) !== null)) {
    return "county";
  }

  const numbers = values.map(parseNumber);
  const numericShare = numbers.filter((n) => n !== null).length / values.length;
  const isYear = (n: number | null) => n !== null && Number.isInteger(n) && n >= 1900 && n <= 2100;
  if (numericShare >= MATCH_SHARE && numbers.every((n) => n === null || isYear(n))) {
    if (/\b(year|yr|fy)\b|^year/.test(header) || numbers.every((n) => n === null || n >= 1990))
      return "year";
  }
  if (share((v) => parseDate(v) !== null) >= MATCH_SHARE) return "date";
  if (numericShare >= MATCH_SHARE) return "number";

  const distinct = new Set(values.map(toText)).size;
  return distinct <= 50 && distinct <= Math.max(2, values.length * 0.5) ? "category" : "text";
}

export function profileColumn(name: string, cells: Cell[]): ColumnProfile {
  const values = cells.filter((c) => c !== null);
  const kind = inferKind(name, values);
  const counts = new Map<string, number>();
  for (const v of values) counts.set(toText(v), (counts.get(toText(v)) ?? 0) + 1);

  const profile: ColumnProfile = {
    name,
    kind,
    filled: values.length,
    missing: cells.length - values.length,
    distinct: counts.size,
    examples: [...counts.keys()].slice(0, 3),
  };

  if (kind === "number") {
    profile.numeric = numericStats(values.map(parseNumber).filter((n): n is number => n !== null));
  }
  if (kind === "category") {
    profile.top = [...counts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([value, count]) => ({ value, count }));
  }
  if (kind === "year" || kind === "date") {
    const sorted = values
      .map((v) => (kind === "year" ? String(parseNumber(v)) : parseDate(v)))
      .filter((v): v is string => v !== null)
      .sort();
    if (sorted.length) profile.range = { from: sorted[0]!, to: sorted.at(-1)! };
  }
  return profile;
}

export function columnValues(table: ParsedTable, column: string): Cell[] {
  const index = table.columns.indexOf(column);
  return index < 0 ? [] : table.rows.map((row) => row[index] ?? null);
}

export function profileTable(table: ParsedTable): DatasetProfile {
  const columns = table.columns.map((name) => profileColumn(name, columnValues(table, name)));
  const time = columns.find((c) => c.kind === "year") ?? columns.find((c) => c.kind === "date");
  return { rowCount: table.rows.length, columns, timeColumn: time?.name ?? null };
}
