import type { SupabaseClient } from "@supabase/supabase-js"

/**
 * Parcelas são geradas de forma preguiçosa na leitura da rota /financeiro —
 * mesma filosofia de alerts.ts: nada de job agendado, nada de chave
 * privilegiada. Este módulo NÃO pode importar "@/lib/supabase/server" nem
 * "next/headers": o tipo Situacao é consumido por componentes de cliente
 * (plano 05-02), e um import de next/headers quebraria esse bundle.
 */

export type StatusParcela = "aberta" | "parcial" | "paga" | "conciliada"

export type Situacao = "a_vencer" | "vencida" | "paga" | "parcial" | "conciliada"

export type LancamentoResumo = {
  tipo: "pagamento" | "acrescimo" | "desconto" | "destrava"
  valor: number
}

export type CardParaGeracao = {
  id: string
  valor: number
  periodo_inicio: string | null
  periodo_fim: string | null
}

/** A linha de `parcelas` como o PostgREST devolve, com os dois embeds. */
export type ParcelaComCard = {
  id: string
  card_id: string
  competencia: string
  vencimento: string
  valor_original: number
  status: StatusParcela
  cards: { endereco: string; proprietario: string } | null
  parcela_lancamentos: LancamentoResumo[] | null
}

export type LinhaParcela = {
  id: string
  competencia: string
  endereco: string
  proprietario: string
  vencimento: string
  valorDevido: number
  valorPago: number
  situacao: Situacao
}

/** Dia 1 do mês da string "YYYY-MM-DD" recebida, sem passar por Date. */
function inicioDoMes(dataISO: string): string {
  const [ano, mes] = dataISO.split("-")
  return `${ano}-${mes}-01`
}

/**
 * Devolve o dia 1 do mês de `hojeISO` e o dia 1 do mês seguinte, virando o
 * ano corretamente de dezembro para janeiro. Implementa D-02.
 */
export function competenciasAlvo(hojeISO: string): [string, string] {
  const [anoStr, mesStr] = hojeISO.split("-")
  const ano = Number(anoStr)
  const mes = Number(mesStr)

  const atual = `${ano}-${String(mes).padStart(2, "0")}-01`

  const proximoMes = mes === 12 ? 1 : mes + 1
  const proximoAno = mes === 12 ? ano + 1 : ano
  const proximo = `${proximoAno}-${String(proximoMes).padStart(2, "0")}-01`

  return [atual, proximo]
}

/**
 * `new Date(ano, mes, 0)` constrói em horário local: dia 0 do mês seguinte é
 * o último dia do mês pedido. `mes` aqui é 1-indexado (agosto = 8). Não usar
 * `new Date("YYYY-MM-DD")` — ver comentário no topo de report.ts sobre esse
 * construtor ler a string como UTC e adiantar a data um dia no Brasil.
 */
export function ultimoDiaDoMes(ano: number, mes: number): number {
  return new Date(ano, mes, 0).getDate()
}

/**
 * Implementa A-02: dia do vencimento é o dia do mês de `periodoInicio`
 * aplicado ao mês da competência, limitado ao último dia daquele mês. Sem
 * `periodoInicio`, o vencimento é o último dia do mês da competência.
 */
export function vencimentoDaCompetencia(
  competencia: string,
  periodoInicio: string | null
): string {
  const [anoStr, mesStr] = competencia.split("-")
  const ano = Number(anoStr)
  const mes = Number(mesStr)
  const ultimoDia = ultimoDiaDoMes(ano, mes)

  const dia = periodoInicio
    ? Math.min(Number(periodoInicio.split("-")[2]), ultimoDia)
    : ultimoDia

  return `${ano}-${String(mes).padStart(2, "0")}-${String(dia).padStart(2, "0")}`
}

/**
 * Implementa D-04 com a granularidade de mês de A-03. Compara strings
 * "YYYY-MM-DD" diretamente — ordenação lexicográfica de data ISO é
 * cronologicamente correta e não passa por Date, então não há fuso
 * envolvido. Limite nulo é limite ausente (A-01): contrato sem
 * `periodo_inicio`/`periodo_fim` sempre passa nesse lado da checagem.
 */
export function competenciaNoPeriodo(
  competencia: string,
  periodoInicio: string | null,
  periodoFim: string | null
): boolean {
  if (periodoInicio && competencia < inicioDoMes(periodoInicio)) return false
  if (periodoFim && competencia > inicioDoMes(periodoFim)) return false
  return true
}

export type ParcelaFaltante = {
  card_id: string
  competencia: string
  vencimento: string
  valor_original: number
}

/**
 * Para cada combinação card × competência que passe em `competenciaNoPeriodo`
 * e não esteja em `existentes`, monta o objeto pronto para INSERT.
 * `valor_original` é a fotografia do `valor` do card neste instante (D-05,
 * PARCELA-03) — depois de gravado ninguém relê `cards.valor` para essa
 * parcela. Cards com `valor` não finito ou <= 0 são descartados: o CHECK
 * `parcelas_valor_original_positivo` recusaria a linha, e como o INSERT é um
 * único comando, um card ruim derrubaria o lote inteiro.
 */
export function parcelasFaltantes(
  cards: CardParaGeracao[],
  competencias: string[],
  existentes: { card_id: string; competencia: string }[]
): ParcelaFaltante[] {
  const chavesExistentes = new Set(
    existentes.map((existente) => `${existente.card_id}|${existente.competencia}`)
  )

  const faltantes: ParcelaFaltante[] = []

  for (const card of cards) {
    if (!Number.isFinite(card.valor) || card.valor <= 0) continue

    for (const competencia of competencias) {
      if (!competenciaNoPeriodo(competencia, card.periodo_inicio, card.periodo_fim)) {
        continue
      }

      const chave = `${card.id}|${competencia}`
      if (chavesExistentes.has(chave)) continue

      faltantes.push({
        card_id: card.id,
        competencia,
        vencimento: vencimentoDaCompetencia(competencia, card.periodo_inicio),
        valor_original: card.valor,
      })
    }
  }

  return faltantes
}

/**
 * Implementa D-07 ao pé da letra. Ver A-05: `parcial` não é produzida nesta
 * fase, mas o rótulo já existe no tipo porque a UI-SPEC manda o badge
 * suportar os 5 estados desde já.
 */
export function situacaoDaParcela(
  status: StatusParcela,
  vencimento: string,
  hojeISO: string
): Situacao {
  if (status === "paga") return "paga"
  if (status === "conciliada") return "conciliada"
  return vencimento < hojeISO ? "vencida" : "a_vencer"
}

/**
 * Implementa A-06: valor devido e valor pago são somados do livro-razão, não
 * lidos de coluna. `destrava` não entra em nenhuma soma — é evento de
 * estado, carrega valor 0.
 */
export function somarLancamentos(
  valorOriginal: number,
  lancamentos: LancamentoResumo[] | null | undefined
): { valorDevido: number; valorPago: number } {
  if (!lancamentos || lancamentos.length === 0) {
    return { valorDevido: valorOriginal, valorPago: 0 }
  }

  let valorDevido = valorOriginal
  let valorPago = 0

  for (const lancamento of lancamentos) {
    if (lancamento.tipo === "acrescimo") valorDevido += lancamento.valor
    else if (lancamento.tipo === "desconto") valorDevido -= lancamento.valor
    else if (lancamento.tipo === "pagamento") valorPago += lancamento.valor
  }

  return { valorDevido, valorPago }
}

/**
 * Aplica `somarLancamentos` e `situacaoDaParcela` em cada parcela e ordena
 * por vencimento crescente e, em empate, por endereço. Quando o embed
 * `cards` vier nulo, usa string vazia — a linha ainda renderiza em vez de
 * derrubar a página.
 */
export function montarLinhas(
  parcelas: ParcelaComCard[],
  hojeISO: string
): LinhaParcela[] {
  const linhas = parcelas.map((parcela) => {
    const { valorDevido, valorPago } = somarLancamentos(
      parcela.valor_original,
      parcela.parcela_lancamentos
    )

    return {
      id: parcela.id,
      competencia: parcela.competencia,
      endereco: parcela.cards?.endereco ?? "",
      proprietario: parcela.cards?.proprietario ?? "",
      vencimento: parcela.vencimento,
      valorDevido,
      valorPago,
      situacao: situacaoDaParcela(parcela.status, parcela.vencimento, hojeISO),
    }
  })

  linhas.sort((a, b) => {
    if (a.vencimento !== b.vencimento) {
      return a.vencimento < b.vencimento ? -1 : 1
    }
    if (a.endereco === b.endereco) return 0
    return a.endereco < b.endereco ? -1 : 1
  })

  return linhas
}

/**
 * Implementa D-01/D-03/D-06. O único cliente Supabase permitido aqui é o de
 * sessão do usuário — recebido por parâmetro, nunca construído neste
 * módulo. O SELECT de cards já é filtrado pelo RLS: quem está fora de
 * `allowed_members` recebe lista vazia e, por construção, não gera nada.
 */
export async function garantirParcelas(
  supabase: SupabaseClient,
  competencias: [string, string]
): Promise<void> {
  const { data: cards, error: erroCards } = await supabase
    .from("cards")
    .select("id, valor, periodo_inicio, periodo_fim")
    .eq("ativo", true)

  if (erroCards) throw erroCards

  const { data: existentes, error: erroExistentes } = await supabase
    .from("parcelas")
    .select("card_id, competencia")
    .in("competencia", competencias)

  if (erroExistentes) throw erroExistentes

  const faltantes = parcelasFaltantes(
    (cards ?? []) as CardParaGeracao[],
    competencias,
    existentes ?? []
  )

  if (faltantes.length === 0) return

  const { error: erroUpsert } = await supabase
    .from("parcelas")
    .upsert(faltantes, { onConflict: "card_id,competencia", ignoreDuplicates: true })

  if (erroUpsert) throw erroUpsert
}
