import { readFileSync } from "node:fs";

import * as XLSX from "xlsx";

import { download, round, type ObservationSeed, type SeedBundle } from "./lib";

// Cycle 09 (Aug 20 – Sep 16, 2024) is the last Household Pulse release with state-level tables.
const CYCLE = "cycle09";
const PERIOD = "2024-08-01";
const TABLE_URL = `https://www2.census.gov/programs-surveys/demo/tables/hhp/2024/${CYCLE}/housing4_${CYCLE}.xlsx`;

// Each indicator spans five answer columns: almost every month, some months, 1–2 months, never, did not report.
const INDICATORS = [
  { dimension: "forgo_necessities", header: "Household reduced or forwent expenses for basic household necessities" },
  { dimension: "unsafe_temperature", header: "Household kept home at a temperature that felt unsafe or unhealthy" },
  { dimension: "unable_to_pay", header: "Household was unable to pay an energy bill or unable to pay the full bill amount" },
] as const;

const num = (v: unknown) => (typeof v === "number" ? v : 0);

function indicatorShares(book: XLSX.WorkBook, sheet: "MI" | "US"): ObservationSeed[] {
  const ws = book.Sheets[sheet];
  if (!ws) throw new Error(`Sheet ${sheet} missing from ${TABLE_URL}`);
  const rows = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1 });
  const headers = (rows[4] ?? []).map(String);
  const total = rows.find((r) => r[0] === "Total");
  if (!total) throw new Error(`Total row missing in ${sheet}`);

  return INDICATORS.map(({ dimension, header }) => {
    const start = headers.findIndex((h) => h.startsWith(header));
    if (start < 0) throw new Error(`Column "${header}" missing in ${sheet}`);
    const answer = (offset: number) => num(total[start + offset]);
    const atLeastOnce = answer(0) + answer(1) + answer(2);
    return {
      measureSlug: "mi_energy_insecurity",
      period: PERIOD,
      grain: "month",
      dimension,
      geoId: sheet,
      value: round((atLeastOnce / (atLeastOnce + answer(3))) * 100, 1),
    } satisfies ObservationSeed;
  });
}

export async function pulseBundle(): Promise<SeedBundle> {
  const book = XLSX.read(readFileSync(await download(TABLE_URL, `hps-2024-${CYCLE}-housing4.xlsx`)));
  return {
    name: "Household Pulse energy insecurity",
    sources: [
      {
        slug: "census-pulse",
        publisher: "U.S. Census Bureau",
        title: "Household Pulse Survey, Housing Table 4: Household energy use and spending in the last 12 months (Cycle 09)",
        url: "https://www.census.gov/data/tables/2024/demo/hhp/cycle09.html",
        dataYear: "2024 (Aug 20 – Sep 16)",
      },
    ],
    measures: [
      {
        slug: "mi_energy_insecurity",
        side: "context",
        label: "Michigan energy insecurity",
        unit: "percent",
        definition:
          "Share of adults whose household, at least once in the last 12 months, could not pay an energy bill in full, cut back on necessities like food or medicine to pay one, or kept the home at an unsafe temperature. Statewide, all utilities; among adults who answered.",
        annualAgg: "last",
        sourceSlug: "census-pulse",
      },
    ],
    observations: [...indicatorShares(book, "MI"), ...indicatorShares(book, "US")],
  };
}
