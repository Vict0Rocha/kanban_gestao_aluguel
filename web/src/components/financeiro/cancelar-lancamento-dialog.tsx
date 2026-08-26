"use client"

import * as React from "react"
import { useRouter } from "next/navigation"

import { formatCurrency, formatDate } from "@/lib/kanban/format"
import {
  cancelarEventoCaucao,
  cancelarLancamento,
  cancelarTaxaImobiliaria,
} from "@/lib/kanban/queries"
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
 * antes de um DELETE de verdade — sem campo de motivo (D-05, 12-CONTEXT.md),
 * cópia estrutural do branch destrutivo de ExcluirContratoDialog, sem a fase
 * de pré-voo e sem `Input`/`Label` de confirmação digitada. Generalizado
 * (D-08, 12-CONTEXT.md) para os três tipos elegíveis de lançamento, um
 * componente só em vez de três cópias — e generalizado de novo (D-06,
 * CANIMOB-05, 14-CONTEXT.md/A-02) para também cobrir taxa da imobiliária:
 * `parentId`/`itemId` nomeiam os props pelo domínio do lançamento (não da
 * parcela), porque a próxima Server Action a entrar aqui
 * (`cancelarEventoCaucaoAction`, plano 14-05) recebe `cardId`, não
 * `parcelaId`. `rotulo`/`acao` chegam prontos do chamador em vez de um
 * `tipo` fechado — o chamador já sabe o rótulo certo (`TIPO[tipo].label` ou
 * `Taxa · {origem}`), este componente não precisa mais conhecer os dois
 * vocabulários.
 */
export function CancelarLancamentoDialog({
  parentId,
  itemId,
  rotulo,
  acao,
  valor,
  data,
  open,
  onOpenChange,
}: {
  parentId: string
  itemId: string
  rotulo: string
  acao: "lancamento" | "taxa" | "caucao"
  valor: number
  data: string
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const router = useRouter()
  const [saving, setSaving] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  const rotuloMinusculo = rotulo.toLowerCase()

  // Resincroniza a cada abertura — mesmo truque de ExcluirContratoDialog/
  // DestravarParcelaDialog: sem isso, o erro/estado de um item anterior
  // vazaria para o próximo clicado.
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
      if (acao === "taxa") {
        await cancelarTaxaImobiliaria(parentId, itemId)
      } else if (acao === "caucao") {
        await cancelarEventoCaucao(parentId, itemId)
      } else {
        await cancelarLancamento(parentId, itemId)
      }
      onOpenChange(false)
      router.refresh()
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : `Não foi possível cancelar o ${rotuloMinusculo}. Tente novamente.`
      )
      setSaving(false)
    }
  }

  const descricaoEfeito =
    acao === "taxa"
      ? "A taxa é apagada e não afeta o valor devido nem o status da parcela."
      : acao === "caucao"
        ? "O evento de caução é apagado. Cancelar este evento libera o cancelamento do que ficou mais recente."
        : "O lançamento é apagado e o status da parcela é recalculado a partir do que sobrar."

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Cancelar {rotuloMinusculo}?</AlertDialogTitle>
          <AlertDialogDescription>
            {rotulo} de {formatCurrency(valor)}
            {data ? ` em ${formatDate(data)}` : ""}. {descricaoEfeito} Esta ação
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
            {saving ? "Cancelando..." : `Cancelar ${rotuloMinusculo}`}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
