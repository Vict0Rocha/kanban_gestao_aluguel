"use client"

import * as React from "react"
import { useRouter } from "next/navigation"

import type { TipoCaucao } from "@/lib/kanban/taxas"
import { registrarEventoCaucao } from "@/lib/kanban/queries"
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

/**
 * Copy de diálogo por `tipo` — distinto do mapa de ícones em
 * `caucao-evento-label.tsx` (aquele é o rótulo do evento na lista, este é
 * título/copy de submit do diálogo).
 */
const TIPO_CAUCAO_DIALOGO = {
  recebido: {
    title: "Registrar caução recebida",
    submitLabel: "Registrar recebimento",
    submitLoadingLabel: "Registrando...",
  },
  devolvido: {
    title: "Registrar devolução da caução",
    submitLabel: "Registrar devolução",
    submitLoadingLabel: "Registrando...",
  },
  usado: {
    title: "Registrar uso da caução",
    submitLabel: "Registrar uso",
    submitLoadingLabel: "Registrando...",
  },
} as const

const RUBRICA_ERRO = {
  recebido: "o recebimento",
  devolvido: "a devolução",
  usado: "o uso",
} as const

/**
 * D-06/IMOB-04: nunca a estrutura destrutiva de confirmação — caução é
 * sempre aditiva (um novo evento registrado), nunca destrutiva. Mesmo
 * padrão de generalização por mapa (`TIPO[tipo]`) que `CancelarLancamentoDialog`
 * usa para copy, mas com a estrutura de `RegistrarPagamentoDialog` (três
 * campos, `Dialog` comum).
 */
export function RegistrarEventoCaucaoDialog({
  cardId,
  tipo,
  saldoAtual,
  todayISO,
  open,
  onOpenChange,
}: {
  cardId: string
  tipo: TipoCaucao
  saldoAtual: number
  todayISO: string
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const router = useRouter()

  const valorInicial = React.useCallback(
    (t: TipoCaucao) => (t === "recebido" ? "" : saldoAtual.toFixed(2).replace(".", ",")),
    [saldoAtual]
  )

  const [valor, setValor] = React.useState(() => valorInicial(tipo))
  const [data, setData] = React.useState(todayISO)
  const [observacao, setObservacao] = React.useState("")
  const [error, setError] = React.useState<string | null>(null)
  const [saving, setSaving] = React.useState(false)

  // Resincroniza a cada abertura — mesmo truque de RegistrarPagamentoDialog:
  // sem isso, o valor/erro de um evento anterior vazaria para o próximo.
  const [wasOpen, setWasOpen] = React.useState(open)
  if (open !== wasOpen) {
    setWasOpen(open)
    if (open) {
      setValor(valorInicial(tipo))
      setData(todayISO)
      setObservacao("")
      setError(null)
    }
  }

  const copy = TIPO_CAUCAO_DIALOGO[tipo]

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()

    const parsedValor = Number(valor.replace(",", "."))
    if (!valor || !Number.isFinite(parsedValor) || parsedValor <= 0) {
      setError("Informe um valor válido.")
      return
    }

    setSaving(true)
    setError(null)
    try {
      await registrarEventoCaucao(
        cardId,
        tipo,
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
          : `Não foi possível registrar ${RUBRICA_ERRO[tipo]}. Tente novamente.`
      )
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{copy.title}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="valor-caucao">Valor (R$)</Label>
            <Input
              id="valor-caucao"
              inputMode="decimal"
              placeholder="0,00"
              value={valor}
              onChange={(e) => setValor(e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="data-caucao">Data</Label>
            <Input
              id="data-caucao"
              type="date"
              value={data}
              onChange={(e) => setData(e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="observacao-caucao">Observação (opcional)</Label>
            <Textarea
              id="observacao-caucao"
              value={observacao}
              onChange={(e) => setObservacao(e.target.value)}
            />
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}

          <DialogFooter>
            <Button type="submit" disabled={saving}>
              {saving ? copy.submitLoadingLabel : copy.submitLabel}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
