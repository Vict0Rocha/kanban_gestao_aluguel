"use client"

import * as React from "react"
import { useRouter } from "next/navigation"

import { formatCurrency } from "@/lib/kanban/format"
import { registrarPagamento } from "@/lib/kanban/queries"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

const mesFormatter = new Intl.DateTimeFormat("pt-BR", { month: "long" })

/**
 * `competencia` chega como "YYYY-MM-01" — nunca `new Date(competencia)`
 * direto (mesmo motivo documentado em report.ts/parcelas.ts: esse
 * construtor lê a string como UTC e adianta a data um dia no Brasil).
 */
function descricaoCompetencia(endereco: string, competencia: string): string {
  const [anoStr, mesStr] = competencia.split("-")
  const ano = Number(anoStr)
  const mes = Number(mesStr)
  const mesPorExtenso = mesFormatter.format(new Date(ano, mes - 1, 1))
  return `${endereco} — competência ${mesPorExtenso}/${ano}`
}

function valorInicial(valorDevido: number, valorPago: number): string {
  const restante = valorDevido - valorPago
  if (restante <= 0) return ""
  return restante.toFixed(2).replace(".", ",")
}

export function RegistrarPagamentoDialog({
  parcelaId,
  endereco,
  competencia,
  valorDevido,
  valorPago,
  todayISO,
  open,
  onOpenChange,
}: {
  parcelaId: string
  endereco: string
  competencia: string
  valorDevido: number
  valorPago: number
  todayISO: string
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const router = useRouter()
  const [valor, setValor] = React.useState(() =>
    valorInicial(valorDevido, valorPago)
  )
  const [data, setData] = React.useState(todayISO)
  const [observacao, setObservacao] = React.useState("")
  const [error, setError] = React.useState<string | null>(null)
  const [saving, setSaving] = React.useState(false)

  // Resincroniza o formulário toda vez que o diálogo reabre — mesmo truque
  // de CardDetailDialog.
  const [wasOpen, setWasOpen] = React.useState(open)
  if (open !== wasOpen) {
    setWasOpen(open)
    if (open) {
      setValor(valorInicial(valorDevido, valorPago))
      setData(todayISO)
      setObservacao("")
      setError(null)
    }
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()

    const parsedValor = Number(valor.replace(",", "."))
    if (!valor || !Number.isFinite(parsedValor) || parsedValor <= 0) {
      setError("Informe um valor de pagamento válido.")
      return
    }
    if (!data) {
      setError("Informe a data do pagamento.")
      return
    }

    setSaving(true)
    setError(null)
    try {
      await registrarPagamento(
        parcelaId,
        parsedValor,
        data,
        observacao.trim() || null
      )
      onOpenChange(false)
      router.refresh()
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "Não foi possível registrar o pagamento. Tente novamente."
      )
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Registrar pagamento</DialogTitle>
          <p className="text-sm text-muted-foreground">
            {descricaoCompetencia(endereco, competencia)}
          </p>
          <p className="text-sm text-muted-foreground">
            Valor devido: {formatCurrency(valorDevido)} · Já pago:{" "}
            {formatCurrency(valorPago)}
          </p>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="valor-pagamento">Valor recebido (R$)</Label>
            <Input
              id="valor-pagamento"
              inputMode="decimal"
              placeholder="0,00"
              value={valor}
              onChange={(e) => setValor(e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="data-pagamento">Data do pagamento</Label>
            <Input
              id="data-pagamento"
              type="date"
              value={data}
              onChange={(e) => setData(e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="observacao-pagamento">Observação (opcional)</Label>
            <Textarea
              id="observacao-pagamento"
              placeholder="Ex.: pago via Pix"
              value={observacao}
              onChange={(e) => setObservacao(e.target.value)}
            />
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}

          <DialogFooter>
            <Button type="submit" disabled={saving}>
              {saving ? "Registrando..." : "Registrar pagamento"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
