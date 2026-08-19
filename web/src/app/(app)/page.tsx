import { createClient } from "@/lib/supabase/server"
import { Board } from "@/components/kanban/board"
import type { Column } from "@/lib/kanban/types"

export default async function BoardPage() {
  const supabase = await createClient()

  const { data: board } = await supabase
    .from("boards")
    .select("id, name")
    .order("created_at")
    .limit(1)
    .maybeSingle()

  const columns: Column[] = board
    ? ((
        await supabase
          .from("columns")
          .select("*, cards(*)")
          .eq("board_id", board.id)
          // D-08: filtro sobre o recurso embutido (sem `!inner`) filtra as
          // LINHAS do embed `cards`, preservando a coluna — uma coluna que
          // ficou sem card por causa deste filtro continua aparecendo,
          // vazia, em vez de sumir do board inteiro.
          .is("cards.arquivado_em", null)
          .order("position")
          .order("position", { referencedTable: "cards" })
      ).data ?? [])
    : []

  return (
    <div className="flex h-full flex-col">
      <div className="p-6 pb-0">
        <h1 className="font-heading text-2xl font-extrabold text-foreground">
          {board?.name ?? "Board Kanban de Aluguel"}
        </h1>
        <p className="text-sm text-muted-foreground">
          Arraste os cards entre as colunas conforme a situação de cada imóvel muda.
        </p>
      </div>

      {board ? (
        <Board boardId={board.id} initialColumns={columns} />
      ) : (
        <div className="m-6 flex flex-1 items-center justify-center rounded-lg border border-dashed border-border text-sm text-muted-foreground">
          Nenhum board encontrado.
        </div>
      )}
    </div>
  )
}
