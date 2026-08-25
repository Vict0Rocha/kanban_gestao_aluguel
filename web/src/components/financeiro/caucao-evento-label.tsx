import { PiggyBank, ShieldCheck, Undo2 } from "lucide-react"

import { cn } from "@/lib/utils"
import type { TipoCaucao } from "@/lib/kanban/taxas"

/**
 * Ícone + rótulo, nunca cor sozinha — mesma regra de `LancamentoTipoLabel`/
 * `ParcelaSituacaoBadge`. Cópia do evento individual (Color § Status tones,
 * 13-UI-SPEC.md) — distinto do status agregado do contrato usado na tabela
 * de Configuração financeira (`STATUS_CAUCAO_LABEL`, configuracao-financeira-
 * view.tsx), que fala de "recebida"/"devolvida"/"usada" no nível do
 * contrato inteiro, não do evento.
 */
export const CAUCAO_TIPO = {
  recebido: {
    icon: PiggyBank,
    label: "Recebida",
    className: "text-status-good",
  },
  devolvido: {
    icon: Undo2,
    label: "Devolvida",
    className: "text-muted-foreground",
  },
  usado: {
    icon: ShieldCheck,
    label: "Usada",
    className: "text-status-warning",
  },
} as const

export function CaucaoEventoLabel({ tipo }: { tipo: TipoCaucao }) {
  const { icon: Icon, label, className } = CAUCAO_TIPO[tipo]

  return (
    <span className={cn("inline-flex items-center gap-1.5 text-xs font-semibold", className)}>
      <Icon className="size-3.5 shrink-0" />
      {label}
    </span>
  )
}
