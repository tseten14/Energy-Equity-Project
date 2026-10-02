// Kept free of parsing libraries: the upload schema imports this, and it ships with every page.

export const FORMATS = ["csv", "tsv", "xlsx", "json", "ndjson"] as const;
export type DatasetFormat = (typeof FORMATS)[number];

export type Cell = string | number | boolean | null;

export const LIMITS = {
  bytes: 10 * 1024 * 1024,
  rows: 20_000,
  columns: 60,
  cellLength: 500,
  headerLength: 120,
} as const;
