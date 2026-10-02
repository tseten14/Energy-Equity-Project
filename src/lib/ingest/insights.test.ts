/** Checks trend, ranking, and distribution findings, including partial years that must be dropped. */
import { describe, expect, it } from "vitest";

import { computeInsights, yearlySeries } from "./insights";
import type { ParsedTable } from "./parse";
import { profileTable } from "./profile";

const monthly: ParsedTable = {
  columns: ["Month", "Shutoffs", "Rate"],
  rows: [
    ...Array.from({ length: 12 }, (_, m) => [`2023-${String(m + 1).padStart(2, "0")}-01`, 100, 10]),
    ...Array.from({ length: 12 }, (_, m) => [`2024-${String(m + 1).padStart(2, "0")}-01`, 150, 20]),
    ["2025-01-01", 500, 30],
  ],
};

describe("yearlySeries", () => {
  it("adds up amounts, averages rates, and drops partial years from totals", () => {
    const profile = profileTable(monthly);
    const shutoffs = yearlySeries(monthly, profile, "Shutoffs");
    expect(shutoffs?.agg).toBe("sum");
    expect(shutoffs?.points).toEqual([
      { year: 2023, value: 1200 },
      { year: 2024, value: 1800 },
    ]);
    expect(shutoffs?.partialYears).toEqual([2025]);

    const rate = yearlySeries(monthly, profile, "Rate");
    expect(rate?.agg).toBe("mean");
    expect(rate?.points.map((p) => p.value)).toEqual([10, 20, 30]);
  });
});

describe("computeInsights", () => {
  it("describes a yearly trend", () => {
    const table: ParsedTable = {
      columns: ["Year", "Bill"],
      rows: [
        [2020, 1000],
        [2021, 1100],
        [2022, 1210],
      ],
    };
    const [trend] = computeInsights(table, profileTable(table));
    expect(trend?.title).toBe("Bill rose 21.0% from 2020 to 2022");
    expect(trend?.body).toContain("about +10.0% a year");
    expect(trend?.stats.chart?.points).toHaveLength(3);
  });

  it("ranks categories and flags outliers", () => {
    const table: ParsedTable = {
      columns: ["Neighborhood", "Households"],
      rows: [
        ["A", 10],
        ["B", 12],
        ["C", 11],
        ["D", 13],
        ["E", 12],
        ["F", 90],
      ],
    };
    const insights = computeInsights(table, profileTable(table));
    expect(insights[0]?.title).toBe("F leads on households");
    expect(insights[0]?.body).toContain("F: 90, or 60.8% of the total");
    expect(insights[1]?.body).toContain("the largest is F at 90");
  });
});
