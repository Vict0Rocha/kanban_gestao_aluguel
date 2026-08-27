"use client"

import * as React from "react"
import { ArrowDownUp } from "lucide-react"

import type { Column as ColumnType } from "@/lib/kanban/types"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"

/**
 * Popup de seleção de coluna para o botão "Reordenar" (D-06, D-07,
 * 16-CONTEXT.md) — composto de dois padrões já existentes neste projeto:
 * o Dialog+DialogTrigger de `add-card-dialog.tsx` e o estado
 * `saving`/`error`/resincronização por abertura de `arquivar-contrato-dialog.tsx`.
 * Sem `RadioGroup` (não existe neste design system) — a seleção é uma lista
 * de botões, o selecionado com `variant="default"`, os demais `variant="ghost"`.
 * Confirmar move numa única ação, sem segunda tela (D-07).
 */
export function ReordenarDialog({
  columns,
  disabled,
  onConfirm,
}: {
  columns: ColumnType[]
  disabled?: boolean
  onConfirm: (columnId: string) => Promise<void>
}) {
  const [open, setOpen] = React.useState(false)
  const [selecionada, setSelecionada] = React.useState<string | null>(null)
  const [saving, setSaving] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  // Resincroniza a cada abertura — mesmo truque de ArquivarContratoDialog.
  const [wasOpen, setWasOpen] = React.useState(open)
  if (open !== wasOpen) {
    setWasOpen(open)
    if (open) {
      setSelecionada(null)
      setSaving(false)
      setError(null)
    }
  }

  async function handleConfirm() {
    if (!selecionada) return
    setSaving(true)
    setError(null)
    try {
      await onConfirm(selecionada)
      setOpen(false)
      setSelecionada(null)
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Não foi possível reordenar os imóveis. Tente novamente."
      )
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={<Button variant="outline" disabled={disabled} className="gap-1.5" />}
      >
        <ArrowDownUp className="size-4" />
        Reordenar
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Mover cards para uma coluna</DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-1">
          {columns.map((column) => (
            <Button
              key={column.id}
              type="button"
              variant={selecionada === column.id ? "default" : "ghost"}
              className="justify-start"
              onClick={() => setSelecionada(column.id)}
            >
              {column.name}
            </Button>
          ))}
        </div>

        {error && <p className="text-sm text-destructive">{error}</p>}

        <DialogFooter>
          <Button
            type="button"
            disabled={!selecionada || saving}
            onClick={() => {
              void handleConfirm()
            }}
          >
            {saving ? "Movendo..." : "Confirmar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
