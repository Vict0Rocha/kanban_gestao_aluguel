import { formatCurrency, formatDate } from "@/lib/kanban/format"
import type { ContractRow } from "@/lib/kanban/report"
import { ContractStatusBadge } from "@/components/reports/contract-status-badge"
import { usePagination, Pagination } from "@/components/pagination"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

export function ContractsTable({
  rows,
  resetKey,
}: {
  rows: ContractRow[]
  /** Chave de identidade do filtro ativo em `ReportsView` — decide quando a
   * paginação volta para a página 1 (PAGIN-03). */
  resetKey: unknown
}) {
  const { itensDaPagina, pagina, totalPaginas, setPagina } = usePagination(
    rows,
    resetKey
  )

  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <h2 className="font-heading text-base font-bold text-foreground">
        Situação dos contratos
      </h2>
      <p className="mt-0.5 text-sm text-muted-foreground">
        Ordenado pelo mais urgente — vencidos primeiro, depois os que vencem antes.
      </p>

      {rows.length === 0 ? (
        <p className="mt-6 text-sm text-muted-foreground">
          Nenhum imóvel corresponde aos filtros selecionados.
        </p>
      ) : (
        <div className="mt-4">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Imóvel</TableHead>
                <TableHead>Proprietário</TableHead>
                <TableHead>Inquilino</TableHead>
                <TableHead>Coluna</TableHead>
                <TableHead className="text-right">Valor</TableHead>
                <TableHead>Fim do contrato</TableHead>
                <TableHead>Situação</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {itensDaPagina.map(({ card, columnName, status, daysLeft }) => (
                <TableRow key={card.id}>
                  <TableCell className="font-medium text-foreground">
                    {card.endereco}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {card.proprietario}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {card.inquilino ?? "—"}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {columnName}
                  </TableCell>
                  <TableCell className="text-right tabular-nums text-foreground">
                    {formatCurrency(card.valor)}
                  </TableCell>
                  <TableCell className="tabular-nums text-muted-foreground">
                    {card.periodo_fim ? formatDate(card.periodo_fim) : "—"}
                  </TableCell>
                  <TableCell>
                    <ContractStatusBadge status={status} daysLeft={daysLeft} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <Pagination
            pagina={pagina}
            totalPaginas={totalPaginas}
            onPaginaChange={setPagina}
          />
        </div>
      )}
    </div>
  )
}
