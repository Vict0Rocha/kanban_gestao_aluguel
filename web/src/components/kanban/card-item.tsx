"use client"

import * as React from "react"
import { useSortable } from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import { Trash2, User } from "lucide-react"

import { cn } from "@/lib/utils"
import { formatCurrency } from "@/lib/kanban/format"
import type { Card } from "@/lib/kanban/types"
import type { CardDetailsInput } from "@/lib/kanban/queries"
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
  onDelete,
  onUpdate,
}: {
  card: Card
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
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      onClick={() => setDetailOpen(true)}
      className={cn(
        // touch-manipulation (not touch-none) keeps vertical scrolling
        // available on the card itself; the TouchSensor's delay is what
        // distinguishes a swipe from a drag.
        "group relative cursor-pointer touch-manipulation rounded-xl border border-border bg-card p-3 shadow-sm transition-shadow hover:shadow-md",
        isDragging && "opacity-40"
      )}
    >
      <AlertDialog>
        <AlertDialogTrigger
          render={
            <Button
              variant="ghost"
              size="icon-sm"
              className="absolute top-1.5 right-1.5 text-muted-foreground opacity-0 group-hover:opacity-100 hover:bg-destructive/10 hover:text-destructive"
              aria-label="Excluir card"
              onPointerDown={(event) => event.stopPropagation()}
              onClick={(event) => event.stopPropagation()}
            />
          }
        >
          <Trash2 className="size-3.5" />
        </AlertDialogTrigger>
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
      </AlertDialog>

      <p className="pr-6 text-sm font-semibold text-foreground">
        {card.endereco}
      </p>
      <p className="mt-0.5 text-xs text-muted-foreground">
        {card.proprietario}
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

      <div
        onClick={(event) => event.stopPropagation()}
        onPointerDown={(event) => event.stopPropagation()}
      >
        <CardDetailDialog
          card={card}
          open={detailOpen}
          onOpenChange={setDetailOpen}
          onSave={onUpdate}
        />
      </div>
    </div>
  )
}
