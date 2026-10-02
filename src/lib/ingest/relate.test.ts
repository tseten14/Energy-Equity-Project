import { describe, expect, it } from "vitest";

import type { ParsedTable } from "./parse";
import { analyzeDataset, topicMatches, type RelateContext } from "./relate";

const ctx: RelateContext = {
  yearly: [
    {
      measure: "avg_price_kwh",
      label: "Average price per kWh (homes)",
      points: [2018, 2019, 2020, 2021, 2022].map((year, i) => ({ year, value: 15 + i })),
    },
  ],
  tractBurden: {
    "26163500100": 12,
    "26163500200": 8,
    "26125100100": 2,
    "26125100200": 3,
  },
};

describe("topicMatches", () => {
  it("finds site measures mentioned in names", () => {
    expect(topicMatches("Monthly shutoff notices")).toEqual(["shutoffs"]);
    expect(topicMatches("Average bill")).toEqual(["avg_yearly_bill"]);
    expect(topicMatches("Bus stops")).toEqual([]);
    expect(topicMatches("Vacancy rate")).toEqual([]);
    expect(topicMatches("Electricity rates")).toEqual(["avg_price_kwh"]);
  });
});

describe("analyzeDataset", () => {
  it("relates a yearly series to the site's yearly measures", () => {
    const table: ParsedTable = {
      columns: ["Year", "Utility assistance requests"],
      rows: [2018, 2019, 2020, 2021, 2022].map((year, i) => [year, 200 + i * 40]),
    };
    const { insights } = analyzeDataset("Assistance", table, ctx);
    const relation = insights.find((i) => i.kind === "relation");
    expect(relation?.relatedMeasure).toBe("avg_price_kwh");
    expect(relation?.stats.r).toBeCloseTo(1);
    expect(relation?.body).toContain("not proof");
  });

  it("joins tracts and counties to energy burden", () => {
    const tracts: ParsedTable = {
      columns: ["GEOID", "Score"],
      rows: [
        ["26163500100", 9],
        ["26163500200", 7],
        ["99999999999", 1],
      ],
    };
    const tract = analyzeDataset("Scores", tracts, ctx).insights.find((i) => i.kind === "relation");
    expect(tract?.title).toBe("2 tracts in your file are in DTE's service area");
    expect(tract?.body).toContain("10.0% of income");

    const counties: ParsedTable = {
      columns: ["County", "Sites"],
      rows: [
        ["Wayne", 4],
        ["Oakland County", 2],
        ["Kent", 1],
      ],
    };
    const county = analyzeDataset("Sites", counties, ctx).insights.find(
      (i) => i.kind === "relation",
    );
    expect(county?.title).toBe("2 counties in your file are in DTE's service area");
    expect(county?.body).toContain("Wayne County has the highest");
  });

  it("tags statistics with matching topics", () => {
    const table: ParsedTable = {
      columns: ["Year", "Shutoffs"],
      rows: [
        [2022, 10],
        [2023, 12],
      ],
    };
    const analysis = analyzeDataset("Notices", table, ctx);
    expect(analysis.topics).toEqual(["shutoffs"]);
    expect(analysis.insights[0]?.relatedMeasure).toBe("shutoffs");
  });
});
