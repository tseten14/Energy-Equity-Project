import { readFileSync } from "node:fs";
import { join } from "node:path";

import * as XLSX from "xlsx";

import { download, round, unzip, yearPeriod, type ObservationSeed, type SeedBundle } from "./lib";

const DTE_ELECTRIC = 5109;
const FIRST_YEAR = 2015;
const LAST_YEAR = 2024;
export const SERVICE_TERRITORY_YEAR = LAST_YEAR;

// Sales_Ult_Cust repeats revenue (thousand $), sales (MWh), customers for each class in this order:
// residential, commercial, industrial, transportation, total. Offsets are from the first revenue column.
const CLASS_OFFSETS = { residential: 0, commercial: 3, industrial: 6, all: 12 } as const;

function zipUrl(year: number): string {
  return year === LAST_YEAR
    ? `https://www.eia.gov/electricity/data/eia861/zip/f861${year}.zip`
    : `https://www.eia.gov/electricity/data/eia861/archive/zip/f861${year}.zip`;
}

async function workbook(year: number, file: string): Promise<XLSX.WorkBook> {
  const zip = await download(zipUrl(year), `eia861-${year}.zip`);
  const dir = unzip(zip, [file]);
  return XLSX.read(readFileSync(join(dir, file)));
}

function sheetRows(book: XLSX.WorkBook): unknown[][] {
  const sheet = book.Sheets[book.SheetNames[0] ?? ""];
  if (!sheet) throw new Error("EIA-861 workbook has no sheets");
  return XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1 });
}

const num = (v: unknown) => (typeof v === "number" ? v : Number.NaN);

async function yearObservations(year: number): Promise<ObservationSeed[]> {
  const rows = sheetRows(await workbook(year, `Sales_Ult_Cust_${year}.xlsx`));
  // Bundled service is the price basis EIA uses: the customer buys both energy and delivery from DTE.
  const row = rows.find((r) => num(r[1]) === DTE_ELECTRIC && r[4] === "Bundled" && r[6] === "MI");
  if (!row) throw new Error(`DTE Electric bundled row not found in EIA-861 ${year}`);
  // Some years add columns (2019 has "Short Form"), so locate the first class block from the header.
  const first = (rows[2] ?? []).indexOf("Thousand Dollars");
  if (first < 0) throw new Error(`Revenue column not found in EIA-861 ${year}`);

  const period = yearPeriod(year);
  return Object.entries(CLASS_OFFSETS).flatMap(([dimension, offset]) => {
    const col = first + offset;
    const revenueUsd = num(row[col]) * 1000;
    const salesKwh = num(row[col + 1]) * 1000;
    const customers = num(row[col + 2]);
    if (![revenueUsd, salesKwh, customers].every(Number.isFinite) || customers === 0) return [];
    const base = { period, grain: "year", dimension } as const;
    return [
      { ...base, measureSlug: "revenue", value: round(revenueUsd, 0) },
      { ...base, measureSlug: "sales_kwh", value: round(salesKwh, 0) },
      { ...base, measureSlug: "customers", value: customers },
      { ...base, measureSlug: "avg_price_kwh", value: round((revenueUsd / salesKwh) * 100) },
      { ...base, measureSlug: "avg_yearly_bill", value: round(revenueUsd / customers, 0) },
    ] satisfies ObservationSeed[];
  });
}

/** Michigan counties where DTE Electric reports customers, from the EIA-861 service territory file. */
export async function dteServiceCounties(): Promise<string[]> {
  const rows = sheetRows(
    await workbook(SERVICE_TERRITORY_YEAR, `Service_Territory_${SERVICE_TERRITORY_YEAR}.xlsx`),
  );
  return rows.filter((r) => num(r[1]) === DTE_ELECTRIC && r[4] === "MI").map((r) => String(r[5]));
}

export async function eiaBundle(): Promise<SeedBundle> {
  const observations: ObservationSeed[] = [];
  for (let year = FIRST_YEAR; year <= LAST_YEAR; year++) {
    observations.push(...(await yearObservations(year)));
  }

  const measure = (
    slug: SeedBundle["measures"][number]["slug"],
    label: string,
    unit: SeedBundle["measures"][number]["unit"],
    definition: string,
    annualAgg: SeedBundle["measures"][number]["annualAgg"] = "sum",
  ) =>
    ({
      slug,
      side: "household",
      label,
      unit,
      definition,
      annualAgg,
      sourceSlug: "eia-861",
    }) as const;

  return {
    name: "EIA-861 customer classes",
    sources: [
      {
        slug: "eia-861",
        publisher: "U.S. Energy Information Administration",
        title: "Form EIA-861 Sales to Ultimate Customers, DTE Electric Company (bundled service)",
        url: "https://www.eia.gov/electricity/data/eia861/",
        dataYear: `${FIRST_YEAR}–${LAST_YEAR}`,
      },
    ],
    measures: [
      measure(
        "avg_yearly_bill",
        "Average yearly bill",
        "usd",
        "Total electricity revenue from a customer class divided by the number of customers in it.",
        "mean",
      ),
      measure(
        "avg_price_kwh",
        "Average price per kWh",
        "cents_per_kwh",
        "What customers paid on average for one kilowatt-hour, including fuel and other charges: revenue divided by electricity sold.",
        "mean",
      ),
      measure(
        "sales_kwh",
        "Electricity used",
        "kwh",
        "Kilowatt-hours of electricity DTE sold to the class in the year.",
      ),
      measure(
        "customers",
        "Customers",
        "count",
        "Number of customer accounts in the class.",
        "mean",
      ),
      measure(
        "revenue",
        "Total revenue",
        "usd",
        "Money DTE Electric collected from the class for electricity in the year.",
      ),
    ],
    observations,
  };
}
