"use client"

import * as React from "react"
import { Building2, CalendarClock, UserX, Wallet } from "lucide-react"

import { cn } from "@/lib/utils"
import { formatCurrency } from "@/lib/kanban/format"
import type { Column } from "@/lib/kanban/types"
import {
  EXPIRING_WINDOW_DAYS,
  buildReport,
  parseISODate,
  type ContractStatus,
} from "@/lib/kanban/report"
import { StatTile } from "@/components/reports/stat-tile"
import { ColumnBarChart } from "@/components/reports/column-bar-chart"
import { ContractsTable } from "@/components/reports/contracts-table"

type StatusFilter = ContractStatus | "todos"

const STATUS_FILTERS: { value: StatusFilter; label: string }[] = [
  { value: "todos", label: "Todos" },
  { value: "vencido", label: "Vencidos" },
  { value: "vencendo", label: "Vencendo" },
  { value: "em_dia", label: "Em dia" },
  { value: "sem_data", label: "Sem data" },
]

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

export function ReportsView({
  columns,
  todayISO,
}: {
  columns: Column[]
  /** Fixed on the server so SSR and hydration agree on "today". */
  todayISO: string
}) {
  const [statusFilter, setStatusFilter] = React.useState<StatusFilter>("todos")
  const [columnFilter, setColumnFilter] = React.useState<string>("todas")

  const today = React.useMemo(() => parseISODate(todayISO), [todayISO])

  // One filter row scopes every report below it, so the tiles, the chart and
  // the table always describe the same slice of data.
  const filteredColumns = React.useMemo(() => {
    const byColumn =
      columnFilter === "todas"
        ? columns
        : columns.filter((column) => column.id === columnFilter)

    if (statusFilter === "todos") return byColumn

    // Re-run the status classification per card using the same reference
    // date the report uses, so the filter can't disagree with the badges.
    const full = buildReport(byColumn, today)
    const allowed = new Set(
      full.contratos
        .filter((row) => row.status === statusFilter)
        .map((row) => row.card.id)
    )

    return byColumn.map((column) => ({
      ...column,
      cards: column.cards.filter((card) => allowed.has(card.id)),
    }))
  }, [columns, columnFilter, statusFilter, today])

  const report = React.useMemo(
    () => buildReport(filteredColumns, today),
    [filteredColumns, today]
  )

  const isFiltered = statusFilter !== "todos" || columnFilter !== "todas"

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

      <div className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-4">
        <div className="flex flex-wrap items-center gap-2">
          <span className="w-20 text-xs font-semibold text-muted-foreground uppercase">
            Contrato
          </span>
          {STATUS_FILTERS.map((filter) => (
            <FilterChip
              key={filter.value}
              active={statusFilter === filter.value}
              onClick={() => setStatusFilter(filter.value)}
            >
              {filter.label}
            </FilterChip>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="w-20 text-xs font-semibold text-muted-foreground uppercase">
            Coluna
          </span>
          <FilterChip
            active={columnFilter === "todas"}
            onClick={() => setColumnFilter("todas")}
          >
            Todas
          </FilterChip>
          {columns.map((column) => (
            <FilterChip
              key={column.id}
              active={columnFilter === column.id}
              onClick={() => setColumnFilter(column.id)}
            >
              {column.name}
            </FilterChip>
          ))}
        </div>
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
