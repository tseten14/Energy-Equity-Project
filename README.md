# DTE, in Plain Terms

A public-interest website that puts what Michigan households pay and experience next to DTE Energy's own finances. Every figure on the site is sourced, dated, and written in plain language. Where a number is missing, the page says so.

The site has two kinds of data:

- **Verified data**, downloaded from public agencies and DTE's own filings, then bundled into the app.
- **Community uploads**. Anyone can add a spreadsheet. The site describes what is in it and lines it up with the verified series. Uploads are labeled unverified and are not checked.

This project is independent. It is not published by DTE Energy.

## Pages

| Page                 | URL           | What you see                                                                                                            |
| -------------------- | ------------- | ----------------------------------------------------------------------------------------------------------------------- |
| Home                 | `/`           | Four headline figures: energy burden, the residential price of electricity, shutoffs, and CEO pay                       |
| Household Experience | `/household`  | A census-tract map of energy burden, burden by income group, monthly shutoffs, and electricity prices by customer class |
| DTE Financials       | `/financials` | Month-end stock price, yearly dividends, revenue growth, and CEO total pay                                              |
| Compare              | `/compare`    | One household measure and one company measure on the same years, plus a correlation and a Michigan-wide context panel   |
| Your data            | `/data`       | Upload a file and browse recent community uploads                                                                       |
| Upload result        | `/data/<id>`  | Charts and written findings for one upload. Search engines are asked not to index it                                    |

The Compare page keeps the chosen measures in the URL, for example `/compare?household=electric_shutoffs&financial=ceo_total_pay`.

## Where the verified numbers come from

`npm run seed` downloads or reads each source and writes `src/server/data/verified.json`. The running site reads that file. It does not call the agencies on each page view.

| Bundle      | Source                                                                                                | What it contributes                                                                                                                                                                  |
| ----------- | ----------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `financial` | SEC company-facts API (CIK 0000936340) and Yahoo Finance                                              | Dividends per share, year-over-year operating-revenue growth, and the month-end DTE stock price                                                                                      |
| `financial` | DTE proxy statements (SEC Form DEF 14A), transcribed in `scripts/seed/data/dte-ceo-pay.json`          | Total yearly pay for the CEO                                                                                                                                                         |
| `eia`       | U.S. Energy Information Administration Form EIA-861                                                   | Residential, commercial, and industrial customers, sales, revenue, average price, and average yearly bill. Also the 22 Lower Peninsula counties where DTE Electric reports customers |
| `shutoffs`  | Michigan Public Service Commission case U-18120, transcribed in `scripts/seed/data/dte-shutoffs.json` | Monthly electric, gas, and combination shutoffs for nonpayment                                                                                                                       |
| `lead`      | U.S. Department of Energy LEAD tool, Michigan 2022                                                    | Average energy burden by census tract and by income band, plus the tract map at `public/geo/dte-tracts.topo.json`                                                                    |
| `pulse`     | U.S. Census Bureau Household Pulse Survey                                                             | Share of Michigan adults who could not pay an energy bill, skipped necessities to pay one, or kept the home at an unsafe temperature                                                 |

Downloaded files are cached in `scripts/seed/.cache/`, which git ignores. Run a single bundle with:

```sh
npm run seed -- --only=eia
```

`--only` accepts `financial`, `eia`, `shutoffs`, `lead`, or `pulse`. A partial run replaces only the measures that bundle owns and keeps the rest of the snapshot.

A few series are transcribed from PDFs rather than parsed from an API: CEO pay, and the shutoff counts. Those JSON files cite the filing or the case. Change them only when a newer filing is checked against the original document.

## How a page gets its numbers

```text
route loader
  -> React Query (src/data/queries.ts)
    -> server function (src/data/measures.ts or src/data/datasets.ts)
      -> snapshot reader (src/server/measures.ts) or upload files (src/server/datasets.ts)
```

Observations in the snapshot are stored as tuples to keep the file small:

```text
[measure, period, grain, dimension, geoId, value]
```

`period` is `YYYY-MM-DD` (the first day of the month, quarter, or year). `grain` is `month`, `quarter`, or `year`. `dimension` distinguishes things like `residential` or `electric`. `geoId` is a census tract id, a state FIPS code, or empty when the figure is for the whole area.

Yearly charts do not treat a partial year as a full year. A year is included only when every period in it was reported. Monthly series can be summed, averaged, or reduced to the last value of the year, depending on `annualAgg` for that measure.

The Compare page and the upload analysis only report a correlation when the two series share at least four years. The page states that a correlation is a pattern, not evidence that one series caused the other.

## Community uploads

On `/data`, a file is parsed in the browser, then sent to the server. The server checks the limits again. It does not trust the browser's row count.

Accepted formats: CSV, TSV, Excel (`.xlsx`), JSON, and newline-delimited JSON.

Limits, from `src/lib/ingest/limits.ts`:

- 10 MB
- 20,000 rows
- 60 columns
- 500 characters in a cell, 120 in a header
- 10 uploads an hour, counted per IP address in memory

The server then:

1. Profiles each column (number, date, year, category, county, census tract).
2. Writes findings that can be computed directly: a trend, a ranking, and a distribution.
3. Lines yearly columns up with the verified series, and joins county or tract columns to energy burden.
4. Optionally asks a model for a short summary. Sentences that contain a number the computed facts do not contain are dropped.
5. Saves two files under `.data/uploads/`, which git ignores: `<id>.rows.json` for the table and `<id>.json` for the profile, findings, and a 50-row preview.

The results page tells the reader the file was uploaded by a member of the public and has not been checked. Do not upload names, addresses, account numbers, or other personal information. Uploads are readable by anyone who has the link, and the recent list on `/data` shows the latest ones.

The hourly limit and the saved files exist only on the machine running the server. Restarting the dev server clears the rate limit. A Cloudflare deployment has no disk for `.data/uploads`, so uploads need a real store before they can work there. The verified pages do not need that store: their data is inside `verified.json`.

## Optional written summary

Leave `.env` empty and the site still runs. The upload page skips the model-written summary and still shows the computed charts.

Copy `.env.example` to `.env` and set:

```sh
AI_GATEWAY_API_KEY=
AI_MODEL=
```

`AI_GATEWAY_API_KEY` is a Vercel AI Gateway key. `AI_MODEL` is optional. When it is empty, the summary uses `openai/gpt-5.4-mini`. The model is instructed to use only the facts it is given and not to claim that one thing caused another. If the call fails or times out, the upload is still saved.

## Repository layout

```text
src/routes/            Pages. See src/routes/README.md for the file-to-URL map.
src/components/        Header, footer, chart cards, the tract map, and the preview table.
src/components/ui/     Shared interface primitives (buttons, menus, the chart wrapper).
src/components/charts/ Line and bar charts, sparklines, and the census-tract map.
src/data/              Types, labels, query options, and the server functions pages call.
src/server/            Snapshot reader, upload storage, and the optional model summary.
src/server/data/       verified.json, produced by npm run seed.
src/lib/ingest/        Parse, profile, insights, and the comparison with verified series.
src/lib/               Number formatting, source citations, and the server error page.
scripts/seed/          One script per source, plus the transcribed JSON files.
public/geo/            Tract boundaries for the household map.
```

Server-only modules start with `import "@tanstack/react-start/server-only"`. The Vite config rejects a browser import of `src/server` or of the `server-only` specifier.

## Local development

You need Node.js and npm. [Install Node with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone https://github.com/tseten14/Energy-Equity-Project.git
cd Energy-Equity-Project
npm i
npm run dev
```

Open http://localhost:8080.

The snapshot already in the repository is enough to run the site. Run `npm run seed` when you want to refresh it from the public sources. Seeding needs network access the first time each file is downloaded. Later runs reuse `scripts/seed/.cache/`.

## Scripts

| Command             | What it does                            |
| ------------------- | --------------------------------------- |
| `npm run dev`       | Start the site at http://localhost:8080 |
| `npm run build`     | Production build                        |
| `npm run preview`   | Serve the production build locally      |
| `npm run seed`      | Rebuild `src/server/data/verified.json` |
| `npm test`          | Run the ingest tests                    |
| `npm run typecheck` | Typecheck without emitting files        |
| `npm run lint`      | Lint                                    |
| `npm run format`    | Format with Prettier                    |

Packages are installed with npm. `bun.lock` is the lockfile the repository commits. Do not commit `package-lock.json`.

## Tests

`src/lib/ingest/` is plain TypeScript with no server or browser. Vitest covers parsing, column detection, the written findings, the comparison with verified series, and the rule that drops model sentences containing unsupported numbers.

```sh
npm test
```

## Production build

`npm run build` uses Nitro with the `cloudflare-module` preset. Verified pages are self-contained because `verified.json` is bundled. Community uploads are not: they are written to the local disk during `npm run dev`.

## Reading the code

Comments explain why a line exists when the code alone does not. They do not restate what the next statement already says.

- A file comment at the top says what the module is for.
- A comment above a function says what the caller can rely on.
- A comment inside a function marks a limit, a data quirk, or an ordering constraint.

`src/components/ui/` is the shared component kit. Those files follow the kit's own structure and are not narrated line by line. The site's behavior lives in `src/routes`, `src/data`, `src/server`, `src/lib`, and `src/components/charts`.
