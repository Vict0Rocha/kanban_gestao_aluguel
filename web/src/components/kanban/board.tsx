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

import type {
  Card,
  CardDetailsInput,
  Column as ColumnType,
} from "@/lib/kanban/types"
import { positionBetween } from "@/lib/kanban/position"
import { countCards, isSearching, matchingIds } from "@/lib/kanban/search"
import { SearchField } from "@/components/search-field"
import {
  createCard,
  createColumn,
  deleteColumn,
  moveCard,
  renameColumn,
  setCardAtivo,
  updateCard,
  updateColumnPosition,
} from "@/lib/kanban/queries"
import { Column } from "@/components/kanban/column"
import { CardItem } from "@/components/kanban/card-item"
import { AddColumnForm } from "@/components/kanban/add-column-form"
import { WriteErrorToast } from "@/components/kanban/write-error-toast"

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
  const [writeError, setWriteError] = React.useState<string | null>(null)
  const [query, setQuery] = React.useState("")

  // A busca aqui realça, não filtra: os cards que não batem continuam na tela,
  // apenas esmaecidos. Como nenhum card sai da lista, arrastar segue liberado
  // durante a busca — a posição gravada é calculada entre os vizinhos reais,
  // que são exatamente os que o usuário vê ao soltar.
  const searching = isSearching(query)
  const matchedIds = React.useMemo(
    () => matchingIds(columns, query),
    [columns, query]
  )
  const totalCards = countCards(columns)
  const matchCount = matchedIds.size

  // Nós DOM dos cards, para o Enter da busca rolar até o resultado. Um ref
  // (não estado) porque preencher/esvaziar o Map a cada montagem/desmontagem
  // de card não deve disparar um re-render do board.
  const cardRefs = React.useRef(new Map<string, HTMLDivElement>())
  const registerCardRef = React.useCallback((id: string, el: HTMLDivElement | null) => {
    if (el) {
      cardRefs.current.set(id, el)
    } else {
      cardRefs.current.delete(id)
    }
  }, [])

  function handleSearchSubmit() {
    // Sem essa guarda, Enter com o campo vazio rolaria para o primeiro card
    // do board: query vazia bate com todo mundo via matchingIds.
    if (!searching || matchedIds.size === 0) return

    const [firstMatchId] = matchedIds
    cardRefs.current.get(firstMatchId)?.scrollIntoView({
      behavior: "smooth",
      block: "center",
    })
  }

  // Estado do board no início do arraste. Um arraste entre colunas já alterou
  // `columns` no onDragOver antes do onDragEnd rodar, então este é o único
  // ponto de volta correto se a gravação for recusada.
  const dragSnapshot = React.useRef<ColumnType[] | null>(null)

  const dismissWriteError = React.useCallback(() => setWriteError(null), [])

  /**
   * Escrita otimista: aplica na tela primeiro, grava depois. Se o banco
   * recusar — RLS barrando alguém removido da allowlist com a sessão aberta,
   * ou a rede caindo — devolve o board ao estado anterior e avisa, em vez de
   * deixar a interface mostrando uma mudança que não foi persistida.
   */
  function persistOrRevert(
    optimistic: ColumnType[],
    revertTo: ColumnType[],
    persist: () => Promise<unknown>,
    message: string
  ) {
    setColumns(optimistic)
    persist().catch((error: unknown) => {
      console.error(error)
      setColumns(revertTo)
      // A Server Action explica o que houve ("O valor do aluguel precisa ser
      // maior que zero", "sem permissão ou o registro já não existe"). O texto
      // genérico só entra se a falha vier de antes disso — rede fora, por
      // exemplo, quando nem chegou a haver resposta do servidor.
      const doServidor = error instanceof Error ? error.message : ""
      setWriteError(doServidor || message)
    })
  }

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
    dragSnapshot.current = columns
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

    const revertTo = dragSnapshot.current ?? columns
    dragSnapshot.current = null

    if (!over) return

    if (active.data.current?.type === "column") {
      if (active.id === over.id) return

      const oldIndex = columns.findIndex((c) => c.id === active.id)
      const newIndex = columns.findIndex((c) => c.id === over.id)
      if (oldIndex === -1 || newIndex === -1) return

      const reordered = arrayMove(columns, oldIndex, newIndex)
      const newPosition = positionBetween(
        reordered[newIndex - 1]?.position,
        reordered[newIndex + 1]?.position
      )
      reordered[newIndex] = { ...reordered[newIndex], position: newPosition }

      persistOrRevert(
        reordered,
        revertTo,
        () => updateColumnPosition(active.id as string, newPosition),
        "Não foi possível mover a coluna."
      )
      return
    }

    // Card: figure out its (possibly just-updated-by-dragOver) column and index.
    const columnId = findColumnOf(columns, active.id as string)?.id
    if (!columnId) return

    const col = columns.find((c) => c.id === columnId)
    if (!col) return

    const activeIndex = col.cards.findIndex((c) => c.id === active.id)
    let overIndex = col.cards.findIndex((c) => c.id === over.id)
    if (overIndex === -1) overIndex = col.cards.length - 1

    // Sempre uma cópia: sem o spread, o caso "não mudou de índice" devolvia o
    // próprio array do state e a linha de position abaixo o mutava no lugar.
    const reorderedCards =
      activeIndex === overIndex
        ? [...col.cards]
        : arrayMove(col.cards, activeIndex, overIndex)

    const newPosition = positionBetween(
      reorderedCards[overIndex - 1]?.position,
      reorderedCards[overIndex + 1]?.position
    )
    reorderedCards[overIndex] = { ...reorderedCards[overIndex], position: newPosition }

    persistOrRevert(
      columns.map((c) => (c.id === columnId ? { ...c, cards: reorderedCards } : c)),
      revertTo,
      () => moveCard(active.id as string, columnId, newPosition),
      "Não foi possível mover o imóvel."
    )
  }

  async function handleCreateColumn(name: string) {
    const last = columns[columns.length - 1]
    const position = positionBetween(last?.position, undefined)
    const created = await createColumn(boardId, name, position)
    setColumns((prev) => [...prev, { ...created, cards: [] }])
  }

  async function handleRenameColumn(id: string, name: string) {
    persistOrRevert(
      columns.map((c) => (c.id === id ? { ...c, name } : c)),
      columns,
      () => renameColumn(id, name),
      "Não foi possível renomear a coluna."
    )
  }

  async function handleDeleteColumn(id: string) {
    persistOrRevert(
      columns.filter((c) => c.id !== id),
      columns,
      () => deleteColumn(id),
      "Não foi possível excluir a coluna."
    )
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

  // Arquivar e excluir aguardam o servidor dentro do próprio diálogo, que já
  // tem um estado de espera próprio (rótulo trocando, botão desabilitado) —
  // então o caminho otimista não compraria nenhuma velocidade percebida
  // aqui. Para a exclusão o caminho otimista seria ativamente errado: um
  // card que some e volta voando com um toast se lê como falha técnica,
  // quando o que aconteceu foi uma recusa de política deliberada e
  // correta, que precisa ser lida — e a mensagem pertence ao diálogo que o
  // usuário está olhando, não a um toast no canto. O servidor já
  // respondeu quando estas duas funções rodam; elas só tiram o card da
  // tela.
  function handleDeleteCard(id: string) {
    setColumns((prev) =>
      prev.map((c) => ({
        ...c,
        cards: c.cards.filter((card) => card.id !== id),
      }))
    )
  }

  function handleArquivarCard(id: string) {
    setColumns((prev) =>
      prev.map((c) => ({
        ...c,
        cards: c.cards.filter((card) => card.id !== id),
      }))
    )
  }

  function handleToggleAtivo(id: string, ativo: boolean) {
    persistOrRevert(
      columns.map((c) => ({
        ...c,
        cards: c.cards.map((card) => (card.id === id ? { ...card, ativo } : card)),
      })),
      columns,
      () => setCardAtivo(id, ativo),
      "Não foi possível salvar a alteração do imóvel."
    )
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
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 pt-4 md:px-6">
        <SearchField
          value={query}
          onChange={setQuery}
          onSubmit={handleSearchSubmit}
          resultSummary={
            searching
              ? `${matchCount} de ${totalCards} imóveis em destaque`
              : undefined
          }
        />
        {searching && (
          <p className="text-xs text-muted-foreground">
            {matchCount === 0 ? (
              "Nenhum imóvel encontrado."
            ) : (
              <>
                <span className="font-semibold text-foreground">{matchCount}</span>
                {` de ${totalCards} imóveis em destaque`}
              </>
            )}
          </p>
        )}
      </div>

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
              searching={searching}
              matchedIds={matchedIds}
              onRename={handleRenameColumn}
              onDeleteColumn={handleDeleteColumn}
              onDeleteCard={handleDeleteCard}
              onArquivarCard={handleArquivarCard}
              onUpdateCard={handleUpdateCard}
              onToggleAtivo={handleToggleAtivo}
              onCreateCard={handleCreateCard}
              registerRef={registerCardRef}
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
          <CardItem
            card={activeCard}
            onDelete={() => {}}
            onArquivado={() => {}}
            onUpdate={async () => {}}
            onToggleAtivo={() => {}}
          />
        )}
        {activeColumn && (
          <div className="w-72 rounded-2xl border border-border bg-muted/60 p-3 font-heading text-sm font-bold shadow-lg">
            {activeColumn.name}
          </div>
        )}
      </DragOverlay>

      <WriteErrorToast message={writeError} onDismiss={dismissWriteError} />
    </DndContext>
  )
}
