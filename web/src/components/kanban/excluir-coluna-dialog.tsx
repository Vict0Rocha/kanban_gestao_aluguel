"use client"

import * as React from "react"
import { Trash2 } from "lucide-react"

import type { Column as ColumnType } from "@/lib/kanban/types"
import { Button } from "@/components/ui/button"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"

/**
 * Exclusão de coluna (D-01/D-02, 17-CONTEXT.md). Três ramos, resolvidos
 * síncrono a partir do estado que o `Board` já mantém (sem pré-voo
 * assíncrono, diferente de `excluir-contrato-dialog.tsx`):
 *
 * 1. Coluna vazia — confirmação simples, comportamento idêntico ao de antes
 *    desta fase (EXCOL-01).
 * 2. Coluna com cards mas nenhuma outra coluna no board — bloqueada, sem
 *    botão destrutivo (EXCOL-03, D-02).
 * 3. Coluna com cards e ao menos um destino disponível — seletor de coluna
 *    (mesmo padrão visual de `ReordenarDialog`) + "Mover e excluir" numa
 *    única ação (EXCOL-02, D-01).
 */
export function ExcluirColunaDialog({
  column,
  outrasColunas,
  onExcluirVazia,
  onExcluirComMovimento,
}: {
  column: ColumnType
  outrasColunas: ColumnType[]
  onExcluirVazia: (columnId: string) => void
  onExcluirComMovimento: (columnId: string, destinoColumnId: string) => void
}) {
  const vazia = column.cards.length === 0
  const [open, setOpen] = React.useState(false)
  const [selecionada, setSelecionada] = React.useState<string | null>(null)

  const [wasOpen, setWasOpen] = React.useState(open)
  if (open !== wasOpen) {
    setWasOpen(open)
    if (open) setSelecionada(null)
  }

  const trigger = (
    <Button
      variant="ghost"
      size="icon-sm"
      className="text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
      aria-label="Excluir coluna"
    >
      <Trash2 className="size-3.5" />
    </Button>
  )

  if (vazia) {
    return (
      <AlertDialog>
        <AlertDialogTrigger render={trigger} />
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir a coluna &quot;{column.name}&quot;?</AlertDialogTitle>
            <AlertDialogDescription>Essa ação não pode ser desfeita.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={() => onExcluirVazia(column.id)}>
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    )
  }

  if (outrasColunas.length === 0) {
    return (
      <AlertDialog>
        <AlertDialogTrigger render={trigger} />
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Não é possível excluir esta coluna</AlertDialogTitle>
            <AlertDialogDescription>
              Crie outra coluna antes de excluir esta.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel variant="outline">Fechar</AlertDialogCancel>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    )
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={trigger} />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            Mover os {column.cards.length} imóveis e excluir &quot;{column.name}&quot;
          </DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-1">
          {outrasColunas.map((c) => (
            <Button
              key={c.id}
              type="button"
              variant={selecionada === c.id ? "default" : "ghost"}
              className="justify-start"
              onClick={() => setSelecionada(c.id)}
            >
              {c.name}
            </Button>
          ))}
        </div>
        <DialogFooter>
          <Button
            type="button"
            disabled={!selecionada}
            onClick={() => {
              onExcluirComMovimento(column.id, selecionada!)
              setOpen(false)
            }}
          >
            Mover e excluir
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
