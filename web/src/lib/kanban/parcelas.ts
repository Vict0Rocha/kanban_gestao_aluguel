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

/** Lançamento com todos os campos que o histórico (plano 06-02) precisa. */
export type LancamentoDetalhado = {
  id: string
  tipo: "pagamento" | "acrescimo" | "desconto" | "destrava"
  valor: number
  data: string
  observacao: string | null
  motivo: string | null
  criado_em: string
  profiles: { full_name: string | null; email: string | null } | null
}

export type CardParaGeracao = {
  id: string
  valor: number
  periodo_inicio: string | null
  periodo_fim: string | null
}

/**
 * A linha de `parcelas` como o PostgREST devolve, com os dois embeds.
 * Desde a Phase 6.2, o embed `cards` também traz os quatro campos que
 * `avaliarVisibilidadeParcela` (visibilidade.ts) precisa para decidir se a
 * parcela aparece — `montarLinhas` continua usando só `endereco`,
 * `proprietario` e `numero`.
 */
export type ParcelaComCard = {
  id: string
  card_id: string
  competencia: string
  vencimento: string
  valor_original: number
  status: StatusParcela
  cards: {
    endereco: string
    proprietario: string
    numero: number
    ativo: boolean
    periodo_inicio: string | null
    periodo_fim: string | null
    arquivado_em: string | null
  } | null
  parcela_lancamentos: LancamentoDetalhado[] | null
}

export type LinhaParcela = {
  id: string
  competencia: string
  endereco: string
  proprietario: string
  numero: number
  vencimento: string
  valorDevido: number
  valorPago: number
  situacao: Situacao
  lancamentos: LancamentoDetalhado[]
}

/**
 * Dia 1 do mês da string "YYYY-MM-DD" recebida, sem passar por Date.
 * Exportada (Phase 6.2) porque `visibilidade.ts` precisa dela para o
 * passo do mês corrente da regra de visibilidade — reimplementar seria
 * criar a segunda cópia que essa fase existe para evitar.
 */
export function inicioDoMes(dataISO: string): string {
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
 * Implementa D-10/D-11 (Phase 6.1) — SUBSTITUI a escolha original da Phase 5
 * (A-02: sem `periodoInicio`, vencimento caía no último dia do mês, para não
 * fazer um contrato sem data cadastrada nascer "vencido" no dia seguinte).
 * O usuário pediu explicitamente um fallback fixo em vez disso: sem
 * `periodoInicio`, o dia é sempre **20** — dia que existe em todo mês, então
 * não precisa de `Math.min`/capping nesse ramo. Com `periodoInicio`, a regra
 * não muda: dia do mês de `periodoInicio` aplicado à competência, limitado ao
 * último dia daquele mês (D-11).
 *
 * Esta função só é chamada dentro de `parcelasFaltantes`, ao montar uma
 * parcela NOVA para `insert` — nunca contra um `UPDATE` de `parcelas.vencimento`
 * de uma linha já existente. Parcelas geradas antes desta mudança para
 * contratos sem `periodo_inicio` mantêm o vencimento antigo (último dia do
 * mês) intocado; esta troca é uma decisão do usuário daqui para frente, não
 * uma reversão silenciosa do histórico.
 */
export function vencimentoDaCompetencia(
  competencia: string,
  periodoInicio: string | null
): string {
  const [anoStr, mesStr] = competencia.split("-")
  const ano = Number(anoStr)
  const mes = Number(mesStr)

  const dia = periodoInicio
    ? Math.min(Number(periodoInicio.split("-")[2]), ultimoDiaDoMes(ano, mes))
    : 20

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

/**
 * O subconjunto de uma linha de `parcelas` de que a poda síncrona (D-01/D-02)
 * e o pré-voo consultivo (D-05, `contarParcelasOrfasAction`) precisam — nunca
 * a linha inteira.
 */
export type ParcelaCandidataPoda = {
  id: string
  competencia: string
  status: StatusParcela
  parcela_lancamentos: { id: string }[] | null
}

/**
 * Critério de "órfã apagável" (D-01/D-02/D-03), única implementação — reusada
 * tanto pela poda síncrona dentro de `updateCardAction` (actions.ts) quanto
 * pelo pré-voo consultivo `contarParcelasOrfasAction`. `false` se
 * `status !== "aberta"`; `false` se existir qualquer linha em
 * `parcela_lancamentos`. As duas checagens são redundantes na prática — todo
 * status diferente de `aberta` implica pelo menos um lançamento — mas ambas
 * são mantidas de propósito, mesma defesa em profundidade que D-02 exige.
 * Por fim, reusa `competenciaNoPeriodo` negada: nunca reimplementar a
 * comparação de datas. D-03 (a poda não distingue direção — encurtar o fim
 * ou adiantar o início podam igual) já está coberto aqui porque
 * `competenciaNoPeriodo` testa os dois lados do período pela mesma
 * comparação.
 */
export function parcelaOrfaApagavel(
  parcela: Pick<ParcelaCandidataPoda, "competencia" | "status" | "parcela_lancamentos">,
  novoInicio: string | null,
  novoFim: string | null
): boolean {
  if (parcela.status !== "aberta") return false
  if ((parcela.parcela_lancamentos?.length ?? 0) > 0) return false
  return !competenciaNoPeriodo(parcela.competencia, novoInicio, novoFim)
}

export type ParcelaFaltante = {
  card_id: string
  competencia: string
  vencimento: string
  valor_original: number
}

/**
 * Implementa o discriminador de D-12/D-14/D-15 (Phase 6.1): um contrato só
 * entra no ramo de geração de período completo (retroativo incluído) quando
 * as DUAS datas estão preenchidas. Só `periodo_inicio` (contrato em prazo
 * indeterminado, comum após o término do prazo fixo) ou nenhuma das duas
 * caem no fallback de `competenciasAlvo` (mês atual + próximo), sem mudança
 * de comportamento em relação à Phase 5.
 */
export function temPeriodoCompleto(card: CardParaGeracao): boolean {
  return Boolean(card.periodo_inicio) && Boolean(card.periodo_fim)
}

/**
 * Discriminador de D-06: `true` só quando `periodo_inicio` E `periodo_fim`
 * estão AMBOS nulos. Um card com só `periodo_inicio` preenchido (prazo
 * indeterminado, estado comum e intencional) devolve `false` aqui e continua
 * caindo no fallback de `competenciasAlvo` sem nenhuma mudança de
 * comportamento — D-06 é deliberadamente mais estreito que
 * `!temPeriodoCompleto`.
 */
export function semNenhumaData(card: CardParaGeracao): boolean {
  return !card.periodo_inicio && !card.periodo_fim
}

/**
 * Implementa D-12/D-13 ao pé da letra: devolve o dia 1 de cada mês de
 * `periodoInicio` até `periodoFim`, inclusive, iterando mês a mês (mesmo
 * padrão de `competenciasAlvo` para virar o ano ao passar de dezembro).
 * Nenhum teto de quantidade de meses é aplicado aqui — um contrato Jan–Dez
 * gera 12 competências, um contrato de vários anos gera todas, sem cap
 * silencioso (ver Task 1 do plano 06.1-06 para a decisão de pré-voo sobre
 * avisos extras). Defensivo: se o mês de `periodoFim` for anterior ao de
 * `periodoInicio`, devolve `[]` — `validarPeriodo` em actions.ts já impede
 * essa entrada na origem, mas esta função não deve confiar cegamente nisso.
 */
export function competenciasDoPeriodo(
  periodoInicio: string,
  periodoFim: string
): string[] {
  const inicio = inicioDoMes(periodoInicio)
  const fim = inicioDoMes(periodoFim)

  if (fim < inicio) return []

  const competencias: string[] = []

  let [ano, mes] = inicio.split("-").map(Number)
  const [anoFim, mesFim] = fim.split("-").map(Number)

  while (ano < anoFim || (ano === anoFim && mes <= mesFim)) {
    competencias.push(`${ano}-${String(mes).padStart(2, "0")}-01`)

    if (mes === 12) {
      mes = 1
      ano += 1
    } else {
      mes += 1
    }
  }

  return competencias
}

/**
 * Decide, por card, qual conjunto de competências alvo usar: período
 * completo (D-12/D-13, incluindo retroativo) quando `temPeriodoCompleto`,
 * senão o fallback de `competenciasAlvo` (D-14/D-15, comportamento da Phase
 * 5 inalterado).
 */
export function competenciasAlvoParaCard(
  card: CardParaGeracao,
  hojeISO: string
): string[] {
  if (temPeriodoCompleto(card)) {
    return competenciasDoPeriodo(card.periodo_inicio!, card.periodo_fim!)
  }

  // D-06: contrato sem NENHUMA data cadastrada gera só a competência do mês
  // atual — devolve só o primeiro elemento do par que `competenciasAlvo` já
  // calcula, sem duplicar a lógica de virar o ano em dezembro. D-07: esta
  // mudança vale só para geração daqui pra frente — `parcelasFaltantes`/
  // `garantirParcelas` só fazem `upsert` do que falta (nunca um `delete`),
  // então nunca apaga retroativamente uma parcela de "próximo mês" já gerada
  // para um contrato sem data antes desta fase. Nenhum código de exclusão
  // precisa ser escrito para D-07 valer — mesmo precedente de
  // `vencimentoDaCompetencia` acima (mudança de regra de geração nunca
  // reescreve o que já foi gerado).
  if (semNenhumaData(card)) {
    return [competenciasAlvo(hojeISO)[0]]
  }

  return competenciasAlvo(hojeISO)
}

/**
 * Para cada card, calcula seu próprio conjunto de competências alvo via
 * `competenciasAlvoParaCard` (período completo incluindo retroativo, ou o
 * fallback de mês atual + próximo) e, para cada combinação card ×
 * competência que passe em `competenciaNoPeriodo` e não esteja em
 * `existentes`, monta o objeto pronto para INSERT. `competenciaNoPeriodo`
 * continua rodando dentro do laço como defesa em profundidade: para o caso
 * de período completo ela é redundante por construção, mas para o caso de
 * fallback continua filtrando exatamente como antes.
 * `valor_original` é a fotografia do `valor` ATUAL do card neste instante
 * (D-05/PARCELA-03; D-18 para a competência retroativa) — depois de gravado
 * ninguém relê `cards.valor` para essa parcela, mesmo que a competência seja
 * passada. Cards com `valor` não finito ou <= 0 são descartados: o CHECK
 * `parcelas_valor_original_positivo` recusaria a linha, e como o INSERT é um
 * único comando, um card ruim derrubaria o lote inteiro.
 */
export function parcelasFaltantes(
  cards: CardParaGeracao[],
  hojeISO: string,
  existentes: { card_id: string; competencia: string }[]
): ParcelaFaltante[] {
  const chavesExistentes = new Set(
    existentes.map((existente) => `${existente.card_id}|${existente.competencia}`)
  )

  const faltantes: ParcelaFaltante[] = []

  for (const card of cards) {
    if (!Number.isFinite(card.valor) || card.valor <= 0) continue

    const competencias = competenciasAlvoParaCard(card, hojeISO)

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
 * Implementa D-04 ao pé da letra, com a fronteira resolvida por A-03: um
 * desconto grande o bastante pode deixar `valorDevido <= 0` numa parcela que
 * já tem pagamento registrado. A cláusula "e `valorDevido > 0`" de D-04
 * bloqueia literalmente o resultado "paga" nesse caso, e como há pagamento
 * (`valorPago > 0`) o resultado não pode ser "aberta" — "parcial" é a única
 * leitura que sobra dentro da própria régua de D-04, não uma invenção de
 * estado novo.
 */
export function statusDeParcela(
  valorDevido: number,
  valorPago: number
): StatusParcela {
  if (valorPago <= 0) return "aberta"
  if (valorDevido > 0 && valorPago >= valorDevido) return "paga"
  return "parcial"
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

    // A-01: mais recente primeiro — ordenação local a este campo, não
    // interfere na ordenação por vencimento/endereço das próprias linhas.
    const lancamentos = [...(parcela.parcela_lancamentos ?? [])].sort(
      (a, b) => (a.criado_em < b.criado_em ? 1 : a.criado_em > b.criado_em ? -1 : 0)
    )

    return {
      id: parcela.id,
      competencia: parcela.competencia,
      endereco: parcela.cards?.endereco ?? "",
      proprietario: parcela.cards?.proprietario ?? "",
      numero: parcela.cards?.numero ?? 0,
      vencimento: parcela.vencimento,
      valorDevido,
      valorPago,
      situacao: situacaoDaParcela(parcela.status, parcela.vencimento, hojeISO),
      lancamentos,
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
 * Implementa D-01/D-03/D-06 e, a partir da Phase 6.1 (PARCELA-06), D-12/D-16.
 * O único cliente Supabase permitido aqui é o de sessão do usuário —
 * recebido por parâmetro, nunca construído neste módulo. O SELECT de cards
 * já é filtrado pelo RLS: quem está fora de `allowed_members` recebe lista
 * vazia e, por construção, não gera nada.
 *
 * A busca de `existentes` não filtra mais por uma janela fixa de
 * competências: agora que cada card pode ter seu próprio conjunto de
 * competências alvo (período completo vs. fallback de dois meses), a
 * checagem de duplicata precisa conhecer TODAS as parcelas já existentes
 * desses cards, não só as de uma janela fixa — senão uma parcela retroativa
 * já gerada poderia ser recriada indevidamente. O `upsert(...,
 * ignoreDuplicates: true)` sobre o índice único `parcelas_unica_por_competencia`
 * continua sendo o cinto e suspensório contra corrida entre abas, agora
 * sobre um conjunto de candidatos maior.
 */
export async function garantirParcelas(
  supabase: SupabaseClient,
  hojeISO: string
): Promise<void> {
  const { data: cards, error: erroCards } = await supabase
    .from("cards")
    .select("id, valor, periodo_inicio, periodo_fim")
    .eq("ativo", true)
    // D-09: contrato arquivado não gera parcela — gerar geraria dado
    // fantasma para algo que já é invisível em tudo (D-08).
    .is("arquivado_em", null)

  if (erroCards) throw erroCards

  const cardsAtivos = (cards ?? []) as CardParaGeracao[]
  const cardIds = cardsAtivos.map((card) => card.id)

  if (cardIds.length === 0) return

  const { data: existentes, error: erroExistentes } = await supabase
    .from("parcelas")
    .select("card_id, competencia")
    .in("card_id", cardIds)

  if (erroExistentes) throw erroExistentes

  const faltantes = parcelasFaltantes(cardsAtivos, hojeISO, existentes ?? [])

  if (faltantes.length === 0) return

  const { error: erroUpsert } = await supabase
    .from("parcelas")
    .upsert(faltantes, { onConflict: "card_id,competencia", ignoreDuplicates: true })

  if (erroUpsert) throw erroUpsert
}
