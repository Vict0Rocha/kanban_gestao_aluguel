"use client"

import * as React from "react"
import { Building2, CalendarClock, FilterX, UserX, Wallet } from "lucide-react"

import { cn } from "@/lib/utils"
import { formatCurrency } from "@/lib/kanban/format"
import type { Column } from "@/lib/kanban/types"
import {
  EXPIRING_WINDOW_DAYS,
  buildReport,
  cardStatus,
  parseISODate,
  type ContractStatus,
} from "@/lib/kanban/report"
import { buildMatcher, countCards } from "@/lib/kanban/search"
import { SearchField } from "@/components/search-field"
import { StatTile } from "@/components/reports/stat-tile"
import { ColumnBarChart } from "@/components/reports/column-bar-chart"
import { ContractsTable } from "@/components/reports/contracts-table"
import { RelatorioFinanceiro } from "@/components/reports/relatorio-financeiro"
import type { ParcelaRelatorio } from "@/lib/kanban/relatorio-financeiro"

const STATUS_OPTIONS: { value: ContractStatus; label: string }[] = [
  { value: "vencido", label: "Vencidos" },
  { value: "vencendo", label: "Vencendo" },
  { value: "em_dia", label: "Em dia" },
  { value: "sem_data", label: "Sem data" },
]

/** Conjunto vazio = nenhum filtro daquela linha, ou seja, tudo passa. */
function toggle<T>(current: Set<T>, value: T): Set<T> {
  const next = new Set(current)
  if (!next.delete(value)) next.add(value)
  return next
}

function FilterChip({
  active,
  children,
  onClick,
}: {
  active: boolean
  children: React.ReactNode
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
        active
          ? "border-primary bg-primary text-primary-foreground"
          : "border-border bg-card text-muted-foreground hover:bg-muted hover:text-foreground"
      )}
    >
      {children}
    </button>
  )
}

function FilterRow({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="w-20 shrink-0 text-xs font-semibold text-muted-foreground uppercase">
        {label}
      </span>
      {children}
    </div>
  )
}

export function ReportsView({
  columns,
  todayISO,
  parcelas,
  erroRelatorioFinanceiro,
}: {
  columns: Column[]
  /** Fixed on the server so SSR and hydration agree on "today". */
  todayISO: string
  parcelas: ParcelaRelatorio[]
  erroRelatorioFinanceiro: boolean
}) {
  // Conjuntos em vez de valor único: as linhas de filtro se combinam entre si
  // (coluna 1 + coluna 2 com contratos vencidos + sem data, por exemplo), e
  // dentro de cada linha as opções somam em vez de se substituir.
  const [statusFilters, setStatusFilters] = React.useState<Set<ContractStatus>>(
    new Set()
  )
  const [columnFilters, setColumnFilters] = React.useState<Set<string>>(new Set())
  const [query, setQuery] = React.useState("")

  const today = React.useMemo(() => parseISODate(todayISO), [todayISO])

  // Um único pipeline alimenta os indicadores, o gráfico e a tabela, para que
  // os três descrevam sempre a mesma fatia de dados.
  const filteredColumns = React.useMemo(() => {
    const matchesQuery = buildMatcher(query)

    return columns
      .filter((column) => columnFilters.size === 0 || columnFilters.has(column.id))
      .map((column) => ({
        ...column,
        cards: column.cards.filter(
          (card) =>
            matchesQuery(card) &&
            (statusFilters.size === 0 ||
              statusFilters.has(cardStatus(card, today)))
        ),
      }))
  }, [columns, columnFilters, statusFilters, query, today])

  const report = React.useMemo(
    () => buildReport(filteredColumns, today),
    [filteredColumns, today]
  )

  const totalCards = React.useMemo(() => countCards(columns), [columns])
  const isFiltered =
    statusFilters.size > 0 || columnFilters.size > 0 || query.trim() !== ""

  function clearFilters() {
    setStatusFilters(new Set())
    setColumnFilters(new Set())
    setQuery("")
  }

  return (
    <div className="flex flex-col gap-5 p-6">
      <div>
        <h1 className="font-heading text-2xl font-extrabold text-foreground">
          Relatórios
        </h1>
        <p className="text-sm text-muted-foreground">
          Uma visão geral da carteira para apoiar a decisão do dia.
        </p>
      </div>

      <RelatorioFinanceiro
        parcelas={parcelas}
        erro={erroRelatorioFinanceiro}
        todayISO={todayISO}
      />

      <div className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <SearchField
            value={query}
            onChange={setQuery}
            resultSummary={`${report.totalImoveis} de ${totalCards} imóveis`}
          />
          {isFiltered && (
            <button
              type="button"
              onClick={clearFilters}
              className="flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              <FilterX className="size-3.5" />
              Limpar filtros
            </button>
          )}
        </div>

        <FilterRow label="Contrato">
          <FilterChip
            active={statusFilters.size === 0}
            onClick={() => setStatusFilters(new Set())}
          >
            Todos
          </FilterChip>
          {STATUS_OPTIONS.map((option) => (
            <FilterChip
              key={option.value}
              active={statusFilters.has(option.value)}
              onClick={() =>
                setStatusFilters((current) => toggle(current, option.value))
              }
            >
              {option.label}
            </FilterChip>
          ))}
        </FilterRow>

        <FilterRow label="Coluna">
          <FilterChip
            active={columnFilters.size === 0}
            onClick={() => setColumnFilters(new Set())}
          >
            Todas
          </FilterChip>
          {columns.map((column) => (
            <FilterChip
              key={column.id}
              active={columnFilters.has(column.id)}
              onClick={() =>
                setColumnFilters((current) => toggle(current, column.id))
              }
            >
              {column.name}
            </FilterChip>
          ))}
        </FilterRow>

        {isFiltered && (
          <p className="text-xs text-muted-foreground">
            Mostrando{" "}
            <span className="font-semibold text-foreground">
              {report.totalImoveis}
            </span>{" "}
            de {totalCards} imóveis.
          </p>
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile
          icon={Building2}
          label={isFiltered ? "Imóveis no filtro" : "Imóveis na carteira"}
          value={String(report.totalImoveis)}
        />
        <StatTile
          icon={Wallet}
          label="Receita mensal"
          value={formatCurrency(report.receitaMensal)}
          hint="Soma dos aluguéis cadastrados"
        />
        <StatTile
          icon={CalendarClock}
          label="Contratos a vencer"
          value={String(report.vencendo)}
          hint={`Nos próximos ${EXPIRING_WINDOW_DAYS} dias`}
          tone={report.vencendo > 0 ? "alert" : "default"}
        />
        <StatTile
          icon={UserX}
          label="Sem inquilino"
          value={String(report.semInquilino)}
          hint="Imóveis sem locatário definido"
        />
      </div>

      <ColumnBarChart data={report.porColuna} />

      <ContractsTable rows={report.contratos} />
    </div>
  )
}
