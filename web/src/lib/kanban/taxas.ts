/**
 * Cálculo puro da taxa da imobiliária sugerida no momento do pagamento —
 * espelha `parcelas.ts`. Este módulo NÃO pode importar "@/lib/supabase/server"
 * nem "next/headers": é consumido por `registrar-pagamento-dialog.tsx`
 * ("use client") e por `actions.ts` ("use server") ao mesmo tempo.
 *
 * Nada aqui soma ou é somado por `somarLancamentos`/`statusDeParcela`
 * (parcelas.ts). A taxa da imobiliária é estruturalmente separada do
 * livro-razão de `parcela_lancamentos` e nunca entra em
 * `valorDevido`/`valorPago`/`status` de uma parcela.
 */

export type OrigemTaxa = "administracao" | "comissao_primeiro_aluguel"

/**
 * Implementa D-08: "primeira parcela" de um contrato é a de menor
 * `competencia` para aquele `card_id`. Comparação de strings ISO diretas —
 * mesmo padrão de `competenciaNoPeriodo` (parcelas.ts) — nunca `Date`.
 */
export function origemTaxa(
  competencia: string,
  primeiraCompetenciaDoContrato: string
): OrigemTaxa {
  return competencia === primeiraCompetenciaDoContrato
    ? "comissao_primeiro_aluguel"
    : "administracao"
}

/** Devolve o percentual certo do contrato conforme a `origem` já decidida. */
export function percentualDaOrigem(
  origem: OrigemTaxa,
  percentualAdministracao: number,
  percentualComissaoPrimeiroAluguel: number
): number {
  return origem === "comissao_primeiro_aluguel"
    ? percentualComissaoPrimeiroAluguel
    : percentualAdministracao
}

/**
 * Chama `origemTaxa` e depois `percentualDaOrigem`, devolvendo os dois juntos
 * para quem consome (componente de cliente) não precisar de duas chamadas.
 */
export function percentualAplicavel(
  competencia: string,
  primeiraCompetenciaDoContrato: string,
  percentualAdministracao: number,
  percentualComissaoPrimeiroAluguel: number
): { percentual: number; origem: OrigemTaxa } {
  const origem = origemTaxa(competencia, primeiraCompetenciaDoContrato)
  const percentual = percentualDaOrigem(
    origem,
    percentualAdministracao,
    percentualComissaoPrimeiroAluguel
  )
  return { percentual, origem }
}

/**
 * A-02: reduz um array plano de `(card_id, competencia)` para a menor
 * `competencia` por `card_id` — comparação de string ISO, sem `Date`. Puro,
 * sem consulta — quem chama já trouxe as linhas (financeiro/page.tsx, para
 * TODOS os `card_id` de uma vez; a Server Action de pagamento usa o caminho
 * de UM `card_id` por vez, direto no banco, via `order by competencia asc
 * limit 1`).
 */
export function primeiraCompetenciaPorCard(
  linhas: { card_id: string; competencia: string }[]
): Record<string, string> {
  const resultado: Record<string, string> = {}
  for (const linha of linhas) {
    const atual = resultado[linha.card_id]
    if (atual === undefined || linha.competencia < atual) {
      resultado[linha.card_id] = linha.competencia
    }
  }
  return resultado
}

// ------------------------------------------------------------------
// Caução (plano 13-06) — ciclo completo: recebido, devolvido, usado
// (D-06, IMOB-04). Estrutura espelhada em `parcelas.ts`
// (`LancamentoResumo`/`somarLancamentos`/`LancamentoDetalhado`), mas nunca
// misturada com ela: `caucao_eventos` é uma terceira tabela isolada, ligada
// só a `card_id`, e nada aqui participa de `somarLancamentos`/
// `statusDeParcela` nem de `taxas_imobiliaria`.
// ------------------------------------------------------------------

export type TipoCaucao = "recebido" | "devolvido" | "usado"

export type CaucaoEventoResumo = { tipo: TipoCaucao; valor: number }

/** Lançamento de caução com todos os campos que o histórico (Sheet, plano
 * 13-06) precisa — mesmo molde de `LancamentoDetalhado` (parcelas.ts). */
export type CaucaoEventoDetalhado = {
  id: string
  tipo: TipoCaucao
  valor: number
  data: string
  observacao: string | null
  criado_em: string
  profiles: { full_name: string | null; email: string | null } | null
}

/**
 * `recebido` soma, `devolvido`/`usado` subtraem. Array vazio/nulo devolve 0.
 * Espelha `somarLancamentos` (parcelas.ts) na forma, nunca na função — este
 * saldo nunca participa do cálculo de status de nenhuma parcela.
 */
export function saldoCaucao(
  eventos: CaucaoEventoResumo[] | null | undefined
): number {
  if (!eventos?.length) return 0
  return eventos.reduce((total, evento) => {
    if (evento.tipo === "recebido") return total + evento.valor
    return total - evento.valor
  }, 0)
}

export type StatusCaucao = "nao-recebida" | "recebida" | "devolvida" | "usada"

/**
 * A-03 (13-06-PLAN.md): sem eventos, "nao-recebida". Saldo positivo,
 * "recebida". Saldo <= 0 com pelo menos um evento, o tipo do evento mais
 * recente (por `criado_em`) decide "devolvida" vs. "usada" — leitura mais
 * simples e defensável do texto ("saldo voltou a 0 via devolução"/"via
 * uso"), não uma regra mais elaborada sobre qual evento trouxe o saldo a
 * zero pela última vez em cenários intercalados.
 */
export function statusCaucao(
  eventos: (CaucaoEventoResumo & { criado_em: string })[] | null | undefined
): StatusCaucao {
  if (!eventos?.length) return "nao-recebida"

  const saldo = saldoCaucao(eventos)
  if (saldo > 0) return "recebida"

  const maisRecente = [...eventos].sort((a, b) =>
    b.criado_em < a.criado_em ? -1 : b.criado_em > a.criado_em ? 1 : 0
  )[0]
  return maisRecente.tipo === "devolvido" ? "devolvida" : "usada"
}
