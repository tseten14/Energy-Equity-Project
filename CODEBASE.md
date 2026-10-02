# Codebase guide

Read this before changing the app. [README.md](README.md) explains what the site shows and where the numbers come from. This file explains how the code is put together.

The repository is [tseten14/Energy-Equity-Project](https://github.com/tseten14/Energy-Equity-Project). The package name in `package.json` is `dte-plain-terms`. The site title is **DTE, in Plain Terms**.

## Read these first

| Order | File                       | Why                                              |
| ----- | -------------------------- | ------------------------------------------------ |
| 1     | `README.md`                | Pages, sources, uploads, and how to run the site |
| 2     | This file                  | Stack, request flow, and where to edit           |
| 3     | `src/routes/README.md`     | Which file is which URL                          |
| 4     | `src/data/types.ts`        | The shape of a measure and an observation        |
| 5     | `src/server/snapshot.ts`   | How those observations are stored on disk        |
| 6     | `src/data/measures.ts`     | How a page's server function shapes the snapshot |
| 7     | `src/routes/household.tsx` | A typical page: loader, query, charts            |

After that, open the page you are changing and follow its imports.

## Technical stack

The app is one TypeScript project. The browser and the server are the same React tree. There is no Python, no separate API service, and no database.

| Layer              | Choice                                              | What it does here                                                                           |
| ------------------ | --------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| Language           | TypeScript 5.8, target ES2022                       | All application code, including the seed scripts                                            |
| UI                 | React 19                                            | Pages and charts                                                                            |
| Routing and server | TanStack Start 1.168 and TanStack Router 1.170      | File routes, server-side rendering, server functions                                        |
| Server cache       | TanStack Query 5                                    | Loaders and components share one cache per request or page load                             |
| Build              | Vite 8 and `@vitejs/plugin-react`                   | Dev server on port 8080, and the production bundle                                          |
| Deploy bundle      | Nitro `3.0.260603-beta`, preset `cloudflare-module` | Production build only. `npm run dev` stays on Node                                          |
| Styles             | Tailwind CSS 4, via `@tailwindcss/vite`             | Tokens live in `src/styles.css`                                                             |
| Charts             | Recharts 2.15                                       | Lines, bars, and sparklines                                                                 |
| Map                | `d3-geo` and `topojson-client`                      | Census-tract map. Not a Python map library                                                  |
| Validation         | Zod 3                                               | Upload payloads and the Compare page URL                                                    |
| Spreadsheets       | Papa Parse, SheetJS (`xlsx`)                        | CSV, TSV, JSON, NDJSON, and Excel uploads. Excel is imported only when a workbook is opened |
| Optional summary   | Vercel AI SDK (`ai` 7)                              | One model call per upload, only if `AI_GATEWAY_API_KEY` is set                              |
| Seed runner        | `tsx`                                               | `npm run seed` runs `scripts/seed/index.ts`                                                 |
| Tract geometry     | `mapshaper`                                         | Used only while seeding the map, not in the website                                         |
| Tests              | Vitest 5                                            | `src/lib/ingest/**/*.test.ts`                                                               |
| Lint and format    | ESLint 9, typescript-eslint, Prettier 3             | `npm run lint`, `npm run format`                                                            |
| Lockfile           | `bun.lock`                                          | Committed. Do not commit `package-lock.json`                                                |

Install and run with npm. Node is required. The commands are listed in the README.

### What the pages actually use

`src/components/ui/` is a shadcn/Radix kit (buttons, dialogs, menus, calendar, carousel, and so on). The pages do not import those widgets. The only piece the charts use is `src/components/ui/chart.tsx`, which wraps Recharts and exposes `--color-*` variables.

These packages are present because that kit imports them. The site's own pages do not call them: Radix primitives, `class-variance-authority`, `cmdk`, `vaul`, `sonner`, `embla-carousel-react`, `react-hook-form`, `react-day-picker`, `input-otp`, `date-fns`, and `lucide-react`.

Icons on the real pages are not from an icon font. The header mark is the letter D.

## How a request is handled

```text
Browser
  -> Vite dev server, or the Nitro bundle in production
    -> src/server.ts          catches a crashed render and returns HTML
      -> TanStack Start
        -> src/start.ts       error page + same-origin check on server functions
          -> src/router.tsx   one QueryClient, route tree from src/routeTree.gen.ts
            -> src/routes/__root.tsx    header, footer, 404, error screen
              -> the page file
```

`src/routeTree.gen.ts` is generated. Do not edit it. Saving a route file regenerates it.

A page file exports `Route` from `createFileRoute`. The household page is the pattern to copy:

1. `head` sets the document title and description.
2. `loader` calls `context.queryClient.ensureQueryData(...)` so the data exists before the component renders.
3. The component calls `useSuspenseQuery` with the same query from `src/data/queries.ts`.
4. The query function is a server function created with `createServerFn` in `src/data/measures.ts` or `src/data/datasets.ts`.
5. That function reads `src/server/measures.ts` or `src/server/datasets.ts`.

Server functions run on the server even though the page imports them. The browser receives the returned JSON. Do not pass secrets, file paths, or the raw snapshot through a return value that the page does not need.

### Server-only code

Files under `src/server/` start with:

```ts
import "@tanstack/react-start/server-only";
```

`vite.config.ts` fails the build if client code imports `src/server/**` or the `server-only` package name. TanStack Start does not use the Next.js `server-only` package. ESLint rejects that import on purpose.

`src/server.ts` is the server entry. It is not a folder. The folder is `src/server/`.

`src/start.ts` exists, so TanStack Start does not install its default middleware. The file adds two pieces back: a catch that renders `src/lib/error-page.ts`, and CSRF protection on server functions. If you edit `src/start.ts`, keep the CSRF middleware.

## Data model

There is no database. Verified figures live in `src/server/data/verified.json`, which `npm run seed` writes and the server imports.

An observation tuple is:

```text
[measure, period, grain, dimension, geoId, value]
```

| Field       | Meaning                                                                                                  |
| ----------- | -------------------------------------------------------------------------------------------------------- |
| `measure`   | One of the slugs in `MEASURE_SLUGS` in `src/data/types.ts`                                               |
| `period`    | `YYYY-MM-DD`, the first day of that month, quarter, or year                                              |
| `grain`     | `month`, `quarter`, or `year`                                                                            |
| `dimension` | A breakdown such as `residential`, `electric`, or an income band. Empty when the figure has no breakdown |
| `geoId`     | Census tract GEOID, a state FIPS code, or empty for an area-wide figure                                  |
| `value`     | The number                                                                                               |

`src/server/measures.ts` loads that file once, joins each measure to its source, and sorts observations. `fetchObservations(slug, filter)` is the read API. `geo: "none"` keeps area-wide rows. `geo: "any"` keeps rows that have a place.

`src/data/series.ts` collapses a series into years. A year is kept only when every period in it was reported, so a half year never looks like a drop. `annualAgg` on the measure says whether months are summed, averaged, or reduced to the last value. Correlation uses Pearson's r and is omitted unless two series share at least four years (`MIN_OVERLAP_YEARS` in `src/data/compare.ts`).

Labels that a reader sees, such as income-band names and county names, are in `src/data/labels.ts`. The snapshot stores keys, not sentences.

### Adding a verified series

1. Teach a seed bundle in `scripts/seed/` to emit the measure and its observations.
2. Add the slug to `MEASURE_SLUGS` in `src/data/types.ts`.
3. If a page should show it, shape it in `src/data/measures.ts` and add a query in `src/data/queries.ts`.
4. Render it from the route. Format the number with `formatValue` in `src/lib/format.ts`, and show the source with `citation` in `src/lib/citation.ts`.
5. Run `npm run seed` and check the sentence on the page against the source document.

Do not invent a missing year. Leave it blank.

## Charts

| Component      | File                                      | Used for                                                                  |
| -------------- | ----------------------------------------- | ------------------------------------------------------------------------- |
| `TrendChart`   | `src/components/charts/trend-chart.tsx`   | Line and bar charts on Household, Financials, Compare, and upload results |
| `Sparkline`    | `src/components/charts/sparkline.tsx`     | The small lines in the Financials summary cards                           |
| `CategoryBars` | `src/components/charts/category-bars.tsx` | Energy burden by income. HTML bars, not Recharts                          |
| `TractMap`     | `src/components/charts/tract-map.tsx`     | Household energy burden by census tract                                   |

`TrendChart` passes axes to Recharts as an array. A React fragment is invisible to Recharts 2 under React 19, and the axes disappear. Keep that array.

Chart colors are the `--chart-*` tokens in `src/styles.css`. Household series use the brick `--chart-1`. Company series use the teal `--chart-2`. The map uses `--chart-seq-1` through `--chart-seq-6`.

`DataCard`, `SourceLine`, `SectionIntro`, and `MeasureCard` in `src/components/data-card.tsx` are the frame around a figure: title, one-line takeaway, chart, and source.

## Uploads

Parsing starts in the browser on `src/routes/data.index.tsx`, then `ingestDataset` in `src/data/datasets.ts` checks the body again with Zod. Limits live in `src/lib/ingest/limits.ts` and are imported by both sides. That file must stay free of Papa Parse and SheetJS so those libraries are not pulled into every page.

Pipeline, all plain functions in `src/lib/ingest/`:

| Module         | Job                                                                 |
| -------------- | ------------------------------------------------------------------- |
| `parse.ts`     | File bytes to columns and rows                                      |
| `profile.ts`   | Column kinds: number, year, date, county, tract, category           |
| `insights.ts`  | Trend, ranking, and distribution text plus chart points             |
| `relate.ts`    | Match years, counties, and tracts to the verified series            |
| `grounding.ts` | Drop model sentences that contain a number the facts do not support |

`src/server/ai-insights.ts` calls the model. No key, a timeout, or a bad response means the upload is still saved without that paragraph.

`src/server/datasets.ts` writes `.data/uploads/<id>.json` and `<id>.rows.json`. The detail file is written second, so a listing never points at a missing table. The 10-uploads-an-hour limit is an in-memory map of timestamps. It resets when the process restarts, and it is never written to disk.

Those files work in `npm run dev` because the server is Node. The Cloudflare build has no writable disk, so uploads need another store before they can work in production. Verified pages do not need that store.

`/data/$datasetId` sets `noindex`. An id that is not a UUID, or a UUID with no file, renders the 404 page.

## Seed scripts

`scripts/seed/index.ts` runs the bundles and merges them into the snapshot. `--only=<bundle>` replaces just that bundle's measures.

| File                        | Bundle                                                                                  |
| --------------------------- | --------------------------------------------------------------------------------------- |
| `scripts/seed/financial.ts` | SEC XBRL dividends and revenue growth, Yahoo month-end stock price, transcribed CEO pay |
| `scripts/seed/eia861.ts`    | EIA-861 customer class totals and the service counties                                  |
| `scripts/seed/shutoffs.ts`  | Reads `scripts/seed/data/dte-shutoffs.json`                                             |
| `scripts/seed/lead.ts`      | LEAD 2022 burden and `public/geo/dte-tracts.topo.json`                                  |
| `scripts/seed/pulse.ts`     | Household Pulse, Michigan and the U.S.                                                  |
| `scripts/seed/lib.ts`       | Download cache, rounding, and the `SeedBundle` type                                     |

CEO pay and shutoff counts are transcribed. Change `scripts/seed/data/dte-ceo-pay.json` or `dte-shutoffs.json` only after checking the filing. Downloads are cached in `scripts/seed/.cache/`, which git ignores.

`verified.json`, the seed JSON files, and `public/geo/*.json` are listed in `.prettierignore` so a format run does not reflow them.

## Styling

`src/styles.css` is Tailwind 4. Colors are `oklch` tokens on `:root`, then exposed to Tailwind through `@theme inline`. Components use token classes (`bg-background`, `text-foreground`, `bg-primary`) rather than raw color values.

Fonts are loaded in `src/routes/__root.tsx`: Fraunces for headings (`font-display`) and Public Sans for text.

Layout width is `max-w-6xl` with horizontal padding. The header and footer are `src/components/site-header.tsx` and `src/components/site-footer.tsx`.

## Conventions

TypeScript is strict. In particular:

- `noUncheckedIndexedAccess` is on, so `array[i]` can be undefined.
- `exactOptionalPropertyTypes` is on, so an optional field is `T | undefined` only when the type says so.
- `noPropertyAccessFromIndexSignature` is on, so index signatures use `obj["key"]`.

Path alias `@/` maps to `src/`. Both `tsconfig.json` and `vite.config.ts` set it. Tests get the same alias from `vitest.config.ts`, which is separate so Vitest does not load the app plugins.

Prettier: width 100, double quotes, semicolons, trailing commas. ESLint turns Prettier failures into lint errors.

Comments say why a line exists. A file comment says what the module is for. Do not restate the next statement.

## Environment

`.env` is gitignored. `.env.example` lists the only variables:

| Name                 | Required | Effect                                                            |
| -------------------- | -------- | ----------------------------------------------------------------- |
| `AI_GATEWAY_API_KEY` | No       | Enables the upload summary. Empty means skip it                   |
| `AI_MODEL`           | No       | Gateway model id, `provider/model`. Default `openai/gpt-5.4-mini` |

`vite.config.ts` parses `.env` and assigns onto `process.env` because a Vite restart keeps the process, and Node will not replace a variable that is already set. Server functions read `process.env` through `src/server/env.ts`. Only `VITE_`-prefixed names are exposed to the browser, and this app does not use any.

## Checks

```sh
npm test
npm run typecheck
npm run lint
npm run build
```

Tests cover ingest only: parsing, column kinds, findings, the match to verified series, and grounding. They do not render pages. After a UI change, load the affected route in the browser.

`npm run build` must succeed before a deploy. It is the check that client code did not import the server.

## Limits to remember

- Verified data changes only when someone runs `npm run seed` and commits the new `verified.json`.
- Uploads and the hourly limit exist only in the local Node process.
- A correlation on Compare or an upload page is a pattern over overlapping years. The copy says it is not a cause.
- Community numbers are labeled unverified. Do not present them as agency figures.
- Do not rewrite published git history. No force push, and no rebase or amend of commits that are already on the remote.
