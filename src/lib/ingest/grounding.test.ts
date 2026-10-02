/** Checks that a sentence survives only when every number in it is already in the facts. */
import { describe, expect, it } from "vitest";

import { groundedOnly, numbersIn } from "./grounding";

describe("numbersIn", () => {
  it("reads numbers with commas and decimals", () => {
    expect(numbersIn("From 1,200 in 2020 to 21.5% and $3.4M")).toEqual([1200, 2020, 21.5, 3.4]);
  });
});

describe("groundedOnly", () => {
  const source =
    "Bill rose 21.0% from 2020 to 2022. It went from 1,000 to 1,210, about +10.0% a year.";

  it("keeps sentences whose numbers come from the source, allowing rounding", () => {
    expect(
      groundedOnly(["Bills rose about 21% between 2020 and 2022.", "No numbers here."], source),
    ).toHaveLength(2);
  });

  it("drops sentences with invented figures or years", () => {
    expect(groundedOnly(["Bills doubled to 2,400.", "This began in 2019."], source)).toEqual([]);
  });
});
