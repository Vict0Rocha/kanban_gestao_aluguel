"use client"

import * as React from "react"
import {
  AlertCircle,
  ArrowDownToLine,
  ArrowUpFromLine,
  FileDown,
  Filter,
  Percent,
  ShieldCheck,
  Sparkles,
  Wallet,
  X,
} from "lucide-react"

import { formatCurrency, formatDate } from "@/lib/kanban/format"
import {
  calcularReconciliacao,
  filtroReconciliacaoVazio,
  passaFiltroCardsReconciliacao,
  passaFiltroPeriodoReconciliacao,
  passaFiltroTipoReconciliacao,
  type CaucaoEventoRelatorio,
  type FiltroReconciliacaoValores,
  type TaxaImobiliariaRelatorio,
} from "@/lib/kanban/reconciliacao"
import { StatTile } from "@/components/reports/stat-tile"
import { FiltroReconciliacao } from "@/components/reports/filtro-reconciliacao"
import { exportarReconciliacaoPDF } from "@/components/reports/reconciliacao-pdf"
import {
  CAUCAO_TIPO,
  CaucaoEventoLabel,
} from "@/components/financeiro/caucao-evento-label"
import { IdPill } from "@/components/financeiro/id-pill"
import {
  TAXA_ORIGEM,
  TaxaOrigemBadge,
} from "@/components/financeiro/taxa-origem-label"
import { usePagination, Pagination } from "@/components/pagination"
import {
  Collapsible,
  CollapsiblePanel,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import { Button } from "@/components/ui/button"
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
  tipoLabel: string
  observacao: string | null
  cards: {
    endereco: string
    proprietario: string
    numero: number
    inquilino: string | null
  } | null
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
  // `filtro` É o estado aplicado, cada `onChange` recalcula na hora, sem
  // botão "Gerar". Período pré-preenchido com o mês corrente (comportamento
  // preservado do campo solto anterior).
  const [filtro, setFiltro] = React.useState<FiltroReconciliacaoValores>(
    () => ({ ...filtroReconciliacaoVazio(), periodo: hojeISO.slice(0, 7) })
  )
  // Painel fechado por padrão, mesmo padrão de relatorio-financeiro-dedicado.tsx.
  const [aberto, setAberto] = React.useState(false)
  const [exportando, setExportando] = React.useState(false)
  const [erroExportacao, setErroExportacao] = React.useState<string | null>(
    null
  )

  const totais = React.useMemo(
    () => calcularReconciliacao(taxas, caucaoEventos, filtro.periodo, filtro.tipos),
    [taxas, caucaoEventos, filtro.periodo, filtro.tipos]
  )

  // A-02 (13-07-PLAN.md): a "linha unificada" da lista (taxa + caução no
  // mesmo array) é responsabilidade de apresentação, montada aqui — a
  // Server Action devolve os dois arrays separados, espelhando as duas
  // tabelas reais.
  const linhas = React.useMemo<LinhaLista[]>(() => {
    const taxaLinhas: LinhaLista[] = taxas
      .filter((taxa) => passaFiltroPeriodoReconciliacao(taxa.data, filtro.periodo))
      .filter((taxa) => passaFiltroCardsReconciliacao(taxa.cards, filtro))
      .filter((taxa) => passaFiltroTipoReconciliacao(taxa.origem, filtro.tipos))
      .map((taxa) => ({
        id: taxa.id,
        data: taxa.data,
        valor: taxa.valor,
        tipo: <TaxaOrigemBadge origem={taxa.origem} />,
        tipoLabel: TAXA_ORIGEM[taxa.origem].label,
        observacao: taxa.observacao,
        cards: taxa.cards,
      }))

    const caucaoLinhas: LinhaLista[] = caucaoEventos
      .filter((evento) => passaFiltroPeriodoReconciliacao(evento.data, filtro.periodo))
      .filter((evento) => passaFiltroCardsReconciliacao(evento.cards, filtro))
      .filter(() => passaFiltroTipoReconciliacao("caucao", filtro.tipos))
      .map((evento) => ({
        id: evento.id,
        data: evento.data,
        valor: evento.valor,
        tipo: <CaucaoEventoLabel tipo={evento.tipo} />,
        tipoLabel: CAUCAO_TIPO[evento.tipo].label,
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
  }, [taxas, caucaoEventos, filtro])

  // PAGIN-03: chave de identidade dos 5 campos do filtro ativo mais o
  // seletor de tipo — nunca derivada de `taxas`/`caucaoEventos`/`linhas`
  // (essas mudam em qualquer refresh de dado, não só quando o filtro
  // muda), mesmo formato pipe-joined de `reports-view.tsx:133`'s
  // `contractsResetKey`. `filtro.tipos` é um Set — ordenado antes do
  // `join` para que ordem de clique nunca mude a chave de reset para a
  // mesma seleção final (Pitfall 4, 20-RESEARCH.md).
  const resetKey = `${filtro.imovel}|${filtro.proprietario}|${filtro.inquilino}|${filtro.id}|${filtro.periodo}|${[...filtro.tipos].sort().join(",")}`
  const { itensDaPagina, pagina, totalPaginas, setPagina } = usePagination(
    linhas,
    resetKey
  )

  // RESEARCH.md Pitfall #2/Anti-pattern: só recebe `linhas`/`totais`/`filtro`
  // já filtrados e na mesma ordem da tela — nunca dado bruto.
  async function handleExportarPDF() {
    setExportando(true)
    setErroExportacao(null)
    try {
      await exportarReconciliacaoPDF(linhas, totais, filtro, hojeISO)
    } catch {
      setErroExportacao("Não foi possível exportar o PDF. Tente novamente.")
    } finally {
      setExportando(false)
    }
  }

  return (
    <Collapsible open={aberto} onOpenChange={setAberto}>
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div />
          <div className="flex items-center gap-2">
            <CollapsibleTrigger
              render={
                <Button variant="outline" size="sm">
                  {aberto ? (
                    <X className="size-3.5" />
                  ) : (
                    <Filter className="size-3.5" />
                  )}
                  {aberto ? "Fechar filtros" : "Filtrar"}
                </Button>
              }
            />
            <Button
              variant="default"
              onClick={handleExportarPDF}
              disabled={exportando}
            >
              <FileDown className="size-3.5" />
              {exportando ? "Exportando..." : "Exportar PDF"}
            </Button>
          </div>
        </div>

        {erroExportacao ? (
          <div
            role="alert"
            aria-live="assertive"
            className="flex items-start gap-3 rounded-xl border border-destructive/30 bg-card p-3"
          >
            <AlertCircle className="mt-0.5 size-4 shrink-0 text-destructive" />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-foreground">
                {erroExportacao}
              </p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Tente novamente.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setErroExportacao(null)}
              aria-label="Fechar aviso"
              className="shrink-0 rounded-md p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              <X className="size-3.5" />
            </button>
          </div>
        ) : null}

        <CollapsiblePanel>
          <FiltroReconciliacao campos={filtro} onChange={setFiltro} />
        </CollapsiblePanel>

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
              Nenhuma taxa ou movimento de caução encontrado para os filtros
              aplicados.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data</TableHead>
                  <TableHead>Contrato</TableHead>
                  <TableHead>Inquilino</TableHead>
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
                          {linha.cards?.proprietario ?? ""}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {linha.cards?.inquilino ?? ""}
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
    </Collapsible>
  )
}
