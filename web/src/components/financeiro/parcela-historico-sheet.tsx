"use client"

import * as React from "react"
import { Trash2 } from "lucide-react"

import { formatCurrency, formatDate } from "@/lib/kanban/format"
import type { LancamentoDetalhado } from "@/lib/kanban/parcelas"
import { CancelarPagamentoDialog } from "@/components/financeiro/cancelar-pagamento-dialog"
import { LancamentoTipoLabel } from "@/components/financeiro/lancamento-tipo-label"
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

function prefixoValor(tipo: LancamentoDetalhado["tipo"], valor: number): string {
  if (tipo === "destrava") return "—"
  if (tipo === "desconto") return `− ${formatCurrency(valor)}`
  return `+ ${formatCurrency(valor)}`
}

export function ParcelaHistoricoSheet({
  endereco,
  competencia,
  vencimento,
  lancamentos,
  parcelaId,
  parcelaConciliada,
  open,
  onOpenChange,
}: {
  endereco: string
  competencia: string
  vencimento: string
  lancamentos: LancamentoDetalhado[]
  parcelaId: string
  parcelaConciliada: boolean
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const [ano] = competencia.split("-")
  // CANPAG-01/D-02: qual lançamento (se algum) está com o diálogo de
  // cancelamento aberto — uma instância só, aberta pelo clique da linha,
  // mesmo formato que AcoesCell já usa para os próprios diálogos.
  const [cancelando, setCancelando] = React.useState<LancamentoDetalhado | null>(null)

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
          {lancamentos.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Nenhum lançamento registrado ainda. Dar baixa ou lançar um ajuste
              aparece aqui.
            </p>
          ) : (
            <ul className="flex flex-col gap-3">
              {lancamentos.map((lancamento) => {
                const quem =
                  lancamento.profiles?.full_name ??
                  lancamento.profiles?.email ??
                  "—"

                return (
                  <li
                    key={lancamento.id}
                    className="flex flex-col gap-2 rounded-xl border border-border bg-card p-3"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <LancamentoTipoLabel tipo={lancamento.tipo} />
                      <span className="text-sm font-semibold tabular-nums text-foreground">
                        {prefixoValor(lancamento.tipo, lancamento.valor)}
                      </span>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {formatDate(lancamento.data)} · {quem}
                    </p>
                    {lancamento.observacao && (
                      <p className="text-sm text-muted-foreground">
                        {lancamento.observacao}
                      </p>
                    )}
                    {lancamento.motivo && (
                      <p className="text-sm text-muted-foreground">
                        <span className="font-medium text-foreground">Motivo: </span>
                        {lancamento.motivo}
                      </p>
                    )}
                    {lancamento.tipo === "pagamento" && !parcelaConciliada && (
                      <div className="flex justify-end">
                        <Button
                          variant="ghost"
                          size="xs"
                          onClick={() => setCancelando(lancamento)}
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
      <CancelarPagamentoDialog
        parcelaId={parcelaId}
        lancamentoId={cancelando?.id ?? ""}
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
