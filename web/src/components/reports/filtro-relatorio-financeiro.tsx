"use client"

import * as React from "react"
import { Filter, X } from "lucide-react"

import {
  Collapsible,
  CollapsiblePanel,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import { Button } from "@/components/ui/button"
import {
  filtroRelatorioVazio,
  type FiltroRelatorioValores,
} from "@/lib/kanban/relatorio-financeiro"

export function FiltroRelatorioFinanceiro({
  onGerar,
  onLimpar,
}: {
  onGerar: (filtro: FiltroRelatorioValores) => void
  onLimpar: () => void
}) {
  // Fechado por padrão. Diferente de `FiltroParcelas`, não há URL
  // persistindo estado entre cargas nesta implementação (D-04: o filtro roda
  // em memória no cliente, disparado só pelo clique em "Gerar relatório") —
  // "abre se a URL já tiver filtro" não se aplica aqui. Simplificação
  // deliberada, ver 08-CONTEXT.md "Claude's Discretion".
  const [aberto, setAberto] = React.useState(false)

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

      <CollapsiblePanel>
        <div className="mt-3 rounded-2xl border border-border bg-card px-5 py-4">
          {/* Task 1 entrega só a linha de ação — Task 2 insere os campos e
              os chips de situação ANTES desta linha, sem remover nada dela. */}
          <div className="flex justify-end gap-2">
            <Button
              variant="default"
              onClick={() => onGerar(filtroRelatorioVazio())}
            >
              Gerar relatório
            </Button>
            <Button variant="ghost" onClick={onLimpar}>
              Limpar filtros
            </Button>
          </div>
        </div>
      </CollapsiblePanel>
    </Collapsible>
  )
}
