import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { EmptyChart, SectionIntro, SourceLine } from "../components/data-card";

const title = "Compare household costs with DTE's finances | DTE, in Plain Terms";
const description =
  "Pick one household measure and one DTE financial measure and see them side by side over the same years, with Michigan statewide energy insecurity shown separately as context.";

export const Route = createFileRoute("/compare")({
  head: () => ({
    meta: [
      { title },
      { name: "description", content: description },
      { property: "og:title", content: title },
      { property: "og:description", content: description },
    ],
  }),
  component: Compare,
});

const householdMeasures = [
  "Energy burden by income",
  "Electric shutoffs",
  "Gas shutoffs",
  "Average yearly bill",
];

const financialMeasures = ["Stock price", "Dividends", "Growth rate", "Executive pay"];

function Compare() {
  const [household, setHousehold] = useState(householdMeasures[0]);
  const [financial, setFinancial] = useState(financialMeasures[0]);

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
                  value={household}
                  onChange={(e) => setHousehold(e.target.value)}
                  className="w-full rounded-full bg-cream px-4 py-3 text-sm font-medium ring-1 ring-border"
                >
                  {householdMeasures.map((m) => (
                    <option key={m}>{m}</option>
                  ))}
                </select>
              </label>
              <label className="min-w-[200px] flex-1">
                <span className="mb-2 block text-sm font-semibold">DTE financial measure</span>
                <select
                  value={financial}
                  onChange={(e) => setFinancial(e.target.value)}
                  className="w-full rounded-full bg-cream px-4 py-3 text-sm font-medium ring-1 ring-border"
                >
                  {financialMeasures.map((m) => (
                    <option key={m}>{m}</option>
                  ))}
                </select>
              </label>
            </div>

            <div className="mt-8 grid gap-6 sm:grid-cols-2">
              <div>
                <p className="text-sm font-semibold">{household}</p>
                <EmptyChart height="h-44" />
                <SourceLine source="Not yet provided" year="Not yet provided" />
              </div>
              <div>
                <p className="text-sm font-semibold">{financial}</p>
                <EmptyChart height="h-44" />
                <SourceLine source="Not yet provided" year="Not yet provided" />
              </div>
            </div>
            <p className="mt-4 text-xs text-foreground/50">
              Both charts will cover only the years where data exists for each measure. Missing
              years are left blank, never filled in.
            </p>
          </div>

          <div className="space-y-6 lg:col-span-4">
            <div className="rounded-2xl bg-accent p-6 text-accent-foreground">
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-accent-foreground/70">
                Michigan statewide context
              </p>
              <p className="mt-3 font-display text-2xl font-semibold leading-tight">
                How the whole state compares.
              </p>
              <p className="mt-2 text-sm text-accent-foreground/80">
                Share of Michigan residents who are energy insecure, cannot pay a utility bill, go
                without other household needs, or keep their home at an unsafe temperature. These
                are statewide figures, not DTE customer figures.
              </p>
              <div className="mt-4 grid h-24 place-items-center rounded-md bg-accent-foreground/15">
                <span className="text-[11px] font-semibold uppercase tracking-[0.1em] text-accent-foreground/70">
                  Data not loaded yet
                </span>
              </div>
              <p className="mt-3 text-xs text-accent-foreground/70">
                Source: Not yet provided · Year: Not yet provided
              </p>
            </div>
            <div className="rounded-2xl bg-amber/20 p-6 ring-1 ring-border">
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-foreground/55">
                A note on cause
              </p>
              <p className="mt-3 text-pretty text-sm text-foreground/80">
                Two trends moving together does not prove that one caused the other. This view shows
                the pattern, not a verdict.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
