"use client"

import * as React from "react"
import { CircleDashed, PiggyBank, Percent, ShieldCheck, Undo2 } from "lucide-react"

import { cn } from "@/lib/utils"
import { statusCaucao, type CaucaoEventoDetalhado, type StatusCaucao } from "@/lib/kanban/taxas"
import { CaucaoHistoricoSheet } from "@/components/financeiro/caucao-historico-sheet"
import { ConfigurarPercentuaisDialog } from "@/components/financeiro/configurar-percentuais-dialog"
import { IdPill } from "@/components/financeiro/id-pill"
import { Button } from "@/components/ui/button"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

/**
 * A-01: tipo bespoke desta tela, não o `Card` completo — mesmo padrão de
 * `ContratoFiltro`/`CardVisibilidade`. `caucaoEventos` chega já buscado e
 * agrupado por `card_id` pela página (A-01, 13-06-PLAN.md) — mesmo padrão
 * de `primeiraCompetenciaPorCard` no plano 13-04.
 */
export type ContratoConfig = {
  id: string
  numero: number
  endereco: string
  proprietario: string
  percentualAdministracao: number
  percentualComissaoPrimeiroAluguel: number
  caucaoEventos: CaucaoEventoDetalhado[]
}

/** Status agregado do contrato (Color § Status tones, 13-UI-SPEC.md) —
 * distinto de `CAUCAO_TIPO` (caucao-evento-label.tsx), que é o rótulo do
 * evento individual dentro do histórico. */
const STATUS_CAUCAO_LABEL: Record<
  StatusCaucao,
  { icon: typeof CircleDashed; label: string; className: string }
> = {
  "nao-recebida": {
    icon: CircleDashed,
    label: "Não recebida",
    className: "text-muted-foreground",
  },
  recebida: {
    icon: PiggyBank,
    label: "Recebida",
    className: "text-status-good",
  },
  devolvida: {
    icon: Undo2,
    label: "Devolvida",
    className: "text-muted-foreground",
  },
  usada: {
    icon: ShieldCheck,
    label: "Usada",
    className: "text-status-warning",
  },
}

function CaucaoStatusCell({ eventos }: { eventos: CaucaoEventoDetalhado[] }) {
  const status = statusCaucao(eventos)
  const { icon: Icon, label, className } = STATUS_CAUCAO_LABEL[status]

  return (
    <TableCell>
      <span className={cn("inline-flex items-center gap-1.5 text-sm font-semibold", className)}>
        <Icon className="size-3.5 shrink-0" />
        {label}
      </span>
    </TableCell>
  )
}

function AcoesCell({
  linha,
  todayISO,
}: {
  linha: ContratoConfig
  todayISO: string
}) {
  const [dialogoAberto, setDialogoAberto] = React.useState(false)
  const [caucaoAberta, setCaucaoAberta] = React.useState(false)

  return (
    <TableCell>
      <div className="flex items-center gap-2">
        <Button
          variant="ghost"
          size="sm"
          aria-label={`Editar percentuais — ${linha.endereco}`}
          onClick={() => setDialogoAberto(true)}
        >
          <Percent className="size-4" />
          Editar percentuais
        </Button>
        <Button
          variant="outline"
          size="sm"
          aria-label={`Caução — ${linha.endereco}`}
          onClick={() => setCaucaoAberta(true)}
        >
          <PiggyBank className="size-4" />
          {"Caução"}
        </Button>
      </div>
      <ConfigurarPercentuaisDialog
        cardId={linha.id}
        endereco={linha.endereco}
        percentualAdministracao={linha.percentualAdministracao}
        percentualComissaoPrimeiroAluguel={linha.percentualComissaoPrimeiroAluguel}
        open={dialogoAberto}
        onOpenChange={setDialogoAberto}
      />
      <CaucaoHistoricoSheet
        cardId={linha.id}
        numero={linha.numero}
        endereco={linha.endereco}
        proprietario={linha.proprietario}
        eventos={linha.caucaoEventos}
        todayISO={todayISO}
        open={caucaoAberta}
        onOpenChange={setCaucaoAberta}
      />
    </TableCell>
  )
}

export function ConfiguracaoFinanceiraView({
  linhas,
  todayISO,
  erro,
}: {
  linhas: ContratoConfig[]
  todayISO: string
  erro?: boolean
}) {
  return (
    <div className="rounded-2xl border border-border bg-card p-6">
      {erro ? (
        <p className="text-sm text-muted-foreground">
          Não foi possível carregar os dados agora. Tente novamente.
        </p>
      ) : linhas.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Nenhum contrato cadastrado ainda.
        </p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>ID</TableHead>
              <TableHead>Imóvel</TableHead>
              <TableHead>Proprietário</TableHead>
              <TableHead className="text-right">Administração</TableHead>
              <TableHead className="text-right">Comissão 1º aluguel</TableHead>
              <TableHead>Caução</TableHead>
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
                <TableCell className="text-right tabular-nums">
                  {linha.percentualAdministracao}%
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {linha.percentualComissaoPrimeiroAluguel}%
                </TableCell>
                <CaucaoStatusCell eventos={linha.caucaoEventos} />
                <AcoesCell linha={linha} todayISO={todayISO} />
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  )
}
