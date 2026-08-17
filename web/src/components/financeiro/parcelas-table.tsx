import { formatCurrency, formatDate } from "@/lib/kanban/format"
import type { LinhaParcela } from "@/lib/kanban/parcelas"
import { ParcelaSituacaoBadge } from "@/components/financeiro/parcela-situacao-badge"
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
  "sem-parcela-no-periodo":
    "Nenhuma parcela para este período. Contratos ativos sem parcela aqui já passaram do período contratado.",
} as const

export function ParcelasTable({
  titulo,
  linhas,
  erro,
  vazio,
}: {
  titulo: string
  linhas: LinhaParcela[]
  erro?: boolean
  vazio: "sem-contrato-ativo" | "sem-parcela-no-periodo"
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
          {VAZIO_LABEL[vazio]}
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
                  <TableCell>
                    <ParcelaSituacaoBadge situacao={linha.situacao} />
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
