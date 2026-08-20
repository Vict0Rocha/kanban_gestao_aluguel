import { createClient } from "@/lib/supabase/server"
import type { Column } from "@/lib/kanban/types"
import { hojeEmCuiaba } from "@/lib/kanban/format"
import type { ParcelaRelatorio } from "@/lib/kanban/relatorio-financeiro"
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

  let parcelasRelatorio: ParcelaRelatorio[] = []
  let erroRelatorioFinanceiro = false

  try {
    // D-05: propositalmente SEM `.is("cards.arquivado_em", null)` e SEM
    // `.eq("cards.ativo"/"ativo", true)` — ao contrário da query de
    // `columns`/`cards` acima. O relatório financeiro inclui contrato
    // arquivado/inativo (exceção deliberada à regra de visibilidade da
    // Phase 6.2 — ver 08-CONTEXT.md D-05). Não "consertar" adicionando esse
    // filtro de volta: faria os totais silenciosamente perderem dinheiro
    // já pago ou já devido de um contrato arquivado/inativo.
    const { data, error } = await supabase
      .from("parcelas")
      .select(
        "competencia, vencimento, valor_original, status, cards(endereco, proprietario), parcela_lancamentos(tipo, valor)"
      )

    if (error) throw error

    // O parser de `.select()` do supabase-js não conhece o schema (sem
    // Database generics no cliente) e por isso infere o embed `cards` como
    // array — mesmo cast/motivo de `financeiro/page.tsx`:
    // `parcelas.card_id -> cards.id` é muitos-para-um, o PostgREST sempre
    // devolve um objeto único ou null aqui, nunca array.
    parcelasRelatorio = (data ?? []) as unknown as ParcelaRelatorio[]
  } catch (erroCapturado) {
    console.error("relatorios:financeiro", erroCapturado)
    erroRelatorioFinanceiro = true
  }

  // Pin "today" no fuso de Cuiabá (não no fuso do processo — Vercel roda em
  // UTC), para o render do servidor e a hidratação do cliente classificarem
  // os contratos contra a mesma data.
  const todayISO = hojeEmCuiaba()

  return (
    <ReportsView
      columns={columns}
      todayISO={todayISO}
      parcelas={parcelasRelatorio}
      erroRelatorioFinanceiro={erroRelatorioFinanceiro}
    />
  )
}
