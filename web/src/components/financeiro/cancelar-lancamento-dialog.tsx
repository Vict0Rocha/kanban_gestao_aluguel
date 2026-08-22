"use client"

import * as React from "react"
import { useRouter } from "next/navigation"

import { formatCurrency, formatDate } from "@/lib/kanban/format"
import type { LancamentoDetalhado } from "@/lib/kanban/parcelas"
import { cancelarLancamento } from "@/lib/kanban/queries"
import { TIPO } from "@/components/financeiro/lancamento-tipo-label"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"

/**
 * D-02 (12-CONTEXT.md, herdado de D-01 11-CONTEXT.md): confirmação simples
 * antes de um DELETE de verdade em `parcela_lancamentos` — sem campo de
 * motivo (D-05, 12-CONTEXT.md), cópia estrutural do branch destrutivo de
 * ExcluirContratoDialog, sem a fase de pré-voo e sem `Input`/`Label` de
 * confirmação digitada. Generalizado (D-08, 12-CONTEXT.md) para os três tipos
 * elegíveis via `TIPO[tipo].label`, um componente só em vez de três cópias.
 */
export function CancelarLancamentoDialog({
  parcelaId,
  lancamentoId,
  tipo,
  valor,
  data,
  open,
  onOpenChange,
}: {
  parcelaId: string
  lancamentoId: string
  tipo: Extract<LancamentoDetalhado["tipo"], "pagamento" | "acrescimo" | "desconto">
  valor: number
  data: string
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const router = useRouter()
  const [saving, setSaving] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  const rotulo = TIPO[tipo].label.toLowerCase()

  // Resincroniza a cada abertura — mesmo truque de ExcluirContratoDialog/
  // DestravarParcelaDialog: sem isso, o erro/estado de um lançamento
  // anterior vazaria para o próximo clicado.
  const [wasOpen, setWasOpen] = React.useState(open)
  if (open !== wasOpen) {
    setWasOpen(open)
    if (open) {
      setSaving(false)
      setError(null)
    }
  }

  async function handleConfirm() {
    setSaving(true)
    setError(null)
    try {
      await cancelarLancamento(parcelaId, lancamentoId)
      onOpenChange(false)
      router.refresh()
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : `Não foi possível cancelar o ${rotulo}. Tente novamente.`
      )
      setSaving(false)
    }
  }

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Cancelar este {rotulo}?</AlertDialogTitle>
          <AlertDialogDescription>
            {TIPO[tipo].label} de {formatCurrency(valor)}
            {data ? ` em ${formatDate(data)}` : ""}. O lançamento é apagado e o
            status da parcela é recalculado a partir do que sobrar. Esta ação
            não pode ser desfeita.
          </AlertDialogDescription>
        </AlertDialogHeader>

        {error && <p className="text-sm text-destructive">{error}</p>}

        <AlertDialogFooter>
          <AlertDialogCancel>Voltar</AlertDialogCancel>
          <AlertDialogAction
            variant="destructive"
            disabled={saving}
            onClick={() => {
              void handleConfirm()
            }}
          >
            {saving ? "Cancelando..." : `Cancelar ${rotulo}`}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
