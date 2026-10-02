/** Checks that each accepted file format becomes columns and rows, and that over-limit files are rejected. */
import * as XLSX from "xlsx";
import { describe, expect, it } from "vitest";

import { IngestError, LIMITS, detectFormat, parseText, parseWorkbook } from "./parse";

describe("detectFormat", () => {
  it("maps extensions to formats", () => {
    expect(detectFormat("bills.CSV")).toBe("csv");
    expect(detectFormat("a.b.tab")).toBe("tsv");
    expect(detectFormat("sheet.xls")).toBe("xlsx");
    expect(detectFormat("events.jsonl")).toBe("ndjson");
    expect(detectFormat("notes.txt")).toBeNull();
  });
});

describe("parseText", () => {
  it("reads CSV with a byte-order mark, quotes, and blank cells", () => {
    const table = parseText(
      '\uFEFFyear,amount,note\n2023,"1,200",\n2024,1300,"said ""hi"""\n',
      "csv",
    );
    expect(table.columns).toEqual(["year", "amount", "note"]);
    expect(table.rows).toEqual([
      ["2023", "1,200", null],
      ["2024", "1300", 'said "hi"'],
    ]);
  });

  it("names blank and repeated headers", () => {
    const table = parseText("a\t\ta\n1\t2\t3", "tsv");
    expect(table.columns).toEqual(["a", "Column 2", "a (2)"]);
  });

  it("reads a JSON array or an object holding one", () => {
    const direct = parseText('[{"county":"Wayne","n":3},{"county":"Oakland","x":true}]', "json");
    expect(direct.columns).toEqual(["county", "n", "x"]);
    expect(direct.rows).toEqual([
      ["Wayne", 3, null],
      ["Oakland", null, true],
    ]);
    expect(parseText('{"meta":1,"data":[{"a":1}]}', "json").rows).toEqual([[1]]);
  });

  it("reads NDJSON and reports the bad line", () => {
    expect(parseText('{"a":1}\n\n{"a":2}\n', "ndjson").rows).toEqual([[1], [2]]);
    expect(() => parseText('{"a":1}\n{oops', "ndjson")).toThrow("Line 2");
  });

  it("rejects empty and oversized files with readable errors", () => {
    expect(() => parseText("only,a,header\n", "csv")).toThrow(IngestError);
    const wide = Array.from({ length: LIMITS.columns + 1 }, (_, i) => `c${i}`).join(",");
    expect(() => parseText(`${wide}\n${wide}`, "csv")).toThrow(/limit is 60/);
  });

  it("truncates very long cells", () => {
    const table = parseText(`a\n${"x".repeat(LIMITS.cellLength + 10)}`, "csv");
    expect(String(table.rows[0]?.[0]).length).toBe(LIMITS.cellLength);
  });
});

describe("parseWorkbook", () => {
  it("reads the first sheet with numbers and dates", async () => {
    const sheet = XLSX.utils.aoa_to_sheet([
      ["Month", "Bills"],
      [new Date(Date.UTC(2024, 0, 15)), 120.5],
      [new Date(Date.UTC(2024, 1, 15)), 98],
    ]);
    const book = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(book, sheet, "Data");
    const buffer = XLSX.write(book, { type: "array", bookType: "xlsx" }) as ArrayBuffer;

    const table = await parseWorkbook(buffer);
    expect(table.columns).toEqual(["Month", "Bills"]);
    expect(table.rows[0]?.[1]).toBe(120.5);
    expect(String(table.rows[0]?.[0])).toMatch(/^2024-01-1[45]$/);
  });
});
