import { createClient } from "@/lib/supabase/server"
import type { Column } from "@/lib/kanban/types"
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

  // Pin "today" on the server so the server render and the client hydration
  // classify contracts against the exact same date.
  const now = new Date()
  const todayISO = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`

  return <ReportsView columns={columns} todayISO={todayISO} />
}
