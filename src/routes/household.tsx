/**
 * Household page: Michigan energy insecurity, area burden, DTE shutoffs, and prices.
 * The year buttons filter shutoffs. The map toggle switches between all 22 counties and Metro Detroit.
 */
import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";

import { CategoryBars } from "../components/charts/category-bars";
import { HIGH_BURDEN, TractMap } from "../components/charts/tract-map";
import { TrendChart } from "../components/charts/trend-chart";
import { DataCard, SectionIntro, SourceLine } from "../components/data-card";
import { AMI_BANDS, CUSTOMER_CLASSES, PULSE_INDICATORS, type ShutoffService } from "../data/labels";
import type { HouseholdData, MichiganContext } from "../data/measures";
import { householdQuery, michiganContextQuery } from "../data/queries";
import { citation } from "../lib/citation";
import { formatMonthShort, formatValue } from "../lib/format";
import { cn } from "../lib/utils";

const title = "Household Experience — what DTE customers pay | Energy Equity Report";
const description =
  "Michigan statewide energy insecurity, energy burden in DTE's service-area geography, and DTE's electric and gas shutoffs and prices.";

export const Route = createFileRoute("/household")({
  head: () => ({
    meta: [
      { title },
      { name: "description", content: description },
      { property: "og:title", content: title },
      { property: "og:description", content: description },
    ],
  }),
  loader: ({ context }) =>
    Promise.all([
      context.queryClient.ensureQueryData(householdQuery()),
      context.queryClient.ensureQueryData(michiganContextQuery()),
    ]),
  component: Household,
});

const pct = (v: number) => formatValue(v, "percent");

function Household() {
  const { data } = useSuspenseQuery(householdQuery());
  const { data: michigan } = useSuspenseQuery(michiganContextQuery());

  return (
    <div className="bg-cream/60 py-16 sm:py-20">
      <div className="mx-auto max-w-6xl px-5 sm:px-8">
        <SectionIntro
          eyebrow="Household Experience"
          title="What utility costs look like from the kitchen table."
          lead="Start with the statewide picture of energy insecurity, then look at energy burden across DTE's service area and the prices and shutoffs DTE reports."
        />

        <MichiganInsecurity context={michigan} />
        <div className="mt-12 max-w-[70ch]">
          <h2 className="font-display text-2xl font-semibold">Closer to DTE's service area</h2>
          <p className="mt-2 text-sm text-foreground/70">
            The energy-burden estimates describe households in places DTE Electric serves; they are
            not limited to verified DTE customers. The shutoff and electricity-price figures below
            are reported by DTE.
          </p>
        </div>
        <div className="mt-10 grid gap-6 lg:grid-cols-12">
          <div className="lg:col-span-7">
            <DataCard
              title="Energy burden by census tract"
              description="The share of income the average household in each neighborhood spends on home energy, 2022. Hover a tract for its figure."
              definition={data.burden.measure.definition}
              {...citation(data.burden.measure)}
            >
              <TractMap values={data.burden.tracts} format={pct} />
              <p className="mt-3 text-xs text-foreground/55">
                Covers the 22 Lower Peninsula counties where DTE Electric reports customers to the
                EIA (2024). Delta County in the Upper Peninsula, where DTE serves only a few
                customers, is left out.
              </p>
            </DataCard>
          </div>
          <div className="lg:col-span-5">
            <BurdenByIncome burden={data.burden} />
          </div>
        </div>

        <Shutoffs shutoffs={data.shutoffs} />
        <CustomerClasses classes={data.classes} />
      </div>
    </div>
  );
}

function MichiganInsecurity({ context }: { context: MichiganContext }) {
  const indicators = PULSE_INDICATORS.flatMap((meta) => {
    const row = context.indicators.find((indicator) => indicator.key === meta.key);
    return row?.michigan == null ? [] : [{ ...meta, michigan: row.michigan, us: row.us }];
  });

  return (
    <section
      className="mt-10 rounded-2xl bg-accent p-6 text-accent-foreground sm:p-8"
      aria-labelledby="insecurity-heading"
    >
      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-accent-foreground/75">
        Michigan statewide · all utilities · 2024
      </p>
      <h2 id="insecurity-heading" className="mt-3 font-display text-2xl font-semibold">
        Energy insecurity across Michigan
      </h2>
      <p className="mt-2 max-w-[70ch] text-sm text-accent-foreground/85">
        These shares describe Michigan adults whose household had each experience at least once in
        the previous 12 months. They are statewide survey results, not figures for DTE customers.
      </p>
      <div className="mt-6 grid gap-4 md:grid-cols-3">
        {indicators.map((indicator) => (
          <div key={indicator.key} className="rounded-xl bg-paper p-5 text-foreground">
            <p className="font-display text-4xl font-semibold tabular-nums">
              {formatValue(indicator.michigan, "percent")}
            </p>
            <p className="mt-2 text-sm font-medium">{indicator.label}</p>
            {indicator.us != null ? (
              <p className="mt-2 text-xs text-foreground/65">
                U.S. comparison: {formatValue(indicator.us, "percent")}
              </p>
            ) : null}
          </div>
        ))}
      </div>
      <SourceLine {...citation(context.measure)} className="text-accent-foreground/75" />
    </section>
  );
}

function BurdenByIncome({ burden }: { burden: HouseholdData["burden"] }) {
  const value = (key: string) => burden.bands.find((b) => b.key === key)?.value;
  const lowest = value("0-30%");
  const highest = value("150%+");
  const items = AMI_BANDS.flatMap((band) => {
    const v = value(band.key);
    return v === undefined
      ? []
      : [{ key: band.key, label: band.label, detail: band.detail, value: v }];
  });

  return (
    <div className="rounded-2xl bg-paper p-6 ring-1 ring-border">
      <h3 className="font-display text-xl font-semibold">Energy burden by income group</h3>
      {lowest !== undefined && highest !== undefined ? (
        <p className="mt-2 max-w-[46ch] text-pretty text-sm text-foreground/70">
          Households with very low incomes spend{" "}
          <strong className="text-primary">{pct(lowest)}</strong> of their income on energy, about{" "}
          {Math.round(lowest / highest)} times the share for high-income households ({pct(highest)}
          ).
        </p>
      ) : null}
      <p className="mt-3 rounded-xl bg-cream px-4 py-3 text-sm text-foreground/75">
        Area median income (AMI): the middle household income for the local area. Groups are based
        on each household's income as a share of it.
      </p>
      <CategoryBars
        items={items}
        format={pct}
        threshold={{
          value: HIGH_BURDEN,
          label: `${HIGH_BURDEN}%: the level generally considered a high energy burden`,
        }}
      />
      {burden.overall !== null ? (
        <p className="mt-4 text-sm text-foreground/70">
          All households in the area together: <strong>{pct(burden.overall)}</strong> of income.
        </p>
      ) : null}
      <SourceLine {...citation(burden.measure)} />
    </div>
  );
}

const SERVICE_COLORS: Record<Exclude<ShutoffService, "combination">, string> = {
  electric: "var(--chart-1)",
  gas: "var(--chart-2)",
};

function Shutoffs({ shutoffs }: { shutoffs: HouseholdData["shutoffs"] }) {
  const years = [...new Set(shutoffs.months.map((m) => Number(m.period.slice(0, 4))))].sort(
    (a, b) => a - b,
  );
  const [year, setYear] = useState(years.includes(2024) ? 2024 : (years.at(-1) ?? 2024));
  const months = shutoffs.months.filter((m) => m.period.startsWith(String(year)));
  const total = (service: ShutoffService) => months.reduce((sum, m) => sum + (m[service] ?? 0), 0);
  const combination = total("combination");
  const cite = citation(shutoffs.measure);

  return (
    <section className="mt-6" aria-labelledby="shutoffs-heading">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h3 id="shutoffs-heading" className="font-display text-2xl font-semibold">
            Shutoffs for nonpayment
          </h3>
          <p className="mt-1 max-w-[60ch] text-sm text-foreground/65">
            {shutoffs.measure.definition}
          </p>
        </div>
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="Year">
          {years.map((y) => (
            <button
              key={y}
              type="button"
              onClick={() => setYear(y)}
              aria-pressed={y === year}
              className={cn(
                "rounded-full px-3 py-1.5 text-xs font-semibold ring-1 ring-border transition-colors",
                y === year ? "bg-ink text-paper" : "bg-paper text-foreground/70 hover:bg-cream",
              )}
            >
              {y}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-4 grid gap-6 sm:grid-cols-2">
        {(["electric", "gas"] as const).map((service) => (
          <DataCard
            key={service}
            title={`${service === "electric" ? "Electric" : "Gas"} shutoffs, ${year}`}
            description={
              <>
                <span className="font-semibold text-foreground">
                  {formatValue(total(service), "count")}
                </span>{" "}
                customers disconnected
                {months.length < 12
                  ? ` (${formatMonthShort(months[0]?.period ?? "")}–${formatMonthShort(months.at(-1)?.period ?? "")} reported so far)`
                  : " over the year"}
                .
              </>
            }
            {...cite}
          >
            <TrendChart
              kind="bar"
              data={months}
              xKey="period"
              series={[
                {
                  key: service,
                  label: `${service === "electric" ? "Electric" : "Gas"} shutoffs`,
                  color: SERVICE_COLORS[service],
                },
              ]}
              formatValue={(v) => formatValue(v, "count")}
              formatTick={(v) => formatValue(v, "count", { short: true })}
              formatX={(p) => formatMonthShort(String(p))}
              ariaLabel={`Monthly ${service} shutoffs in ${year}`}
              className="mt-4 h-52"
            />
          </DataCard>
        ))}
      </div>
      {combination > 0 ? (
        <p className="mt-3 text-sm text-foreground/70">
          Another <strong>{formatValue(combination, "count")}</strong> customers lost both electric
          and gas service in {year}. DTE started reporting them separately in 2025; before that they
          were included in the counts above.
        </p>
      ) : null}
    </section>
  );
}

function CustomerClasses({ classes }: { classes: HouseholdData["classes"] }) {
  const { measures, rows, year } = classes;
  const residential = rows.find((r) => r.key === "residential");
  const first = classes.bills[0];
  const cite = citation(measures.avg_yearly_bill);

  return (
    <div className="mt-6 rounded-2xl bg-paper p-6 ring-1 ring-border">
      <h3 className="font-display text-xl font-semibold">
        DTE electricity prices by customer class
      </h3>
      {residential && first?.residential !== undefined ? (
        <p className="mt-1 max-w-[70ch] text-sm text-foreground/65">
          The average home paid DTE Electric{" "}
          <strong className="text-foreground">
            {formatValue(residential.avg_yearly_bill, "usd")}
          </strong>{" "}
          for electricity in {year}, up from {formatValue(first.residential, "usd")} in {first.year}
          . Each kilowatt-hour cost homes {formatValue(residential.avg_price_kwh, "cents_per_kwh")},
          more than businesses or factories paid.
        </p>
      ) : null}
      <p className="mt-3 rounded-xl bg-cream px-4 py-3 text-sm text-foreground/75">
        Customer class: the kind of customer being billed, such as homes, businesses or factories.
      </p>

      <h4 className="mt-6 text-sm font-semibold">Average yearly electric bill for a home</h4>
      <TrendChart
        kind="bar"
        data={classes.bills}
        xKey="year"
        series={[
          { key: "residential", label: "Average yearly bill (homes)", color: "var(--chart-1)" },
        ]}
        formatValue={(v) => formatValue(v, "usd")}
        ariaLabel={`Average yearly electric bill for DTE residential customers, ${first?.year ?? ""} to ${year}`}
        className="mt-2 h-56"
      />

      <div className="mt-6 overflow-x-auto">
        <table className="w-full min-w-[640px] text-left text-sm">
          <caption className="mb-2 text-left text-sm font-semibold">Full detail for {year}</caption>
          <thead>
            <tr className="border-b border-border text-xs uppercase tracking-[0.1em] text-foreground/45">
              <th scope="col" className="py-2 pr-4 font-semibold">
                Customer class
              </th>
              <th scope="col" className="py-2 pr-4 font-semibold">
                {measures.avg_yearly_bill.label}
              </th>
              <th scope="col" className="py-2 pr-4 font-semibold">
                {measures.avg_price_kwh.label}
              </th>
              <th scope="col" className="py-2 pr-4 font-semibold">
                {measures.sales_kwh.label} (kWh)
              </th>
              <th scope="col" className="py-2 pr-4 font-semibold">
                {measures.customers.label}
              </th>
              <th scope="col" className="py-2 font-semibold">
                {measures.revenue.label}
              </th>
            </tr>
          </thead>
          <tbody className="tabular-nums">
            {rows.map((row) => (
              <tr
                key={row.key}
                className={cn(
                  "border-b border-border/60 last:border-0",
                  row.key === "all" && "font-semibold",
                )}
              >
                <th scope="row" className="py-3 pr-4 font-medium">
                  {CUSTOMER_CLASSES.find((c) => c.key === row.key)?.label}
                </th>
                <td className="py-3 pr-4">{formatValue(row.avg_yearly_bill, "usd")}</td>
                <td className="py-3 pr-4">{formatValue(row.avg_price_kwh, "cents_per_kwh")}</td>
                <td className="py-3 pr-4">
                  {formatValue(row.sales_kwh, "count", { short: true })}
                </td>
                <td className="py-3 pr-4">{formatValue(row.customers, "count")}</td>
                <td className="py-3">{formatValue(row.revenue, "usd")}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-3 text-xs text-foreground/55">
        Bundled-service customers only: those who buy both the electricity and its delivery from
        DTE. Averages are calculated from EIA totals (revenue ÷ customers, revenue ÷ kWh sold).
      </p>
      <SourceLine {...cite} />
    </div>
  );
}
