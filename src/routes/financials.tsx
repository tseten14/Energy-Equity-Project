import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";

import { TrendChart } from "../components/charts/trend-chart";
import { DataCard, MeasureCard, SectionIntro } from "../components/data-card";
import type { MeasureSummary } from "../data/measures";
import { financialsQuery } from "../data/queries";
import type { MeasureSlug } from "../data/types";
import { citation } from "../lib/citation";
import { formatChange, formatPeriod, formatValue } from "../lib/format";

const title = "DTE Financials — stock, dividends and executive pay | DTE, in Plain Terms";
const description =
  "DTE's stock price, dividends, growth rate and executive compensation, each explained in everyday language.";

export const Route = createFileRoute("/financials")({
  head: () => ({
    meta: [
      { title },
      { name: "description", content: description },
      { property: "og:title", content: title },
      { property: "og:description", content: description },
    ],
  }),
  loader: ({ context }) => context.queryClient.ensureQueryData(financialsQuery()),
  component: Financials,
});

const DETAIL: Record<string, { title: string; note?: string; kind: "line" | "bar" }> = {
  stock_price: { title: "Stock price, month by month", kind: "line" },
  dividends_per_share: {
    title: "Dividends declared per share, each year",
    note: "The 2021 drop reflects DTE spinning off its natural gas pipeline business (DT Midstream) that year.",
    kind: "bar",
  },
  revenue_growth: {
    title: "Revenue growth compared with the year before",
    note: "Much of the swing comes from DTE's energy trading business, whose revenue rises and falls with wholesale energy prices.",
    kind: "bar",
  },
  ceo_total_pay: {
    title: "CEO total pay, each year",
    note: "Joi Harris succeeded Jerry Norcia as CEO in September 2025; her 2025 total was $6.7M.",
    kind: "bar",
  },
};

function Financials() {
  const { data } = useSuspenseQuery(financialsQuery());
  const bySlug = (slug: MeasureSlug) => data.find((s) => s.measure.slug === slug);

  return (
    <div className="py-16 sm:py-20">
      <div className="mx-auto max-w-6xl px-5 sm:px-8">
        <SectionIntro
          eyebrow="DTE Financials"
          title="The company's side of the ledger."
          lead="The same utility that sets your rates also pays shareholders and executives. Here's what those numbers mean in everyday words."
          tone="accent"
        />

        <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {data.map((s) => (
            <MeasureCard
              key={s.measure.slug}
              label={s.measure.label}
              definition={s.measure.definition}
              value={formatValue(s.latest.value, s.measure.unit)}
              caption={formatPeriod(s.latest.period, s.grain)}
              change={
                s.previous
                  ? {
                      text: formatChange(s.latest.value, s.previous.value, s.measure.unit),
                      against: formatPeriod(s.previous.period, s.grain),
                    }
                  : undefined
              }
              series={s.series.map((p) => p.value)}
              {...citation(s.measure)}
            />
          ))}
        </div>

        <div className="mt-6 grid gap-6 lg:grid-cols-2">
          {(["stock_price", "dividends_per_share", "revenue_growth", "ceo_total_pay"] as const).map(
            (slug) => {
              const summary = bySlug(slug);
              return summary ? <DetailChart key={slug} summary={summary} /> : null;
            },
          )}
        </div>
      </div>
    </div>
  );
}

function DetailChart({ summary }: { summary: MeasureSummary }) {
  const { measure, grain, series } = summary;
  const detail = DETAIL[measure.slug] ?? { title: measure.label, kind: "line" as const };
  const first = series[0];
  const range = first
    ? `${formatPeriod(first.period, grain)} – ${formatPeriod(summary.latest.period, grain)}`
    : "";

  return (
    <DataCard title={detail.title} description={range} {...citation(measure)}>
      <TrendChart
        kind={detail.kind}
        data={series.map((p) => ({
          x: grain === "year" ? p.period.slice(0, 4) : p.period,
          value: p.value,
        }))}
        xKey="x"
        series={[
          {
            key: "value",
            label: measure.label,
            color: measure.slug === "stock_price" ? "var(--chart-2)" : "var(--chart-1)",
          },
        ]}
        formatValue={(v) => formatValue(v, measure.unit)}
        formatTick={(v) => formatValue(v, measure.unit, { short: true })}
        formatX={(x) => (grain === "year" ? String(x) : formatPeriod(String(x), grain))}
        barColor={
          measure.slug === "revenue_growth"
            ? (v) => (v < 0 ? "var(--chart-1)" : "var(--chart-2)")
            : undefined
        }
        ariaLabel={`${detail.title}, ${range}`}
        className="mt-4 h-60"
      />
      {detail.note ? <p className="mt-3 text-xs text-foreground/60">{detail.note}</p> : null}
    </DataCard>
  );
}
