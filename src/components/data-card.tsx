import type { ReactNode } from "react";

/**
 * Presentation-only building blocks.
 * No dataset has been supplied yet, so every card renders a labeled empty state
 * instead of a number. Nothing here invents values, sources, or takeaways.
 */

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

export function EmptyChart({ height = "h-40", label = "Data not loaded yet" }: { height?: string; label?: string }) {
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

export function SourceLine({ source, year }: { source: string; year: string }) {
  return (
    <p className="mt-3 text-xs text-foreground/50">
      Source: {source} · Year: {year}
    </p>
  );
}

export function DataCard({
  title,
  description,
  definition,
  source,
  year,
  children,
}: {
  title: string;
  description?: string;
  definition?: string;
  source: string;
  year: string;
  children?: ReactNode;
}) {
  return (
    <div className="rounded-2xl bg-paper p-6 ring-1 ring-border">
      <h3 className="font-display text-xl font-semibold">{title}</h3>
      {description ? <p className="mt-1 text-sm text-foreground/60">{description}</p> : null}
      {definition ? (
        <p className="mt-3 rounded-xl bg-cream px-4 py-3 text-sm text-foreground/75">{definition}</p>
      ) : null}
      {children ?? <EmptyChart />}
      <SourceLine source={source} year={year} />
    </div>
  );
}

export function MeasureCard({
  label,
  definition,
  source,
  year,
}: {
  label: string;
  definition: string;
  source: string;
  year: string;
}) {
  return (
    <div className="rounded-2xl bg-paper p-6 ring-1 ring-border">
      <p className="text-xs font-semibold uppercase tracking-[0.12em] text-foreground/45">{label}</p>
      <p className="mt-3 font-display text-4xl font-semibold" aria-label="No value available yet">
        —
      </p>
      <p className="mt-2 text-sm text-foreground/60">{definition}</p>
      <EmptyChart height="h-16" />
      <SourceLine source={source} year={year} />
    </div>
  );
}
