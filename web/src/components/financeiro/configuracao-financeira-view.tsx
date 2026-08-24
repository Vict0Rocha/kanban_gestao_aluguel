"use client"

import * as React from "react"
import { Percent } from "lucide-react"

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
 * `ContratoFiltro`/`CardVisibilidade`. A coluna/ação de Caução (UI-SPEC §1)
 * entra no plano 13-06, que estende este tipo — ver A-02 do 13-05-PLAN.md.
 */
export type ContratoConfig = {
  id: string
  numero: number
  endereco: string
  proprietario: string
  percentualAdministracao: number
  percentualComissaoPrimeiroAluguel: number
}

function AcoesCell({ linha }: { linha: ContratoConfig }) {
  const [dialogoAberto, setDialogoAberto] = React.useState(false)

  return (
    <TableCell>
      <Button
        variant="ghost"
        size="sm"
        aria-label={`Editar percentuais — ${linha.endereco}`}
        onClick={() => setDialogoAberto(true)}
      >
        <Percent className="size-4" />
        Editar percentuais
      </Button>
      <ConfigurarPercentuaisDialog
        cardId={linha.id}
        endereco={linha.endereco}
        percentualAdministracao={linha.percentualAdministracao}
        percentualComissaoPrimeiroAluguel={linha.percentualComissaoPrimeiroAluguel}
        open={dialogoAberto}
        onOpenChange={setDialogoAberto}
      />
    </TableCell>
  )
}

export function ConfiguracaoFinanceiraView({
  linhas,
  erro,
}: {
  linhas: ContratoConfig[]
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
                <AcoesCell linha={linha} />
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  )
}
