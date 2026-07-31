import type { Card } from "./types"
import { contractStatus, daysBetween, parseISODate } from "./report"

/** Re-exported so alert consumers don't need to reach into the report module. */
export { parseISODate as parseAlertDate }

export type AlertType = "contrato_vencendo" | "contrato_vencido"
export type AlertStatus = "pendente" | "enviado" | "descartado"

/** An `alerts` row as stored — records that someone already handled it. */
export type ResolvedAlert = {
  card_id: string
  type: AlertType
  trigger_date: string
  status: AlertStatus
}

export type CardWithAlerts = Card & { alerts?: ResolvedAlert[] | null }

export type PendingAlert = {
  card: Card
  type: AlertType
  /** The contract's end date — renewing it makes a fresh alert appear. */
  triggerDate: string
  daysLeft: number
}

/**
 * Alerts are derived from the contract dates on every read rather than
 * written ahead of time by a scheduled job, so they are never stale and the
 * app needs no privileged database key. Only the *resolution* is stored.
 */
export function buildPendingAlerts(
  cards: CardWithAlerts[],
  today: Date = new Date()
): PendingAlert[] {
  const pending: PendingAlert[] = []

  for (const card of cards) {
    if (!card.periodo_fim) continue

    const daysLeft = daysBetween(today, parseISODate(card.periodo_fim))
    const status = contractStatus(daysLeft)
    if (status !== "vencendo" && status !== "vencido") continue

    const type: AlertType =
      status === "vencido" ? "contrato_vencido" : "contrato_vencendo"

    // "Expiring" and "expired" are separate alerts on the same date on
    // purpose: dismissing the heads-up shouldn't silence the actual due date.
    const alreadyHandled = (card.alerts ?? []).some(
      (alert) =>
        alert.type === type &&
        alert.trigger_date === card.periodo_fim &&
        alert.status !== "pendente"
    )
    if (alreadyHandled) continue

    pending.push({ card, type, triggerDate: card.periodo_fim, daysLeft })
  }

  // Most urgent first: longest overdue, then closest to expiring.
  return pending.sort((a, b) => a.daysLeft - b.daysLeft)
}

/**
 * wa.me wants digits only, including the country code. Brazilian numbers are
 * usually typed without it (10 digits landline, 11 mobile), so add 55 when
 * it's clearly missing and otherwise leave what the user entered alone.
 */
export function toWhatsAppNumber(phone: string): string | null {
  const digits = phone.replace(/\D/g, "")
  if (digits.length === 10 || digits.length === 11) return `55${digits}`
  if (digits.startsWith("55") && (digits.length === 12 || digits.length === 13)) {
    return digits
  }
  // Anything else is either already international or unusable — send it as
  // typed rather than guessing wrong and messaging a stranger.
  return digits.length >= 10 ? digits : null
}

export function buildAlertMessage(alert: PendingAlert): string {
  const { card, daysLeft } = alert
  const nome = card.inquilino ? `Olá, ${card.inquilino}!` : "Olá!"

  const prazo =
    daysLeft < 0
      ? `venceu em ${formatBR(card.periodo_fim!)}`
      : daysLeft === 0
        ? "vence hoje"
        : `vence em ${daysLeft} ${daysLeft === 1 ? "dia" : "dias"} (${formatBR(card.periodo_fim!)})`

  return `${nome} Passando para avisar que o contrato de aluguel do imóvel ${card.endereco} ${prazo}. Podemos conversar sobre a renovação?`
}

function formatBR(isoDate: string): string {
  const [year, month, day] = isoDate.split("-")
  return `${day}/${month}/${year}`
}

export function buildWhatsAppUrl(alert: PendingAlert): string | null {
  if (!alert.card.telefone) return null
  const number = toWhatsAppNumber(alert.card.telefone)
  if (!number) return null
  return `https://wa.me/${number}?text=${encodeURIComponent(buildAlertMessage(alert))}`
}
