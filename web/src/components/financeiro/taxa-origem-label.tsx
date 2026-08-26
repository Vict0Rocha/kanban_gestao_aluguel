import { Percent, Sparkles } from "lucide-react"

import { cn } from "@/lib/utils"
import type { OrigemTaxa } from "@/lib/kanban/taxas"

/**
 * Promovido de `dinheiro-imobiliaria-view.tsx` (13-07-PLAN.md, A-03) porque
 * esta é a SEGUNDA tela a precisar rotular taxa por origem (D-01,
 * 14-CONTEXT.md) — deixa de ser "só daquela view". Mesmo padrão de
 * `caucao-evento-label.tsx`/`lancamento-tipo-label.tsx`: ícone + rótulo +
 * `className` por categoria, "nunca cor sozinha" — a versão local anterior
 * não colorizava por origem; esta adota `className` (A-03), mudança visual
 * pequena e deliberada aceita pelo usuário.
 */
export const TAXA_ORIGEM = {
  administracao: { icon: Percent, label: "Administração", className: "text-status-good" },
  comissao_primeiro_aluguel: {
    icon: Sparkles,
    label: "Comissão 1º aluguel",
    className: "text-status-warning",
  },
} as const

export function TaxaOrigemBadge({ origem }: { origem: OrigemTaxa }) {
  const { icon: Icon, label, className } = TAXA_ORIGEM[origem]
  return (
    <span className={cn("inline-flex items-center gap-1.5 text-xs font-semibold", className)}>
      <Icon className="size-3.5 shrink-0" />
      {label}
    </span>
  )
}
