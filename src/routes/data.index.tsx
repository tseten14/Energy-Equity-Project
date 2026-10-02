/**
 * Upload page. Parsing happens in the browser so a bad file fails before it is sent.
 * The server analyzes the table and redirects to the results page.
 */
import { useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { Link, createFileRoute, useNavigate } from "@tanstack/react-router";
import { useId, useState, type DragEvent } from "react";

import { SectionIntro } from "../components/data-card";
import { PreviewTable } from "../components/preview-table";
import { ingestDataset, type DatasetSummary } from "../data/datasets";
import { recentDatasetsQuery } from "../data/queries";
import {
  IngestError,
  LIMITS,
  parseFile,
  type DatasetFormat,
  type ParsedTable,
} from "../lib/ingest/parse";
import { cn } from "../lib/utils";

const title = "Your data — upload a file and see how it relates | DTE, in Plain Terms";
const description =
  "Upload a CSV, Excel or JSON file. We describe what's in it and show how it lines up with verified data on DTE customers and finances.";

export const Route = createFileRoute("/data/")({
  head: () => ({
    meta: [
      { title },
      { name: "description", content: description },
      { property: "og:title", content: title },
      { property: "og:description", content: description },
    ],
  }),
  loader: ({ context }) => context.queryClient.ensureQueryData(recentDatasetsQuery()),
  component: YourData,
});

const ACCEPT = ".csv,.tsv,.tab,.xlsx,.xls,.json,.ndjson,.jsonl";

function YourData() {
  const { data: recent } = useSuspenseQuery(recentDatasetsQuery());

  return (
    <div className="bg-cream/60 py-16 sm:py-20">
      <div className="mx-auto max-w-6xl px-5 sm:px-8">
        <SectionIntro
          eyebrow="Your data"
          title="Bring your own numbers."
          lead="Upload a spreadsheet about bills, shutoffs, neighborhoods or anything else related to energy costs. We'll describe what's in it and show how it lines up with the verified data on this site."
        />

        <div className="mt-10 grid gap-6 lg:grid-cols-12">
          <div className="lg:col-span-8">
            <Uploader />
          </div>
          <aside className="space-y-6 lg:col-span-4">
            <div className="rounded-2xl bg-highlight/25 p-6 ring-1 ring-highlight/40">
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-foreground/60">
                Before you upload
              </p>
              <ul className="mt-3 space-y-2 text-sm text-foreground/80">
                <li>
                  <strong>Don't upload personal information</strong> such as names, addresses, phone
                  numbers or account numbers. Uploads are public.
                </li>
                <li>Uploads are labeled as community data and are not checked by us.</li>
                <li>
                  Up to {LIMITS.bytes / 1024 / 1024} MB, {LIMITS.rows.toLocaleString()} rows and{" "}
                  {LIMITS.columns} columns per file, and 10 uploads an hour.
                </li>
              </ul>
            </div>
            <div className="rounded-2xl bg-paper p-6 ring-1 ring-border">
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-foreground/55">
                What we look for
              </p>
              <ul className="mt-3 space-y-2 text-sm text-foreground/75">
                <li>
                  <strong>A year or date column</strong> to show trends, and to line your numbers up
                  with DTE prices, bills, shutoffs and finances.
                </li>
                <li>
                  <strong>A census tract (GEOID) or county column</strong> to compare places with
                  household energy burden.
                </li>
                <li>
                  <strong>Categories</strong> such as neighborhood or program, to rank them.
                </li>
              </ul>
            </div>
          </aside>
        </div>

        <RecentUploads datasets={recent} />
      </div>
    </div>
  );
}

type Parsed = ParsedTable & { format: DatasetFormat; fileName: string };

const defaultName = (fileName: string) =>
  fileName
    .replace(/\.[^.]+$/, "")
    .replace(/[_-]+/g, " ")
    .trim();

function errorMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : "";
  // Validation failures arrive as a JSON list of issues, which isn't meant for readers.
  if (!message || message.startsWith("[") || message.startsWith("{")) {
    return "We couldn't save this file. Check that it's within the limits and try again.";
  }
  return message;
}

function Uploader() {
  const inputId = useId();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [parsed, setParsed] = useState<Parsed | null>(null);
  const [name, setName] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [readError, setReadError] = useState<string | null>(null);
  const [reading, setReading] = useState(false);
  const [dragging, setDragging] = useState(false);

  const upload = useMutation({
    mutationFn: (file: Parsed) =>
      ingestDataset({
        data: {
          name: name.trim(),
          fileName: file.fileName,
          format: file.format,
          columns: file.columns,
          rows: file.rows,
        },
      }),
    onSuccess: async ({ id }) => {
      await queryClient.invalidateQueries({ queryKey: ["datasets"] });
      await navigate({ to: "/data/$datasetId", params: { datasetId: id } });
    },
  });

  async function choose(file: File | undefined) {
    if (!file) return;
    setReading(true);
    setReadError(null);
    setParsed(null);
    upload.reset();
    try {
      const table = await parseFile(file);
      setParsed({ ...table, fileName: file.name });
      setName(defaultName(file.name));
      setConfirmed(false);
    } catch (error) {
      setReadError(error instanceof IngestError ? error.message : "We couldn't read this file.");
    } finally {
      setReading(false);
    }
  }

  function drop(event: DragEvent) {
    event.preventDefault();
    setDragging(false);
    void choose(event.dataTransfer.files[0]);
  }

  const error = readError ?? (upload.isError ? errorMessage(upload.error) : null);

  return (
    <div className="rounded-2xl bg-paper p-6 ring-1 ring-border">
      <label
        htmlFor={inputId}
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={drop}
        className={cn(
          "grid cursor-pointer place-items-center rounded-xl border-2 border-dashed border-border px-6 py-12 text-center transition-colors hover:bg-cream",
          dragging && "border-primary bg-cream",
        )}
      >
        <span className="font-display text-xl font-semibold">
          {reading
            ? "Reading your file…"
            : parsed
              ? "Choose a different file"
              : "Drop a file here, or click to choose"}
        </span>
        <span className="mt-2 text-sm text-foreground/60">
          CSV, TSV, Excel (.xlsx), JSON or NDJSON
        </span>
        <input
          id={inputId}
          type="file"
          accept={ACCEPT}
          className="sr-only"
          onChange={(e) => {
            void choose(e.target.files?.[0]);
            e.target.value = "";
          }}
        />
      </label>

      {error ? (
        <p
          role="alert"
          className="mt-4 rounded-xl bg-primary/10 px-4 py-3 text-sm font-medium text-primary"
        >
          {error}
        </p>
      ) : null}

      {parsed ? (
        <form
          className="mt-6"
          onSubmit={(e) => {
            e.preventDefault();
            upload.mutate(parsed);
          }}
        >
          <p className="text-sm text-foreground/70">
            <span className="font-semibold text-foreground">{parsed.fileName}</span> ·{" "}
            {parsed.rows.length.toLocaleString()} rows · {parsed.columns.length} columns
          </p>
          <PreviewTable columns={parsed.columns} rows={parsed.rows.slice(0, 5)} className="mt-3" />

          <label className="mt-6 block">
            <span className="mb-2 block text-sm font-semibold">Name this dataset</span>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={120}
              required
              className="w-full rounded-full bg-cream px-4 py-3 text-sm ring-1 ring-border focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </label>
          <label className="mt-4 flex items-start gap-3 text-sm text-foreground/80">
            <input
              type="checkbox"
              checked={confirmed}
              onChange={(e) => setConfirmed(e.target.checked)}
              className="mt-0.5 size-4 accent-primary"
            />
            This file has no personal information, and I'm okay with it being public.
          </label>
          <button
            type="submit"
            disabled={!confirmed || !name.trim() || upload.isPending}
            className="mt-6 rounded-full bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {upload.isPending ? "Analyzing…" : "Analyze and save"}
          </button>
        </form>
      ) : null}
    </div>
  );
}

const uploadedOn = (iso: string) =>
  new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });

function RecentUploads({ datasets }: { datasets: DatasetSummary[] }) {
  return (
    <section className="mt-16" aria-labelledby="recent-uploads">
      <h2 id="recent-uploads" className="font-display text-2xl font-semibold">
        Recent community uploads
      </h2>
      {datasets.length === 0 ? (
        <p className="mt-3 text-sm text-foreground/60">
          Nothing has been uploaded yet. Yours could be the first.
        </p>
      ) : (
        <ul className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {datasets.map((d) => (
            <li key={d.id}>
              <Link
                to="/data/$datasetId"
                params={{ datasetId: d.id }}
                className="block h-full rounded-2xl bg-paper p-5 ring-1 ring-border transition-shadow hover:ring-primary"
              >
                <p className="text-xs font-semibold uppercase tracking-[0.12em] text-foreground/45">
                  Community upload · unverified
                </p>
                <p className="mt-2 font-display text-lg font-semibold leading-snug">{d.name}</p>
                <p className="mt-1 text-xs text-foreground/55">
                  {d.rowCount.toLocaleString()} rows · {d.columnCount} columns ·{" "}
                  {uploadedOn(d.createdAt)}
                </p>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
