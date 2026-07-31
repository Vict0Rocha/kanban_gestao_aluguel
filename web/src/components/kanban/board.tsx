"use client"

import * as React from "react"
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
} from "@dnd-kit/core"
import {
  SortableContext,
  arrayMove,
  horizontalListSortingStrategy,
  sortableKeyboardCoordinates,
} from "@dnd-kit/sortable"

import type { Card, Column as ColumnType } from "@/lib/kanban/types"
import { positionBetween } from "@/lib/kanban/position"
import {
  createCard,
  createColumn,
  deleteCard,
  deleteColumn,
  moveCard,
  renameColumn,
  updateCard,
  updateColumnPosition,
  type CardDetailsInput,
} from "@/lib/kanban/queries"
import { Column } from "@/components/kanban/column"
import { CardItem } from "@/components/kanban/card-item"
import { AddColumnForm } from "@/components/kanban/add-column-form"

function findColumnOf(columns: ColumnType[], id: string): ColumnType | undefined {
  return (
    columns.find((column) => column.id === id) ??
    columns.find((column) => column.cards.some((card) => card.id === id))
  )
}

export function Board({
  boardId,
  initialColumns,
}: {
  boardId: string
  initialColumns: ColumnType[]
}) {
  const [columns, setColumns] = React.useState(initialColumns)
  const [activeCard, setActiveCard] = React.useState<Card | null>(null)
  const [activeColumn, setActiveColumn] = React.useState<ColumnType | null>(null)

  // Mouse and touch are split on purpose. A single PointerSensor would need
  // `touch-action: none` on every card, which kills scrolling a long column
  // by swiping over it. With a touch delay, a swipe scrolls and a press-hold
  // starts the drag — the usual mobile board gesture.
  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, {
      activationConstraint: { delay: 250, tolerance: 8 },
    }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )

  function handleDragStart(event: DragStartEvent) {
    const { active } = event
    if (active.data.current?.type === "column") {
      setActiveColumn(columns.find((c) => c.id === active.id) ?? null)
    } else {
      const column = findColumnOf(columns, active.id as string)
      setActiveCard(column?.cards.find((c) => c.id === active.id) ?? null)
    }
  }

  function handleDragOver(event: DragOverEvent) {
    const { active, over } = event
    if (!over || active.id === over.id) return
    if (active.data.current?.type !== "card") return

    const activeColumnId = findColumnOf(columns, active.id as string)?.id
    const overColumnId =
      over.data.current?.type === "card"
        ? findColumnOf(columns, over.id as string)?.id
        : (over.id as string)

    if (!activeColumnId || !overColumnId || activeColumnId === overColumnId) return

    setColumns((prev) => {
      const from = prev.find((c) => c.id === activeColumnId)
      const to = prev.find((c) => c.id === overColumnId)
      if (!from || !to) return prev

      const movingCard = from.cards.find((c) => c.id === active.id)
      if (!movingCard) return prev

      const overIndex = to.cards.findIndex((c) => c.id === over.id)
      const insertAt = overIndex >= 0 ? overIndex : to.cards.length

      return prev.map((col) => {
        if (col.id === from.id) {
          return { ...col, cards: col.cards.filter((c) => c.id !== active.id) }
        }
        if (col.id === to.id) {
          const nextCards = [...col.cards]
          nextCards.splice(insertAt, 0, { ...movingCard, column_id: to.id })
          return { ...col, cards: nextCards }
        }
        return col
      })
    })
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    setActiveCard(null)
    setActiveColumn(null)
    if (!over) return

    if (active.data.current?.type === "column") {
      if (active.id === over.id) return

      setColumns((prev) => {
        const oldIndex = prev.findIndex((c) => c.id === active.id)
        const newIndex = prev.findIndex((c) => c.id === over.id)
        const reordered = arrayMove(prev, oldIndex, newIndex)

        const newPosition = positionBetween(
          reordered[newIndex - 1]?.position,
          reordered[newIndex + 1]?.position
        )
        reordered[newIndex] = { ...reordered[newIndex], position: newPosition }

        updateColumnPosition(active.id as string, newPosition).catch(console.error)
        return reordered
      })
      return
    }

    // Card: figure out its (possibly just-updated-by-dragOver) column and index.
    const columnId = findColumnOf(columns, active.id as string)?.id
    if (!columnId) return

    setColumns((prev) => {
      const col = prev.find((c) => c.id === columnId)
      if (!col) return prev

      const activeIndex = col.cards.findIndex((c) => c.id === active.id)
      let overIndex = col.cards.findIndex((c) => c.id === over.id)
      if (overIndex === -1) overIndex = col.cards.length - 1

      const reorderedCards =
        activeIndex === overIndex ? col.cards : arrayMove(col.cards, activeIndex, overIndex)

      const newPosition = positionBetween(
        reorderedCards[overIndex - 1]?.position,
        reorderedCards[overIndex + 1]?.position
      )
      reorderedCards[overIndex] = { ...reorderedCards[overIndex], position: newPosition }

      moveCard(active.id as string, columnId, newPosition).catch(console.error)

      return prev.map((c) => (c.id === columnId ? { ...c, cards: reorderedCards } : c))
    })
  }

  async function handleCreateColumn(name: string) {
    const last = columns[columns.length - 1]
    const position = positionBetween(last?.position, undefined)
    const created = await createColumn(boardId, name, position)
    setColumns((prev) => [...prev, { ...created, cards: [] }])
  }

  async function handleRenameColumn(id: string, name: string) {
    setColumns((prev) => prev.map((c) => (c.id === id ? { ...c, name } : c)))
    renameColumn(id, name).catch(console.error)
  }

  async function handleDeleteColumn(id: string) {
    setColumns((prev) => prev.filter((c) => c.id !== id))
    deleteColumn(id).catch(console.error)
  }

  async function handleCreateCard(
    columnId: string,
    input: { proprietario: string; valor: number; endereco: string }
  ) {
    const column = columns.find((c) => c.id === columnId)
    const lastCard = column?.cards[column.cards.length - 1]
    const position = positionBetween(lastCard?.position, undefined)
    const created = await createCard(columnId, position, input)
    setColumns((prev) =>
      prev.map((c) => (c.id === columnId ? { ...c, cards: [...c.cards, created] } : c))
    )
  }

  async function handleUpdateCard(id: string, input: CardDetailsInput) {
    const updated = await updateCard(id, input)
    setColumns((prev) =>
      prev.map((c) => ({
        ...c,
        cards: c.cards.map((card) => (card.id === id ? updated : card)),
      }))
    )
  }

  async function handleDeleteCard(id: string) {
    setColumns((prev) =>
      prev.map((c) => ({ ...c, cards: c.cards.filter((card) => card.id !== id) }))
    )
    deleteCard(id).catch(console.error)
  }

  return (
    <DndContext
      // dnd-kit derives the drag handles' aria-describedby from a
      // module-level counter, which keeps incrementing across requests on the
      // server while the client always restarts at 0 — so the ids disagree and
      // React reports a hydration mismatch. A fixed id makes it deterministic.
      id="kanban-board"
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
    >
      {/* flex-1 + min-h-0 (not h-full) so the board takes the space left over
          by the page header rather than a full copy of the parent's height. */}
      <div className="flex min-h-0 flex-1 gap-4 overflow-x-auto p-4 md:p-6">
        <SortableContext
          items={columns.map((c) => c.id)}
          strategy={horizontalListSortingStrategy}
        >
          {columns.map((column) => (
            <Column
              key={column.id}
              column={column}
              onRename={handleRenameColumn}
              onDeleteColumn={handleDeleteColumn}
              onDeleteCard={handleDeleteCard}
              onUpdateCard={handleUpdateCard}
              onCreateCard={handleCreateCard}
            />
          ))}
        </SortableContext>

        {columns.length === 0 && (
          <div className="flex h-full max-w-sm flex-col justify-center gap-1">
            <p className="font-heading text-sm font-bold text-foreground">
              Seu board está vazio
            </p>
            <p className="text-sm text-muted-foreground">
              Crie colunas para as etapas do seu processo — por exemplo
              &quot;Falta contrato&quot;, &quot;Gerar boletos&quot; e &quot;Em dia&quot;.
            </p>
          </div>
        )}

        <AddColumnForm onCreate={handleCreateColumn} />
      </div>

      <DragOverlay>
        {activeCard && (
          <CardItem card={activeCard} onDelete={() => {}} onUpdate={async () => {}} />
        )}
        {activeColumn && (
          <div className="w-72 rounded-2xl border border-border bg-muted/60 p-3 font-heading text-sm font-bold shadow-lg">
            {activeColumn.name}
          </div>
        )}
      </DragOverlay>
    </DndContext>
  )
}
