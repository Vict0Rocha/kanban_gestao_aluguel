"use client"

import * as React from "react"
import { useRouter } from "next/navigation"

import { cn } from "@/lib/utils"
import { formatCurrency } from "@/lib/kanban/format"
import { ajustarParcela } from "@/lib/kanban/queries"
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
 * direto (mesmo motivo documentado em report.ts/parcelas.ts).
 */
function descricaoCompetencia(endereco: string, competencia: string): string {
  const [anoStr, mesStr] = competencia.split("-")
  const ano = Number(anoStr)
  const mes = Number(mesStr)
  const mesPorExtenso = mesFormatter.format(new Date(ano, mes - 1, 1))
  return `${endereco} — competência ${mesPorExtenso}/${ano}`
}

type TipoAjuste = "acrescimo" | "desconto"

const OBSERVACAO_PLACEHOLDER: Record<TipoAjuste, string> = {
  acrescimo: "Ex.: multa por atraso",
  desconto: "Ex.: desconto por pagamento antecipado",
}

export function AjustarParcelaDialog({
  parcelaId,
  endereco,
  competencia,
  valorDevido,
  open,
  onOpenChange,
}: {
  parcelaId: string
  endereco: string
  competencia: string
  valorDevido: number
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const router = useRouter()
  const [tipo, setTipo] = React.useState<TipoAjuste>("acrescimo")
  const [valor, setValor] = React.useState("")
  const [observacao, setObservacao] = React.useState("")
  const [error, setError] = React.useState<string | null>(null)
  const [saving, setSaving] = React.useState(false)

  // Resincroniza o formulário toda vez que o diálogo reabre — mesmo truque
  // de CardDetailDialog/RegistrarPagamentoDialog.
  const [wasOpen, setWasOpen] = React.useState(open)
  if (open !== wasOpen) {
    setWasOpen(open)
    if (open) {
      setTipo("acrescimo")
      setValor("")
      setObservacao("")
      setError(null)
    }
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()

    const parsedValor = Number(valor.replace(",", "."))
    if (!valor || !Number.isFinite(parsedValor) || parsedValor <= 0) {
      setError("Informe um valor de ajuste válido.")
      return
    }

    setSaving(true)
    setError(null)
    try {
      await ajustarParcela(parcelaId, tipo, parsedValor, observacao.trim() || null)
      onOpenChange(false)
      router.refresh()
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "Não foi possível registrar o ajuste. Tente novamente."
      )
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Ajustar valor</DialogTitle>
          <p className="text-sm text-muted-foreground">
            {descricaoCompetencia(endereco, competencia)}
          </p>
          <p className="text-sm text-muted-foreground">
            Valor devido atual: {formatCurrency(valorDevido)}
          </p>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div
            role="group"
            aria-label="Tipo de ajuste"
            className="inline-flex items-center gap-1 self-start rounded-full bg-muted p-1"
          >
            <button
              type="button"
              aria-pressed={tipo === "acrescimo"}
              onClick={() => setTipo("acrescimo")}
              className={cn(
                "rounded-full px-3 py-1 text-xs font-semibold transition-colors",
                tipo === "acrescimo"
                  ? "bg-card text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              Acréscimo
            </button>
            <button
              type="button"
              aria-pressed={tipo === "desconto"}
              onClick={() => setTipo("desconto")}
              className={cn(
                "rounded-full px-3 py-1 text-xs font-semibold transition-colors",
                tipo === "desconto"
                  ? "bg-card text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              Desconto
            </button>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="valor-ajuste">Valor do ajuste (R$)</Label>
            <Input
              id="valor-ajuste"
              inputMode="decimal"
              placeholder="0,00"
              value={valor}
              onChange={(e) => setValor(e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="observacao-ajuste">Observação (opcional)</Label>
            <Textarea
              id="observacao-ajuste"
              placeholder={OBSERVACAO_PLACEHOLDER[tipo]}
              value={observacao}
              onChange={(e) => setObservacao(e.target.value)}
            />
          </div>

          <p className="text-sm text-muted-foreground">
            Isso pode mudar a situação da parcela na lista — por exemplo, uma
            parcela paga pode voltar a parcial.
          </p>

          {error && <p className="text-sm text-destructive">{error}</p>}

          <DialogFooter>
            <Button type="submit" disabled={saving}>
              {saving ? "Aplicando..." : "Aplicar ajuste"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
