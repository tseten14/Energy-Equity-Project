import { createFileRoute } from "@tanstack/react-router";
import { MeasureCard, SectionIntro } from "../components/data-card";

const title = "DTE Financials — stock, dividends and executive pay | DTE, in Plain Terms";
const description =
  "DTE's stock price, dividends, growth rate and executive compensation, each explained in everyday language.";

export const Route = createFileRoute("/financials")({
  head: () => ({
    meta: [
      { title },
      { name: "description", content: description },
      { property: "og:title", content: title },
      { property: "og:description", content: description },
    ],
  }),
  component: Financials,
});

const measures = [
  {
    label: "Stock price",
    definition: "The price of one share of the company's stock on the market.",
  },
  {
    label: "Dividends",
    definition: "Dividend: cash the company pays its shareholders, usually every few months.",
  },
  {
    label: "Growth rate",
    definition: "How fast the company's revenue or value is rising, year over year.",
  },
  {
    label: "Executive pay",
    definition: "What the top leaders are paid, including salary, bonuses and stock.",
  },
];

function Financials() {
  return (
    <div className="py-16 sm:py-20">
      <div className="mx-auto max-w-6xl px-5 sm:px-8">
        <SectionIntro
          eyebrow="DTE Financials"
          title="The company's side of the ledger."
          lead="The same utility that sets your rates also pays shareholders and executives. Here's what those numbers mean in everyday words."
          tone="accent"
        />

        <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {measures.map((m) => (
            <MeasureCard
              key={m.label}
              label={m.label}
              definition={m.definition}
              source="Not yet provided"
              year="Not yet provided"
            />
          ))}
        </div>
      </div>
    </div>
  );
}
