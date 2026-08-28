"use client"

import * as React from "react"
import { CircleDashed, PiggyBank, Percent, ShieldCheck, Undo2 } from "lucide-react"

import { cn } from "@/lib/utils"
import { statusCaucao, type CaucaoEventoDetalhado, type StatusCaucao } from "@/lib/kanban/taxas"
import { CaucaoHistoricoSheet } from "@/components/financeiro/caucao-historico-sheet"
import { ConfigurarPercentuaisDialog } from "@/components/financeiro/configurar-percentuais-dialog"
import { IdPill } from "@/components/financeiro/id-pill"
import { usePagination, Pagination } from "@/components/pagination"
import { normalizeText } from "@/lib/kanban/search"
import { SearchField } from "@/components/search-field"
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

/**
 * D-03 (18-CONTEXT.md): ContratoConfig não tem inquilino/telefone/
 * observacoes como o Card completo do Board, então buildMatcher/
 * searchableText de search.ts (tipados para Card) não se aplicam aqui —
 * matcher próprio para os três campos já visíveis na tabela: número,
 * endereço, proprietário. Mesmo contrato de buildMatcher: todos os termos
 * precisam bater, cada um em qualquer um dos três campos.
 */
function searchableText(linha: ContratoConfig): string {
  return normalizeText(
    [String(linha.numero), linha.endereco, linha.proprietario].join(" ")
  )
}

function buildContratoMatcher(query: string): (linha: ContratoConfig) => boolean {
  const terms = normalizeText(query).split(/\s+/).filter(Boolean)
  if (terms.length === 0) return () => true

  return (linha) => {
    const text = searchableText(linha)
    return terms.every((term) => text.includes(term))
  }
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
  const [query, setQuery] = React.useState("")
  const matchesQuery = React.useMemo(() => buildContratoMatcher(query), [query])
  const linhasFiltradas = React.useMemo(
    () => linhas.filter(matchesQuery),
    [linhas, matchesQuery]
  )

  // FILTCFG-02 (18-CONTEXT.md): query é useState do próprio
  // ConfiguracaoFinanceiraView — não é remontado por um router.refresh()
  // disparado por ConfigurarPercentuaisDialog/CaucaoHistoricoSheet (só a
  // prop `linhas` ganha referência nova), então editar percentuais/caução
  // nunca reseta a página do usuário. Mudar o termo de busca muda `query` e
  // volta a paginação para a página 1 (as duas metades de FILTCFG-02).
  const { itensDaPagina, pagina, totalPaginas, setPagina } = usePagination(
    linhasFiltradas,
    query
  )

  return (
    <div className="rounded-2xl border border-border bg-card p-6">
      {!erro && linhas.length > 0 && (
        <div className="mb-4">
          <SearchField
            value={query}
            onChange={setQuery}
            placeholder="Buscar por número, endereço ou proprietário..."
            resultSummary={`${linhasFiltradas.length} de ${linhas.length} contratos`}
          />
        </div>
      )}
      {erro ? (
        <p className="text-sm text-muted-foreground">
          Não foi possível carregar os dados agora. Tente novamente.
        </p>
      ) : linhas.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Nenhum contrato cadastrado ainda.
        </p>
      ) : linhasFiltradas.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Nenhum contrato corresponde à busca.
        </p>
      ) : (
        <div>
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
              {itensDaPagina.map((linha) => (
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
