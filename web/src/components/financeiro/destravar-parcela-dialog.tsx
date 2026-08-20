"use client"

import * as React from "react"
import { useRouter } from "next/navigation"

import { formatCurrency } from "@/lib/kanban/format"
import { destravarParcela } from "@/lib/kanban/queries"
import { Button } from "@/components/ui/button"
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
 * direto (mesmo motivo documentado em report.ts/parcelas.ts). Mesmo helper
 * dos diálogos irmãos, cópia própria — não compartilhada.
 */
function descricaoCompetencia(endereco: string, competencia: string): string {
  const [anoStr, mesStr] = competencia.split("-")
  const ano = Number(anoStr)
  const mes = Number(mesStr)
  const mesPorExtenso = mesFormatter.format(new Date(ano, mes - 1, 1))
  return `${endereco} — competência ${mesPorExtenso}/${ano}`
}

export function DestravarParcelaDialog({
  parcelaId,
  endereco,
  competencia,
  valorPago,
  open,
  onOpenChange,
}: {
  parcelaId: string
  endereco: string
  competencia: string
  valorPago: number
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const router = useRouter()
  const [motivo, setMotivo] = React.useState("")
  const [error, setError] = React.useState<string | null>(null)
  const [saving, setSaving] = React.useState(false)

  // Resincroniza o formulário toda vez que o diálogo reabre — mesmo truque
  // de CardDetailDialog/RegistrarPagamentoDialog/AjustarParcelaDialog.
  const [wasOpen, setWasOpen] = React.useState(open)
  if (open !== wasOpen) {
    setWasOpen(open)
    if (open) {
      setMotivo("")
      setError(null)
    }
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()

    if (!motivo.trim()) {
      setError("Informe o motivo da destrava.")
      return
    }

    setSaving(true)
    setError(null)
    try {
      await destravarParcela(parcelaId, motivo.trim())
      onOpenChange(false)
      router.refresh()
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "Não foi possível destravar a parcela. Tente novamente."
      )
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Destravar parcela</DialogTitle>
          <p className="text-sm text-muted-foreground">
            {descricaoCompetencia(endereco, competencia)}
          </p>
          <p className="text-sm text-muted-foreground">
            Valor pago: {formatCurrency(valorPago)}
          </p>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="motivo-destrava">Motivo da destrava</Label>
            <Textarea
              id="motivo-destrava"
              placeholder="Ex.: valor lançado errado, corrigir e destravar para nova baixa"
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
            />
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}

          <DialogFooter>
            <Button type="submit" disabled={saving}>
              {saving ? "Destravando..." : "Destravar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
