import { queryOptions, useQuery } from "@tanstack/react-query";
import { geoMercator, geoPath } from "d3-geo";
import type { Feature, FeatureCollection, Geometry } from "geojson";
import { useMemo, useRef, useState, type PointerEvent } from "react";
import { feature } from "topojson-client";
import type { GeometryCollection, Topology } from "topojson-specification";

import { cn } from "@/lib/utils";

interface TractProps {
  GEOID: string;
}
interface CountyProps {
  COUNTYFP: string;
  NAMELSADCO: string;
}
type DteTopology = Topology<{
  tracts: GeometryCollection<TractProps>;
  counties: GeometryCollection<CountyProps>;
}>;

const geoQuery = queryOptions({
  queryKey: ["geo", "dte-tracts"],
  queryFn: async () => {
    const res = await fetch("/geo/dte-tracts.topo.json");
    if (!res.ok) throw new Error(`Map boundaries failed to load (${res.status})`);
    return (await res.json()) as DteTopology;
  },
  staleTime: Number.POSITIVE_INFINITY,
});

// Class breaks in percent of income. 6% is the common "high energy burden" line.
const BREAKS = [2, 3, 4, 6, 8];
const COLORS = [1, 2, 3, 4, 5, 6].map((n) => `var(--chart-seq-${n})`);
const LEGEND = ["Under 2%", "2–3%", "3–4%", "4–6%", "6–8%", "8% or more"];
export const HIGH_BURDEN = 6;

const METRO_DETROIT = new Set(["163", "125", "099"]); // Wayne, Oakland, Macomb
const WIDTH = 600;
const HEIGHT = 560;

const colorFor = (value: number | undefined) =>
  value === undefined ? "var(--chart-empty)" : COLORS[BREAKS.filter((b) => value >= b).length];

function tractLabel(geoid: string, counties: Map<string, string>) {
  const code = geoid.slice(5);
  const number = `${Number(code.slice(0, 4))}${code.slice(4) === "00" ? "" : `.${code.slice(4)}`}`;
  return `Tract ${number}, ${counties.get(geoid.slice(2, 5)) ?? "Michigan"}`;
}

interface TractMapProps {
  values: Record<string, number>;
  format: (value: number) => string;
}

export function TractMap({ values, format }: TractMapProps) {
  const { data: topology, error } = useQuery(geoQuery);
  const [view, setView] = useState<"all" | "metro">("all");
  const [hover, setHover] = useState<{ geoid: string; x: number; y: number } | null>(null);
  const frame = useRef<HTMLDivElement>(null);

  const shapes = useMemo(() => {
    if (!topology) return null;
    const tracts = feature(topology, topology.objects.tracts) as FeatureCollection<
      Geometry,
      TractProps
    >;
    const counties = feature(topology, topology.objects.counties) as FeatureCollection<
      Geometry,
      CountyProps
    >;
    const focus: FeatureCollection<Geometry, CountyProps> =
      view === "all"
        ? counties
        : {
            ...counties,
            features: counties.features.filter((c) => METRO_DETROIT.has(c.properties.COUNTYFP)),
          };
    const path = geoPath(geoMercator().fitSize([WIDTH, HEIGHT], focus));
    return {
      tracts: tracts.features.map((t: Feature<Geometry, TractProps>) => ({
        id: t.properties.GEOID,
        d: path(t) ?? "",
      })),
      counties: counties.features.map((c) => ({ id: c.properties.COUNTYFP, d: path(c) ?? "" })),
      countyNames: new Map(
        counties.features.map((c) => [c.properties.COUNTYFP, c.properties.NAMELSADCO]),
      ),
    };
  }, [topology, view]);

  const summary = useMemo(() => {
    const high = Object.entries(values).filter(([, v]) => v > HIGH_BURDEN);
    const byCounty = new Map<string, number>();
    for (const [geoid] of high)
      byCounty.set(geoid.slice(2, 5), (byCounty.get(geoid.slice(2, 5)) ?? 0) + 1);
    const top = [...byCounty.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3);
    return { total: Object.keys(values).length, high: high.length, top };
  }, [values]);

  const onPointerMove = (event: PointerEvent<SVGSVGElement>) => {
    const geoid = (event.target as Element).getAttribute("data-geoid");
    const box = frame.current?.getBoundingClientRect();
    setHover(
      geoid && box ? { geoid, x: event.clientX - box.left, y: event.clientY - box.top } : null,
    );
  };

  const hovered = hover ? shapes?.tracts.find((t) => t.id === hover.geoid) : undefined;
  const hoveredValue = hover ? values[hover.geoid] : undefined;

  return (
    <div>
      <div className="mt-4 flex gap-2" role="group" aria-label="Map area">
        {(["all", "metro"] as const).map((v) => (
          <button
            key={v}
            type="button"
            onClick={() => setView(v)}
            aria-pressed={view === v}
            className={cn(
              "rounded-full px-3 py-1.5 text-xs font-semibold ring-1 ring-border transition-colors",
              view === v ? "bg-ink text-paper" : "bg-cream text-foreground/70 hover:bg-cream/70",
            )}
          >
            {v === "all" ? "All 22 counties" : "Metro Detroit"}
          </button>
        ))}
      </div>

      <div ref={frame} className="relative mt-3 overflow-hidden rounded-md bg-cream">
        {shapes ? (
          <svg
            viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
            className="h-auto w-full"
            role="img"
            aria-label={`Map of ${summary.total} census tracts in DTE Electric's service area, shaded by energy burden. ${summary.high} tracts are above ${HIGH_BURDEN}%.`}
            onPointerMove={onPointerMove}
            onPointerLeave={() => setHover(null)}
          >
            <g>
              {shapes.tracts.map((t) => (
                <path
                  key={t.id}
                  d={t.d}
                  data-geoid={t.id}
                  fill={colorFor(values[t.id])}
                  stroke="var(--paper)"
                  strokeWidth={0.25}
                />
              ))}
            </g>
            <g
              fill="none"
              stroke="var(--ink)"
              strokeOpacity={0.55}
              strokeWidth={0.8}
              pointerEvents="none"
            >
              {shapes.counties.map((c) => (
                <path key={c.id} d={c.d} />
              ))}
            </g>
            {hovered ? (
              <path
                d={hovered.d}
                fill="none"
                stroke="var(--ink)"
                strokeWidth={2}
                pointerEvents="none"
              />
            ) : null}
          </svg>
        ) : (
          <div role="status" className="grid aspect-[15/14] place-items-center px-4 text-center">
            <span className="text-xs font-semibold uppercase tracking-[0.12em] text-foreground/45">
              {error ? "The map could not load" : "Loading map…"}
            </span>
          </div>
        )}

        {hover && shapes ? (
          <div
            className="pointer-events-none absolute z-10 w-max max-w-[14rem] rounded-lg border border-border bg-paper px-3 py-2 text-xs shadow-lg"
            style={{
              left: Math.min(hover.x + 12, (frame.current?.clientWidth ?? 0) - 180),
              top: Math.max(hover.y - 48, 4),
            }}
          >
            <p className="font-semibold">{tractLabel(hover.geoid, shapes.countyNames)}</p>
            <p className="mt-0.5 text-foreground/70">
              {hoveredValue === undefined
                ? "No household data"
                : `${format(hoveredValue)} of income on energy`}
            </p>
          </div>
        ) : null}
      </div>

      <ul
        className="mt-3 flex flex-wrap gap-x-3 gap-y-1.5 text-[11px] text-foreground/65"
        aria-label="Map legend"
      >
        {LEGEND.map((label, i) => (
          <li key={label} className="flex items-center gap-1.5">
            <span
              className="h-3 w-3 rounded-sm ring-1 ring-border"
              style={{ backgroundColor: COLORS[i] }}
            />
            {label}
          </li>
        ))}
        <li className="flex items-center gap-1.5">
          <span
            className="h-3 w-3 rounded-sm ring-1 ring-border"
            style={{ backgroundColor: "var(--chart-empty)" }}
          />
          No household data
        </li>
      </ul>

      {shapes ? (
        <p className="mt-4 text-sm text-foreground/75">
          <span className="font-semibold text-foreground">
            {summary.high} of {summary.total.toLocaleString()} tracts
          </span>{" "}
          spend more than {HIGH_BURDEN}% of income on energy on average
          {summary.top.length
            ? `, most of them in ${summary.top.map(([fips, n]) => `${shapes.countyNames.get(fips) ?? fips} (${n})`).join(", ")}.`
            : "."}
        </p>
      ) : null}
    </div>
  );
}
