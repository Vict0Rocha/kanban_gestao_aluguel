import { competenciaNoPeriodo, inicioDoMes, type ParcelaComCard } from "./parcelas"

/**
 * Aqui moram as regras de ciclo de vida do contrato que o servidor e a
 * interface precisam COMPARTILHAR. Nenhuma delas pode viver em
 * `actions.ts` — que é um módulo de Server Actions e só pode exportar
 * função async — nem pode existir em duas cópias: a divergência entre
 * leitura e escrita é exatamente o que originou a Phase 6.2 (`ativo`
 * filtrava a geração de parcela mas não a escrita, e ninguém percebeu até
 * um humano olhar produção).
 *
 * Módulo puro: sem "use client", sem "use server", sem import de
 * "next/headers" nem de "@/lib/supabase/server" — precisa ser importável
 * tanto por Server Action (actions.ts) quanto por componente de cliente
 * (o plano 06.2-06 importa uma constante daqui para comparar mensagem de
 * erro contra o retorno de uma Server Action).
 */

/**
 * Subconjunto de `cards` de que a regra de visibilidade precisa —
 * deliberadamente menor que o tipo `Card` completo, para que qualquer
 * query que alimente a regra declare exatamente estes quatro campos.
 */
export type CardVisibilidade = {
  ativo: boolean
  periodo_inicio: string | null
  periodo_fim: string | null
  arquivado_em: string | null
}

export type MotivoOcultacao =
  | "arquivado"
  | "inativo-mes-futuro"
  | "fora-do-periodo"
  | "indeterminado"

export type ResultadoVisibilidade =
  | { visivel: true }
  | { visivel: false; motivo: MotivoOcultacao }

export type EntradaVisibilidade = {
  competencia: string
  card: CardVisibilidade | null
  temLancamento: boolean
  hojeISO: string
}

/**
 * A ÚNICA implementação da regra de visibilidade de parcela em todo o
 * projeto (D-01). `parcelaVisivel`/`filtrarParcelasVisiveis` (leitura, o
 * Financeiro) e `exigirParcelaVisivel` (escrita, actions.ts) consomem
 * exatamente esta função — nenhum dos dois pode reimplementar nem um
 * passo desta ordem.
 *
 * Ordem de avaliação, nesta sequência exata:
 */
export function avaliarVisibilidadeParcela({
  competencia,
  card,
  temLancamento,
  hojeISO,
}: EntradaVisibilidade): ResultadoVisibilidade {
  // 1. Sem card, a regra não pode ser avaliada. A resposta segura é
  //    recusar (D-04), não presumir visível.
  if (!card) return { visivel: false, motivo: "indeterminado" }

  // 2. Contrato arquivado some de tudo (D-08) — e este passo vem ANTES do
  //    override de lançamento do passo 3, e isso é uma decisão, não um
  //    descuido. D-01 diz que parcela com lançamento sempre aparece; D-08
  //    diz que contrato arquivado some de tudo. Os dois se cruzam aqui:
  //    arquivar é um ato explícito do operador que tira o contrato
  //    inteiro de operação, então ele ganha. Na prática o caminho de
  //    leitura nunca exercita este ramo — cards arquivados já são
  //    filtrados na query (D-08) — mas o caminho de escrita exercita, e é
  //    o único lugar onde essa colisão pode ser resolvida.
  if (card.arquivado_em !== null) return { visivel: false, motivo: "arquivado" }

  // 3. O override de D-01/D-05: o dinheiro entrou de verdade, então a
  //    parcela nunca some, mesmo fora do período e mesmo com o contrato
  //    inativo. ESTE É O RAMO MAIS FÁCIL DE PERDER numa reescrita futura
  //    — não mover esta checagem para depois dos passos 4/5.
  //    D-17: `temLancamento` conta qualquer linha de `parcela_lancamentos`
  //    (pagamento, acréscimo, desconto, destrava), então quando a Phase 7
  //    (conciliação) passar a gravar ali, uma parcela conciliada entra
  //    sob este mesmo ramo sem nenhum código novo — só confirmar quando a
  //    Phase 7 chegar.
  if (temLancamento) return { visivel: true }

  // 4. Fora do período atual do card. Reusa `competenciaNoPeriodo` de
  //    parcelas.ts — não reescrever o teste de período aqui.
  if (!competenciaNoPeriodo(competencia, card.periodo_inicio, card.periodo_fim)) {
    return { visivel: false, motivo: "fora-do-periodo" }
  }

  // 5. Contrato inativo esconde só o futuro (D-02). Comparação de string
  //    ISO direta, como o resto do projeto faz — competência é sempre dia
  //    1, então "maior que o dia 1 do mês de hoje" é exatamente "mês
  //    futuro". Mês atual e meses passados passam (escolha explícita do
  //    usuário: dívida real não some da tela).
  //    Quando os passos 4 e 5 valeriam ao mesmo tempo, o passo 4 já
  //    retornou antes de chegar aqui — "fora-do-periodo" ganha, porque é
  //    a causa mais específica e a mais acionável (o usuário ajusta a
  //    data no board).
  if (!card.ativo && competencia > inicioDoMes(hojeISO)) {
    return { visivel: false, motivo: "inativo-mes-futuro" }
  }

  // 6. Nenhum motivo de ocultação se aplicou.
  return { visivel: true }
}

/**
 * Invólucro de uma linha, para deixar o caminho de leitura legível. Não
 * contém nenhuma condicional própria — só repassa o campo `visivel` do
 * resultado de `avaliarVisibilidadeParcela`.
 */
export function parcelaVisivel(entrada: EntradaVisibilidade): boolean {
  return avaliarVisibilidadeParcela(entrada).visivel
}

/**
 * Filtra o resultado de uma query de `parcelas` (com os embeds `cards` e
 * `parcela_lancamentos`) para as linhas visíveis pela regra única. D-06:
 * roda em memória sobre o resultado da query porque a regra não se
 * expressa numa única query PostgREST (depende de "tem lançamento" +
 * período do card + mês corrente ao mesmo tempo) — ver o tradeoff
 * registrado em docs/data-model.md.
 */
export function filtrarParcelasVisiveis(
  parcelas: ParcelaComCard[],
  hojeISO: string
): ParcelaComCard[] {
  return parcelas.filter((parcela) =>
    parcelaVisivel({
      competencia: parcela.competencia,
      card: parcela.cards,
      temLancamento: (parcela.parcela_lancamentos?.length ?? 0) > 0,
      hojeISO,
    })
  )
}

/**
 * As quatro frases pt-BR de recusa, verbatim da seção "Server-refused
 * write on a hidden parcela (D-04)" da UI-SPEC — renderizadas no slot de
 * erro inline que `RegistrarPagamentoDialog` e `AjustarParcelaDialog` já
 * têm. Nenhuma superfície de erro nova.
 */
export const MENSAGEM_PARCELA_OCULTA: Record<MotivoOcultacao, string> = {
  "inativo-mes-futuro":
    "Esta parcela não está mais disponível: o contrato está inativo e a competência é de um mês futuro. Reative o contrato no board para voltar a lançar nela.",
  "fora-do-periodo":
    "Esta parcela não está mais disponível: a competência ficou fora do período atual do contrato. Ajuste o início ou o fim do contrato no board se ela deveria valer.",
  arquivado:
    "Este contrato está arquivado. Desarquive em Arquivados para voltar a lançar nas parcelas dele.",
  indeterminado:
    "Esta parcela não está mais disponível para lançamento. Atualize a página para ver a lista atual.",
}

/**
 * Consumidas pelo plano 06.2-05 (exclusão de card/coluna, D-14/D-15/D-16):
 * o diálogo de exclusão (cliente) precisa comparar a mensagem de erro
 * devolvida pelo servidor contra a primeira delas, e um módulo de Server
 * Actions não pode exportar constante — por isso as duas moram aqui, ao
 * lado de `MENSAGEM_PARCELA_OCULTA`, pelo mesmo motivo.
 */
export const EXCLUSAO_BLOQUEADA_POR_LANCAMENTO =
  "Este contrato já tem lançamento financeiro registrado. Excluir apagaria esse histórico junto, então a exclusão fica bloqueada. Arquive o contrato em vez de excluir."

export const EXCLUSAO_COLUNA_BLOQUEADA_POR_LANCAMENTO =
  "Um dos imóveis desta coluna já tem lançamento financeiro registrado. Arquive esse contrato ou mova-o para outra coluna antes de excluir a coluna."
