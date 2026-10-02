/** The opening Compare overview: sourced household and company findings beside further reading. */
import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";

import { SectionIntro, SourceLine } from "../components/data-card";
import { DTE_ARTICLES } from "../data/articles";
import type { OverviewFinding } from "../data/measures";
import { overviewQuery } from "../data/queries";
import { citation } from "../lib/citation";

const title = "Compare household experience and DTE finances | DTE, in Plain Terms";
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

function FindingGroup({
  title: groupTitle,
  findings,
  to,
}: {
  title: string;
  findings: OverviewFinding[];
  to: "/household" | "/financials";
}) {
  return (
    <section className="rounded-2xl bg-paper p-6 ring-1 ring-border sm:p-8">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <h3 className="font-display text-2xl font-semibold">{groupTitle}</h3>
        <Link
          to={to}
          className="text-sm font-semibold text-secondary-foreground underline underline-offset-2"
        >
          Explore the data
        </Link>
      </div>
      <ul className="mt-5 space-y-5">
        {findings.map((finding) => (
          <li key={finding.label} className="border-l-4 border-primary pl-4">
            <p className="font-display text-2xl font-semibold tabular-nums text-foreground">
              {finding.value}
            </p>
            <p className="mt-1 text-sm font-semibold">{finding.label}</p>
            <p className="mt-1 text-xs text-foreground/70">{finding.detail}</p>
            <SourceLine {...citation(finding.measure)} />
          </li>
        ))}
      </ul>
    </section>
  );
}

function CompareOverview() {
  const { data } = useSuspenseQuery(overviewQuery());

  return (
    <div className="bg-cream/60 py-16 sm:py-20">
      <div className="mx-auto max-w-6xl px-5 sm:px-8">
        <SectionIntro
          eyebrow="Compare"
          title="What households experience. What DTE reports."
          lead="A short guide to the figures behind energy affordability and DTE's finances, with reporting that adds context."
        />
        <p className="mt-6 max-w-[75ch] rounded-xl bg-highlight px-5 py-4 text-sm font-medium text-highlight-foreground">
          Scope matters: energy insecurity describes Michigan statewide across all utilities. Energy
          burden describes households in DTE's service-area geography. Shutoffs and electricity
          prices are DTE-reported figures.
        </p>

        <div className="mt-10 grid items-start gap-6 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)]">
          <div className="space-y-6">
            <FindingGroup title="Household experience" findings={data.household} to="/household" />
            <FindingGroup title="DTE financials" findings={data.financial} to="/financials" />
          </div>
          <aside
            className="rounded-2xl bg-paper p-6 ring-1 ring-border sm:p-8"
            aria-labelledby="articles-heading"
          >
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-secondary-foreground">
              Further reading
            </p>
            <h3 id="articles-heading" className="mt-2 font-display text-2xl font-semibold">
              Five DTE articles to know
            </h3>
            <ol className="mt-6 space-y-6">
              {DTE_ARTICLES.map((article, index) => (
                <li
                  key={article.url}
                  className="border-t border-border pt-5 first:border-0 first:pt-0"
                >
                  <p className="text-xs font-semibold uppercase tracking-wide text-foreground/65">
                    {index + 1}. {article.publisher} · {article.date}
                  </p>
                  <a
                    href={article.url}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-2 block font-display text-lg font-semibold leading-snug text-secondary-foreground underline decoration-transparent underline-offset-4 hover:decoration-current"
                  >
                    {article.title}
                  </a>
                  <p className="mt-2 text-sm text-foreground/75">{article.description}</p>
                </li>
              ))}
            </ol>
          </aside>
        </div>
      </div>
    </div>
  );
}
