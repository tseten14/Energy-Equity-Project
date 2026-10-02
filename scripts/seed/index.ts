/**
 * Fetches every verified dataset from its public source and loads it into Supabase.
 *
 *   npm run seed                 upsert with SUPABASE_URL + SUPABASE_SECRET_KEY from .env
 *   npm run seed -- --sql        write scripts/seed/.cache/seed.sql instead (for the SQL editor)
 *   npm run seed -- --only=eia   run a single bundle (financial, eia, shutoffs, lead, pulse)
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { createClient } from "@supabase/supabase-js";

import type { Database } from "../../src/server/database.types";
import { eiaBundle } from "./eia861";
import { financialBundle } from "./financial";
import { leadBundle } from "./lead";
import { CACHE_DIR, RETRIEVED_AT, type SeedBundle } from "./lib";
import { pulseBundle } from "./pulse";
import { shutoffsBundle } from "./shutoffs";

const bundles: Record<string, () => Promise<SeedBundle>> = {
  financial: financialBundle,
  eia: eiaBundle,
  shutoffs: shutoffsBundle,
  lead: leadBundle,
  pulse: pulseBundle,
};

const args = process.argv.slice(2);
const only = args.find((a) => a.startsWith("--only="))?.split("=")[1];
const emitSql = args.includes("--sql");

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

async function upsert(bundles: SeedBundle[]) {
  if (typeof process.loadEnvFile === "function") process.loadEnvFile();
  const { SUPABASE_URL, SUPABASE_SECRET_KEY } = process.env;
  if (!SUPABASE_URL || !SUPABASE_SECRET_KEY) {
    throw new Error("Set SUPABASE_URL and SUPABASE_SECRET_KEY in .env, or run with --sql.");
  }
  const db = createClient<Database>(SUPABASE_URL, SUPABASE_SECRET_KEY, {
    auth: { persistSession: false },
  });

  for (const bundle of bundles) {
    const { data: sources, error: sourceError } = await db
      .from("sources")
      .upsert(
        bundle.sources.map((s) => ({
          slug: s.slug,
          publisher: s.publisher,
          title: s.title,
          url: s.url,
          data_year: s.dataYear,
          retrieved_at: RETRIEVED_AT,
        })),
        { onConflict: "slug" },
      )
      .select("id, slug");
    if (sourceError) throw sourceError;
    const sourceId = new Map(sources.map((s) => [s.slug, s.id]));

    const { error: measureError } = await db.from("measures").upsert(
      bundle.measures.map((m) => ({
        slug: m.slug,
        side: m.side,
        label: m.label,
        unit: m.unit,
        definition: m.definition,
        annual_agg: m.annualAgg,
        source_id: sourceId.get(m.sourceSlug) ?? null,
      })),
    );
    if (measureError) throw measureError;

    // Replace each measure's observations so removed source rows don't linger.
    for (const measure of bundle.measures) {
      const { error } = await db.from("observations").delete().eq("measure_slug", measure.slug);
      if (error) throw error;
    }
    const rows = bundle.observations.map(toRow);
    for (let i = 0; i < rows.length; i += 1000) {
      const { error } = await db.from("observations").insert(rows.slice(i, i + 1000));
      if (error) throw error;
    }
    console.log(`✓ ${bundle.name}`);
  }
}

function toRow(o: SeedBundle["observations"][number]) {
  return {
    measure_slug: o.measureSlug,
    period: o.period,
    grain: o.grain,
    dimension: o.dimension ?? "",
    geo_id: o.geoId ?? "",
    value: o.value,
  };
}

const lit = (value: string | number | null) =>
  value === null
    ? "null"
    : typeof value === "number"
      ? String(value)
      : `'${value.replaceAll("'", "''")}'`;

function toSql(bundles: SeedBundle[]): string {
  const statements: string[] = ["begin;"];
  for (const bundle of bundles) {
    for (const s of bundle.sources) {
      statements.push(
        `insert into sources (slug, publisher, title, url, data_year, retrieved_at) values (${[s.slug, s.publisher, s.title, s.url, s.dataYear, RETRIEVED_AT].map(lit).join(", ")})` +
          ` on conflict (slug) do update set publisher = excluded.publisher, title = excluded.title, url = excluded.url, data_year = excluded.data_year, retrieved_at = excluded.retrieved_at;`,
      );
    }
    for (const m of bundle.measures) {
      statements.push(
        `insert into measures (slug, side, label, unit, definition, annual_agg, source_id) values (${[m.slug, m.side, m.label, m.unit, m.definition, m.annualAgg].map(lit).join(", ")}, (select id from sources where slug = ${lit(m.sourceSlug)}))` +
          ` on conflict (slug) do update set side = excluded.side, label = excluded.label, unit = excluded.unit, definition = excluded.definition, annual_agg = excluded.annual_agg, source_id = excluded.source_id;`,
        `delete from observations where measure_slug = ${lit(m.slug)};`,
      );
    }
    const rows = bundle.observations.map(toRow);
    for (let i = 0; i < rows.length; i += 500) {
      const values = rows
        .slice(i, i + 500)
        .map(
          (r) =>
            `(${[r.measure_slug, r.period, r.grain, r.dimension, r.geo_id, r.value].map(lit).join(", ")})`,
        );
      statements.push(
        `insert into observations (measure_slug, period, grain, dimension, geo_id, value) values\n${values.join(",\n")};`,
      );
    }
  }
  statements.push("commit;");
  return statements.join("\n");
}

const collected = await collect();
if (emitSql) {
  mkdirSync(CACHE_DIR, { recursive: true });
  const path = join(CACHE_DIR, only ? `seed-${only}.sql` : "seed.sql");
  writeFileSync(path, toSql(collected));
  console.log(`Wrote ${path}`);
} else {
  await upsert(collected);
}
