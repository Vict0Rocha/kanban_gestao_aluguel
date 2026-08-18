"use client"

import { formatDate } from "@/lib/kanban/format"
import type { LinhaParcela } from "@/lib/kanban/parcelas"
import {
  FiltroParcelas,
  type FiltroValores,
} from "@/components/financeiro/filtro-parcelas"
import { ParcelasTable } from "@/components/financeiro/parcelas-table"

/**
 * D-01/D-02 (Phase 6.1): não há mais seletor de competência — o servidor já
 * resolveu a única lista relevante (padrão "vencendo hoje" ou, a partir do
 * plano 06.1-05, o resultado de um filtro). `FiltroParcelas` decide o
 * cabeçalho (título/subtítulo/contador) a partir de `filtrosAtivos`; este
 * componente só decide o estado vazio e repassa para `ParcelasTable`.
 */
export function FinanceiroView({
  linhas,
  temContratoAtivo,
  erro,
  todayISO,
  filtrosAtivos,
  filtroInicial,
}: {
  linhas: LinhaParcela[]
  temContratoAtivo: boolean
  erro?: boolean
  todayISO: string
  filtrosAtivos: boolean
  filtroInicial: FiltroValores
}) {
  const vazio = !temContratoAtivo
    ? "sem-contrato-ativo"
    : filtrosAtivos
      ? "sem-resultado-filtro"
      : "sem-parcela-hoje"

  const titulo = filtrosAtivos ? "Resultado da busca" : "Vencendo hoje"
  const subtitulo = filtrosAtivos ? undefined : formatDate(todayISO)

  return (
    <div className="flex flex-col gap-4">
      <FiltroParcelas
        titulo={titulo}
        subtitulo={subtitulo}
        totalResultados={linhas.length}
        filtrosAtivos={filtrosAtivos}
        filtroInicial={filtroInicial}
      />
      <ParcelasTable
        linhas={linhas}
        erro={erro}
        vazio={vazio}
        todayISO={todayISO}
      />
    </div>
  )
}
