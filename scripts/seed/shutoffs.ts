import { readFileSync } from "node:fs";

import { monthPeriod, type ObservationSeed, type SeedBundle } from "./lib";

interface QuarterReport {
  quarter: string;
  filing: string;
  url: string;
  electric: number[];
  gas: number[];
  combination?: number[];
}

interface ShutoffFile {
  quarters: QuarterReport[];
}

export async function shutoffsBundle(): Promise<SeedBundle> {
  const file = JSON.parse(
    readFileSync(new URL("./data/dte-shutoffs.json", import.meta.url), "utf8"),
  ) as ShutoffFile;

  const observations: ObservationSeed[] = file.quarters.flatMap((report) => {
    const year = Number(report.quarter.slice(0, 4));
    const firstMonth = (Number(report.quarter.slice(-1)) - 1) * 3 + 1;
    const series = { electric: report.electric, gas: report.gas, combination: report.combination };
    return Object.entries(series).flatMap(([dimension, counts]) =>
      (counts ?? []).map((value, i) => ({
        measureSlug: "shutoffs" as const,
        period: monthPeriod(year, firstMonth + i),
        grain: "month" as const,
        dimension,
        value,
      })),
    );
  });

  const quarters = file.quarters.map((q) => q.quarter.replace("-", " "));
  return {
    name: "MPSC shutoffs",
    sources: [
      {
        slug: "mpsc-u18120",
        publisher: "Michigan Public Service Commission",
        title: "DTE Electric and DTE Gas quarterly reports, Case U-18120 (Rule 460.151)",
        url: "https://mi-psc.my.site.com/s/case/500t0000008efylAAA",
        dataYear: `${quarters[0]} – ${quarters.at(-1)}`,
      },
    ],
    measures: [
      {
        slug: "shutoffs",
        side: "household",
        label: "Shutoffs",
        unit: "count",
        definition:
          "Shutoff: DTE physically disconnected a customer's service because a bill was not paid. Counted per month, all customer types.",
        annualAgg: "sum",
        sourceSlug: "mpsc-u18120",
      },
    ],
    observations,
  };
}
