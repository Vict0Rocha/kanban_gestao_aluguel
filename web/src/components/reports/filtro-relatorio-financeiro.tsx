"use client"

import * as React from "react"
import Link from "next/link"
import { ArrowUpRight } from "lucide-react"
import { Filter, X } from "lucide-react"

import {
  Collapsible,
  CollapsiblePanel,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { FilterChip, toggle } from "@/components/reports/reports-view"
import {
  filtroRelatorioVazio,
  type FiltroRelatorioValores,
  type SituacaoRelatorio,
} from "@/lib/kanban/relatorio-financeiro"

const SITUACAO_OPTIONS: { value: SituacaoRelatorio; label: string }[] = [
  { value: "paga", label: "Pagas" },
  { value: "a_vencer", label: "A vencer" },
  { value: "vencida", label: "Vencidas" },
  { value: "conciliada", label: "Conciliadas" },
]

export function FiltroRelatorioFinanceiro({
  onGerar,
  onLimpar,
  carregando,
}: {
  onGerar: (filtro: FiltroRelatorioValores) => void
  onLimpar: () => void
  carregando: boolean
}) {
  // Fechado por padrão. Diferente de `FiltroParcelas`, não há URL
  // persistindo estado entre cargas nesta implementação (D-04: o filtro roda
  // em memória no cliente, disparado só pelo clique em "Gerar relatório") —
  // "abre se a URL já tiver filtro" não se aplica aqui. Simplificação
  // deliberada, ver 08-CONTEXT.md "Claude's Discretion".
  const [aberto, setAberto] = React.useState(false)
  const [campos, setCampos] = React.useState<FiltroRelatorioValores>(
    filtroRelatorioVazio()
  )

  function atualizarCampo(
    campo: "imovel" | "proprietario" | "periodo",
    valor: string
  ) {
    setCampos((atual) => ({ ...atual, [campo]: valor }))
  }

  const temFiltroPreenchido = Boolean(
    campos.imovel.trim() ||
      campos.proprietario.trim() ||
      campos.periodo.trim() ||
      campos.situacoes.size > 0
  )

  function limpar() {
    setCampos(filtroRelatorioVazio())
    onLimpar()
  }

  return (
    <Collapsible open={aberto} onOpenChange={setAberto}>
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="font-heading text-base font-bold text-foreground">
            Relatório financeiro
          </h2>
          <p className="text-sm text-muted-foreground">
            Combine imóvel, proprietário, período e situação — depois gere o
            relatório.
          </p>
        </div>
        <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          render={<Link href="/relatorios/financeiro" />}
        >
          <ArrowUpRight className="size-3.5" />
          Relatório financeiro
        </Button>
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
        <div className="mt-3 rounded-2xl border border-border bg-card px-5 py-4">
          <div className="grid grid-cols-[repeat(3,1fr)] gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="filtro-rel-imovel">Imóvel</Label>
              <Input
                id="filtro-rel-imovel"
                type="text"
                placeholder="Endereço do imóvel"
                value={campos.imovel}
                onChange={(event) =>
                  atualizarCampo("imovel", event.target.value)
                }
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="filtro-rel-proprietario">Proprietário</Label>
              <Input
                id="filtro-rel-proprietario"
                type="text"
                placeholder="Nome do proprietário"
                value={campos.proprietario}
                onChange={(event) =>
                  atualizarCampo("proprietario", event.target.value)
                }
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="filtro-rel-periodo">Período</Label>
              <Input
                id="filtro-rel-periodo"
                type="month"
                value={campos.periodo}
                onChange={(event) =>
                  atualizarCampo("periodo", event.target.value)
                }
              />
            </div>
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-2">
            <span className="shrink-0 text-xs font-semibold text-muted-foreground uppercase">
              Situação
            </span>
            <FilterChip
              active={campos.situacoes.size === 0}
              onClick={() =>
                setCampos((atual) => ({ ...atual, situacoes: new Set() }))
              }
            >
              Todas
            </FilterChip>
            {SITUACAO_OPTIONS.map((option) => (
              <FilterChip
                key={option.value}
                active={campos.situacoes.has(option.value)}
                onClick={() =>
                  setCampos((atual) => ({
                    ...atual,
                    situacoes: toggle(atual.situacoes, option.value),
                  }))
                }
              >
                {option.label}
              </FilterChip>
            ))}
          </div>

          {/* Task 1 entregou só a linha de ação — Task 2 inseriu os campos e
              os chips de situação ANTES desta linha, sem remover nada dela. */}
          <div className="mt-3 flex justify-end gap-2">
            <Button
              variant="default"
              onClick={() => onGerar(campos)}
              disabled={carregando}
            >
              {carregando ? "Gerando..." : "Gerar relatório"}
            </Button>
            {temFiltroPreenchido && (
              <Button variant="ghost" onClick={limpar} disabled={carregando}>
                Limpar filtros
              </Button>
            )}
          </div>
        </div>
      </CollapsiblePanel>
    </Collapsible>
  )
}
