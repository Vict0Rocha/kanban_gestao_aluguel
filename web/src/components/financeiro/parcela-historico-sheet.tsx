"use client"

import * as React from "react"
import { Trash2 } from "lucide-react"

import { formatCurrency, formatDate } from "@/lib/kanban/format"
import type { LinhaHistoricoParcela } from "@/lib/kanban/parcelas"
import { CancelarLancamentoDialog } from "@/components/financeiro/cancelar-lancamento-dialog"
import { LancamentoTipoLabel, TIPO } from "@/components/financeiro/lancamento-tipo-label"
import { TAXA_ORIGEM, TaxaOrigemBadge } from "@/components/financeiro/taxa-origem-label"
import { Button } from "@/components/ui/button"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"

const mesFormatter = new Intl.DateTimeFormat("pt-BR", { month: "long" })

/** Mês por extenso a partir de "YYYY-MM-DD", sem passar por `new Date(string)`. */
function mesPorExtenso(competencia: string): string {
  const [ano, mes] = competencia.split("-")
  return mesFormatter.format(new Date(Number(ano), Number(mes) - 1, 1))
}

/**
 * D-01 (14-CONTEXT.md): taxa é sempre exibida com prefixo "+" (a imobiliária
 * recebe), mesmo espírito de `prefixoValor` mas sem `tipo` — `taxas_imobiliaria`
 * não tem coluna `tipo`, cada linha já É uma taxa.
 */
function prefixoValorItem(item: LinhaHistoricoParcela): string {
  if (item.kind === "taxa") return `+ ${formatCurrency(item.valor)}`
  if (item.tipo === "destrava") return "—"
  if (item.tipo === "desconto") return `− ${formatCurrency(item.valor)}`
  return `+ ${formatCurrency(item.valor)}`
}

/** Rótulo textual (distinto do componente visual `LancamentoTipoLabel`/
 * `TaxaOrigemBadge`) para o título/descrição de `CancelarLancamentoDialog`,
 * que recebe `rotulo: string` pronto em vez de recalcular a partir de `tipo`
 * (D-06/CANIMOB-05, A-02). */
function rotuloDoItem(item: LinhaHistoricoParcela): string {
  return item.kind === "lancamento"
    ? TIPO[item.tipo].label
    : `Taxa · ${TAXA_ORIGEM[item.origem].label}`
}

export function ParcelaHistoricoSheet({
  endereco,
  competencia,
  vencimento,
  historico,
  parcelaId,
  parcelaConciliada,
  open,
  onOpenChange,
}: {
  endereco: string
  competencia: string
  vencimento: string
  historico: LinhaHistoricoParcela[]
  parcelaId: string
  parcelaConciliada: boolean
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const [ano] = competencia.split("-")
  // CANPAG-01/D-02: qual item (lançamento ou taxa) está com o diálogo de
  // cancelamento aberto — uma instância só, aberta pelo clique da linha,
  // mesmo formato que AcoesCell já usa para os próprios diálogos.
  const [cancelando, setCancelando] = React.useState<LinhaHistoricoParcela | null>(null)

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full p-0 sm:max-w-md">
        <SheetHeader className="border-b border-border">
          <SheetTitle className="font-heading">Histórico — {endereco}</SheetTitle>
          <p className="text-sm text-muted-foreground">
            Competência {mesPorExtenso(competencia)}/{ano} · Vencimento{" "}
            {formatDate(vencimento)}
          </p>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto p-4">
          {historico.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Nenhum lançamento registrado ainda. Dar baixa ou lançar um ajuste
              aparece aqui.
            </p>
          ) : (
            <ul className="flex flex-col gap-3">
              {historico.map((item) => {
                const quem =
                  item.profiles?.full_name ??
                  item.profiles?.email ??
                  "—"

                return (
                  <li
                    key={item.id}
                    className="flex flex-col gap-2 rounded-xl border border-border bg-card p-3"
                  >
                    <div className="flex items-start justify-between gap-2">
                      {item.kind === "lancamento" ? (
                        <LancamentoTipoLabel tipo={item.tipo} />
                      ) : (
                        <TaxaOrigemBadge origem={item.origem} />
                      )}
                      <span className="text-sm font-semibold tabular-nums text-foreground">
                        {prefixoValorItem(item)}
                      </span>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {formatDate(item.data)} · {quem}
                    </p>
                    {item.observacao && (
                      <p className="text-sm text-muted-foreground">
                        {item.observacao}
                      </p>
                    )}
                    {item.kind === "lancamento" && item.motivo && (
                      <p className="text-sm text-muted-foreground">
                        <span className="font-medium text-foreground">Motivo: </span>
                        {item.motivo}
                      </p>
                    )}
                    {(item.kind === "taxa" || ["pagamento", "acrescimo", "desconto"].includes(item.tipo)) && !parcelaConciliada && (
                      <div className="flex justify-end">
                        <Button
                          variant="ghost"
                          size="xs"
                          onClick={() => setCancelando(item)}
                        >
                          <Trash2 className="size-3" />
                          Cancelar
                        </Button>
                      </div>
                    )}
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      </SheetContent>
      <CancelarLancamentoDialog
        parentId={parcelaId}
        itemId={cancelando?.id ?? ""}
        rotulo={cancelando ? rotuloDoItem(cancelando) : ""}
        acao={cancelando?.kind ?? "lancamento"}
        valor={cancelando?.valor ?? 0}
        data={cancelando?.data ?? ""}
        open={cancelando !== null}
        onOpenChange={(open) => {
          if (!open) setCancelando(null)
        }}
      />
    </Sheet>
  )
}
