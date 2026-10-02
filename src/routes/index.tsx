/** The opening Compare overview: sourced household and company findings beside further reading. */
import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";

import { SectionIntro, SourceLine } from "../components/data-card";
import { DTE_ARTICLES } from "../data/articles";
import type { OverviewFinding } from "../data/measures";
import { overviewQuery } from "../data/queries";
import { citation } from "../lib/citation";

const title = "Compare household experience and DTE finances | Energy Equity Report";
const description =
  "The most important sourced findings on Michigan household energy insecurity and DTE's finances, with five articles for further reading.";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title },
      { name: "description", content: description },
      { property: "og:title", content: title },
      { property: "og:description", content: description },
    ],
  }),
  loader: ({ context }) => context.queryClient.ensureQueryData(overviewQuery()),
  component: CompareOverview,
});

function SectionLink({ to, children }: { to: "/household" | "/financials"; children: string }) {
  return (
    <Link
      to={to}
      className="inline-flex items-center gap-1 text-sm font-semibold text-primary underline-offset-2 hover:underline"
    >
      {children}
      <span aria-hidden="true">&rarr;</span>
    </Link>
  );
}

function FindingList({ findings, accent }: { findings: OverviewFinding[]; accent: string }) {
  return (
    <ul className="mt-5 space-y-5">
      {findings.map((finding) => (
        <li key={finding.label} className={`border-l-4 pl-4 ${accent}`}>
          <p className="font-display text-3xl font-semibold tabular-nums">{finding.value}</p>
          <p className="mt-1 text-sm font-semibold">{finding.label}</p>
          <p className="mt-1 text-sm text-foreground/70">{finding.detail}</p>
          <SourceLine {...citation(finding.measure)} />
        </li>
      ))}
    </ul>
  );
}

function CompareOverview() {
  const { data } = useSuspenseQuery(overviewQuery());
  const statewide = data.household.filter(
    (finding) => finding.measure.slug === "mi_energy_insecurity",
  );
  const dteHousehold = data.household.filter(
    (finding) => finding.measure.slug !== "mi_energy_insecurity",
  );
  const statewideSource = statewide[0];

  return (
    <div className="bg-cream/60 py-16 sm:py-20">
      <div className="mx-auto max-w-6xl px-5 sm:px-8">
        <SectionIntro
          eyebrow="Compare"
          title="What households experience. What DTE reports."
          lead="The main figures, with a note on whether each one is statewide or DTE-only, and five articles for the story around them."
        />

        <div className="mt-10 grid items-start gap-6 lg:grid-cols-[minmax(0,1.15fr)_minmax(18rem,0.85fr)]">
          <div className="space-y-6">
            <section className="rounded-2xl bg-paper p-6 ring-1 ring-border sm:p-8">
              <div className="flex flex-wrap items-baseline justify-between gap-3">
                <h3 className="font-display text-2xl font-semibold">Household experience</h3>
                <SectionLink to="/household">See household charts</SectionLink>
              </div>

              {statewideSource ? (
                <div className="mt-5 rounded-xl bg-ink p-5 text-paper">
                  <p className="text-xs font-semibold uppercase tracking-[0.14em] text-highlight">
                    Michigan statewide, all utilities
                  </p>
                  <p className="mt-2 max-w-[58ch] text-sm text-paper/80">
                    Share of Michigan adults whose household had each experience at least once in
                    the previous 12 months. These are survey results, not DTE customer figures.
                  </p>
                  <ul className="mt-4 grid gap-4 sm:grid-cols-3">
                    {statewide.map((finding) => (
                      <li key={finding.label}>
                        <p className="font-display text-3xl font-semibold tabular-nums">
                          {finding.value}
                        </p>
                        <p className="mt-1 text-sm text-paper/85">{finding.label}</p>
                        <p className="mt-1 text-xs text-paper/65">{finding.detail}</p>
                      </li>
                    ))}
                  </ul>
                  <SourceLine
                    {...citation(statewideSource.measure)}
                    className="text-paper/70"
                  />
                </div>
              ) : null}

              <p className="mt-6 text-xs font-semibold uppercase tracking-[0.14em] text-chart-1">
                DTE customers only
              </p>
              <FindingList findings={dteHousehold} accent="border-chart-1" />
            </section>

            <section className="rounded-2xl bg-paper p-6 ring-1 ring-border sm:p-8">
              <div className="flex flex-wrap items-baseline justify-between gap-3">
                <h3 className="font-display text-2xl font-semibold">DTE financials</h3>
                <SectionLink to="/financials">See company charts</SectionLink>
              </div>
              <FindingList findings={data.financial} accent="border-chart-2" />
            </section>
          </div>

          <aside
            className="rounded-2xl bg-paper p-6 ring-1 ring-border sm:p-8 lg:sticky lg:top-6"
            aria-labelledby="articles-heading"
          >
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-accent">
              Further reading
            </p>
            <h3 id="articles-heading" className="mt-2 font-display text-2xl font-semibold">
              Five articles to know
            </h3>
            <p className="mt-2 text-sm text-foreground/70">
              Reporting that puts the shutoffs, rates, and shareholder payouts in context.
            </p>
            <ol className="mt-6 space-y-5">
              {DTE_ARTICLES.map((article, index) => (
                <li key={article.url} className="border-t border-border pt-5 first:border-0 first:pt-0">
                  <p className="text-xs font-semibold uppercase tracking-wide text-foreground/55">
                    <span className="mr-2 inline-grid size-5 place-items-center rounded-full bg-highlight text-[11px] text-highlight-foreground">
                      {index + 1}
                    </span>
                    {article.publisher} · {article.date}
                  </p>
                  <a
                    href={article.url}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-2 block font-display text-lg font-semibold leading-snug text-primary underline decoration-transparent underline-offset-4 hover:decoration-current"
                  >
                    {article.title}
                  </a>
                  <p className="mt-1.5 text-sm text-foreground/75">{article.description}</p>
                </li>
              ))}
            </ol>
          </aside>
        </div>
      </div>
    </div>
  );
}
