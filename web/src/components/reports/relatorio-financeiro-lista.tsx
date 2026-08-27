import { formatCurrency, formatDate } from "@/lib/kanban/format"
import { situacaoDaParcela, somarLancamentos } from "@/lib/kanban/parcelas"
import { ParcelaSituacaoBadge } from "@/components/financeiro/parcela-situacao-badge"
import type { ParcelaRelatorio } from "@/lib/kanban/relatorio-financeiro"
import { usePagination, Pagination } from "@/components/pagination"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

const mesFormatter = new Intl.DateTimeFormat("pt-BR", { month: "long" })

/**
 * `competencia` chega como "YYYY-MM-01" — nunca `new Date(competencia)`
 * direto (mesmo motivo documentado em parcelas.ts/registrar-pagamento-dialog.tsx:
 * esse construtor lê a string como UTC e adianta a data um dia no Brasil).
 * `Intl` devolve o mês por extenso em minúsculas em pt-BR — capitalizado
 * manualmente aqui porque esta célula de tabela pede "Agosto de 2026", não o
 * formato "mês/ano" minúsculo usado nos diálogos.
 */
function competenciaLabel(competencia: string): string {
  const [ano, mes] = competencia.split("-").map(Number)
  const mesPorExtenso = mesFormatter.format(new Date(ano, mes - 1, 1))
  const mesCapitalizado =
    mesPorExtenso.charAt(0).toUpperCase() + mesPorExtenso.slice(1)
  return `${mesCapitalizado} de ${ano}`
}

export function RelatorioFinanceiroLista({
  linhas,
  hojeISO,
  resetKey,
}: {
  linhas: ParcelaRelatorio[]
  hojeISO: string
  /** Chave de identidade do filtro ativo em `RelatorioFinanceiroDedicado` —
   * decide quando a paginação volta para a página 1 (PAGIN-03). */
  resetKey: unknown
}) {
  const { itensDaPagina, pagina, totalPaginas, setPagina } = usePagination(
    linhas,
    resetKey
  )

  return (
    <div className="rounded-2xl border border-border bg-card p-6">
      {linhas.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Nenhuma parcela encontrada para os filtros aplicados.
        </p>
      ) : (
        <div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Imóvel</TableHead>
                <TableHead>Proprietário</TableHead>
                <TableHead>Competência</TableHead>
                <TableHead>Vencimento</TableHead>
                <TableHead>Situação</TableHead>
                <TableHead className="text-right">Valor</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {itensDaPagina.map((parcela) => {
                const situacao = situacaoDaParcela(
                  parcela.status,
                  parcela.vencimento,
                  hojeISO
                )
                // D-07: mesma regra de calcularRelatorioFinanceiro — pagas/
                // conciliadas mostram valorPago; a_vencer/vencidas mostram o
                // saldo devido, nunca valor_original bruto.
                const { valorDevido, valorPago } = somarLancamentos(
                  parcela.valor_original,
                  parcela.parcela_lancamentos
                )
                const valor =
                  situacao === "paga" || situacao === "conciliada"
                    ? valorPago
                    : Math.max(valorDevido - valorPago, 0)

                return (
                  <TableRow key={parcela.id}>
                    <TableCell className="text-sm font-semibold text-foreground">
                      {parcela.cards?.endereco ?? ""}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {parcela.cards?.proprietario ?? ""}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {competenciaLabel(parcela.competencia)}
                    </TableCell>
                    <TableCell className="tabular-nums text-muted-foreground">
                      {formatDate(parcela.vencimento)}
                    </TableCell>
                    <TableCell>
                      <ParcelaSituacaoBadge situacao={situacao} className="gap-2" />
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatCurrency(valor)}
                    </TableCell>
                  </TableRow>
                )
              })}
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
