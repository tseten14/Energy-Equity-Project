/** Horizontal bars for a small set of labeled categories, such as energy burden by income. */
import { cn } from "@/lib/utils";

export interface CategoryItem {
  key: string;
  label: string;
  detail?: string;
  value: number;
}

interface CategoryBarsProps {
  items: CategoryItem[];
  format: (value: number) => string;
  /** A marked value on the scale, such as the 6% "high burden" line. */
  threshold?: { value: number; label: string };
}

export function CategoryBars({ items, format, threshold }: CategoryBarsProps) {
  const max = Math.max(...items.map((i) => i.value), threshold?.value ?? 0) * 1.05;
  const position = (value: number) => `${(value / max) * 100}%`;

  return (
    <div className="relative mt-6">
      <ul className="space-y-4">
        {items.map((item) => {
          const high = threshold !== undefined && item.value > threshold.value;
          return (
            <li key={item.key}>
              <div className="mb-1.5 flex items-baseline justify-between gap-3 text-sm">
                <span>
                  <span className="font-medium">{item.label}</span>
                  {item.detail ? (
                    <span className="ml-2 text-xs text-foreground/50">{item.detail}</span>
                  ) : null}
                </span>
                <span className={cn("font-semibold tabular-nums", high && "text-primary")}>
                  {format(item.value)}
                </span>
              </div>
              <div className="relative h-8 overflow-hidden rounded-full bg-cream">
                <div
                  className={cn("h-full rounded-full", high ? "bg-primary" : "bg-highlight")}
                  style={{ width: position(item.value) }}
                />
                {threshold ? (
                  <div
                    className="absolute inset-y-0 border-l-2 border-dashed border-foreground/40"
                    style={{ left: position(threshold.value) }}
                    aria-hidden="true"
                  />
                ) : null}
              </div>
            </li>
          );
        })}
      </ul>
      {threshold ? (
        <p className="mt-3 flex items-center gap-2 text-xs text-foreground/60">
          <span
            className="inline-block h-3 border-l-2 border-dashed border-foreground/40"
            aria-hidden="true"
          />
          {threshold.label}
        </p>
      ) : null}
    </div>
  );
}
