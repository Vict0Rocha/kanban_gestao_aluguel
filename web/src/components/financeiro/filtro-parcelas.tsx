"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { Filter, X } from "lucide-react"

import {
  Collapsible,
  CollapsiblePanel,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

export type FiltroValores = {
  proprietario: string
  inquilino: string
  periodo: string
  id: string
}

/**
 * D-03/D-04/D-05 (Phase 6.1). Estado do drawer é local (`React.useState`,
 * mesmo padrão que `mes-switcher.tsx` já usava para o próprio toggle de
 * competência) — inicial aberto só quando a URL já chegou com algum dos
 * quatro parâmetros (`filtrosAtivos`), fechado caso contrário. O servidor
 * (`financeiro/page.tsx`) é sempre quem decide o resultado: este componente
 * nunca filtra `linhas` em memória, só monta a URL e navega.
 */
export function FiltroParcelas({
  titulo,
  subtitulo,
  totalResultados,
  filtrosAtivos,
  filtroInicial,
}: {
  titulo: string
  subtitulo?: string
  totalResultados: number
  filtrosAtivos: boolean
  filtroInicial: FiltroValores
}) {
  const router = useRouter()

  const [aberto, setAberto] = React.useState(filtrosAtivos)
  const [campos, setCampos] = React.useState<FiltroValores>(filtroInicial)

  function atualizarCampo(campo: keyof FiltroValores, valor: string) {
    setCampos((atual) => ({ ...atual, [campo]: valor }))
  }

  function consultar() {
    const params = new URLSearchParams()
    if (campos.proprietario.trim()) {
      params.set("proprietario", campos.proprietario.trim())
    }
    if (campos.inquilino.trim()) {
      params.set("inquilino", campos.inquilino.trim())
    }
    if (campos.periodo.trim()) {
      params.set("periodo", campos.periodo.trim())
    }
    if (campos.id.trim()) {
      params.set("id", campos.id.trim())
    }

    const query = params.toString()
    router.push(query ? `/financeiro?${query}` : "/financeiro")
  }

  function limpar() {
    setCampos({ proprietario: "", inquilino: "", periodo: "", id: "" })
    router.push("/financeiro")
    // D-04/D-05: Limpar NÃO fecha o drawer — o usuário fica com o
    // formulário vazio e pronto para preencher de novo.
  }

  return (
    <Collapsible open={aberto} onOpenChange={setAberto}>
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="font-heading text-base font-bold text-foreground">
            {titulo}
          </h2>
          {subtitulo && (
            <p className="text-sm text-muted-foreground">{subtitulo}</p>
          )}
        </div>
        <div className="flex items-center gap-3">
          {filtrosAtivos && (
            <span className="text-sm text-muted-foreground">
              {totalResultados} resultado{totalResultados === 1 ? "" : "s"}{" "}
              para a busca
            </span>
          )}
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
          <div className="grid grid-cols-[repeat(4,1fr)_auto] items-end gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="filtro-proprietario">Proprietário</Label>
              <Input
                id="filtro-proprietario"
                type="text"
                placeholder="Nome do proprietário"
                value={campos.proprietario}
                onChange={(event) =>
                  atualizarCampo("proprietario", event.target.value)
                }
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="filtro-inquilino">Inquilino</Label>
              <Input
                id="filtro-inquilino"
                type="text"
                placeholder="Nome do inquilino"
                value={campos.inquilino}
                onChange={(event) =>
                  atualizarCampo("inquilino", event.target.value)
                }
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="filtro-periodo">Período (vencimento)</Label>
              <Input
                id="filtro-periodo"
                type="month"
                value={campos.periodo}
                onChange={(event) =>
                  atualizarCampo("periodo", event.target.value)
                }
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="filtro-id">ID do contrato</Label>
              <Input
                id="filtro-id"
                type="text"
                inputMode="numeric"
                placeholder="Ex: 12"
                value={campos.id}
                onChange={(event) => atualizarCampo("id", event.target.value)}
              />
            </div>
            <div className="flex gap-2">
              <Button variant="default" onClick={consultar}>
                Consultar
              </Button>
              <Button variant="ghost" onClick={limpar}>
                Limpar
              </Button>
            </div>
          </div>
        </div>
      </CollapsiblePanel>
    </Collapsible>
  )
}
