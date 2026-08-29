"use client"

import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
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

/**
 * D-01: `campos` É o estado aplicado — não existe distinção rascunho/
 * aplicado. Cada `onChange` escreve direto no estado do pai, sem nenhum
 * botão de submit/"Gerar relatório" — é essa ausência que implementa o
 * filtro ao vivo.
 */
export function FiltroRelatorioFinanceiroLive({
  campos,
  onChange,
}: {
  campos: FiltroRelatorioValores
  onChange: (updater: (atual: FiltroRelatorioValores) => FiltroRelatorioValores) => void
}) {
  function atualizarCampo(
    campo: "imovel" | "proprietario" | "periodo",
    valor: string
  ) {
    onChange((atual) => ({ ...atual, [campo]: valor }))
  }

  const temFiltroPreenchido = Boolean(
    campos.imovel.trim() ||
      campos.proprietario.trim() ||
      campos.periodo.trim() ||
      campos.situacoes.size > 0
  )

  return (
    <div className="mt-4 rounded-2xl border border-border bg-card px-6 py-4">
      <div className="grid grid-cols-[repeat(3,1fr)] gap-3">
        <div className="flex flex-col gap-2">
          <Label htmlFor="filtro-rel-live-imovel">Imóvel</Label>
          <Input
            id="filtro-rel-live-imovel"
            type="text"
            placeholder="Endereço do imóvel"
            value={campos.imovel}
            onChange={(event) => atualizarCampo("imovel", event.target.value)}
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="filtro-rel-live-proprietario">Proprietário</Label>
          <Input
            id="filtro-rel-live-proprietario"
            type="text"
            placeholder="Nome do proprietário"
            value={campos.proprietario}
            onChange={(event) =>
              atualizarCampo("proprietario", event.target.value)
            }
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="filtro-rel-live-periodo">Período</Label>
          <Input
            id="filtro-rel-live-periodo"
            type="month"
            value={campos.periodo}
            onChange={(event) => atualizarCampo("periodo", event.target.value)}
          />
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <span className="shrink-0 text-xs font-semibold text-muted-foreground uppercase">
          Situação
        </span>
        <FilterChip
          active={campos.situacoes.size === 0}
          onClick={() => onChange(() => ({ ...campos, situacoes: new Set() }))}
          className="font-semibold"
        >
          Todas
        </FilterChip>
        {SITUACAO_OPTIONS.map((option) => (
          <FilterChip
            key={option.value}
            active={campos.situacoes.has(option.value)}
            onClick={() =>
              onChange((atual) => ({
                ...atual,
                situacoes: toggle(atual.situacoes, option.value),
              }))
            }
            className="font-semibold"
          >
            {option.label}
          </FilterChip>
        ))}
      </div>

      {temFiltroPreenchido && (
        <div className="mt-3 flex justify-end">
          <Button variant="ghost" onClick={() => onChange(() => filtroRelatorioVazio())}>
            Limpar filtros
          </Button>
        </div>
      )}
    </div>
  )
}
