"use client"

import * as React from "react"
import { TriangleAlert } from "lucide-react"

import { formatCurrency } from "@/lib/kanban/format"
import { arquivarCard, contarParcelasEmAberto } from "@/lib/kanban/queries"
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
 * Três estados distintos, não um `number | null`: `null` ambiguaria "ainda
 * não resolveu" com "resolveu e a contagem falhou", e um `0` antes da
 * resposta do servidor seria um falso "tudo certo" num aviso (D-10).
 */
type PendenciaEstado =
  | { fase: "conferindo" }
  | { fase: "com-pendencia"; quantidade: number; total: number }
  | { fase: "sem-pendencia" }
  | { fase: "falhou" }

export function ArquivarContratoDialog({
  card,
  open,
  onOpenChange,
  onArquivado,
}: {
  card: { id: string; endereco: string }
  open: boolean
  onOpenChange: (open: boolean) => void
  onArquivado: (cardId: string) => void
}) {
  const [pendencia, setPendencia] = React.useState<PendenciaEstado>({
    fase: "conferindo",
  })
  const [saving, setSaving] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  // Resincroniza a cada abertura — mesmo truque de RegistrarPagamentoDialog.
  // Sem isso, o aviso de pendência do contrato anterior ficaria na tela por
  // um instante ao reabrir este diálogo para um card diferente.
  const [wasOpen, setWasOpen] = React.useState(open)
  if (open !== wasOpen) {
    setWasOpen(open)
    if (open) {
      setPendencia({ fase: "conferindo" })
      setSaving(false)
      setError(null)
    }
  }

  React.useEffect(() => {
    if (!open) return
    let cancelado = false
    contarParcelasEmAberto(card.id)
      .then(({ quantidade, total }) => {
        if (cancelado) return
        setPendencia(
          quantidade > 0
            ? { fase: "com-pendencia", quantidade, total }
            : { fase: "sem-pendencia" }
        )
      })
      .catch(() => {
        if (!cancelado) setPendencia({ fase: "falhou" })
      })
    return () => {
      cancelado = true
    }
  }, [open, card.id])

  async function handleConfirm() {
    setSaving(true)
    setError(null)
    try {
      await arquivarCard(card.id)
      onArquivado(card.id)
      onOpenChange(false)
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Não foi possível arquivar o imóvel. Tente novamente."
      )
      setSaving(false)
    }
  }

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Arquivar este imóvel?</AlertDialogTitle>
          <AlertDialogDescription>
            {card.endereco} — o imóvel sai do board, do Financeiro, dos
            relatórios e dos alertas. Nada é apagado, e você pode desarquivar
            quando quiser.
          </AlertDialogDescription>
        </AlertDialogHeader>

        {pendencia.fase === "conferindo" && (
          <p className="text-sm text-muted-foreground">
            Conferindo parcelas em aberto...
          </p>
        )}

        {pendencia.fase === "com-pendencia" && (
          <div className="flex flex-col gap-1">
            <p className="flex items-center gap-1.5 text-xs font-semibold text-status-warning">
              <TriangleAlert className="size-3.5 shrink-0" />
              {pendencia.quantidade === 1
                ? `1 parcela em aberto, somando ${formatCurrency(pendencia.total)}.`
                : `${pendencia.quantidade} parcelas em aberto, somando ${formatCurrency(pendencia.total)}.`}
            </p>
            <p className="text-sm text-muted-foreground">
              Elas continuam registradas e voltam a aparecer se você
              desarquivar.
            </p>
          </div>
        )}

        {pendencia.fase === "sem-pendencia" && (
          <p className="text-sm text-muted-foreground">
            Nenhuma parcela em aberto neste contrato.
          </p>
        )}

        {pendencia.fase === "falhou" && (
          <p className="text-sm text-muted-foreground">
            Não foi possível conferir as parcelas em aberto. Você ainda pode
            arquivar.
          </p>
        )}

        {error && <p className="text-sm text-destructive">{error}</p>}

        <AlertDialogFooter>
          <AlertDialogCancel>Cancelar</AlertDialogCancel>
          <AlertDialogAction
            variant="default"
            disabled={saving}
            onClick={() => {
              void handleConfirm()
            }}
          >
            {saving ? "Arquivando..." : "Arquivar"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
