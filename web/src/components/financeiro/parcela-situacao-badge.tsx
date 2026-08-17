import {
  AlertCircle,
  CheckCircle2,
  CircleDollarSign,
  Clock,
  Lock,
} from "lucide-react"

import { cn } from "@/lib/utils"
import type { Situacao } from "@/lib/kanban/parcelas"

/**
 * Situação é sempre ícone + rótulo, nunca cor sozinha — mesma regra de
 * ContractStatusBadge. `paga`, `parcial` e `conciliada` não são alcançáveis
 * com os dados desta fase (nenhuma baixa nem conciliação até as Phases 6/7),
 * mas o componente nasce completo com os 5 estados para que aquelas fases
 * não precisem reabri-lo.
 */
const SITUACAO = {
  a_vencer: {
    icon: Clock,
    label: "A vencer",
    className: "text-muted-foreground",
  },
  vencida: {
    icon: AlertCircle,
    label: "Vencida",
    className: "text-status-critical",
  },
  paga: {
    icon: CheckCircle2,
    label: "Paga",
    className: "text-status-good",
  },
  parcial: {
    icon: CircleDollarSign,
    label: "Parcial",
    className: "text-status-warning",
  },
  conciliada: {
    icon: Lock,
    label: "Conciliada",
    className: "text-muted-foreground",
  },
} as const

export function ParcelaSituacaoBadge({ situacao }: { situacao: Situacao }) {
  const { icon: Icon, label, className } = SITUACAO[situacao]

  return (
    <span className={cn("inline-flex items-center gap-1.5 text-xs font-semibold", className)}>
      <Icon className="size-3.5 shrink-0" />
      {label}
    </span>
  )
}
