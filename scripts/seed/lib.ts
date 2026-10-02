/**
 * Shared helpers for the seed scripts: download with a cache, shape a bundle, and round a figure.
 * Each source file returns one SeedBundle. scripts/seed/index.ts merges them into the snapshot.
 */
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import type { AnnualAgg, Grain, MeasureSide, MeasureSlug, MeasureUnit } from "../../src/data/types";

export const CACHE_DIR = join(dirname(fileURLToPath(import.meta.url)), ".cache");
export const RETRIEVED_AT = new Date().toISOString().slice(0, 10);

// SEC asks automated clients to identify themselves.
const USER_AGENT = "DTE in Plain Terms data seed (public-interest research)";

export interface SourceSeed {
  slug: string;
  publisher: string;
  title: string;
  url: string;
  dataYear: string;
}

export interface MeasureSeed {
  slug: MeasureSlug;
  side: MeasureSide;
  label: string;
  unit: MeasureUnit;
  definition: string;
  annualAgg: AnnualAgg;
  sourceSlug: string;
  additionalSourceSlugs?: string[];
}

export interface ObservationSeed {
  measureSlug: MeasureSlug;
  period: string;
  grain: Grain;
  dimension?: string;
  geoId?: string;
  value: number;
}

export interface SeedBundle {
  name: string;
  sources: SourceSeed[];
  measures: MeasureSeed[];
  observations: ObservationSeed[];
}

export async function fetchText(url: string, init?: RequestInit): Promise<string> {
  const res = await fetch(url, {
    ...init,
    headers: { "User-Agent": USER_AGENT, ...init?.headers },
  });
  if (!res.ok) throw new Error(`GET ${url} failed: ${res.status} ${res.statusText}`);
  return res.text();
}

export async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  return JSON.parse(await fetchText(url, init)) as T;
}

/** Downloads once into the seed cache and returns the local path. */
export async function download(url: string, fileName: string): Promise<string> {
  mkdirSync(CACHE_DIR, { recursive: true });
  const path = join(CACHE_DIR, fileName);
  if (existsSync(path)) return path;
  console.log(`  downloading ${url}`);
  const res = await fetch(url, { headers: { "User-Agent": USER_AGENT } });
  if (!res.ok) throw new Error(`GET ${url} failed: ${res.status} ${res.statusText}`);
  writeFileSync(path, Buffer.from(await res.arrayBuffer()));
  return path;
}

/** Extracts matching members of a zip into the cache; returns the extraction directory. */
export function unzip(zipPath: string, members: string[] = []): string {
  const outDir = zipPath.replace(/\.zip$/i, "");
  mkdirSync(outDir, { recursive: true });
  execFileSync("unzip", ["-o", "-q", zipPath, ...members, "-d", outDir]);
  return outDir;
}

export function yearPeriod(year: number): string {
  return `${year}-01-01`;
}

export function monthPeriod(year: number, month: number): string {
  return `${year}-${String(month).padStart(2, "0")}-01`;
}

export function round(value: number, digits = 2): number {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}
