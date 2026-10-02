/** Estimate month-end market capitalization using only shares reported by that month. */
export interface ShareCount {
  end: string;
  value: number;
}

export function marketCapForMonth(
  period: string,
  sharePrice: number,
  shares: readonly ShareCount[],
): { value: number; sharesAsOf: string } | null {
  const year = Number(period.slice(0, 4));
  const month = Number(period.slice(5, 7));
  const monthEnd = new Date(Date.UTC(year, month, 0)).toISOString().slice(0, 10);
  const known = shares.filter((row) => row.end <= monthEnd).at(-1);
  return known
    ? { value: Math.round(sharePrice * known.value * 100) / 100, sharesAsOf: known.end }
    : null;
}
