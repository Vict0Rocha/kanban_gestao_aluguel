import { AlertCircle, CheckCircle2, Clock, Minus } from "lucide-react"

import { cn } from "@/lib/utils"
import type { ContractStatus } from "@/lib/kanban/report"

/**
 * Status is always icon + label, never color alone — the color is a
 * reinforcement so the meaning survives colorblindness and grayscale print.
 */
const STATUS = {
  vencido: {
    icon: AlertCircle,
    label: "Vencido",
    className: "text-status-critical",
  },
  vencendo: {
    icon: Clock,
    label: "Vence em breve",
    className: "text-status-warning",
  },
  em_dia: {
    icon: CheckCircle2,
    label: "Em dia",
    className: "text-status-good",
  },
  sem_data: {
    icon: Minus,
    label: "Sem data",
    className: "text-muted-foreground",
  },
} as const

export function ContractStatusBadge({
  status,
  daysLeft,
}: {
  status: ContractStatus
  daysLeft: number | null
}) {
  const { icon: Icon, label, className } = STATUS[status]

  let text: string = label
  if (status === "vencendo" && daysLeft !== null) {
    text = daysLeft === 0 ? "Vence hoje" : `Vence em ${daysLeft}d`
  } else if (status === "vencido" && daysLeft !== null) {
    const overdue = Math.abs(daysLeft)
    text = `Vencido há ${overdue}d`
  }

  return (
    <span className={cn("inline-flex items-center gap-1.5 text-xs font-medium", className)}>
      <Icon className="size-3.5 shrink-0" />
      {text}
    </span>
  )
}
