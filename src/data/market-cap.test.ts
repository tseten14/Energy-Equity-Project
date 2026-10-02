/** Historical valuations must not use shares reported after the stock-price month. */
import { describe, expect, it } from "vitest";

import { marketCapForMonth } from "./market-cap";

describe("marketCapForMonth", () => {
  const shares = [
    { end: "2024-12-31", value: 200_000_000 },
    { end: "2025-03-31", value: 210_000_000 },
  ];

  it("uses the latest share count available by month end", () => {
    expect(marketCapForMonth("2025-02-01", 100, shares)).toEqual({
      value: 20_000_000_000,
      sharesAsOf: "2024-12-31",
    });
    expect(marketCapForMonth("2025-03-01", 100, shares)).toEqual({
      value: 21_000_000_000,
      sharesAsOf: "2025-03-31",
    });
  });

  it("omits months before the first reported count", () => {
    expect(marketCapForMonth("2024-11-01", 100, shares)).toBeNull();
  });
});
