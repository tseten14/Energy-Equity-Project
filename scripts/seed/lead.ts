/**
 * 2022 LEAD energy burden for Michigan census tracts and income bands,
 * clipped to the counties DTE Electric reports, plus the tract map.
 */
import { createReadStream, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { createInterface } from "node:readline";
import { fileURLToPath } from "node:url";

import mapshaper from "mapshaper";
import Papa from "papaparse";

import { dteServiceCounties, SERVICE_TERRITORY_YEAR } from "./eia861";
import { download, round, unzip, yearPeriod, type ObservationSeed, type SeedBundle } from "./lib";

const LEAD_YEAR = 2022;
const LEAD_ZIP = "https://data.openei.org/files/6219/MI-2022-LEAD-data.zip";
const LEAD_TRACTS_CSV = "MI AMI Census Tracts 2022.csv";
const TRACTS_ZIP = "https://www2.census.gov/geo/tiger/GENZ2022/shp/cb_2022_26_tract_500k.zip";
const GEO_OUT = join(
  dirname(fileURLToPath(import.meta.url)),
  "../../public/geo/dte-tracts.topo.json",
);

// Delta County is in the Upper Peninsula, hundreds of miles from the contiguous service area;
// leaving it out keeps the map legible.
const EXCLUDED_COUNTIES = new Set(["Delta"]);

const normalizeCounty = (name: string) =>
  name
    .replace(/ County$/, "")
    .replaceAll(".", "")
    .trim();

async function tractShapefile(): Promise<string> {
  const dir = unzip(await download(TRACTS_ZIP, "tracts-mi-2022.zip"));
  return join(dir, "cb_2022_26_tract_500k.shp");
}

/** County FIPS codes (3 digits) for DTE Electric's Lower Peninsula service counties. */
async function serviceCountyFips(shp: string): Promise<Map<string, string>> {
  const names = new Set(
    (await dteServiceCounties()).map(normalizeCounty).filter((n) => !EXCLUDED_COUNTIES.has(n)),
  );
  const output = await mapshaper.applyCommands(`-i "${shp}" -o format=csv out.csv`);
  const rows = Papa.parse<{ COUNTYFP: string; NAMELSADCO: string }>(String(output["out.csv"]), {
    header: true,
    skipEmptyLines: true,
  }).data;

  const fips = new Map<string, string>();
  for (const row of rows) {
    const name = normalizeCounty(row.NAMELSADCO);
    if (names.has(name)) fips.set(row.COUNTYFP, name);
  }
  if (fips.size !== names.size)
    throw new Error(`Matched ${fips.size} of ${names.size} service counties`);
  return fips;
}

async function writeTractGeometry(shp: string, countyFips: string[]) {
  mkdirSync(dirname(GEO_OUT), { recursive: true });
  const filter = JSON.stringify(countyFips);
  await mapshaper.runCommands(
    [
      `-i "${shp}" name=tracts`,
      `-filter '${filter}.indexOf(COUNTYFP) > -1'`,
      `-filter-fields GEOID,COUNTYFP,NAMELSADCO`,
      `-proj wgs84`,
      `-simplify 12% keep-shapes`,
      `-dissolve COUNTYFP copy-fields=NAMELSADCO + name=counties`,
      `-filter-fields GEOID target=tracts`,
      `-o "${GEO_OUT}" format=topojson target=tracts,counties quantization=20000`,
    ].join(" "),
  );
}

interface Totals {
  units: number;
  income: number;
  energy: number;
}

const add = (
  totals: Totals | undefined,
  units: number,
  income: number,
  energy: number,
): Totals => ({
  units: (totals?.units ?? 0) + units,
  income: (totals?.income ?? 0) + income,
  energy: (totals?.energy ?? 0) + energy,
});

/** Streams the LEAD AMI tract file and sums households, income and energy spending. */
async function aggregateLead(countyFips: Set<string>) {
  const dir = unzip(await download(LEAD_ZIP, "lead-mi-2022.zip"), [LEAD_TRACTS_CSV]);
  const lines = createInterface({ input: createReadStream(join(dir, LEAD_TRACTS_CSV)) });

  const byTract = new Map<string, Totals>();
  const byBand = new Map<string, Totals>();
  let columns: Map<string, number> | undefined;

  for await (const line of lines) {
    const cells = line.split(",");
    if (!columns) {
      columns = new Map(cells.map((name, i) => [name, i]));
      continue;
    }
    const index = columns;
    const cell = (name: string) => cells[index.get(name) ?? -1] ?? "";

    const tract = cell("FIP");
    if (!countyFips.has(tract.slice(2, 5))) continue;

    const units = Number(cell("UNITS"));
    const income = Number(cell("HINCP*UNITS"));
    const energy =
      Number(cell("ELEP*UNITS")) + Number(cell("GASP*UNITS")) + Number(cell("FULP*UNITS"));
    if (![units, income, energy].every(Number.isFinite)) continue;

    byTract.set(tract, add(byTract.get(tract), units, income, energy));
    const band = cell("AMI150");
    byBand.set(band, add(byBand.get(band), units, income, energy));
  }
  return { byTract, byBand };
}

// Energy burden as LEAD defines it: average energy cost divided by average household income.
const burden = (t: Totals) => (t.income > 0 ? round((t.energy / t.income) * 100, 1) : null);

export async function leadBundle(): Promise<SeedBundle> {
  const shp = await tractShapefile();
  const counties = await serviceCountyFips(shp);
  await writeTractGeometry(shp, [...counties.keys()]);
  console.log(`  wrote ${GEO_OUT}`);

  const { byTract, byBand } = await aggregateLead(new Set(counties.keys()));
  const period = yearPeriod(LEAD_YEAR);
  const observations: ObservationSeed[] = [];

  for (const [tract, totals] of byTract) {
    const value = burden(totals);
    if (value !== null) {
      observations.push({
        measureSlug: "energy_burden",
        period,
        grain: "year",
        dimension: "all",
        geoId: tract,
        value,
      });
    }
  }
  for (const [band, totals] of byBand) {
    const value = burden(totals);
    if (value !== null) {
      observations.push({
        measureSlug: "energy_burden",
        period,
        grain: "year",
        dimension: band,
        value,
      });
    }
  }
  const area = [...byBand.values()].reduce<Totals | undefined>(
    (sum, t) => add(sum, t.units, t.income, t.energy),
    undefined,
  );
  const areaBurden = area && burden(area);
  if (areaBurden != null) {
    observations.push({
      measureSlug: "energy_burden",
      period,
      grain: "year",
      dimension: "all",
      value: areaBurden,
    });
  }

  return {
    name: "LEAD energy burden",
    sources: [
      {
        slug: "doe-lead",
        publisher: "U.S. Department of Energy",
        title: `Low-Income Energy Affordability Data (LEAD) Tool ${LEAD_YEAR}, census tracts by area median income, ${counties.size} DTE Electric service counties (EIA-861 ${SERVICE_TERRITORY_YEAR})`,
        url: "https://data.openei.org/submissions/6219",
        dataYear: String(LEAD_YEAR),
      },
    ],
    measures: [
      {
        slug: "energy_burden",
        side: "household",
        label: "Energy burden",
        unit: "percent",
        definition:
          "Energy burden: the share of a household's income spent on electricity, gas and other home energy costs. Above 6% is considered high.",
        annualAgg: "mean",
        sourceSlug: "doe-lead",
      },
    ],
    observations,
  };
}
