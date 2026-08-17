import { formatCurrency, formatDate } from "@/lib/kanban/format"
import type { LinhaParcela } from "@/lib/kanban/parcelas"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

// O badge com ícone e cor de status entra no plano 05-02 — aqui só o rótulo
// em português, sem cor nenhuma.
const SITUACAO_LABEL: Record<LinhaParcela["situacao"], string> = {
  a_vencer: "A vencer",
  vencida: "Vencida",
  paga: "Paga",
  parcial: "Parcial",
  conciliada: "Conciliada",
}

export function ParcelasTable({
  titulo,
  linhas,
  erro,
}: {
  titulo: string
  linhas: LinhaParcela[]
  erro?: boolean
}) {
  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <h2 className="font-heading text-base font-bold text-foreground">
        {titulo}
      </h2>

      {erro ? (
        <p className="mt-1 text-sm text-muted-foreground">
          Não foi possível carregar as parcelas deste mês. Tente novamente.
        </p>
      ) : linhas.length === 0 ? (
        <p className="mt-1 text-sm text-muted-foreground">
          Nenhuma parcela para este período.
        </p>
      ) : (
        <div className="mt-4">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Imóvel</TableHead>
                <TableHead>Proprietário</TableHead>
                <TableHead>Vencimento</TableHead>
                <TableHead className="text-right">Valor devido</TableHead>
                <TableHead className="text-right">Valor pago</TableHead>
                <TableHead>Situação</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {linhas.map((linha) => (
                <TableRow key={linha.id}>
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
                  <TableCell className="text-xs font-semibold">
                    {SITUACAO_LABEL[linha.situacao]}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  )
}
