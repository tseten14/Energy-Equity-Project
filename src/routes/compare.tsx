/**
 * Compare page. The two dropdowns are stored in the URL so a comparison can be shared.
 * Years that were only partly reported are left blank on both charts.
 */
import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

import { TrendChart } from "../components/charts/trend-chart";
import { SectionIntro, SourceLine } from "../components/data-card";
import {
  FINANCIAL_KEYS,
  FINANCIAL_OPTIONS,
  HOUSEHOLD_KEYS,
  HOUSEHOLD_OPTIONS,
  MIN_OVERLAP_YEARS,
} from "../data/compare";
import { PULSE_INDICATORS } from "../data/labels";
import type { CompareData, CompareSide, MichiganContext } from "../data/measures";
import { compareQuery, michiganContextQuery } from "../data/queries";
import { describeCorrelation } from "../data/series";
import { citation } from "../lib/citation";
import { formatValue } from "../lib/format";

const title = "Compare household costs with DTE's finances | DTE, in Plain Terms";
const description =
  "Pick one household measure and one DTE financial measure and see them side by side over the same years, with Michigan statewide energy insecurity shown separately as context.";

const searchSchema = z.object({
  household: z.enum(HOUSEHOLD_KEYS).default("avg_price_kwh").catch("avg_price_kwh"),
  financial: z.enum(FINANCIAL_KEYS).default("stock_price").catch("stock_price"),
});

export const Route = createFileRoute("/compare")({
  head: () => ({
    meta: [
      { title },
      { name: "description", content: description },
      { property: "og:title", content: title },
      { property: "og:description", content: description },
    ],
  }),
  validateSearch: searchSchema,
  loaderDeps: ({ search }) => search,
  loader: ({ context, deps }) =>
    Promise.all([
      context.queryClient.ensureQueryData(compareQuery(deps)),
      context.queryClient.ensureQueryData(michiganContextQuery()),
    ]),
  component: Compare,
});

const selectClass = "w-full rounded-full bg-cream px-4 py-3 text-sm font-medium ring-1 ring-border";

function Compare() {
  const search = Route.useSearch();
  const navigate = Route.useNavigate();
  const { data } = useSuspenseQuery(compareQuery(search));
  const { data: context } = useSuspenseQuery(michiganContextQuery());

  const choose = (patch: Partial<typeof search>) =>
    navigate({ search: { ...search, ...patch }, replace: true, resetScroll: false });

  return (
    <div className="bg-cream/60 py-16 sm:py-20">
      <div className="mx-auto max-w-6xl px-5 sm:px-8">
        <SectionIntro
          eyebrow="Compare"
          title="Put the two sides on the same timeline."
          lead="Pick one household measure and one company measure. We line them up over the same years so you can see the pattern for yourself."
        />

        <div className="mt-10 grid gap-6 lg:grid-cols-12">
          <div className="rounded-2xl bg-paper p-6 ring-1 ring-border lg:col-span-8">
            <div className="flex flex-wrap gap-4">
              <label className="min-w-[200px] flex-1">
                <span className="mb-2 block text-sm font-semibold">Household measure</span>
                <select
                  value={search.household}
                  onChange={(e) => choose({ household: e.target.value as typeof search.household })}
                  className={selectClass}
                >
                  {HOUSEHOLD_KEYS.map((key) => (
                    <option key={key} value={key}>
                      {HOUSEHOLD_OPTIONS[key].label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="min-w-[200px] flex-1">
                <span className="mb-2 block text-sm font-semibold">DTE financial measure</span>
                <select
                  value={search.financial}
                  onChange={(e) => choose({ financial: e.target.value as typeof search.financial })}
                  className={selectClass}
                >
                  {FINANCIAL_KEYS.map((key) => (
                    <option key={key} value={key}>
                      {FINANCIAL_OPTIONS[key].label}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            {search.household === "avg_price_kwh" ? (
              <p className="mt-3 text-xs text-foreground/60">
                Energy burden is only measured for 2022, so it can't be lined up by year. Average
                price per kWh, the main driver of electricity costs, stands in for it here.
              </p>
            ) : null}

            <SideBySide data={data} />
          </div>

          <div className="space-y-6 lg:col-span-4">
            <Pattern data={data} />
            <MichiganCard context={context} />
          </div>
        </div>
      </div>
    </div>
  );
}

function SideBySide({ data }: { data: CompareData }) {
  const years = [...data.household.points, ...data.financial.points].map((p) => p.year);
  const span = years.length ? { from: Math.min(...years), to: Math.max(...years) } : null;
  const axis = span ? Array.from({ length: span.to - span.from + 1 }, (_, i) => span.from + i) : [];
  const shutoffs = data.household.measure.slug === "shutoffs";

  return (
    <>
      <div className="mt-8 grid gap-6 sm:grid-cols-2">
        <SideChart side={data.household} axis={axis} color="var(--chart-1)" />
        <SideChart side={data.financial} axis={axis} color="var(--chart-2)" />
      </div>
      <p className="mt-4 text-xs text-foreground/50">
        Both charts share the same years. A year is only shown when it was fully reported; missing
        years are left blank, never filled in.
        {shutoffs
          ? " From 2025, customers who lost both electric and gas service are counted separately, so the 2025 figure leaves them out."
          : ""}
      </p>
    </>
  );
}

function SideChart({ side, axis, color }: { side: CompareSide; axis: number[]; color: string }) {
  const values = new Map(side.points.map((p) => [p.year, p.value]));
  const { unit } = side.measure;
  const aggregation = { sum: "yearly total", mean: "yearly average", last: "value at year end" }[
    side.measure.annualAgg
  ];

  return (
    <div>
      <p className="text-sm font-semibold">{side.label}</p>
      <p className="text-xs text-foreground/50">Shown as the {aggregation}</p>
      <TrendChart
        data={axis.map((year) => ({ year, value: values.get(year) }))}
        xKey="year"
        series={[{ key: "value", label: side.label, color }]}
        formatValue={(v) => formatValue(v, unit)}
        formatTick={(v) => formatValue(v, unit, { short: true })}
        ariaLabel={`${side.label} by year`}
        className="mt-3 h-48"
      />
      <SourceLine {...citation(side.measure)} />
    </div>
  );
}

function Pattern({ data }: { data: CompareData }) {
  const { overlap, correlation } = data;
  const range = overlap.length ? `${overlap[0]}–${overlap.at(-1)}` : null;

  return (
    <div className="rounded-2xl bg-paper p-6 ring-1 ring-border">
      <p className="text-xs font-semibold uppercase tracking-[0.12em] text-foreground/55">
        The pattern
      </p>
      {correlation !== null && range ? (
        <>
          <p className="mt-3 font-display text-4xl font-semibold tabular-nums">
            r = {correlation.toFixed(2)}
          </p>
          <p className="mt-2 text-sm text-foreground/75">
            Over the {overlap.length} years both are reported ({range}), the two measures show{" "}
            {describeCorrelation(correlation)}.
          </p>
        </>
      ) : (
        <p className="mt-3 text-sm text-foreground/75">
          {overlap.length
            ? `These measures overlap in only ${overlap.length} year${overlap.length === 1 ? "" : "s"} (${range}).`
            : "These measures don't overlap in any year."}{" "}
          At least {MIN_OVERLAP_YEARS} shared years are needed before we show a correlation.
        </p>
      )}
      <p className="mt-3 text-xs text-foreground/55">
        Correlation (r) runs from −1 to 1. Near 1, the two rise and fall together; near −1, one
        rises as the other falls; near 0, there's no consistent link.
      </p>
      <div className="mt-4 rounded-xl bg-amber/20 p-4">
        <p className="text-xs font-semibold uppercase tracking-[0.12em] text-foreground/55">
          A note on cause
        </p>
        <p className="mt-2 text-pretty text-sm text-foreground/80">
          Two trends moving together does not prove that one caused the other. This view shows the
          pattern, not a verdict.
        </p>
      </div>
    </div>
  );
}

function MichiganCard({ context }: { context: MichiganContext }) {
  const cite = citation(context.measure);
  const indicators = PULSE_INDICATORS.flatMap((meta) => {
    const row = context.indicators.find((i) => i.key === meta.key);
    return row?.michigan != null ? [{ ...meta, michigan: row.michigan, us: row.us }] : [];
  });

  return (
    <div className="rounded-2xl bg-accent p-6 text-accent-foreground">
      <p className="text-xs font-semibold uppercase tracking-[0.12em] text-accent-foreground/70">
        Michigan statewide context
      </p>
      <p className="mt-3 font-display text-2xl font-semibold leading-tight">
        How the whole state compares.
      </p>
      <p className="mt-2 text-sm text-accent-foreground/80">
        Share of Michigan adults whose household did each of these at least once in the past year.
        These are statewide figures for all utilities, not DTE customer figures.
      </p>
      <ul className="mt-5 space-y-4">
        {indicators.map((i) => (
          <li key={i.key}>
            <div className="flex items-baseline justify-between gap-3 text-sm">
              <span>{i.label}</span>
              <span className="font-display text-xl font-semibold tabular-nums">
                {formatValue(i.michigan, "percent")}
              </span>
            </div>
            <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-accent-foreground/15">
              <div
                className="h-full rounded-full bg-accent-foreground"
                style={{ width: `${i.michigan}%` }}
              />
            </div>
            {i.us != null ? (
              <p className="mt-1 text-xs text-accent-foreground/70">
                U.S.: {formatValue(i.us, "percent")}
              </p>
            ) : null}
          </li>
        ))}
      </ul>
      <SourceLine {...cite} className="text-accent-foreground/70" />
    </div>
  );
}
