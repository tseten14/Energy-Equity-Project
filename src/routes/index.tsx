/** Home page. Four sourced headline figures, each linking to the page that explains it. */
import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";

import { SourceLine } from "../components/data-card";
import type { Headlines } from "../data/measures";
import { headlinesQuery } from "../data/queries";
import { citation } from "../lib/citation";
import { formatValue } from "../lib/format";

const title = "DTE, in Plain Terms — household energy costs and company finances";
const description =
  "A plain-language comparison of what DTE customers pay and experience with DTE's prices and company financials, plus Michigan statewide energy insecurity as context.";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title },
      { name: "description", content: description },
      { property: "og:title", content: title },
      { property: "og:description", content: description },
    ],
  }),
  loader: ({ context }) => context.queryClient.ensureQueryData(headlinesQuery()),
  component: Home,
});

function Home() {
  const { data } = useSuspenseQuery(headlinesQuery());

  return (
    <section className="py-16 sm:py-24">
      <div className="mx-auto max-w-6xl px-5 sm:px-8">
        <div className="grid items-center gap-10 lg:grid-cols-12 lg:gap-16">
          <div className="lg:col-span-7">
            <span className="inline-block rounded-full bg-amber/25 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.14em]">
              Civic data, explained
            </span>
            <h1 className="mt-6 max-w-[20ch] text-balance font-display text-5xl font-semibold leading-none sm:text-6xl lg:text-7xl">
              What your utility bill says about the company behind it.
            </h1>
            <p className="mt-6 max-w-[52ch] text-pretty text-lg text-foreground/70">
              We compare what Michigan households actually pay and experience — energy burden,
              electric and gas shutoffs — against the utility's own financials. No jargon. Every
              number is sourced, dated, and defined in plain English.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                to="/household"
                className="inline-flex items-center gap-2 rounded-full bg-primary px-6 py-3.5 text-base font-semibold text-primary-foreground ring-2 ring-primary/30"
              >
                Explore household data
                <span aria-hidden="true" className="text-lg leading-none">
                  &rarr;
                </span>
              </Link>
              <Link
                to="/compare"
                className="inline-flex items-center gap-2 rounded-full px-6 py-3.5 text-base font-semibold ring-2 ring-border"
              >
                Compare the two sides
              </Link>
            </div>
            <p className="mt-6 max-w-[50ch] text-sm text-foreground/55">
              The figures come from federal agencies, the Michigan Public Service Commission and
              DTE's own filings. Have a dataset of your own?{" "}
              <Link to="/data" className="font-semibold text-primary underline underline-offset-2">
                Upload it
              </Link>{" "}
              and see how it relates.
            </p>
          </div>

          <div className="lg:col-span-5">
            <div className="rounded-2xl bg-cream p-6 ring-1 ring-border">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-foreground/50">
                How to read this site
              </p>
              <ul className="mt-4 space-y-4">
                <li className="flex gap-3">
                  <span className="grid size-8 shrink-0 place-items-center rounded-full bg-primary/15 font-display font-semibold text-primary">
                    1
                  </span>
                  <p className="pt-1 text-sm text-foreground/75">
                    Each chart has a plain title, a one-line takeaway, and a source with year.
                  </p>
                </li>
                <li className="flex gap-3">
                  <span className="grid size-8 shrink-0 place-items-center rounded-full bg-accent/15 font-display font-semibold text-accent">
                    2
                  </span>
                  <p className="pt-1 text-sm text-foreground/75">
                    Terms you might not know are defined right where they appear.
                  </p>
                </li>
                <li className="flex gap-3">
                  <span className="grid size-8 shrink-0 place-items-center rounded-full bg-amber/25 font-display font-semibold">
                    3
                  </span>
                  <p className="pt-1 text-sm text-foreground/75">
                    Where data is missing, we say so — we never guess or invent numbers.
                  </p>
                </li>
              </ul>
            </div>
          </div>
        </div>

        <HeadlineStrip data={data} />
      </div>
    </section>
  );
}

function HeadlineStrip({ data }: { data: Headlines }) {
  const { burden, price, shutoffs, ceoPay } = data;
  const priceRise = ((price.latest.value - price.first.value) / price.first.value) * 100;

  const stats = [
    {
      value: formatValue(burden.veryLow, "percent"),
      text: `of income goes to home energy for very low-income households in DTE's area, against ${formatValue(burden.overall, "percent")} for all households.`,
      to: "/household" as const,
      measure: burden.measure,
    },
    {
      value: formatValue(price.latest.value, "cents_per_kwh"),
      text: `per kilowatt-hour paid by homes in ${price.latest.year}, up ${Math.round(priceRise)}% since ${price.first.year}.`,
      to: "/household" as const,
      measure: price.measure,
    },
    {
      value: formatValue(shutoffs.total, "count"),
      text: `electric and gas shutoffs for nonpayment in ${shutoffs.year}.`,
      to: "/household" as const,
      measure: shutoffs.measure,
    },
    {
      value: formatValue(ceoPay.latest.value, "usd"),
      text: `in total pay for DTE's CEO in ${ceoPay.latest.year}.`,
      to: "/financials" as const,
      measure: ceoPay.measure,
    },
  ];

  return (
    <div className="mt-16 grid gap-px overflow-hidden rounded-2xl bg-border ring-1 ring-border sm:grid-cols-2 lg:grid-cols-4">
      {stats.map((s) => (
        <div key={s.measure.slug} className="flex flex-col bg-paper p-6">
          <Link to={s.to} className="group">
            <p className="font-display text-4xl font-semibold tabular-nums group-hover:text-primary">
              {s.value}
            </p>
            <p className="mt-2 text-sm text-foreground/70">{s.text}</p>
          </Link>
          <SourceLine {...citation(s.measure)} className="mt-auto pt-3" />
        </div>
      ))}
    </div>
  );
}
