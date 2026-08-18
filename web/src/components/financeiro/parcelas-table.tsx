"use client"

import * as React from "react"
import { Banknote, History } from "lucide-react"

import { formatCurrency, formatDate } from "@/lib/kanban/format"
import type { LinhaParcela } from "@/lib/kanban/parcelas"
import { AjustarParcelaDialog } from "@/components/financeiro/ajustar-parcela-dialog"
import { IdPill } from "@/components/financeiro/id-pill"
import { ParcelaHistoricoSheet } from "@/components/financeiro/parcela-historico-sheet"
import { ParcelaSituacaoBadge } from "@/components/financeiro/parcela-situacao-badge"
import { RegistrarPagamentoDialog } from "@/components/financeiro/registrar-pagamento-dialog"
import { Button } from "@/components/ui/button"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

const VAZIO_LABEL = {
  "sem-contrato-ativo":
    "Nenhum contrato ativo no momento. Marque um contrato como ativo no board para ele começar a gerar parcelas automaticamente.",
  "sem-parcela-hoje":
    "Nenhuma parcela vence hoje. Use os filtros para consultar outro período.",
  "sem-resultado-filtro":
    "Nenhuma parcela encontrada para os filtros aplicados.",
} as const

function AcoesCell({
  linha,
  todayISO,
}: {
  linha: LinhaParcela
  todayISO: string
}) {
  const [dialogoAberto, setDialogoAberto] = React.useState<
    "pagamento" | "ajustar" | "historico" | null
  >(null)

  return (
    <TableCell className="flex items-center gap-2">
      <Button
        variant="outline"
        aria-label={`Registrar pagamento — ${linha.endereco}`}
        onClick={() => setDialogoAberto("pagamento")}
      >
        <Banknote className="size-4" />
        Pagamento
      </Button>
      <Button
        variant="ghost"
        aria-label={`Ajustar valor — ${linha.endereco}`}
        onClick={() => setDialogoAberto("ajustar")}
      >
        Ajustar
      </Button>
      <Button
        variant="ghost"
        size="icon"
        aria-label={`Ver histórico de lançamentos — ${linha.endereco}`}
        onClick={() => setDialogoAberto("historico")}
      >
        <History className="size-4" />
      </Button>
      <RegistrarPagamentoDialog
        parcelaId={linha.id}
        endereco={linha.endereco}
        competencia={linha.competencia}
        valorDevido={linha.valorDevido}
        valorPago={linha.valorPago}
        todayISO={todayISO}
        open={dialogoAberto === "pagamento"}
        onOpenChange={(open) => setDialogoAberto(open ? "pagamento" : null)}
      />
      <AjustarParcelaDialog
        parcelaId={linha.id}
        endereco={linha.endereco}
        competencia={linha.competencia}
        valorDevido={linha.valorDevido}
        open={dialogoAberto === "ajustar"}
        onOpenChange={(open) => setDialogoAberto(open ? "ajustar" : null)}
      />
      <ParcelaHistoricoSheet
        endereco={linha.endereco}
        competencia={linha.competencia}
        vencimento={linha.vencimento}
        lancamentos={linha.lancamentos}
        open={dialogoAberto === "historico"}
        onOpenChange={(open) => setDialogoAberto(open ? "historico" : null)}
      />
    </TableCell>
  )
}

export function ParcelasTable({
  titulo,
  subtitulo,
  linhas,
  erro,
  vazio,
  todayISO,
}: {
  titulo: string
  subtitulo?: string
  linhas: LinhaParcela[]
  erro?: boolean
  vazio: "sem-contrato-ativo" | "sem-parcela-hoje" | "sem-resultado-filtro"
  todayISO: string
}) {
  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <h2 className="font-heading text-base font-bold text-foreground">
        {titulo}
      </h2>
      {subtitulo && (
        <p className="text-sm text-muted-foreground">{subtitulo}</p>
      )}

      {erro ? (
        <p className="mt-1 text-sm text-muted-foreground">
          Não foi possível carregar as parcelas. Tente novamente.
        </p>
      ) : linhas.length === 0 ? (
        <p className="mt-1 text-sm text-muted-foreground">
          {VAZIO_LABEL[vazio]}
        </p>
      ) : (
        <div className="mt-4">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>ID</TableHead>
                <TableHead>Imóvel</TableHead>
                <TableHead>Proprietário</TableHead>
                <TableHead>Vencimento</TableHead>
                <TableHead className="text-right">Valor devido</TableHead>
                <TableHead className="text-right">Valor pago</TableHead>
                <TableHead>Situação</TableHead>
                <TableHead>Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {linhas.map((linha) => (
                <TableRow key={linha.id}>
                  <TableCell>
                    <IdPill numero={linha.numero} />
                  </TableCell>
                  <TableCell className="text-sm font-semibold text-foreground">
                    {linha.endereco}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {linha.proprietario}
                  </TableCell>
                  <TableCell className="tabular-nums text-muted-foreground">
                    {formatDate(linha.vencimento)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatCurrency(linha.valorDevido)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatCurrency(linha.valorPago)}
                  </TableCell>
                  <TableCell>
                    <ParcelaSituacaoBadge situacao={linha.situacao} />
                  </TableCell>
                  <AcoesCell linha={linha} todayISO={todayISO} />
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  )
}
