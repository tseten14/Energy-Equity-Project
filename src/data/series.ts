/**
 * Turns observations into yearly points and measures how two yearly series move together.
 * Used by the landing-page findings and upload analysis.
 */
import type { AnnualAgg, Grain, Observation, YearPoint } from "./types";

const PERIODS_PER_YEAR: Record<Grain, number> = { month: 12, quarter: 4, year: 1 };

export const yearOf = (period: string) => Number(period.slice(0, 4));

/**
 * Collapses one series (a single dimension and place) into yearly values.
 * A year only counts when every period in it was reported, so partial years never look like drops.
 */
export function toYearly(observations: readonly Observation[], agg: AnnualAgg): YearPoint[] {
  const byYear = new Map<number, Observation[]>();
  for (const o of observations) {
    const year = yearOf(o.period);
    byYear.set(year, [...(byYear.get(year) ?? []), o]);
  }

  const points: YearPoint[] = [];
  for (const [year, rows] of byYear) {
    const grain = rows[0]?.grain ?? "year";
    if (new Set(rows.map((r) => r.period)).size < PERIODS_PER_YEAR[grain]) continue;
    const sorted = [...rows].sort((a, b) => a.period.localeCompare(b.period));
    const values = sorted.map((r) => r.value);
    const total = values.reduce((sum, v) => sum + v, 0);
    const value =
      agg === "sum" ? total : agg === "mean" ? total / values.length : (values.at(-1) ?? 0);
    points.push({ year, value });
  }
  return points.sort((a, b) => a.year - b.year);
}

/** Pearson correlation coefficient, or null when there are fewer than `minPoints` pairs or no variation. */
export function pearson(
  xs: readonly number[],
  ys: readonly number[],
  minPoints = 4,
): number | null {
  const n = Math.min(xs.length, ys.length);
  if (n < minPoints) return null;
  const mean = (v: readonly number[]) => v.slice(0, n).reduce((s, x) => s + x, 0) / n;
  const mx = mean(xs);
  const my = mean(ys);
  let cov = 0;
  let vx = 0;
  let vy = 0;
  for (let i = 0; i < n; i++) {
    const dx = xs[i]! - mx;
    const dy = ys[i]! - my;
    cov += dx * dy;
    vx += dx * dx;
    vy += dy * dy;
  }
  return vx === 0 || vy === 0 ? null : cov / Math.sqrt(vx * vy);
}

export interface AlignedYear {
  year: number;
  a: number;
  b: number;
}

/** Years present in both series, in order. */
export function alignYears(a: readonly YearPoint[], b: readonly YearPoint[]): AlignedYear[] {
  const bByYear = new Map(b.map((p) => [p.year, p.value]));
  return a.flatMap((p) => {
    const other = bByYear.get(p.year);
    return other === undefined ? [] : [{ year: p.year, a: p.value, b: other }];
  });
}

export function describeCorrelation(r: number): string {
  const strength = Math.abs(r) >= 0.7 ? "strong" : Math.abs(r) >= 0.4 ? "moderate" : "weak";
  if (strength === "weak") return "little or no consistent relationship";
  return `a ${strength} tendency to move ${r > 0 ? "in the same direction" : "in opposite directions"}`;
}
