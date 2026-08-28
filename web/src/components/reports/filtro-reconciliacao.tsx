"use client"

import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import {
  filtroReconciliacaoVazio,
  type FiltroReconciliacaoValores,
} from "@/lib/kanban/reconciliacao"

/**
 * Espelha `filtro-relatorio-financeiro-live.tsx` 1:1 (D-01, 19-CONTEXT.md):
 * `campos` É o estado aplicado, cada `onChange` escreve direto no estado do
 * pai, sem nenhum botão de submit/"Consultar" — é essa ausência que
 * implementa o filtro ao vivo. Não tem `Collapsible` próprio — quem
 * suspende/expande é `DinheiroImobiliariaView`, mesma composição já shipada
 * em `relatorio-financeiro-dedicado.tsx`.
 */
export function FiltroReconciliacao({
  campos,
  onChange,
}: {
  campos: FiltroReconciliacaoValores
  onChange: (
    updater: (atual: FiltroReconciliacaoValores) => FiltroReconciliacaoValores
  ) => void
}) {
  function atualizarCampo(
    campo: "imovel" | "proprietario" | "inquilino" | "id" | "periodo",
    valor: string
  ) {
    onChange((atual) => ({ ...atual, [campo]: valor }))
  }

  const temFiltroPreenchido = Boolean(
    campos.imovel.trim() ||
      campos.proprietario.trim() ||
      campos.inquilino.trim() ||
      campos.id.trim() ||
      campos.periodo.trim()
  )

  return (
    <div className="mt-3 rounded-2xl border border-border bg-card px-5 py-4">
      <div className="grid grid-cols-[repeat(5,1fr)] gap-3">
        <div className="flex flex-col gap-2">
          <Label htmlFor="filtro-reconc-imovel">Imóvel</Label>
          <Input
            id="filtro-reconc-imovel"
            type="text"
            placeholder="Endereço do imóvel"
            value={campos.imovel}
            onChange={(event) => atualizarCampo("imovel", event.target.value)}
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="filtro-reconc-proprietario">Proprietário</Label>
          <Input
            id="filtro-reconc-proprietario"
            type="text"
            placeholder="Nome do proprietário"
            value={campos.proprietario}
            onChange={(event) =>
              atualizarCampo("proprietario", event.target.value)
            }
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="filtro-reconc-inquilino">Inquilino</Label>
          <Input
            id="filtro-reconc-inquilino"
            type="text"
            placeholder="Nome do inquilino"
            value={campos.inquilino}
            onChange={(event) =>
              atualizarCampo("inquilino", event.target.value)
            }
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="filtro-reconc-id">ID do contrato</Label>
          <Input
            id="filtro-reconc-id"
            type="text"
            inputMode="numeric"
            placeholder="Ex: 12"
            value={campos.id}
            onChange={(event) => atualizarCampo("id", event.target.value)}
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="filtro-reconc-periodo">Período</Label>
          <Input
            id="filtro-reconc-periodo"
            type="month"
            value={campos.periodo}
            onChange={(event) => atualizarCampo("periodo", event.target.value)}
          />
        </div>
      </div>

      {temFiltroPreenchido && (
        <div className="mt-3 flex justify-end">
          <Button
            variant="ghost"
            onClick={() => onChange(() => filtroReconciliacaoVazio())}
          >
            Limpar filtros
          </Button>
        </div>
      )}
    </div>
  )
}
