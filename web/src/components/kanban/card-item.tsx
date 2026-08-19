"use client"

import * as React from "react"
import { useSortable } from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import { Archive, Trash2, User } from "lucide-react"

import { cn } from "@/lib/utils"
import { formatCurrency } from "@/lib/kanban/format"
import type { Card } from "@/lib/kanban/types"
import type { CardDetailsInput } from "@/lib/kanban/types"
import { IdPill } from "@/components/financeiro/id-pill"
import { Button } from "@/components/ui/button"
import { CardDetailDialog } from "@/components/kanban/card-detail-dialog"
import { ArquivarContratoDialog } from "@/components/kanban/arquivar-contrato-dialog"
import { ExcluirContratoDialog } from "@/components/kanban/excluir-contrato-dialog"

export function CardItem({
  card,
  matched,
  onDelete,
  onArquivado,
  onUpdate,
  onToggleAtivo,
  registerRef,
}: {
  card: Card
  /**
   * `undefined` = sem busca ativa, todos os cards em estado normal.
   * `true`/`false` = bate ou não bate com o que foi digitado. O card que não
   * bate só esmaece: continua legível, clicável e arrastável, porque a busca
   * aqui serve para achar um imóvel no meio dos outros, não para escondê-los.
   */
  matched?: boolean
  /**
   * Mudou de significado no plano 06.2-06: antes pedia ao servidor para
   * excluir o card, agora é chamado DEPOIS que o servidor já confirmou a
   * exclusão (dentro de `ExcluirContratoDialog`) — só tira o card da tela.
   * Mesmo nome, contrato diferente: quem reler este arquivo sem saber disso
   * vai procurar uma chamada de rede aqui e não vai achar nenhuma.
   */
  onDelete: (id: string) => void
  /**
   * O servidor confirmou o arquivamento (dentro de `ArquivarContratoDialog`)
   * — só tira o card da tela. Opcional só para a Task 2 compilar sozinha
   * antes de `board.tsx` repassar a função de verdade na Task 3; a cópia do
   * card no `DragOverlay` também não precisa dela (é só visual).
   */
  onArquivado?: (id: string) => void
  onUpdate: (id: string, input: CardDetailsInput) => Promise<void>
  onToggleAtivo: (id: string, ativo: boolean) => void
  /**
   * Registra o nó DOM deste card no Map do board, para o Enter da busca
   * rolar até ele. Opcional — a cópia visual do card no DragOverlay não
   * recebe essa prop, para não sobrescrever a referência do card real.
   */
  registerRef?: (id: string, el: HTMLDivElement | null) => void
}) {
  const [detailOpen, setDetailOpen] = React.useState(false)
  const [arquivarOpen, setArquivarOpen] = React.useState(false)
  const [excluirOpen, setExcluirOpen] = React.useState(false)

  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: card.id, data: { type: "card", columnId: card.column_id } })

  const setRefs = React.useCallback(
    (el: HTMLDivElement | null) => {
      setNodeRef(el)
      registerRef?.(card.id, el)
    },
    [setNodeRef, registerRef, card.id]
  )

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  }

  return (
    // ArquivarContratoDialog, ExcluirContratoDialog e CardDetailDialog são
    // irmãos do div ordenável abaixo, nunca descendentes dele. React
    // borbulha eventos sintéticos (click, keydown, mousedown...) pela
    // árvore JSX, não pela posição portalada no DOM, então um diálogo
    // aninhado dentro deste div vazaria cada tecla e clique para os
    // listeners de arraste do dnd-kit por baixo — foi isso que já quebrou
    // digitar espaço e selecionar texto no formulário de detalhes uma vez.
    // A restrição fica mais crítica aqui, não menos: o diálogo de exclusão
    // carrega um campo de texto onde o usuário precisa digitar
    // "excluir {numero}", e a barra de espaço é justamente a tecla que
    // vazava.
    <>
      <div
        ref={setRefs}
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
        <Button
          variant="ghost"
          size="icon-sm"
          className="absolute top-1.5 right-1.5 text-muted-foreground opacity-0 group-hover:opacity-100 focus-visible:opacity-100 hover:bg-destructive/10 hover:text-destructive"
          aria-label="Excluir card"
          onPointerDown={(event) => event.stopPropagation()}
          onMouseDown={(event) => event.stopPropagation()}
          onClick={(event) => {
            event.stopPropagation()
            setExcluirOpen(true)
          }}
        >
          <Trash2 className="size-3.5" />
        </Button>

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
        <div className="mt-2 flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5">
            <Button
              variant="ghost"
              size="icon-xs"
              className="-ml-1 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100 hover:bg-muted hover:text-foreground"
              aria-label={`Arquivar ${card.endereco}`}
              onPointerDown={(event) => event.stopPropagation()}
              onMouseDown={(event) => event.stopPropagation()}
              onClick={(event) => {
                event.stopPropagation()
                setArquivarOpen(true)
              }}
            >
              <Archive className="size-3" />
            </Button>
            <p className="text-sm font-semibold text-primary">
              {formatCurrency(card.valor)}
            </p>
          </div>
          <IdPill numero={card.numero} variant="subtle" />
        </div>
      </div>

      <ArquivarContratoDialog
        card={card}
        open={arquivarOpen}
        onOpenChange={setArquivarOpen}
        onArquivado={(id) => onArquivado?.(id)}
      />

      <ExcluirContratoDialog
        card={card}
        open={excluirOpen}
        onOpenChange={setExcluirOpen}
        onExcluido={onDelete}
        onPedirArquivamento={() => {
          setExcluirOpen(false)
          setArquivarOpen(true)
        }}
      />

      <CardDetailDialog
        card={card}
        open={detailOpen}
        onOpenChange={setDetailOpen}
        onSave={onUpdate}
        onToggleAtivo={onToggleAtivo}
      />
    </>
  )
}
