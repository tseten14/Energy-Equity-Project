import { createFileRoute, Link } from "@tanstack/react-router";

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
  component: Home,
});

function Home() {
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
            <p className="mt-6 max-w-[46ch] text-sm text-foreground/50">
              No datasets have been loaded yet. Until real data arrives, every chart on this site
              shows a clearly labeled empty state rather than an estimate.
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
      </div>
    </section>
  );
}
