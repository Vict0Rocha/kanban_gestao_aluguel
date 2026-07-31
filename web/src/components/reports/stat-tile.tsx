import type { LucideIcon } from "lucide-react"

import { cn } from "@/lib/utils"

export function StatTile({
  label,
  value,
  hint,
  icon: Icon,
  tone = "default",
}: {
  label: string
  value: string
  hint?: string
  icon: LucideIcon
  /** `alert` is reserved for counts that need action, and always ships
   *  with its own label — the color is never the only signal. */
  tone?: "default" | "alert"
}) {
  return (
    <div className="flex flex-col gap-2 rounded-2xl border border-border bg-card p-4">
      <div className="flex items-center gap-2 text-muted-foreground">
        <Icon className="size-4 shrink-0" />
        <span className="text-sm">{label}</span>
      </div>
      {/* Proportional figures: tabular-nums makes a large standalone
          number look loose. */}
      <p
        className={cn(
          "font-heading text-2xl font-extrabold",
          tone === "alert" ? "text-status-critical" : "text-foreground"
        )}
      >
        {value}
      </p>
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  )
}
