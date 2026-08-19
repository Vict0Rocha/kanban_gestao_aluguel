"use client"

import * as React from "react"
import { useSortable } from "@dnd-kit/sortable"
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import { GripVertical, Trash2 } from "lucide-react"

import { cn } from "@/lib/utils"
import type { Column as ColumnType } from "@/lib/kanban/types"
import type { CardDetailsInput } from "@/lib/kanban/types"
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
  matchedIds,
  onRename,
  onDeleteColumn,
  onDeleteCard,
  onArquivarCard,
  onUpdateCard,
  onToggleAtivo,
  onCreateCard,
  registerRef,
}: {
  column: ColumnType
  searching: boolean
  /** Cards que batem com a busca — realçados, nunca removidos da lista. */
  matchedIds: Set<string>
  onRename: (id: string, name: string) => void
  onDeleteColumn: (id: string) => void
  onDeleteCard: (id: string) => void
  /** Opcional pelo mesmo motivo do `onArquivado` de `CardItem` — ver comentário lá. */
  onArquivarCard?: (id: string) => void
  onUpdateCard: (id: string, input: CardDetailsInput) => Promise<void>
  onToggleAtivo: (id: string, ativo: boolean) => void
  onCreateCard: (
    columnId: string,
    input: { proprietario: string; valor: number; endereco: string }
  ) => Promise<void>
  registerRef?: (id: string, el: HTMLDivElement | null) => void
}) {
  const [editingName, setEditingName] = React.useState(false)
  const [name, setName] = React.useState(column.name)

  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: column.id, data: { type: "column" } })

  const matchesHere = searching
    ? column.cards.filter((card) => matchedIds.has(card.id)).length
    : 0

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
          className="cursor-grab touch-none text-muted-foreground hover:text-foreground active:cursor-grabbing"
          aria-label="Reordenar coluna"
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

        {/* Durante a busca, quantos desta coluna estão em destaque — é o que
            diz de relance em qual etapa procurar. */}
        <span
          className={cn(
            "shrink-0 text-xs tabular-nums",
            searching && matchesHere > 0
              ? "font-semibold text-primary"
              : "text-muted-foreground"
          )}
        >
          {searching
            ? `${matchesHere} de ${column.cards.length}`
            : column.cards.length}
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
              matched={searching ? matchedIds.has(card.id) : undefined}
              onDelete={onDeleteCard}
              onArquivado={onArquivarCard}
              onUpdate={onUpdateCard}
              onToggleAtivo={onToggleAtivo}
              registerRef={registerRef}
            />
          ))}
        </SortableContext>

        {column.cards.length === 0 && (
          <p className="rounded-xl border border-dashed border-border px-3 py-6 text-center text-xs text-muted-foreground">
            Arraste um imóvel para cá ou adicione um novo abaixo.
          </p>
        )}
      </div>

      <div className="p-2">
        <AddCardDialog
          onCreate={(input) => onCreateCard(column.id, input)}
        />
      </div>
    </div>
  )
}
