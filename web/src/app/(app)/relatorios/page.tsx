import { createClient } from "@/lib/supabase/server"
import type { Column } from "@/lib/kanban/types"
import { hojeEmCuiaba } from "@/lib/kanban/format"
import { ReportsView } from "@/components/reports/reports-view"

export default async function RelatoriosPage() {
  const supabase = await createClient()

  const { data: board } = await supabase
    .from("boards")
    .select("id")
    .order("created_at")
    .limit(1)
    .maybeSingle()

  const columns: Column[] = board
    ? ((
        await supabase
          .from("columns")
          .select("*, cards(*)")
          .eq("board_id", board.id)
          // D-08: mesmo filtro de page.tsx (Board) — sem `!inner`, filtra
          // as linhas do embed `cards` e preserva a coluna, que continua
          // aparecendo vazia em vez de sumir dos relatórios.
          .is("cards.arquivado_em", null)
          .order("position")
      ).data ?? [])
    : []

  // Pin "today" no fuso de Cuiabá (não no fuso do processo — Vercel roda em
  // UTC), para o render do servidor e a hidratação do cliente classificarem
  // os contratos contra a mesma data.
  const todayISO = hojeEmCuiaba()

  return <ReportsView columns={columns} todayISO={todayISO} />
}
