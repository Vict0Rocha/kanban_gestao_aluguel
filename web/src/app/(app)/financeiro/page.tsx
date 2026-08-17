import { createClient } from "@/lib/supabase/server"
import {
  competenciasAlvo,
  garantirParcelas,
  montarLinhas,
  type LinhaParcela,
  type ParcelaComCard,
} from "@/lib/kanban/parcelas"
import { FinanceiroView } from "@/components/financeiro/financeiro-view"

export default async function FinanceiroPage() {
  const supabase = await createClient()

  const { data: board } = await supabase
    .from("boards")
    .select("id")
    .order("created_at")
    .limit(1)
    .maybeSingle()

  // Pin "today" on the server, mesma linha usada em relatorios/page.tsx e
  // (app)/layout.tsx (A-04).
  const now = new Date()
  const hojeISO = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`

  let linhasAtual: LinhaParcela[] = []
  let linhasProximo: LinhaParcela[] = []
  let erro = false
  // Se a contagem falhar, tratamos como true: mostrar o texto de período é
  // menos enganoso do que dizer "nenhum contrato ativo" por causa de uma
  // falha de rede.
  let temContratoAtivo = true

  if (board) {
    const competencias = competenciasAlvo(hojeISO)

    const { count, error: erroContagem } = await supabase
      .from("cards")
      .select("id", { count: "exact", head: true })
      .eq("ativo", true)

    if (!erroContagem) {
      temContratoAtivo = (count ?? 0) > 0
    }

    try {
      await garantirParcelas(supabase, competencias)

      const { data, error } = await supabase
        .from("parcelas")
        .select(
          "id, card_id, competencia, vencimento, valor_original, status, cards(endereco, proprietario), parcela_lancamentos(tipo, valor)"
        )
        .in("competencia", competencias)

      if (error) throw error

      // O parser de `.select()` do supabase-js não conhece o schema (sem
      // Database generics no cliente) e por isso infere o embed `cards`
      // como array — mas `parcelas.card_id -> cards.id` é muitos-para-um:
      // o PostgREST sempre devolve um objeto único ou null aqui, nunca
      // array.
      const parcelas = (data ?? []) as unknown as ParcelaComCard[]
      const parcelasDoMesAtual = parcelas.filter(
        (parcela) => parcela.competencia === competencias[0]
      )
      const parcelasDoProximoMes = parcelas.filter(
        (parcela) => parcela.competencia === competencias[1]
      )

      linhasAtual = montarLinhas(parcelasDoMesAtual, hojeISO)
      linhasProximo = montarLinhas(parcelasDoProximoMes, hojeISO)
    } catch (erroCapturado) {
      // O objeto de erro do Supabase nunca chega ao navegador — só o log
      // do servidor. A página renderiza uma constante (ver ParcelasTable).
      console.error("financeiro", erroCapturado)
      erro = true
    }
  }

  return (
    <div className="flex flex-col gap-5 p-6">
      <div>
        <h1 className="font-heading text-2xl font-extrabold text-foreground">
          Financeiro
        </h1>
        <p className="text-sm text-muted-foreground">
          Parcelas do mês atual e do próximo mês de cada contrato ativo.
        </p>
      </div>

      {board ? (
        <FinanceiroView
          linhasAtual={linhasAtual}
          linhasProximo={linhasProximo}
          temContratoAtivo={temContratoAtivo}
          erro={erro}
        />
      ) : (
        <div className="flex flex-1 items-center justify-center rounded-lg border border-dashed border-border text-sm text-muted-foreground">
          Nenhum board encontrado.
        </div>
      )}
    </div>
  )
}
