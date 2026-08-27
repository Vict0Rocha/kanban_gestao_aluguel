"use client"

import * as React from "react"
import {
  ArrowDownToLine,
  ArrowUpFromLine,
  Percent,
  ShieldCheck,
  Sparkles,
  Wallet,
} from "lucide-react"

import { formatCurrency, formatDate } from "@/lib/kanban/format"
import {
  calcularReconciliacao,
  passaFiltroPeriodoReconciliacao,
  type CaucaoEventoRelatorio,
  type TaxaImobiliariaRelatorio,
} from "@/lib/kanban/reconciliacao"
import { StatTile } from "@/components/reports/stat-tile"
import { CaucaoEventoLabel } from "@/components/financeiro/caucao-evento-label"
import { IdPill } from "@/components/financeiro/id-pill"
import { TaxaOrigemBadge } from "@/components/financeiro/taxa-origem-label"
import { usePagination, Pagination } from "@/components/pagination"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

type LinhaLista = {
  id: string
  data: string
  valor: number
  tipo: React.ReactNode
  observacao: string | null
  cards: { endereco: string; proprietario: string; numero: number } | null
}

export function DinheiroImobiliariaView({
  taxas,
  caucaoEventos,
  hojeISO,
}: {
  taxas: TaxaImobiliariaRelatorio[]
  caucaoEventos: CaucaoEventoRelatorio[]
  hojeISO: string
}) {
  // D-01 (10-UI-SPEC.md, reusado aqui): sem distinção rascunho/aplicado —
  // `periodo` É o estado aplicado, cada `onChange` recalcula na hora, sem
  // botão "Gerar".
  const [periodo, setPeriodo] = React.useState(() => hojeISO.slice(0, 7))

  const totais = React.useMemo(
    () => calcularReconciliacao(taxas, caucaoEventos, periodo),
    [taxas, caucaoEventos, periodo]
  )

  // A-02 (13-07-PLAN.md): a "linha unificada" da lista (taxa + caução no
  // mesmo array) é responsabilidade de apresentação, montada aqui — a
  // Server Action devolve os dois arrays separados, espelhando as duas
  // tabelas reais.
  const linhas = React.useMemo<LinhaLista[]>(() => {
    const taxaLinhas: LinhaLista[] = taxas
      .filter((taxa) => passaFiltroPeriodoReconciliacao(taxa.data, periodo))
      .map((taxa) => ({
        id: taxa.id,
        data: taxa.data,
        valor: taxa.valor,
        tipo: <TaxaOrigemBadge origem={taxa.origem} />,
        observacao: taxa.observacao,
        cards: taxa.cards,
      }))

    const caucaoLinhas: LinhaLista[] = caucaoEventos
      .filter((evento) => passaFiltroPeriodoReconciliacao(evento.data, periodo))
      .map((evento) => ({
        id: evento.id,
        data: evento.data,
        valor: evento.valor,
        tipo: <CaucaoEventoLabel tipo={evento.tipo} />,
        observacao: evento.observacao,
        cards: evento.cards,
      }))

    // Divergência deliberada de `linhasFiltradas`
    // (relatorio-financeiro-dedicado.tsx), que é ascendente: este relatório
    // é lido "acabei de receber o extrato, confiro as entradas mais
    // recentes primeiro" — mais recente primeiro minimiza rolagem no caso
    // comum.
    return [...taxaLinhas, ...caucaoLinhas].sort((a, b) =>
      b.data < a.data ? -1 : b.data > a.data ? 1 : 0
    )
  }, [taxas, caucaoEventos, periodo])

  // PAGIN-03: `periodo` já é o único filtro desta tela — usado direto como
  // resetKey, sem prop nova.
  const { itensDaPagina, pagina, totalPaginas, setPagina } = usePagination(linhas, periodo)

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div />
        <div className="flex flex-col gap-2">
          <Label htmlFor="dinheiro-imobiliaria-periodo">Período</Label>
          <Input
            id="dinheiro-imobiliaria-periodo"
            type="month"
            value={periodo}
            onChange={(event) => setPeriodo(event.target.value)}
          />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <StatTile
          icon={Percent}
          label="Administração"
          value={formatCurrency(totais.administracao)}
        />
        <StatTile
          icon={Sparkles}
          label="Comissão 1º aluguel"
          value={formatCurrency(totais.comissao)}
        />
        <StatTile
          icon={Wallet}
          label="Total recebido no período"
          value={formatCurrency(totais.totalRecebido)}
        />
        <StatTile
          icon={ArrowDownToLine}
          label="Caução recebida"
          value={formatCurrency(totais.caucaoRecebida)}
        />
        <StatTile
          icon={ArrowUpFromLine}
          label="Caução devolvida"
          value={formatCurrency(totais.caucaoDevolvida)}
        />
        <StatTile
          icon={ShieldCheck}
          label="Caução usada"
          value={formatCurrency(totais.caucaoUsada)}
          hint="Não é uma nova entrada no banco — caução já recebida antes, reclassificada."
        />
      </div>

      <div className="rounded-2xl border border-border bg-card p-6">
        {linhas.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Nenhuma taxa ou movimento de caução no período selecionado.
          </p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Data</TableHead>
                <TableHead>Contrato</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead className="text-right">Valor</TableHead>
                <TableHead>Observação</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {itensDaPagina.map((linha) => (
                <TableRow key={linha.id}>
                  <TableCell className="tabular-nums text-muted-foreground">
                    {formatDate(linha.data)}
                  </TableCell>
                  <TableCell className="text-sm">
                    <div className="flex items-center gap-2">
                      <IdPill numero={linha.cards?.numero ?? 0} />
                      <span className="font-semibold text-foreground">
                        {linha.cards?.endereco ?? ""}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell>{linha.tipo}</TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatCurrency(linha.valor)}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {linha.observacao ?? ""}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
        <Pagination
          pagina={pagina}
          totalPaginas={totalPaginas}
          onPaginaChange={setPagina}
        />
      </div>
    </div>
  )
}
