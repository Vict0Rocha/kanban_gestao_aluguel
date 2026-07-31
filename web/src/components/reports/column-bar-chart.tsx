import { formatCurrency } from "@/lib/kanban/format"
import type { ColumnBreakdown } from "@/lib/kanban/report"

/**
 * One measure (imóveis) across nominal categories (the board's columns), so
 * every bar takes the same hue — bar length already encodes the value, and a
 * per-bar color would spend the identity channel re-encoding it. Single
 * series, so no legend: the heading names what is plotted. Each bar carries
 * its value at the tip, which doubles as the chart's table view.
 */
export function ColumnBarChart({ data }: { data: ColumnBreakdown[] }) {
  const max = Math.max(...data.map((item) => item.count), 1)

  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <h2 className="font-heading text-base font-bold text-foreground">
        Imóveis por coluna
      </h2>
      <p className="mt-0.5 text-sm text-muted-foreground">
        Onde os imóveis estão parados hoje.
      </p>

      {data.length === 0 ? (
        <p className="mt-6 text-sm text-muted-foreground">
          Nenhuma coluna cadastrada ainda.
        </p>
      ) : (
        <ul className="mt-5 flex flex-col gap-3">
          {data.map((item) => (
            <li key={item.id} className="grid grid-cols-[9rem_1fr] items-center gap-3">
              <span className="truncate text-sm text-foreground" title={item.name}>
                {item.name}
              </span>
              <div className="flex items-center gap-2">
                <div className="h-5 flex-1">
                  <div
                    className="h-full rounded-r-[4px] bg-chart-1"
                    style={{ width: `${(item.count / max) * 100}%` }}
                  />
                </div>
                <span className="w-8 shrink-0 text-right text-sm font-semibold text-foreground tabular-nums">
                  {item.count}
                </span>
                <span className="w-28 shrink-0 text-right text-xs text-muted-foreground tabular-nums">
                  {formatCurrency(item.valor)}
                </span>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
