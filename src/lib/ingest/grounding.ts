const NUMBER = /\d[\d,]*(?:\.\d+)?/g;

const isYear = (n: number) => Number.isInteger(n) && n >= 1900 && n <= 2100;

export function numbersIn(text: string): number[] {
  return (text.match(NUMBER) ?? []).map((n) => Number(n.replace(/,/g, "")));
}

/** True when `n` is one of `known`, allowing for rounding but never for a different year. */
function isGrounded(n: number, known: readonly number[]): boolean {
  return known.some(
    (k) =>
      n === k ||
      n === Math.round(k) ||
      n === Number(k.toFixed(1)) ||
      (!isYear(n) && Math.abs(k) >= 100 && Math.abs(n - k) / Math.abs(k) < 0.01),
  );
}

/**
 * Keeps only the sentences whose numbers all appear in the source material,
 * so AI-written text cannot introduce figures the computed statistics do not support.
 */
export function groundedOnly(sentences: readonly string[], source: string): string[] {
  const known = numbersIn(source);
  return sentences.filter((s) => numbersIn(s).every((n) => isGrounded(n, known)));
}
