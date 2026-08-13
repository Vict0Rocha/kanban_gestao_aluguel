"use client"

import * as React from "react"
import { useSortable } from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import { Trash2, User } from "lucide-react"

import { cn } from "@/lib/utils"
import { formatCurrency } from "@/lib/kanban/format"
import type { Card } from "@/lib/kanban/types"
import type { CardDetailsInput } from "@/lib/kanban/types"
import { Button } from "@/components/ui/button"
import { CardDetailDialog } from "@/components/kanban/card-detail-dialog"
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

export function CardItem({
  card,
  matched,
  onDelete,
  onUpdate,
}: {
  card: Card
  /**
   * `undefined` = sem busca ativa, todos os cards em estado normal.
   * `true`/`false` = bate ou não bate com o que foi digitado. O card que não
   * bate só esmaece: continua legível, clicável e arrastável, porque a busca
   * aqui serve para achar um imóvel no meio dos outros, não para escondê-los.
   */
  matched?: boolean
  onDelete: (id: string) => void
  onUpdate: (id: string, input: CardDetailsInput) => Promise<void>
}) {
  const [detailOpen, setDetailOpen] = React.useState(false)

  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: card.id, data: { type: "card", columnId: card.column_id } })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  }

  return (
    // AlertDialogContent and CardDetailDialog are siblings of the sortable
    // div below, never descendants of it. React bubbles synthetic events
    // (click, keydown, mousedown...) through the JSX tree, not the portaled
    // DOM position, so a dialog nested inside this div would leak every
    // keystroke and click to dnd-kit's drag listeners underneath — that's
    // what broke typing spaces and selecting text in the detail form.
    <AlertDialog>
      <div
        ref={setNodeRef}
        style={style}
        {...attributes}
        {...listeners}
        onClick={() => setDetailOpen(true)}
        data-match={matched === undefined ? undefined : matched}
        className={cn(
          "group relative cursor-pointer touch-manipulation rounded-xl border border-border bg-card p-3 shadow-sm transition-all hover:shadow-md",
          matched === true && "border-primary ring-2 ring-primary/60",
          // Esmaecido, não apagado: ainda dá para ler o card ao lado e
          // comparar com o que a busca destacou.
          matched === false && "opacity-45 hover:opacity-100",
          isDragging && "opacity-40"
        )}
      >
        <AlertDialogTrigger
          render={
            <Button
              variant="ghost"
              size="icon-sm"
              className="absolute top-1.5 right-1.5 text-muted-foreground opacity-0 group-hover:opacity-100 hover:bg-destructive/10 hover:text-destructive"
              aria-label="Excluir card"
              onPointerDown={(event) => event.stopPropagation()}
              onMouseDown={(event) => event.stopPropagation()}
              onClick={(event) => event.stopPropagation()}
            />
          }
        >
          <Trash2 className="size-3.5" />
        </AlertDialogTrigger>

        <p className="pr-6 text-sm font-semibold text-foreground">
          {card.proprietario}
        </p>
        <p className="mt-0.5 text-xs text-muted-foreground">
          {card.endereco}
        </p>
        {card.inquilino && (
          <p className="mt-1.5 flex items-center gap-1 text-xs text-muted-foreground">
            <User className="size-3" />
            {card.inquilino}
          </p>
        )}
        <p className="mt-2 text-sm font-semibold text-primary">
          {formatCurrency(card.valor)}
        </p>
      </div>

      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Excluir este imóvel do board?</AlertDialogTitle>
          <AlertDialogDescription>
            {card.endereco} — essa ação não pode ser desfeita.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancelar</AlertDialogCancel>
          <AlertDialogAction
            variant="destructive"
            onClick={() => onDelete(card.id)}
          >
            Excluir
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>

      <CardDetailDialog
        card={card}
        open={detailOpen}
        onOpenChange={setDetailOpen}
        onSave={onUpdate}
      />
    </AlertDialog>
  )
}
