import type { Card, Column } from "./types"

/** Days ahead within which a contract counts as "expiring soon". */
export const EXPIRING_WINDOW_DAYS = 30

export type ContractStatus = "vencido" | "vencendo" | "em_dia" | "sem_data"

export type ContractRow = {
  card: Card
  columnName: string
  status: ContractStatus
  /** Negative when already past due. Null when the card has no end date. */
  daysLeft: number | null
}

export type ColumnBreakdown = {
  id: string
  name: string
  count: number
  valor: number
}

export type Report = {
  totalImoveis: number
  receitaMensal: number
  semInquilino: number
  vencendo: number
  vencidos: number
  porColuna: ColumnBreakdown[]
  contratos: ContractRow[]
}

/**
 * Postgres `date` arrives as "YYYY-MM-DD". `new Date(str)` would read that as
 * UTC midnight, which lands on the previous day in Brazil (UTC-3) and makes
 * every contract look a day early — so build the date in local time instead.
 */
export function parseISODate(value: string): Date {
  const [year, month, day] = value.split("-").map(Number)
  return new Date(year, month - 1, day)
}

function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate())
}

export function daysBetween(from: Date, to: Date): number {
  const MS_PER_DAY = 24 * 60 * 60 * 1000
  return Math.round(
    (startOfDay(to).getTime() - startOfDay(from).getTime()) / MS_PER_DAY
  )
}

export function contractStatus(
  daysLeft: number | null
): ContractStatus {
  if (daysLeft === null) return "sem_data"
  if (daysLeft < 0) return "vencido"
  if (daysLeft <= EXPIRING_WINDOW_DAYS) return "vencendo"
  return "em_dia"
}

export function buildReport(columns: Column[], today: Date = new Date()): Report {
  const contratos: ContractRow[] = []
  const porColuna: ColumnBreakdown[] = []

  let totalImoveis = 0
  let receitaMensal = 0
  let semInquilino = 0
  let vencendo = 0
  let vencidos = 0

  for (const column of columns) {
    let valorColuna = 0

    for (const card of column.cards) {
      totalImoveis += 1
      receitaMensal += card.valor
      valorColuna += card.valor
      if (!card.inquilino) semInquilino += 1

      const daysLeft = card.periodo_fim
        ? daysBetween(today, parseISODate(card.periodo_fim))
        : null
      const status = contractStatus(daysLeft)

      if (status === "vencendo") vencendo += 1
      if (status === "vencido") vencidos += 1

      contratos.push({ card, columnName: column.name, status, daysLeft })
    }

    porColuna.push({
      id: column.id,
      name: column.name,
      count: column.cards.length,
      valor: valorColuna,
    })
  }

  // Most urgent first: overdue, then soonest to expire. Cards with no end
  // date sort last — there is nothing to act on yet.
  contratos.sort((a, b) => {
    if (a.daysLeft === null) return b.daysLeft === null ? 0 : 1
    if (b.daysLeft === null) return -1
    return a.daysLeft - b.daysLeft
  })

  return {
    totalImoveis,
    receitaMensal,
    semInquilino,
    vencendo,
    vencidos,
    porColuna,
    contratos,
  }
}
