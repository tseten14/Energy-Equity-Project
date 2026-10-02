/** The first rows of an uploaded file, shown before save and again on the results page. */
import type { Cell } from "@/lib/ingest/parse";
import { cn } from "@/lib/utils";

export function PreviewTable({
  columns,
  rows,
  className,
}: {
  columns: string[];
  rows: Cell[][];
  className?: string;
}) {
  return (
    <div className={cn("overflow-x-auto rounded-xl ring-1 ring-border", className)}>
      <table className="w-full text-left text-xs">
        <thead className="bg-cream">
          <tr>
            {columns.map((c) => (
              <th key={c} scope="col" className="whitespace-nowrap px-3 py-2 font-semibold">
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} className="border-t border-border">
              {columns.map((c, j) => (
                <td
                  key={c}
                  className="max-w-[16rem] truncate whitespace-nowrap px-3 py-2 tabular-nums text-foreground/75"
                >
                  {row[j] === null || row[j] === undefined ? "" : String(row[j])}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
