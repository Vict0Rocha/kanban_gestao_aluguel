"use client"

import * as React from "react"
import { AlertCircle, CheckCircle2, Clock, Filter, Lock, X, type LucideIcon } from "lucide-react"

import { formatCurrency } from "@/lib/kanban/format"
import { situacaoDaParcela } from "@/lib/kanban/parcelas"
import {
  calcularRelatorioFinanceiro,
  filtroRelatorioVazio,
  passaFiltroPeriodo,
  passaFiltroTexto,
  type FiltroRelatorioValores,
  type ParcelaRelatorio,
  type SituacaoRelatorio,
} from "@/lib/kanban/relatorio-financeiro"
import { StatTile } from "@/components/reports/stat-tile"
import { FiltroRelatorioFinanceiroLive } from "@/components/reports/filtro-relatorio-financeiro-live"
import { RelatorioFinanceiroLista } from "@/components/reports/relatorio-financeiro-lista"
import {
  Collapsible,
  CollapsiblePanel,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import { Button } from "@/components/ui/button"

/** Mesmo mapeamento ícone-situação de `RelatorioFinanceiro` (Phase 8). */
const ICONE_E_ROTULO: Record<SituacaoRelatorio, { icon: LucideIcon; label: string }> = {
  paga: { icon: CheckCircle2, label: "Pagas" },
  a_vencer: { icon: Clock, label: "A vencer" },
  vencida: { icon: AlertCircle, label: "Vencidas" },
  conciliada: { icon: Lock, label: "Conciliadas" },
}

export function RelatorioFinanceiroDedicado({
  parcelas,
  hojeISO,
}: {
  parcelas: ParcelaRelatorio[]
  hojeISO: string
}) {
  // Painel fechado por padrão (10-CONTEXT.md "Claude's Discretion").
  const [aberto, setAberto] = React.useState(false)
  // D-01: `filtro` É o estado aplicado — não existe distinção rascunho/
  // aplicado como na Phase 8, então não há `aplicado`/`onGerar` aqui.
  const [filtro, setFiltro] = React.useState<FiltroRelatorioValores>(
    filtroRelatorioVazio()
  )

  const categorias = React.useMemo(
    () => calcularRelatorioFinanceiro(parcelas, filtro, hojeISO),
    [parcelas, filtro, hojeISO]
  )

  const linhasFiltradas = React.useMemo(() => {
    return parcelas
      .filter((p) => {
        const endereco = p.cards?.endereco ?? ""
        const proprietario = p.cards?.proprietario ?? ""
        if (!passaFiltroTexto(endereco, filtro.imovel)) return false
        if (!passaFiltroTexto(proprietario, filtro.proprietario)) return false
        if (!passaFiltroPeriodo(p.competencia, filtro.periodo)) return false
        // D-06: `situacaoDaParcela` nunca devolve "parcial" na prática para os
        // dados desta fase (mesmo cast de `calcularRelatorioFinanceiro`).
        const situacao = situacaoDaParcela(
          p.status,
          p.vencimento,
          hojeISO
        ) as SituacaoRelatorio
        if (filtro.situacoes.size > 0 && !filtro.situacoes.has(situacao))
          return false
        return true
      })
      .sort((a, b) =>
        a.vencimento < b.vencimento ? -1 : a.vencimento > b.vencimento ? 1 : 0
      )
  }, [parcelas, filtro, hojeISO])

  return (
    <Collapsible open={aberto} onOpenChange={setAberto}>
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <p className="text-sm text-muted-foreground">
            {linhasFiltradas.length} de {parcelas.length} parcelas
          </p>
          <div className="flex items-center gap-2">
            <CollapsibleTrigger
              render={
                <Button variant="outline" size="sm">
                  {aberto ? (
                    <X className="size-3.5" />
                  ) : (
                    <Filter className="size-3.5" />
                  )}
                  {aberto ? "Fechar filtros" : "Filtrar"}
                </Button>
              }
            />
          </div>
        </div>

        <CollapsiblePanel>
          <FiltroRelatorioFinanceiroLive campos={filtro} onChange={setFiltro} />
        </CollapsiblePanel>

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {categorias.map((categoria) => {
            const { icon, label } = ICONE_E_ROTULO[categoria.situacao]
            return (
              <StatTile
                key={categoria.situacao}
                icon={icon}
                label={label}
                value={String(categoria.quantidade)}
                hint={formatCurrency(categoria.total)}
                tone={
                  categoria.situacao === "vencida" && categoria.quantidade > 0
                    ? "alert"
                    : "default"
                }
              />
            )
          })}
        </div>

        <RelatorioFinanceiroLista linhas={linhasFiltradas} hojeISO={hojeISO} />
      </div>
    </Collapsible>
  )
}
