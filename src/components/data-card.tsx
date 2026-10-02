import type { ReactNode } from "react";

import type { Citation } from "@/lib/citation";
import { cn } from "@/lib/utils";

import { Sparkline } from "./charts/sparkline";

/** Shared building blocks. Every figure on the site is shown with its source and data year. */

export function SectionIntro({
  eyebrow,
  title,
  lead,
  tone = "brand",
}: {
  eyebrow: string;
  title: string;
  lead: string;
  tone?: "brand" | "accent";
}) {
  return (
    <div className="max-w-[48ch]">
      <p
        className={`text-sm font-semibold uppercase tracking-[0.14em] ${
          tone === "accent" ? "text-accent" : "text-primary"
        }`}
      >
        {eyebrow}
      </p>
      <h2 className="mt-3 max-w-[40ch] text-balance text-4xl leading-tight sm:text-5xl">{title}</h2>
      <p className="mt-4 max-w-[52ch] text-pretty text-lg text-foreground/70">{lead}</p>
    </div>
  );
}

/** For data that genuinely does not exist. Never used as a loading placeholder for real figures. */
export function EmptyChart({
  height = "h-40",
  label = "No data available",
}: {
  height?: string;
  label?: string;
}) {
  return (
    <div
      role="status"
      className={`mt-4 grid ${height} place-items-center rounded-md bg-cream px-4 text-center`}
    >
      <span className="text-xs font-semibold uppercase tracking-[0.12em] text-foreground/45">
        {label}
      </span>
    </div>
  );
}

export function SourceLine({ source, year, href, className }: Citation & { className?: string }) {
  return (
    <p className={cn("mt-3 text-xs text-foreground/50", className)}>
      Source:{" "}
      {href ? (
        <a
          href={href}
          target="_blank"
          rel="noreferrer"
          className="underline decoration-dotted underline-offset-2 hover:decoration-solid"
        >
          {source}
        </a>
      ) : (
        source
      )}{" "}
      · Year: {year}
    </p>
  );
}

export function DataCard({
  title,
  description,
  definition,
  children,
  className,
  ...cite
}: Citation & {
  title: string;
  description?: ReactNode;
  definition?: string;
  children?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("rounded-2xl bg-paper p-6 ring-1 ring-border", className)}>
      <h3 className="font-display text-xl font-semibold">{title}</h3>
      {description ? <p className="mt-1 text-sm text-foreground/60">{description}</p> : null}
      {definition ? (
        <p className="mt-3 rounded-xl bg-cream px-4 py-3 text-sm text-foreground/75">
          {definition}
        </p>
      ) : null}
      {children ?? <EmptyChart />}
      <SourceLine {...cite} />
    </div>
  );
}

export function MeasureCard({
  label,
  definition,
  value,
  caption,
  change,
  series,
  ...cite
}: Citation & {
  label: string;
  definition: string;
  value: string;
  /** What the value refers to, e.g. "2025" or "Sep 2026". */
  caption: string;
  change?: { text: string; against: string } | undefined;
  series?: number[] | undefined;
}) {
  return (
    <div className="flex flex-col rounded-2xl bg-paper p-6 ring-1 ring-border">
      <p className="text-xs font-semibold uppercase tracking-[0.12em] text-foreground/45">
        {label}
      </p>
      <p className="mt-3 font-display text-4xl font-semibold tabular-nums">{value}</p>
      <p className="mt-1 text-xs text-foreground/55">
        {caption}
        {change ? (
          <>
            {" · "}
            <span className="font-semibold text-foreground/75">{change.text}</span> vs{" "}
            {change.against}
          </>
        ) : null}
      </p>
      <p className="mt-3 text-sm text-foreground/60">{definition}</p>
      <div className="mt-auto">
        {series && series.length > 1 ? <Sparkline values={series} /> : null}
        <SourceLine {...cite} />
      </div>
    </div>
  );
}
