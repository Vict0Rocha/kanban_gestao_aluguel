"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { AlertCircle, Bell, Check, Clock, MessageCircle } from "lucide-react"

import { cn } from "@/lib/utils"
import { formatDate } from "@/lib/kanban/format"
import { resolveAlert } from "@/lib/kanban/queries"
import {
  buildPendingAlerts,
  buildWhatsAppUrl,
  parseAlertDate,
  type CardWithAlerts,
  type PendingAlert,
} from "@/lib/kanban/alerts"
import { Button } from "@/components/ui/button"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet"

function AlertRow({
  alert,
  onResolve,
  busy,
}: {
  alert: PendingAlert
  onResolve: (alert: PendingAlert, status: "enviado" | "descartado") => void
  busy: boolean
}) {
  const overdue = alert.daysLeft < 0
  const waUrl = buildWhatsAppUrl(alert)

  const prazo = overdue
    ? `Venceu há ${Math.abs(alert.daysLeft)}d`
    : alert.daysLeft === 0
      ? "Vence hoje"
      : `Vence em ${alert.daysLeft}d`

  return (
    <li className="flex flex-col gap-2 rounded-xl border border-border bg-card p-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-foreground">
            {alert.card.endereco}
          </p>
          <p className="truncate text-xs text-muted-foreground">
            {alert.card.inquilino ?? "Sem inquilino"} ·{" "}
            {formatDate(alert.triggerDate)}
          </p>
        </div>
        <span
          className={cn(
            "flex shrink-0 items-center gap-1 text-xs font-medium",
            overdue ? "text-status-critical" : "text-status-warning"
          )}
        >
          {overdue ? (
            <AlertCircle className="size-3.5" />
          ) : (
            <Clock className="size-3.5" />
          )}
          {prazo}
        </span>
      </div>

      <div className="flex flex-wrap gap-2">
        {waUrl ? (
          <Button
            size="sm"
            // It renders an <a>, not a <button> — without this Base UI keeps
            // applying native button semantics to a link.
            nativeButton={false}
            render={
              <a href={waUrl} target="_blank" rel="noopener noreferrer" />
            }
          >
            <MessageCircle className="size-3.5" />
            Avisar no WhatsApp
          </Button>
        ) : (
          <span className="text-xs text-muted-foreground">
            Sem telefone cadastrado
          </span>
        )}
        <Button
          size="sm"
          variant="outline"
          disabled={busy}
          onClick={() => onResolve(alert, "enviado")}
        >
          <Check className="size-3.5" />
          Já resolvi
        </Button>
      </div>
    </li>
  )
}

export function AlertsPanel({
  cards,
  todayISO,
  triggerClassName,
}: {
  cards: CardWithAlerts[]
  /** Pinned on the server so SSR and hydration agree on "today". */
  todayISO: string
  triggerClassName?: string
}) {
  const router = useRouter()
  const [open, setOpen] = React.useState(false)
  const [busyId, setBusyId] = React.useState<string | null>(null)

  const today = React.useMemo(() => parseAlertDate(todayISO), [todayISO])
  const alerts = React.useMemo(
    () => buildPendingAlerts(cards, today),
    [cards, today]
  )

  async function handleResolve(
    alert: PendingAlert,
    status: "enviado" | "descartado"
  ) {
    const key = `${alert.card.id}-${alert.type}`
    setBusyId(key)
    try {
      await resolveAlert({
        cardId: alert.card.id,
        type: alert.type,
        triggerDate: alert.triggerDate,
        status,
      })
      router.refresh()
    } catch (error) {
      console.error(error)
    } finally {
      setBusyId(null)
    }
  }

  const count = alerts.length

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger
        render={
          <Button
            variant="ghost"
            size="icon"
            className={cn("relative", triggerClassName)}
            aria-label={
              count > 0
                ? `Alertas de contrato (${count} pendente${count === 1 ? "" : "s"})`
                : "Alertas de contrato"
            }
          />
        }
      >
        <Bell className="size-4" />
        {count > 0 && (
          <span className="absolute -top-0.5 -right-0.5 flex min-w-4 items-center justify-center rounded-full bg-status-critical px-1 text-[10px] font-bold text-white">
            {count > 9 ? "9+" : count}
          </span>
        )}
      </SheetTrigger>

      <SheetContent side="right" className="w-full p-0 sm:max-w-md">
        <SheetHeader className="border-b border-border">
          <SheetTitle className="font-heading">Alertas de contrato</SheetTitle>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto p-4">
          {count === 0 ? (
            <p className="text-sm text-muted-foreground">
              Nenhum contrato vencendo nos próximos 30 dias. Tudo em dia por aqui.
            </p>
          ) : (
            <ul className="flex flex-col gap-3">
              {alerts.map((alert) => (
                <AlertRow
                  key={`${alert.card.id}-${alert.type}`}
                  alert={alert}
                  onResolve={handleResolve}
                  busy={busyId === `${alert.card.id}-${alert.type}`}
                />
              ))}
            </ul>
          )}
        </div>
      </SheetContent>
    </Sheet>
  )
}
