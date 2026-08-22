import { Banknote, TrendingDown, TrendingUp, Unlock } from "lucide-react"

import { cn } from "@/lib/utils"
import type { LancamentoDetalhado } from "@/lib/kanban/parcelas"

/**
 * Ícone + rótulo, nunca cor sozinha — mesma regra de ParcelaSituacaoBadge.
 * `destrava` só fica alcançável a partir da Phase 7, mas o componente nasce
 * pronto para os 4 estados agora, mesmo precedente de futuro-proofing.
 */
export const TIPO = {
  pagamento: {
    icon: Banknote,
    label: "Pagamento",
    className: "text-status-good",
  },
  acrescimo: {
    icon: TrendingUp,
    label: "Acréscimo",
    className: "text-status-warning",
  },
  desconto: {
    icon: TrendingDown,
    label: "Desconto",
    className: "text-muted-foreground",
  },
  destrava: {
    icon: Unlock,
    label: "Destrava",
    className: "text-muted-foreground",
  },
} as const

export function LancamentoTipoLabel({
  tipo,
}: {
  tipo: LancamentoDetalhado["tipo"]
}) {
  const { icon: Icon, label, className } = TIPO[tipo]

  return (
    <span className={cn("inline-flex items-center gap-1.5 text-xs font-semibold", className)}>
      <Icon className="size-3.5 shrink-0" />
      {label}
    </span>
  )
}
