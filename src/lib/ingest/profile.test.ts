/** Checks county, tract, and year detection, including names and codes that should not match. */
import { describe, expect, it } from "vitest";

import {
  countyFips,
  parseDate,
  parseNumber,
  profileColumn,
  profileTable,
  tractGeoid,
} from "./profile";

describe("value readers", () => {
  it("reads numbers the way people write them", () => {
    expect(parseNumber("$1,234.50")).toBe(1234.5);
    expect(parseNumber("12%")).toBe(12);
    expect(parseNumber("(300)")).toBe(-300);
    expect(parseNumber("1e3")).toBe(1000);
    expect(parseNumber("12 apples")).toBeNull();
    expect(parseNumber(true)).toBeNull();
  });

  it("reads ISO and US dates", () => {
    expect(parseDate("2024-05")).toBe("2024-05-01");
    expect(parseDate("2024-05-09T10:00:00Z")).toBe("2024-05-09");
    expect(parseDate("5/9/2024")).toBe("2024-05-09");
    expect(parseDate("2024-13-01")).toBeNull();
  });

  it("recognizes DTE-area counties and census tracts", () => {
    expect(countyFips("Wayne County")).toBe("26163");
    expect(countyFips("st. clair")).toBe("26147");
    expect(countyFips("26125")).toBe("26125");
    expect(countyFips("Kent")).toBeNull();
    expect(tractGeoid("1400000US26163500100")).toBe("26163500100");
    expect(tractGeoid(6037101110)).toBe("06037101110");
  });
});

describe("profileColumn", () => {
  it("infers column kinds", () => {
    expect(profileColumn("Year", [2019, 2020, 2021]).kind).toBe("year");
    expect(profileColumn("Month", ["2024-01-01", "2024-02-01"]).kind).toBe("date");
    expect(profileColumn("Amount", ["$10", "$20", null]).kind).toBe("number");
    expect(profileColumn("County", ["Wayne", "Oakland", "Macomb"]).kind).toBe("county");
    expect(profileColumn("county_name", ["Kent", "Ottawa", "Wayne"]).kind).toBe("county");
    expect(profileColumn("County population", [1749343, 1270017]).kind).toBe("number");
    expect(profileColumn("GEOID", ["26163500100", "26163500200"]).kind).toBe("tract");
    expect(profileColumn("Status", ["open", "closed", "open", "open"]).kind).toBe("category");
    expect(profileColumn("Empty", [null, null]).kind).toBe("empty");
  });

  it("does not mistake large totals for tracts", () => {
    expect(profileColumn("Sales", [15131396000, 15342223000, 14998001000]).kind).toBe("number");
  });

  it("summarizes numbers and categories", () => {
    const amount = profileColumn("Amount", [1, 2, 3, 4, null]);
    expect(amount).toMatchObject({ filled: 4, missing: 1 });
    expect(amount.numeric).toMatchObject({ min: 1, max: 4, median: 2.5, sum: 10 });
    const status = profileColumn("Status", ["open", "closed", "open"]);
    expect(status.top?.[0]).toEqual({ value: "open", count: 2 });
  });
});

describe("profileTable", () => {
  it("prefers a year column for the time axis", () => {
    const profile = profileTable({
      columns: ["Date", "Year", "Value"],
      rows: [
        ["2024-01-01", 2024, 1],
        ["2025-01-01", 2025, 2],
      ],
    });
    expect(profile.timeColumn).toBe("Year");
    expect(profile.rowCount).toBe(2);
  });
});
