/** The publisher, year, and link shown under a chart. */
import type { Measure } from "@/data/types";

export interface Citation {
  source: string;
  year: string;
  href?: string | undefined;
}

export function citation(measure: Measure): Citation {
  return {
    source: measure.source?.publisher ?? "Source not recorded",
    year: measure.source?.dataYear ?? "Unknown",
    href: measure.source?.url,
  };
}
