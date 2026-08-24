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
