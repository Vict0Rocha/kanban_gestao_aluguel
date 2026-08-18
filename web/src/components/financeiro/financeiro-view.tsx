"use client"

import type { LinhaParcela } from "@/lib/kanban/parcelas"
import { formatDate } from "@/lib/kanban/format"
import { ParcelasTable } from "@/components/financeiro/parcelas-table"

/**
 * D-01/D-02 (Phase 6.1): não há mais seletor de competência — o servidor já
 * resolveu a única lista relevante (padrão "vencendo hoje" ou, a partir do
 * plano 06.1-05, o resultado de um filtro). Este componente só decide o
 * estado vazio e repassa para `ParcelasTable`.
 */
export function FinanceiroView({
  linhas,
  temContratoAtivo,
  erro,
  todayISO,
}: {
  linhas: LinhaParcela[]
  temContratoAtivo: boolean
  erro?: boolean
  todayISO: string
}) {
  const vazio = temContratoAtivo ? "sem-parcela-hoje" : "sem-contrato-ativo"

  return (
    <div className="flex flex-col gap-4">
      <ParcelasTable
        titulo="Vencendo hoje"
        subtitulo={formatDate(todayISO)}
        linhas={linhas}
        erro={erro}
        vazio={vazio}
        todayISO={todayISO}
      />
    </div>
  )
}
