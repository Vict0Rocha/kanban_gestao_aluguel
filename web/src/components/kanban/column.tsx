"use client"

import * as React from "react"
import { useSortable } from "@dnd-kit/sortable"
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import { GripVertical, Trash2 } from "lucide-react"

import { cn } from "@/lib/utils"
import type { FilteredColumn } from "@/lib/kanban/search"
import type { CardDetailsInput } from "@/lib/kanban/queries"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { CardItem } from "@/components/kanban/card-item"
import { AddCardDialog } from "@/components/kanban/add-card-dialog"
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

export function Column({
  column,
  searching,
  onRename,
  onDeleteColumn,
  onDeleteCard,
  onUpdateCard,
  onCreateCard,
}: {
  /** `cards` já vem filtrado pela busca; `totalCards` é o tamanho real. */
  column: FilteredColumn
  searching: boolean
  onRename: (id: string, name: string) => void
  onDeleteColumn: (id: string) => void
  onDeleteCard: (id: string) => void
  onUpdateCard: (id: string, input: CardDetailsInput) => Promise<void>
  onCreateCard: (
    columnId: string,
    input: { proprietario: string; valor: number; endereco: string }
  ) => Promise<void>
}) {
  const [editingName, setEditingName] = React.useState(false)
  const [name, setName] = React.useState(column.name)

  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: column.id, data: { type: "column" }, disabled: searching })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  }

  function commitName() {
    setEditingName(false)
    const trimmed = name.trim()
    if (trimmed && trimmed !== column.name) {
      onRename(column.id, trimmed)
    } else {
      setName(column.name)
    }
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "flex h-full w-72 max-w-[85vw] shrink-0 flex-col rounded-2xl border border-border bg-muted/40",
        isDragging && "opacity-50"
      )}
    >
      <div className="flex items-center gap-1 p-3">
        <button
          type="button"
          {...attributes}
          {...listeners}
          disabled={searching}
          className={cn(
            "touch-none text-muted-foreground",
            searching
              ? "cursor-not-allowed opacity-40"
              : "cursor-grab hover:text-foreground active:cursor-grabbing"
          )}
          aria-label={
            searching
              ? "Reordenar coluna (indisponível durante a busca)"
              : "Reordenar coluna"
          }
        >
          <GripVertical className="size-4" />
        </button>

        {editingName ? (
          <Input
            autoFocus
            value={name}
            onChange={(event) => setName(event.target.value)}
            onBlur={commitName}
            onKeyDown={(event) => {
              if (event.key === "Enter") commitName()
              if (event.key === "Escape") {
                setName(column.name)
                setEditingName(false)
              }
            }}
            className="h-7 flex-1 font-heading font-bold"
          />
        ) : (
          <button
            type="button"
            onClick={() => setEditingName(true)}
            className="flex-1 truncate text-left font-heading text-sm font-bold text-foreground"
          >
            {column.name}
          </button>
        )}

        {/* Durante a busca o contador diz quanto da coluna está escondido, para
            que "2 de 14" não seja lido como "esta coluna só tem 2 imóveis". */}
        <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
          {searching
            ? `${column.cards.length} de ${column.totalCards}`
            : column.totalCards}
        </span>

        <AlertDialog>
          <AlertDialogTrigger
            render={
              <Button
                variant="ghost"
                size="icon-sm"
                className="text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                aria-label="Excluir coluna"
              />
            }
          >
            <Trash2 className="size-3.5" />
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Excluir a coluna &quot;{column.name}&quot;?</AlertDialogTitle>
              <AlertDialogDescription>
                {column.cards.length > 0
                  ? `Os ${column.cards.length} imóveis dessa coluna também serão excluídos. Essa ação não pode ser desfeita.`
                  : "Essa ação não pode ser desfeita."}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction
                variant="destructive"
                onClick={() => onDeleteColumn(column.id)}
              >
                Excluir
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>

      <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto px-3 pb-2">
        <SortableContext
          items={column.cards.map((card) => card.id)}
          strategy={verticalListSortingStrategy}
        >
          {column.cards.map((card) => (
            <CardItem
              key={card.id}
              card={card}
              searching={searching}
              onDelete={onDeleteCard}
              onUpdate={onUpdateCard}
            />
          ))}
        </SortableContext>

        {column.cards.length === 0 && (
          <p className="rounded-xl border border-dashed border-border px-3 py-6 text-center text-xs text-muted-foreground">
            {searching
              ? "Nenhum imóvel desta coluna corresponde à busca."
              : "Arraste um imóvel para cá ou adicione um novo abaixo."}
          </p>
        )}
      </div>

      {!searching && (
        <div className="p-2">
          <AddCardDialog
            onCreate={(input) => onCreateCard(column.id, input)}
          />
        </div>
      )}
    </div>
  )
}
