import { createFileRoute } from "@tanstack/react-router";
import { DataCard, EmptyChart, SectionIntro, SourceLine } from "../components/data-card";

const title = "Household Experience — what DTE customers pay | DTE, in Plain Terms";
const description =
  "Energy burden by census tract and income group across the DTE service area, plus electric and gas shutoffs shown separately.";

export const Route = createFileRoute("/household")({
  head: () => ({
    meta: [
      { title },
      { name: "description", content: description },
      { property: "og:title", content: title },
      { property: "og:description", content: description },
    ],
  }),
  component: Household,
});

const incomeGroups = ["Under $30k", "$30k–$60k", "$60k–$100k", "Over $100k"];

function Household() {
  return (
    <div className="bg-cream/60 py-16 sm:py-20">
      <div className="mx-auto max-w-6xl px-5 sm:px-8">
        <SectionIntro
          eyebrow="Household Experience"
          title="What utility costs look like from the kitchen table."
          lead="Energy burden is how much of a household's income goes to keeping the lights on and the heat running. Here's how it varies by income, and where shutoffs land."
        />

        <div className="mt-10 grid gap-6 lg:grid-cols-12">
          <div className="lg:col-span-5">
            <DataCard
              title="Energy burden by census tract"
              description="A map of your neighborhood's share of income spent on energy."
              definition="Energy burden: the share of a household's income spent on electricity, gas and other home energy costs."
              source="Not yet provided"
              year="Not yet provided"
            >
              <EmptyChart height="aspect-[4/3] h-auto w-full" label="Map not loaded yet" />
            </DataCard>
          </div>

          <div className="lg:col-span-7">
            <div className="rounded-2xl bg-paper p-6 ring-1 ring-border">
              <h3 className="font-display text-xl font-semibold">Energy burden by income group</h3>
              <p className="mt-2 max-w-[46ch] text-pretty text-sm text-foreground/70">
                This chart will compare the share of income spent on energy across income groups.
                A takeaway will appear here once the data is loaded.
              </p>
              <div className="mt-6 space-y-4" aria-hidden="true">
                {incomeGroups.map((group) => (
                  <div key={group}>
                    <div className="mb-1.5 flex justify-between text-sm">
                      <span className="font-medium">{group}</span>
                      <span className="text-foreground/50">share of income</span>
                    </div>
                    <div className="h-8 overflow-hidden rounded-full bg-cream" />
                  </div>
                ))}
              </div>
              <p className="mt-5 text-xs text-foreground/50">
                Bars stay empty until data loads.{" "}
                <span className="font-semibold text-primary">Data not loaded yet.</span>
              </p>
              <SourceLine source="Not yet provided" year="Not yet provided" />
            </div>
          </div>
        </div>

        <div className="mt-6 grid gap-6 sm:grid-cols-2">
          <DataCard
            title="Electric shutoffs"
            description="Times electric service was cut for nonpayment. Shown for 2024 first; other years appear only when data exists."
            source="Not yet provided"
            year="Not yet provided"
          />
          <DataCard
            title="Gas shutoffs"
            description="Times gas service was cut for nonpayment. Shown for 2024 first; other years appear only when data exists."
            source="Not yet provided"
            year="Not yet provided"
          />
        </div>

        <div className="mt-6 rounded-2xl bg-paper p-6 ring-1 ring-border">
          <h3 className="font-display text-xl font-semibold">DTE energy prices by customer class</h3>
          <p className="mt-1 text-sm text-foreground/60">
            The average yearly bill comes first, with the full detail — electricity used, number of
            customers, total revenue and average price per kilowatt-hour — in the table below.
          </p>
          <p className="mt-3 rounded-xl bg-cream px-4 py-3 text-sm text-foreground/75">
            Customer class: the kind of customer being billed, such as homes, businesses or
            factories.
          </p>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[640px] text-left text-sm">
              <caption className="sr-only">
                DTE energy prices by customer class — no data loaded yet
              </caption>
              <thead>
                <tr className="border-b border-border text-xs uppercase tracking-[0.1em] text-foreground/45">
                  <th scope="col" className="py-2 pr-4 font-semibold">Customer class</th>
                  <th scope="col" className="py-2 pr-4 font-semibold">Average yearly bill</th>
                  <th scope="col" className="py-2 pr-4 font-semibold">Average price per kWh</th>
                  <th scope="col" className="py-2 pr-4 font-semibold">Electricity used (kWh)</th>
                  <th scope="col" className="py-2 pr-4 font-semibold">Customers</th>
                  <th scope="col" className="py-2 font-semibold">Total revenue</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td colSpan={6} className="py-10 text-center text-xs font-semibold uppercase tracking-[0.12em] text-foreground/45">
                    Data not loaded yet
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
          <SourceLine source="Not yet provided" year="Not yet provided" />
        </div>
      </div>
    </div>
  );
}
