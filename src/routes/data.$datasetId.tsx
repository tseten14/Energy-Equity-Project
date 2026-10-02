/**
 * Results for one community upload. Search engines are asked not to index it.
 * An unknown id renders the 404 page.
 */
import { useSuspenseQuery } from "@tanstack/react-query";
import { Link, createFileRoute, notFound } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { z } from "zod";

import { TrendChart } from "../components/charts/trend-chart";
import { PreviewTable } from "../components/preview-table";
import type { DatasetDetail, StoredInsight } from "../data/datasets";
import { MEASURE_PAGES } from "../data/labels";
import { datasetQuery } from "../data/queries";
import { formatNumber } from "../lib/format";
import type { ColumnKind, ColumnProfile } from "../lib/ingest/profile";

export const Route = createFileRoute("/data/$datasetId")({
  loader: async ({ context, params }) => {
    if (!z.string().uuid().safeParse(params.datasetId).success) throw notFound();
    const dataset = await context.queryClient.ensureQueryData(datasetQuery(params.datasetId));
    if (!dataset) throw notFound();
    return { name: dataset.name };
  },
  head: ({ loaderData }) => {
    const title = `${loaderData?.name ?? "Uploaded dataset"} — community upload | Energy Equity Report`;
    return {
      meta: [
        { title },
        {
          name: "description",
          content: "A community-uploaded dataset, described and related to DTE data.",
        },
        // Uploads are unverified, so they should not show up in search results as this site's findings.
        { name: "robots", content: "noindex" },
      ],
    };
  },
  component: DatasetPage,
});

function DatasetPage() {
  const { datasetId } = Route.useParams();
  const { data } = useSuspenseQuery(datasetQuery(datasetId));
  if (!data) return null;

  const ai = data.insights.find((i) => i.kind === "ai");
  const stats = data.insights.filter((i) => i.kind === "stat");
  const relations = data.insights.filter((i) => i.kind === "relation");

  return (
    <div className="bg-cream/60 py-16 sm:py-20">
      <div className="mx-auto max-w-6xl px-5 sm:px-8">
        <Header dataset={data} />
        {ai ? <AiSummary insight={ai} /> : null}

        <Section title="What's in the file">
          {stats.length ? (
            <div className="grid gap-6 md:grid-cols-2">
              {stats.map((insight) => (
                <InsightCard key={insight.id} insight={insight} color="var(--chart-1)" />
              ))}
            </div>
          ) : (
            <Note>
              We didn't find number columns to summarize. Columns with amounts, counts or rates work
              best.
            </Note>
          )}
        </Section>

        <Section title="How it relates to DTE">
          {relations.length ? (
            <div className="grid gap-6 md:grid-cols-2">
              {relations.map((insight) => (
                <InsightCard key={insight.id} insight={insight} color="var(--chart-2)" />
              ))}
            </div>
          ) : (
            <Note>
              We couldn't line this file up with the site's data. To compare over time, include a
              year or date column with at least 4 years in common with DTE's figures (most start in
              2015). To compare places, include a census tract GEOID or a county column for the DTE
              service area.
            </Note>
          )}
        </Section>

        <Section title="Columns">
          <ColumnTable columns={data.profile.columns} />
        </Section>

        <Section title="First rows">
          <p className="mb-3 text-sm text-foreground/60">
            Showing {data.preview.rows.length.toLocaleString()} of {data.rowCount.toLocaleString()}{" "}
            rows.
          </p>
          <PreviewTable
            columns={data.preview.columns}
            rows={data.preview.rows}
            className="bg-paper"
          />
        </Section>
      </div>
    </div>
  );
}

const uploadedOn = (iso: string) =>
  new Date(iso).toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });

function Header({ dataset }: { dataset: DatasetDetail }) {
  return (
    <header className="max-w-[60ch]">
      <Link
        to="/data"
        className="text-sm font-semibold text-primary underline-offset-2 hover:underline"
      >
        ← All uploads
      </Link>
      <p className="mt-6 inline-block rounded-full bg-highlight/30 px-3 py-1 text-xs font-semibold uppercase tracking-[0.12em] text-foreground/70">
        Community upload · unverified
      </p>
      <h1 className="mt-4 text-balance text-4xl leading-tight sm:text-5xl">{dataset.name}</h1>
      <p className="mt-3 text-sm text-foreground/60">
        {dataset.fileName} · {dataset.rowCount.toLocaleString()} rows ·{" "}
        {dataset.profile.columns.length} columns · uploaded {uploadedOn(dataset.createdAt)}
      </p>
      <p className="mt-4 text-pretty text-foreground/75">
        A member of the public uploaded this file and we haven't checked it. Every figure below is
        computed directly from the file.
      </p>
    </header>
  );
}

function AiSummary({ insight }: { insight: StoredInsight }) {
  const caveats = insight.stats?.caveats ?? [];
  return (
    <section
      className="mt-10 rounded-2xl bg-accent p-6 text-accent-foreground sm:p-8"
      aria-labelledby="ai-summary"
    >
      <p className="text-xs font-semibold uppercase tracking-[0.12em] text-accent-foreground/70">
        Summary · written by AI
      </p>
      <h2
        id="ai-summary"
        className="mt-3 max-w-[50ch] font-display text-2xl font-semibold leading-snug"
      >
        {insight.title}
      </h2>
      <ul className="mt-4 max-w-[70ch] list-disc space-y-2 pl-5 text-sm">
        {insight.body.split("\n").map((line) => (
          <li key={line}>{line}</li>
        ))}
      </ul>
      {caveats.length ? (
        <p className="mt-4 max-w-[70ch] text-sm text-accent-foreground/80">
          Keep in mind: {caveats.join(" ")}
        </p>
      ) : null}
      <p className="mt-4 text-xs text-accent-foreground/70">
        Written from the statistics below and checked so it only uses figures they contain. Treat it
        as a starting point, not a finding.
      </p>
    </section>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="mt-14">
      <h2 className="mb-5 font-display text-2xl font-semibold">{title}</h2>
      {children}
    </section>
  );
}

function Note({ children }: { children: ReactNode }) {
  return (
    <p className="max-w-[70ch] rounded-2xl bg-paper p-6 text-sm text-foreground/70 ring-1 ring-border">
      {children}
    </p>
  );
}

function InsightCard({ insight, color }: { insight: StoredInsight; color: string }) {
  const chart = insight.stats?.chart;
  const related = insight.relatedMeasure ? MEASURE_PAGES[insight.relatedMeasure] : null;

  return (
    <article className="flex flex-col rounded-2xl bg-paper p-6 ring-1 ring-border">
      <h3 className="font-display text-xl font-semibold leading-snug">{insight.title}</h3>
      <p className="mt-2 text-pretty text-sm text-foreground/75">{insight.body}</p>
      {chart && chart.points.length > 1 ? (
        <TrendChart
          data={chart.points}
          xKey="label"
          series={[{ key: "value", label: chart.valueLabel, color }]}
          kind={chart.kind}
          formatValue={formatNumber}
          ariaLabel={`Chart: ${insight.title}`}
          className="mt-4 h-52"
        />
      ) : null}
      {related ? (
        <p className="mt-auto pt-4 text-sm text-foreground/60">
          Related on this site:{" "}
          <Link
            to={related.to}
            className="font-semibold text-primary underline-offset-2 hover:underline"
          >
            {related.label}
          </Link>
        </p>
      ) : null}
    </article>
  );
}

const KIND_LABELS: Record<ColumnKind, string> = {
  number: "Number",
  year: "Year",
  date: "Date",
  tract: "Census tract",
  county: "County",
  category: "Category",
  text: "Text",
  empty: "Empty",
};

function columnSummary(c: ColumnProfile): string {
  if (c.numeric) {
    return `Median ${formatNumber(c.numeric.median)}, from ${formatNumber(c.numeric.min)} to ${formatNumber(c.numeric.max)}`;
  }
  if (c.range) return `${c.range.from} to ${c.range.to}`;
  if (c.top)
    return c.top
      .slice(0, 3)
      .map((t) => `${t.value} (${t.count.toLocaleString()})`)
      .join(", ");
  if (c.kind === "empty") return "No values";
  return `${c.distinct.toLocaleString()} different values`;
}

function ColumnTable({ columns }: { columns: ColumnProfile[] }) {
  return (
    <div className="overflow-x-auto rounded-2xl bg-paper ring-1 ring-border">
      <table className="w-full text-left text-sm">
        <thead className="bg-cream text-xs uppercase tracking-[0.08em] text-foreground/60">
          <tr>
            <th scope="col" className="px-4 py-3 font-semibold">
              Column
            </th>
            <th scope="col" className="px-4 py-3 font-semibold">
              Type
            </th>
            <th scope="col" className="px-4 py-3 font-semibold">
              Filled in
            </th>
            <th scope="col" className="px-4 py-3 font-semibold">
              Summary
            </th>
          </tr>
        </thead>
        <tbody>
          {columns.map((c) => (
            <tr key={c.name} className="border-t border-border">
              <td className="px-4 py-3 font-medium">{c.name}</td>
              <td className="px-4 py-3 text-foreground/70">{KIND_LABELS[c.kind]}</td>
              <td className="px-4 py-3 tabular-nums text-foreground/70">
                {c.filled.toLocaleString()}
                {c.missing ? (
                  <span className="text-foreground/45"> ({c.missing.toLocaleString()} blank)</span>
                ) : null}
              </td>
              <td className="px-4 py-3 text-foreground/70">{columnSummary(c)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
