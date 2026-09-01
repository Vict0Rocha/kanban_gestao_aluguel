"use client"

import * as React from "react"
import { Trash2 } from "lucide-react"

import { formatCurrency, formatDate } from "@/lib/kanban/format"
import { saldoCaucao, type CaucaoEventoDetalhado, type TipoCaucao } from "@/lib/kanban/taxas"
import { CancelarLancamentoDialog } from "@/components/financeiro/cancelar-lancamento-dialog"
import { CAUCAO_TIPO, CaucaoEventoLabel } from "@/components/financeiro/caucao-evento-label"
import { RegistrarEventoCaucaoDialog } from "@/components/financeiro/registrar-evento-caucao-dialog"
import { Button } from "@/components/ui/button"
import {
  Sheet,
  SheetContent,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"

/** `+` para `recebido`, `−` para `devolvido`/`usado` — mesmo molde de
 * `prefixoValor` em `parcela-historico-sheet.tsx`, sem o caso `destrava`,
 * que não existe no ciclo de caução. */
function prefixoValorCaucao(tipo: TipoCaucao, valor: number): string {
  if (tipo === "recebido") return `+ ${formatCurrency(valor)}`
  return `− ${formatCurrency(valor)}`
}

/**
 * A-01 (13-06-PLAN.md): lê os eventos que a própria página de Configuração
 * financeira já buscou (prop `eventos`) — mesmo padrão de
 * `ParcelaHistoricoSheet`, sem `useEffect`/fetch próprio. Ordem cronológica
 * ASCENDENTE (mais antigo primeiro) — trilha de auditoria lida do início ao
 * fim, divergência deliberada da ordem descendente do relatório de
 * reconciliação (plano 13-07). A Phase 14 (D-05, CANIMOB-04) acrescentou
 * cancelamento sequencial a partir do evento mais recente — só o último
 * item do array (`eventos[eventos.length - 1]`) mostra o botão "Cancelar";
 * cancelar o topo libera o que sobrou no novo topo. A leitura direto da prop
 * `eventos`, sem `useEffect`/fetch próprio, e a ordem ascendente continuam
 * exatamente como estavam antes desta fase.
 */
export function CaucaoHistoricoSheet({
  cardId,
  numero,
  endereco,
  proprietario,
  eventos,
  todayISO,
  open,
  onOpenChange,
}: {
  cardId: string
  numero: number
  endereco: string
  proprietario: string
  eventos: CaucaoEventoDetalhado[]
  todayISO: string
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  // Qual tipo de evento está com o diálogo de registro aberto — mesmo
  // padrão de `dialogoAberto` em `AcoesCell`.
  const [dialogoAberto, setDialogoAberto] = React.useState<TipoCaucao | null>(null)

  // Evento com o diálogo de cancelamento aberto — só o mais recente
  // (A-01, 14-05-PLAN.md) chega a ter esse estado setado, porque só ele
  // mostra o botão "Cancelar".
  const [cancelando, setCancelando] = React.useState<CaucaoEventoDetalhado | null>(null)

  const saldo = saldoCaucao(eventos)

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full p-0 sm:max-w-md">
        <SheetHeader className="border-b border-border">
          <SheetTitle className="font-heading">Caução — {endereco}</SheetTitle>
          <p className="text-sm text-muted-foreground">
            Contrato #{numero} · {proprietario} · Saldo atual: {formatCurrency(saldo)}
          </p>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto p-4">
          {eventos.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Nenhum evento de caução registrado ainda.
            </p>
          ) : (
            <ul className="flex flex-col gap-3">
              {eventos.map((evento, index) => {
                const quem =
                  evento.profiles?.full_name ?? evento.profiles?.email ?? "—"
                // A-01 (14-05-PLAN.md): array em ordem ASCENDENTE — o mais
                // recente é sempre o ÚLTIMO índice, nunca o primeiro.
                const ultimo = index === eventos.length - 1

                return (
                  <li
                    key={evento.id}
                    className="flex flex-col gap-2 rounded-xl border border-border bg-card p-3"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <CaucaoEventoLabel tipo={evento.tipo} />
                      <span className="text-sm font-semibold tabular-nums text-foreground">
                        {prefixoValorCaucao(evento.tipo, evento.valor)}
                      </span>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {formatDate(evento.data)} · {quem}
                    </p>
                    {evento.observacao && (
                      <p className="text-sm text-muted-foreground">{evento.observacao}</p>
                    )}
                    {ultimo && (
                      <div className="flex justify-end">
                        <Button variant="ghost" size="xs" onClick={() => setCancelando(evento)}>
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

        <SheetFooter>
          {eventos.length === 0 || saldo <= 0 ? (
            <Button variant="default" onClick={() => setDialogoAberto("recebido")}>
              Registrar caução recebida
            </Button>
          ) : (
            <>
              <Button variant="outline" onClick={() => setDialogoAberto("recebido")}>
                Adicionar recebimento
              </Button>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setDialogoAberto("devolvido")}>
                  Devolver caução
                </Button>
                <Button variant="default" onClick={() => setDialogoAberto("usado")}>
                  Registrar uso
                </Button>
              </div>
            </>
          )}
        </SheetFooter>
      </SheetContent>

      <RegistrarEventoCaucaoDialog
        cardId={cardId}
        tipo={dialogoAberto ?? "recebido"}
        saldoAtual={saldo}
        todayISO={todayISO}
        open={dialogoAberto !== null}
        onOpenChange={(open) => {
          if (!open) setDialogoAberto(null)
        }}
      />

      <CancelarLancamentoDialog
        parentId={cardId}
        itemId={cancelando?.id ?? ""}
        rotulo={cancelando ? `Caução · ${CAUCAO_TIPO[cancelando.tipo].label}` : ""}
        acao="caucao"
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
