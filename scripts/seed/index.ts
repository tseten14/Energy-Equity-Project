/**
 * Fetches every verified dataset from its public source and writes the snapshot the server reads.
 *
 *   npm run seed                 rebuild src/server/data/verified.json from every source
 *   npm run seed -- --only=eia   refresh a single bundle (financial, eia, shutoffs, lead, pulse)
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import type { VerifiedSnapshot } from "../../src/server/snapshot";
import { eiaBundle } from "./eia861";
import { financialBundle } from "./financial";
import { leadBundle } from "./lead";
import { RETRIEVED_AT, type SeedBundle } from "./lib";
import { pulseBundle } from "./pulse";
import { shutoffsBundle } from "./shutoffs";

const SNAPSHOT = join(
  dirname(fileURLToPath(import.meta.url)),
  "../../src/server/data/verified.json",
);

const bundles: Record<string, () => Promise<SeedBundle>> = {
  financial: financialBundle,
  eia: eiaBundle,
  shutoffs: shutoffsBundle,
  lead: leadBundle,
  pulse: pulseBundle,
};

const only = process.argv.find((a) => a.startsWith("--only="))?.split("=")[1];

async function collect(): Promise<SeedBundle[]> {
  const selected = only ? { [only]: bundles[only] } : bundles;
  const results: SeedBundle[] = [];
  for (const [key, build] of Object.entries(selected)) {
    if (!build)
      throw new Error(`Unknown bundle "${key}". Options: ${Object.keys(bundles).join(", ")}`);
    console.log(`→ ${key}`);
    const bundle = await build();
    console.log(`  ${bundle.measures.length} measures, ${bundle.observations.length} observations`);
    results.push(bundle);
  }
  return results;
}

const empty: VerifiedSnapshot = { sources: [], measures: [], observations: [] };

/** Replaces everything the new bundles cover and keeps the rest of the existing snapshot. */
function merge(existing: VerifiedSnapshot, fresh: SeedBundle[]): VerifiedSnapshot {
  const sourceSlugs = new Set(fresh.flatMap((b) => b.sources.map((s) => s.slug)));
  const measureSlugs = new Set<string>(fresh.flatMap((b) => b.measures.map((m) => m.slug)));
  return {
    sources: [
      ...existing.sources.filter((s) => !sourceSlugs.has(s.slug)),
      ...fresh.flatMap((b) => b.sources.map((s) => ({ ...s, retrievedAt: RETRIEVED_AT }))),
    ],
    measures: [
      ...existing.measures.filter((m) => !measureSlugs.has(m.slug)),
      ...fresh.flatMap((b) => b.measures),
    ],
    observations: [
      ...existing.observations.filter(([slug]) => !measureSlugs.has(slug)),
      ...fresh.flatMap((b) =>
        b.observations.map(
          (o) =>
            [o.measureSlug, o.period, o.grain, o.dimension ?? "", o.geoId ?? "", o.value] as const,
        ),
      ),
    ],
  };
}

const existing =
  only && existsSync(SNAPSHOT)
    ? (JSON.parse(readFileSync(SNAPSHOT, "utf8")) as VerifiedSnapshot)
    : empty;
const snapshot = merge(existing, await collect());
mkdirSync(dirname(SNAPSHOT), { recursive: true });
writeFileSync(SNAPSHOT, JSON.stringify(snapshot));
console.log(
  `Wrote ${SNAPSHOT}: ${snapshot.measures.length} measures, ${snapshot.observations.length} observations`,
);
