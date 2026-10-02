/**
 * Optional plain-language summary of an upload.
 * Returns null when no API key is set or the request fails, so the rest of the page still saves.
 */
import "@tanstack/react-start/server-only";

import { createGateway, generateText, Output } from "ai";
import { z } from "zod";

import { MEASURE_SLUGS, type Measure, type MeasureSlug } from "@/data/types";
import { groundedOnly } from "@/lib/ingest/grounding";
import type { ComputedInsight } from "@/lib/ingest/insights";
import type { DatasetProfile } from "@/lib/ingest/profile";

import { readEnv } from "./env";

const DEFAULT_MODEL = "openai/gpt-5.4-mini";

const summarySchema = z.object({
  headline: z.string().describe("One plain sentence: the most useful takeaway from this dataset."),
  bullets: z.array(z.string()).describe("Two to four short findings, each one sentence."),
  relatedMeasures: z
    .array(z.enum(MEASURE_SLUGS))
    .describe("Slugs of the site measures this dataset is most relevant to, if any."),
  caveats: z.array(z.string()).describe("Up to two limits a reader should keep in mind."),
});

export interface AiSummary {
  headline: string;
  bullets: string[];
  relatedMeasure: MeasureSlug | null;
  caveats: string[];
}

const INSTRUCTIONS = `You explain community-uploaded datasets on a public website about DTE Energy, a Michigan utility.
Readers are not experts: write short, plain sentences at about an eighth-grade reading level.
Use only the facts in the input. Do not state any number, year, or name that is not in the input.
Never claim that one thing causes another; correlations are patterns only.
The data is unverified and uploaded by the public, so do not present it as official.`;

/** An AI-written summary of the computed statistics, or null when no AI key is configured or the call fails. */
export async function summarizeDataset(input: {
  name: string;
  profile: DatasetProfile;
  insights: ComputedInsight[];
  /** Measures whose keywords appear in the dataset's name or columns. */
  topics: MeasureSlug[];
  measures: Measure[];
}): Promise<AiSummary | null> {
  const apiKey = readEnv("AI_GATEWAY_API_KEY");
  if (!apiKey) return null;

  const facts = JSON.stringify({
    dataset: input.name,
    rows: input.profile.rowCount,
    columns: input.profile.columns.map((c) => ({
      name: c.name,
      kind: c.kind,
      ...(c.numeric ? { median: c.numeric.median, min: c.numeric.min, max: c.numeric.max } : {}),
      ...(c.range ? { range: c.range } : {}),
    })),
    findings: input.insights.map((i) => ({ title: i.title, detail: i.body })),
    keywordMatches: input.topics,
    siteMeasures: input.measures.map((m) => ({
      slug: m.slug,
      label: m.label,
      definition: m.definition,
    })),
  });

  try {
    const gateway = createGateway({ apiKey });
    const { output } = await generateText({
      model: gateway(readEnv("AI_MODEL") ?? DEFAULT_MODEL),
      instructions: INSTRUCTIONS,
      prompt: `Summarize this dataset for the site's readers and say how it relates to the site's measures.\n\n${facts}`,
      output: Output.object({ schema: summarySchema }),
      abortSignal: AbortSignal.timeout(20_000),
    });

    const [headline] = groundedOnly([output.headline], facts);
    const bullets = groundedOnly(output.bullets, facts).slice(0, 4);
    if (!headline || bullets.length === 0) return null;
    return {
      headline,
      bullets,
      relatedMeasure: output.relatedMeasures[0] ?? null,
      caveats: groundedOnly(output.caveats, facts).slice(0, 2),
    };
  } catch (error) {
    console.error("AI summary failed", error);
    return null;
  }
}
