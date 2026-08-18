import { createClient } from "@/lib/supabase/server"
import {
  competenciasAlvo,
  garantirParcelas,
  montarLinhas,
  type LinhaParcela,
  type ParcelaComCard,
} from "@/lib/kanban/parcelas"
import { FinanceiroView } from "@/components/financeiro/financeiro-view"

const SELECT_PARCELA_PADRAO =
  "id, card_id, competencia, vencimento, valor_original, status, cards(endereco, proprietario, numero), parcela_lancamentos(id, tipo, valor, data, observacao, motivo, criado_em, profiles(full_name, email))"

// `!inner` é obrigatório para poder filtrar por coluna do embed — sem ela o
// PostgREST não aceita `.ilike()`/`.eq()` em `cards.*`.
const SELECT_PARCELA_FILTRADA =
  "id, card_id, competencia, vencimento, valor_original, status, cards!inner(endereco, proprietario, numero, inquilino), parcela_lancamentos(id, tipo, valor, data, observacao, motivo, criado_em, profiles(full_name, email))"

/** Dia 1 do mês seguinte a "YYYY-MM", sem passar por Date — mesmo padrão de `competenciasAlvo`. */
function inicioMesSeguinte(periodoYYYYMM: string): string {
  const [anoStr, mesStr] = periodoYYYYMM.split("-")
  const ano = Number(anoStr)
  const mes = Number(mesStr)

  const proximoMes = mes === 12 ? 1 : mes + 1
  const proximoAno = mes === 12 ? ano + 1 : ano

  return `${proximoAno}-${String(proximoMes).padStart(2, "0")}-01`
}

export default async function FinanceiroPage({
  searchParams,
}: {
  searchParams: Promise<{
    proprietario?: string
    inquilino?: string
    periodo?: string
    id?: string
  }>
}) {
  const supabase = await createClient()
  const params = await searchParams

  const proprietario = params.proprietario?.trim() ?? ""
  const inquilino = params.inquilino?.trim() ?? ""
  const periodo = params.periodo?.trim() ?? ""
  const idBusca = params.id?.trim() ?? ""

  // D-03/D-04: qualquer um dos quatro presente substitui a visão padrão.
  const filtrosAtivos = Boolean(
    proprietario || inquilino || periodo || idBusca
  )

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

  let linhas: LinhaParcela[] = []
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
      // D-16: geração preguiçosa continua rodando em toda carga da rota,
      // com filtro aplicado ou não — só a query de LEITURA abaixo muda.
      await garantirParcelas(supabase, competencias)

      let query = supabase
        .from("parcelas")
        .select(filtrosAtivos ? SELECT_PARCELA_FILTRADA : SELECT_PARCELA_PADRAO)

      if (filtrosAtivos) {
        if (proprietario) {
          query = query.ilike("cards.proprietario", `%${proprietario}%`)
        }
        if (inquilino) {
          query = query.ilike("cards.inquilino", `%${inquilino}%`)
        }
        // T-06.1-17: período fora do formato "YYYY-MM" é ignorado
        // silenciosamente, não derruba a página.
        if (/^\d{4}-\d{2}$/.test(periodo)) {
          query = query
            .gte("vencimento", `${periodo}-01`)
            .lt("vencimento", inicioMesSeguinte(periodo))
        }
        // T-06.1-17: id não numérico é ignorado, não derruba a página.
        if (idBusca && Number.isInteger(Number(idBusca))) {
          query = query.eq("cards.numero", Number(idBusca))
        }
      } else {
        // Visão padrão (D-02): só as parcelas vencendo hoje.
        query = query.eq("vencimento", hojeISO)
      }

      const { data, error } = await query

      if (error) throw error

      // O parser de `.select()` do supabase-js não conhece o schema (sem
      // Database generics no cliente) e por isso infere o embed `cards`
      // como array — mas `parcelas.card_id -> cards.id` é muitos-para-um:
      // o PostgREST sempre devolve um objeto único ou null aqui, nunca
      // array.
      const parcelas = (data ?? []) as unknown as ParcelaComCard[]

      linhas = montarLinhas(parcelas, hojeISO)
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
          Parcelas vencendo hoje, por padrão. Use os filtros para consultar
          outro período, proprietário, inquilino ou contrato.
        </p>
      </div>

      {board ? (
        <FinanceiroView
          linhas={linhas}
          temContratoAtivo={temContratoAtivo}
          erro={erro}
          todayISO={hojeISO}
          filtrosAtivos={filtrosAtivos}
          filtroInicial={{
            proprietario,
            inquilino,
            periodo,
            id: idBusca,
          }}
        />
      ) : (
        <div className="flex flex-1 items-center justify-center rounded-lg border border-dashed border-border text-sm text-muted-foreground">
          Nenhum board encontrado.
        </div>
      )}
    </div>
  )
}
