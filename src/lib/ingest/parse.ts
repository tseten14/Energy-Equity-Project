/**
 * Turns an uploaded file into columns and rows.
 * CSV, TSV, JSON, and NDJSON are parsed here. Excel is loaded only when a workbook is opened.
 */
import Papa from "papaparse";

import { LIMITS, type Cell, type DatasetFormat } from "./limits";

export { FORMATS, LIMITS, type Cell, type DatasetFormat } from "./limits";

/** Rows are arrays aligned with `columns`, which keeps uploads compact. */
export interface ParsedTable {
  columns: string[];
  rows: Cell[][];
}

/** An error whose message is safe and useful to show to the person uploading. */
export class IngestError extends Error {}

const EXTENSIONS: Record<string, DatasetFormat> = {
  csv: "csv",
  tsv: "tsv",
  tab: "tsv",
  xlsx: "xlsx",
  xls: "xlsx",
  json: "json",
  ndjson: "ndjson",
  jsonl: "ndjson",
};

export function detectFormat(fileName: string): DatasetFormat | null {
  return EXTENSIONS[fileName.toLowerCase().split(".").pop() ?? ""] ?? null;
}

export async function parseFile(file: File): Promise<ParsedTable & { format: DatasetFormat }> {
  const format = detectFormat(file.name);
  if (!format) throw new IngestError("Use a CSV, TSV, Excel (.xlsx), JSON or NDJSON file.");
  if (file.size > LIMITS.bytes) throw new IngestError("Files can be up to 10 MB.");
  const table =
    format === "xlsx"
      ? await parseWorkbook(await file.arrayBuffer())
      : parseText(await file.text(), format);
  return { ...table, format };
}

export function parseText(text: string, format: Exclude<DatasetFormat, "xlsx">): ParsedTable {
  switch (format) {
    case "csv":
    case "tsv": {
      const result = Papa.parse<string[]>(text.replace(/^\uFEFF/, ""), {
        delimiter: format === "tsv" ? "\t" : "",
        skipEmptyLines: "greedy",
      });
      const [header = [], ...records] = result.data;
      return toTable(header, records);
    }
    case "json":
      return fromObjects(findRecords(parseJson(text)));
    case "ndjson":
      return fromObjects(
        text
          .split(/\r?\n/)
          .filter((line) => line.trim())
          .map((line, i) => parseJson(line, i + 1)),
      );
  }
}

export async function parseWorkbook(data: ArrayBuffer): Promise<ParsedTable> {
  // SheetJS is large, so it only loads when someone actually uploads a spreadsheet.
  const XLSX = await import("xlsx");
  const book = XLSX.read(data, { type: "array", cellDates: true });
  const sheet = book.Sheets[book.SheetNames[0] ?? ""];
  if (!sheet) throw new IngestError("This workbook has no sheets.");
  const [header = [], ...records] = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
    header: 1,
    raw: true,
    defval: null,
    blankrows: false,
  });
  return toTable(header, records);
}

function parseJson(text: string, line?: number): unknown {
  try {
    return JSON.parse(text);
  } catch {
    throw new IngestError(
      line ? `Line ${line} is not valid JSON.` : "This file is not valid JSON.",
    );
  }
}

/** Accepts an array of objects, or an object holding one (such as `{ "data": [...] }`). */
function findRecords(json: unknown): unknown[] {
  if (Array.isArray(json)) return json;
  if (json && typeof json === "object") {
    const nested = Object.values(json).find((v) => Array.isArray(v) && v.some(isRecord));
    if (nested) return nested as unknown[];
  }
  throw new IngestError('JSON files need a list of records, like [{ "year": 2024, ... }].');
}

const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);

function fromObjects(records: unknown[]): ParsedTable {
  const objects = records.filter(isRecord);
  const columns = [...new Set(objects.flatMap((o) => Object.keys(o)))];
  return toTable(
    columns,
    objects.map((o) => columns.map((c) => o[c])),
  );
}

function toTable(header: unknown[], records: unknown[][]): ParsedTable {
  const columns = uniqueNames(header);
  if (columns.length === 0 || records.length === 0)
    throw new IngestError("No rows of data were found.");
  if (columns.length > LIMITS.columns) {
    throw new IngestError(
      `This file has ${columns.length} columns; the limit is ${LIMITS.columns}.`,
    );
  }
  if (records.length > LIMITS.rows) {
    throw new IngestError(
      `This file has ${records.length.toLocaleString()} rows; the limit is ${LIMITS.rows.toLocaleString()}.`,
    );
  }
  return { columns, rows: records.map((r) => columns.map((_, i) => toCell(r[i]))) };
}

function uniqueNames(header: unknown[]): string[] {
  const seen = new Map<string, number>();
  return header.map((raw, i) => {
    const base =
      String(raw ?? "")
        .trim()
        .slice(0, LIMITS.headerLength) || `Column ${i + 1}`;
    const n = (seen.get(base) ?? 0) + 1;
    seen.set(base, n);
    return n === 1 ? base : `${base} (${n})`;
  });
}

export function toCell(value: unknown): Cell {
  if (value === null || value === undefined) return null;
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value === "boolean") return value;
  if (value instanceof Date)
    return Number.isNaN(value.getTime()) ? null : value.toISOString().slice(0, 10);
  const text = (typeof value === "object" ? JSON.stringify(value) : String(value)).trim();
  return text === "" ? null : text.slice(0, LIMITS.cellLength);
}
