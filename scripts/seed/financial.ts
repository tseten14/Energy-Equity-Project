/**
 * Company financials from SEC company facts, month-end share prices from Yahoo,
 * and CEO total pay from the transcribed proxy-statement file.
 */
import { readFileSync } from "node:fs";

import { marketCapForMonth, type ShareCount } from "../../src/data/market-cap";
import {
  fetchJson,
  monthPeriod,
  round,
  yearPeriod,
  type ObservationSeed,
  type SeedBundle,
} from "./lib";

const DTE_CIK = "0000936340";
const COMPANY_FACTS_URL = `https://data.sec.gov/api/xbrl/companyfacts/CIK${DTE_CIK}.json`;
const YAHOO_URL = "https://query1.finance.yahoo.com/v8/finance/chart/DTE?range=10y&interval=1mo";

interface XbrlFact {
  start?: string;
  end: string;
  val: number;
  form: string;
  filed: string;
}

interface CompanyFacts {
  facts: { "us-gaap": Record<string, { units: Record<string, XbrlFact[]> }> };
}

/** DTE Energy shares at each reported quarter end, never a future share count. */
function reportedShares(facts: CompanyFacts): ShareCount[] {
  const best = new Map<string, XbrlFact>();
  for (const fact of facts.facts["us-gaap"]["CommonStockSharesOutstanding"]?.units["shares"] ??
    []) {
    if (!["10-K", "10-Q"].includes(fact.form) || fact.start || fact.val <= 0) continue;
    const current = best.get(fact.end);
    if (!current || fact.filed > current.filed) best.set(fact.end, fact);
  }
  return [...best]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([end, fact]) => ({
      end,
      value: fact.val,
    }));
}

/** One value per calendar year from 10-K full-year facts, preferring the most recent filing. */
function annualFacts(facts: CompanyFacts, tags: string[], unit: string): Map<number, number> {
  const best = new Map<number, XbrlFact>();
  for (const tag of tags) {
    for (const fact of facts.facts["us-gaap"][tag]?.units[unit] ?? []) {
      const isCalendarYear = fact.start?.endsWith("-01-01") && fact.end.endsWith("-12-31");
      if (
        !fact.form.startsWith("10-K") ||
        !isCalendarYear ||
        fact.start!.slice(0, 4) !== fact.end.slice(0, 4)
      )
        continue;
      const year = Number(fact.end.slice(0, 4));
      const current = best.get(year);
      if (!current || fact.filed > current.filed) best.set(year, fact);
    }
  }
  return new Map([...best].sort(([a], [b]) => a - b).map(([year, fact]) => [year, fact.val]));
}

async function secObservations(): Promise<{
  observations: ObservationSeed[];
  shares: ShareCount[];
}> {
  const facts = await fetchJson<CompanyFacts>(COMPANY_FACTS_URL);

  const dividends = annualFacts(facts, ["CommonStockDividendsPerShareDeclared"], "USD/shares");
  const paid = annualFacts(facts, ["PaymentsOfDividendsCommonStock"], "USD");
  // DTE reported total operating revenue under "Revenues" through 2017 and the regulated-plus-unregulated tag since.
  const revenue = annualFacts(
    facts,
    ["Revenues", "RegulatedAndUnregulatedOperatingRevenue"],
    "USD",
  );

  const observations: ObservationSeed[] = [...dividends].map(([year, value]) => ({
    measureSlug: "dividends_per_share",
    period: yearPeriod(year),
    grain: "year",
    value,
  }));
  observations.push(
    ...[...paid].map(([year, value]) => ({
      measureSlug: "dividends_paid" as const,
      period: yearPeriod(year),
      grain: "year" as const,
      value,
    })),
  );

  for (const [year, value] of revenue) {
    const previous = revenue.get(year - 1);
    if (previous === undefined) continue;
    observations.push({
      measureSlug: "revenue_growth",
      period: yearPeriod(year),
      grain: "year",
      value: round((value / previous - 1) * 100, 1),
    });
  }
  return { observations, shares: reportedShares(facts) };
}

interface YahooChart {
  chart: {
    result: { timestamp: number[]; indicators: { quote: { close: (number | null)[] }[] } }[];
  };
}

async function stockPriceObservations(): Promise<ObservationSeed[]> {
  const chart = await fetchJson<YahooChart>(YAHOO_URL);
  const result = chart.chart.result[0];
  if (!result) throw new Error("Yahoo Finance returned no DTE price history");
  const { timestamp, indicators } = result;
  const closes = indicators.quote[0]?.close ?? [];
  const now = new Date();
  const currentMonth = monthPeriod(now.getUTCFullYear(), now.getUTCMonth() + 1);

  // Monthly bars are stamped at the start of the month in New York time; add a day to stay inside it.
  return timestamp.flatMap((ts, i) => {
    const date = new Date((ts + 86_400) * 1000);
    const period = monthPeriod(date.getUTCFullYear(), date.getUTCMonth() + 1);
    const close = closes[i];
    if (close == null || period === currentMonth) return [];
    return [
      {
        measureSlug: "stock_price",
        period,
        grain: "month",
        value: round(close),
      } satisfies ObservationSeed,
    ];
  });
}

/** Market capitalization is the share price times the most recent reported share count. */
function marketCapObservations(prices: ObservationSeed[], shares: ShareCount[]): ObservationSeed[] {
  return prices.flatMap(({ period, value }) => {
    const estimate = marketCapForMonth(period, value, shares);
    return estimate
      ? [
          {
            measureSlug: "market_cap",
            period,
            grain: "month",
            dimension: estimate.sharesAsOf,
            value: estimate.value,
          } satisfies ObservationSeed,
        ]
      : [];
  });
}

interface CeoPayFile {
  executive: string;
  years: { year: number; total: number; filing: string }[];
}

function ceoPayObservations(): ObservationSeed[] {
  const file = JSON.parse(
    readFileSync(new URL("./data/dte-ceo-pay.json", import.meta.url), "utf8"),
  ) as CeoPayFile;
  return file.years.map(({ year, total }) => ({
    measureSlug: "ceo_total_pay",
    period: yearPeriod(year),
    grain: "year",
    value: total,
  }));
}

export async function financialBundle(): Promise<SeedBundle> {
  const [sec, stock] = await Promise.all([secObservations(), stockPriceObservations()]);
  const marketCap = marketCapObservations(stock, sec.shares);
  const ceo = ceoPayObservations();
  const years = (rows: { period: string }[]) => {
    const all = rows.map((r) => Number(r.period.slice(0, 4)));
    return `${Math.min(...all)}–${Math.max(...all)}`;
  };

  return {
    name: "DTE financials",
    sources: [
      {
        slug: "sec-xbrl",
        publisher: "U.S. Securities and Exchange Commission",
        title: "DTE Energy Co. 10-K and 10-Q financial data (XBRL company facts)",
        url: COMPANY_FACTS_URL,
        dataYear: years([...sec.observations, ...sec.shares.map((row) => ({ period: row.end }))]),
      },
      {
        slug: "yahoo-dte",
        publisher: "Yahoo Finance",
        title: "DTE (NYSE) monthly closing share price",
        url: "https://finance.yahoo.com/quote/DTE/history/",
        dataYear: years(stock),
      },
      {
        slug: "dte-proxy",
        publisher: "DTE Energy proxy statements (SEC Form DEF 14A)",
        title: "Summary Compensation Table, 2020, 2023 and 2026 proxy statements",
        url: "https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&CIK=0000936340&type=DEF+14A",
        dataYear: years(ceo),
      },
    ],
    measures: [
      {
        slug: "stock_price",
        side: "financial",
        label: "Stock price",
        unit: "usd",
        definition: "The price of one share of DTE stock at the end of each month.",
        annualAgg: "last",
        sourceSlug: "yahoo-dte",
      },
      {
        slug: "dividends_per_share",
        side: "financial",
        label: "Dividends",
        unit: "usd_per_share",
        definition:
          "Dividend: cash the company pays its shareholders. Shown as the total declared per share each year.",
        annualAgg: "sum",
        sourceSlug: "sec-xbrl",
      },
      {
        slug: "market_cap",
        side: "financial",
        label: "Market capitalization",
        unit: "usd",
        definition:
          "Estimated value of all DTE Energy shares at month end: closing share price multiplied by the latest reported shares outstanding. It is not the value of DTE's assets or its sale price.",
        annualAgg: "last",
        sourceSlug: "yahoo-dte",
        additionalSourceSlugs: ["sec-xbrl"],
      },
      {
        slug: "dividends_paid",
        side: "financial",
        label: "Cash dividends paid",
        unit: "usd",
        definition:
          "Total cash DTE Energy paid to all common shareholders during the year, as reported in its annual cash-flow statement.",
        annualAgg: "sum",
        sourceSlug: "sec-xbrl",
      },
      {
        slug: "revenue_growth",
        side: "financial",
        label: "Growth rate",
        unit: "percent",
        definition:
          "How much DTE's total operating revenue rose or fell compared with the year before.",
        annualAgg: "mean",
        sourceSlug: "sec-xbrl",
      },
      {
        slug: "ceo_total_pay",
        side: "financial",
        label: "Executive pay",
        unit: "usd",
        definition:
          "Total yearly compensation for DTE's CEO named in its proxy statement: salary, stock awards, bonuses, pension changes and other compensation.",
        annualAgg: "sum",
        sourceSlug: "dte-proxy",
      },
    ],
    observations: [...sec.observations, ...stock, ...marketCap, ...ceo],
  };
}
