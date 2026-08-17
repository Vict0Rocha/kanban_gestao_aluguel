"use client"

import * as React from "react"

import type { LinhaParcela } from "@/lib/kanban/parcelas"
import { MesSwitcher } from "@/components/financeiro/mes-switcher"
import { ParcelasTable } from "@/components/financeiro/parcelas-table"

/**
 * Um único componente de lista alimentado por dois conjuntos de linhas — as
 * duas visões são filtro de competência sobre o mesmo dado, não dois modelos
 * diferentes (D-12). Trocar de segmento não navega, não recarrega e não vai
 * ao banco: as duas competências já vieram montadas do servidor.
 */
export function FinanceiroView({
  linhasAtual,
  linhasProximo,
  temContratoAtivo,
  erro,
}: {
  linhasAtual: LinhaParcela[]
  linhasProximo: LinhaParcela[]
  temContratoAtivo: boolean
  erro?: boolean
}) {
  const [competencia, setCompetencia] = React.useState<"atual" | "proximo">(
    "atual"
  )

  const linhas = competencia === "atual" ? linhasAtual : linhasProximo
  const titulo =
    competencia === "atual" ? "Parcelas — mês atual" : "Parcelas — próximo mês"
  const vazio = temContratoAtivo ? "sem-parcela-no-periodo" : "sem-contrato-ativo"

  return (
    <div className="flex flex-col gap-4">
      <MesSwitcher value={competencia} onChange={setCompetencia} />
      <ParcelasTable titulo={titulo} linhas={linhas} erro={erro} vazio={vazio} />
    </div>
  )
}
