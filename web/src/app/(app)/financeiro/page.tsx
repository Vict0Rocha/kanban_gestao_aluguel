import { createClient } from "@/lib/supabase/server"
import {
  garantirParcelas,
  montarLinhas,
  type LinhaParcela,
  type ParcelaComCard,
} from "@/lib/kanban/parcelas"
import { filtrarParcelasVisiveis } from "@/lib/kanban/visibilidade"
import { hojeEmCuiaba } from "@/lib/kanban/format"
import { FinanceiroView } from "@/components/financeiro/financeiro-view"

// `!inner` é obrigatório para poder filtrar por coluna do embed — sem ela o
// PostgREST não aceita `.ilike()`/`.eq()`/`.is()` em `cards.*`. Desde a
// Phase 6.2 as DUAS constantes usam `!inner`, porque as duas precisam do
// filtro `cards.arquivado_em is null` (D-08) aplicado na query abaixo — o
// `!inner` nunca descarta nenhuma linha legítima aqui porque
// `parcelas.card_id` é `not null` com FK para `cards`: o embed nunca podia
// ser nulo de verdade.
const SELECT_PARCELA_PADRAO =
  "id, card_id, competencia, vencimento, valor_original, status, cards!inner(endereco, proprietario, numero, ativo, periodo_inicio, periodo_fim, arquivado_em), parcela_lancamentos(id, tipo, valor, data, observacao, motivo, criado_em, profiles(full_name, email))"

const SELECT_PARCELA_FILTRADA =
  "id, card_id, competencia, vencimento, valor_original, status, cards!inner(endereco, proprietario, numero, inquilino, ativo, periodo_inicio, periodo_fim, arquivado_em), parcela_lancamentos(id, tipo, valor, data, observacao, motivo, criado_em, profiles(full_name, email))"

/** Dia 1 do mês seguinte a "YYYY-MM", sem passar por Date — mesmo padrão usado em parcelas.ts. */
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
  // T-06.1-17: id não numérico é ignorado, não derruba a página. Calculado
  // uma vez e reusado tanto pelo filtro de parcelas quanto pela consulta da
  // nota contextual do plano 06.2-07, para não duplicar a guarda.
  const idNumerico =
    idBusca && Number.isInteger(Number(idBusca)) ? Number(idBusca) : null

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

  // Pin "today" no fuso de Cuiabá, não no fuso do processo (Vercel roda em
  // UTC) — mesma função usada em relatorios/page.tsx, (app)/layout.tsx e
  // actions.ts (A-04, corrigido junto com o bug de arquivado_em).
  const hojeISO = hojeEmCuiaba()

  let linhas: LinhaParcela[] = []
  let erro = false
  // Se a contagem falhar, tratamos como true: mostrar o texto de período é
  // menos enganoso do que dizer "nenhum contrato ativo" por causa de uma
  // falha de rede.
  let temContratoAtivo = true

  if (board) {
    const { count, error: erroContagem } = await supabase
      .from("cards")
      .select("id", { count: "exact", head: true })
      .eq("ativo", true)
      // D-08: um contrato arquivado não sustenta sozinho a frase "há
      // contrato ativo" — arquivado some de tudo, inclusive daqui.
      .is("arquivado_em", null)

    if (!erroContagem) {
      temContratoAtivo = (count ?? 0) > 0
    }

    try {
      // D-16: geração preguiçosa continua rodando em toda carga da rota,
      // com filtro aplicado ou não — só a query de LEITURA abaixo muda.
      // A partir da Phase 6.1 (PARCELA-06), o conjunto de competências alvo
      // é calculado por card dentro de garantirParcelas/parcelasFaltantes
      // (período completo vs. fallback de dois meses), não mais uma janela
      // fixa passada por aqui.
      await garantirParcelas(supabase, hojeISO)

      let query = supabase
        .from("parcelas")
        .select(filtrosAtivos ? SELECT_PARCELA_FILTRADA : SELECT_PARCELA_PADRAO)
        // D-08: arquivado some de tudo. Filtro barato de banco, não passa
        // pela regra em memória de `filtrarParcelasVisiveis` — vale para
        // os dois ramos (padrão e filtrado) abaixo.
        .is("cards.arquivado_em", null)

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
        if (idNumerico !== null) {
          query = query.eq("cards.numero", idNumerico)
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

      // D-06: a regra de visibilidade não se expressa numa única query
      // PostgREST (depende de "tem lançamento" + período do card + mês
      // corrente ao mesmo tempo), então roda em memória sobre o resultado
      // já trazido pela query acima. A ~48 contratos com ~24 parcelas cada
      // o custo é irrelevante — o caminho de escala está registrado em
      // docs/data-model.md.
      const visiveis = filtrarParcelasVisiveis(parcelas, hojeISO)

      linhas = montarLinhas(visiveis, hojeISO)
    } catch (erroCapturado) {
      // O objeto de erro do Supabase nunca chega ao navegador — só o log
      // do servidor. A página renderiza uma constante (ver ParcelasTable).
      console.error("financeiro", erroCapturado)
      erro = true
    }
  }

  // Nota contextual (plano 06.2-07): só quando o filtro é por ID numérico.
  // Consulta independente, deliberadamente SEM filtro de `arquivado_em` —
  // ela precisa enxergar justamente o contrato arquivado, que a query de
  // parcelas acima esconde. Qualquer falha aqui vira `null` em silêncio:
  // a nota é um extra e nunca pode marcar a página como em erro nem
  // impedir a lista de renderizar (comportamento idêntico ao de hoje).
  let contratoFiltro: {
    numero: number
    ativo: boolean
    arquivado_em: string | null
  } | null = null

  if (idNumerico !== null) {
    try {
      const { data: contrato, error: erroContrato } = await supabase
        .from("cards")
        .select("numero, ativo, arquivado_em")
        .eq("numero", idNumerico)
        .maybeSingle()

      contratoFiltro = erroContrato ? null : contrato
    } catch (erroCapturado) {
      console.error("financeiro:nota-contextual", erroCapturado)
      contratoFiltro = null
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
          contratoFiltro={contratoFiltro}
        />
      ) : (
        <div className="flex flex-1 items-center justify-center rounded-lg border border-dashed border-border text-sm text-muted-foreground">
          Nenhum board encontrado.
        </div>
      )}
    </div>
  )
}
