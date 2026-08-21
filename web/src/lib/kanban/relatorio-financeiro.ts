import type { LancamentoResumo, StatusParcela } from "./parcelas"
import { situacaoDaParcela, somarLancamentos } from "./parcelas"

/**
 * Mesma regra de `parcelas.ts`: este módulo NÃO pode importar
 * "@/lib/supabase/server" nem "next/headers" — é consumido diretamente por
 * `relatorio-financeiro.tsx` ("use client"), e um import de next/headers
 * quebraria esse bundle.
 */

export type SituacaoRelatorio = "paga" | "a_vencer" | "vencida" | "conciliada"

/**
 * Formato enxuto da linha de `parcelas` que a query de `relatorios/page.tsx`
 * traz para este relatório — sem os campos de visibilidade (`ativo`,
 * `arquivado_em`, `periodo_inicio`, `periodo_fim`) que `ParcelaComCard`
 * carrega, porque esta fase deliberadamente não filtra por eles (D-05).
 */
export type ParcelaRelatorio = {
  id: string
  competencia: string
  vencimento: string
  valor_original: number
  status: StatusParcela
  cards: { endereco: string; proprietario: string } | null
  parcela_lancamentos: LancamentoResumo[] | null
}

export type FiltroRelatorioValores = {
  imovel: string
  proprietario: string
  periodo: string
  situacoes: Set<SituacaoRelatorio>
}

export type CategoriaRelatorio = {
  situacao: SituacaoRelatorio
  quantidade: number
  total: number
}

/** Ordem fixa de renderização das quatro categorias, em todo o app. */
export const SITUACAO_RELATORIO_ORDEM: SituacaoRelatorio[] = [
  "paga",
  "a_vencer",
  "vencida",
  "conciliada",
]

export function filtroRelatorioVazio(): FiltroRelatorioValores {
  return {
    imovel: "",
    proprietario: "",
    periodo: "",
    situacoes: new Set(),
  }
}

/** Campo vazio nunca filtra — mesmo `ilike`/substring de `FiltroParcelas`. */
export function passaFiltroTexto(valor: string, filtro: string): boolean {
  const alvo = filtro.trim().toLowerCase()
  if (!alvo) return true
  return valor.toLowerCase().includes(alvo)
}

/**
 * D-08: filtra por `competencia`, não por `vencimento` — consistência com o
 * filtro de período já existente no Financeiro. Período fora do formato
 * "YYYY-MM" é ignorado silenciosamente (mesma regra de `financeiro/page.tsx`
 * para o parâmetro `periodo` malformado), nunca derruba o relatório.
 */
export function passaFiltroPeriodo(competencia: string, periodo: string): boolean {
  if (!/^\d{4}-\d{2}$/.test(periodo)) return true
  return competencia.startsWith(periodo)
}

/**
 * Única função de agregação do relatório financeiro — chamada só pelo
 * componente cliente (`RelatorioFinanceiro`), nunca no servidor. Devolve
 * sempre as 4 categorias de `SITUACAO_RELATORIO_ORDEM`, mesmo com
 * `quantidade: 0`, para que o grid de `StatTile` nunca varie de tamanho.
 */
export function calcularRelatorioFinanceiro(
  parcelas: ParcelaRelatorio[],
  filtro: FiltroRelatorioValores,
  hojeISO: string
): CategoriaRelatorio[] {
  const totais = new Map<SituacaoRelatorio, { quantidade: number; total: number }>(
    SITUACAO_RELATORIO_ORDEM.map((situacao) => [situacao, { quantidade: 0, total: 0 }])
  )

  for (const parcela of parcelas) {
    const endereco = parcela.cards?.endereco ?? ""
    const proprietario = parcela.cards?.proprietario ?? ""

    if (!passaFiltroTexto(endereco, filtro.imovel)) continue
    if (!passaFiltroTexto(proprietario, filtro.proprietario)) continue
    if (!passaFiltroPeriodo(parcela.competencia, filtro.periodo)) continue

    // D-06: `situacaoDaParcela` é a ÚNICA fonte da classificação em 4
    // categorias — nunca reimplementada aqui. Ela nunca devolve "parcial" na
    // prática (ver o próprio comentário dela em parcelas.ts): só compara
    // status "paga"/"conciliada" e, para qualquer outro status (incluindo
    // "aberta"/"parcial"), vencimento vs `hojeISO`. Por isso o valor sempre
    // cai em uma das 4 chaves de SITUACAO_RELATORIO_ORDEM.
    const situacao = situacaoDaParcela(
      parcela.status,
      parcela.vencimento,
      hojeISO
    ) as SituacaoRelatorio

    if (filtro.situacoes.size > 0 && !filtro.situacoes.has(situacao)) continue

    const entrada = totais.get(situacao)!
    entrada.quantidade += 1

    // D-07: pagas/conciliadas somam o que já entrou (`valorPago`);
    // a_vencer/vencidas somam o que falta entrar (`valorDevido - valorPago`,
    // nunca negativo). Os dois valores por parcela vêm de `somarLancamentos`,
    // já existente — não recalculados na mão.
    const { valorDevido, valorPago } = somarLancamentos(
      parcela.valor_original,
      parcela.parcela_lancamentos
    )

    entrada.total +=
      situacao === "paga" || situacao === "conciliada"
        ? valorPago
        : Math.max(valorDevido - valorPago, 0)
  }

  return SITUACAO_RELATORIO_ORDEM.map((situacao) => ({
    situacao,
    ...totais.get(situacao)!,
  }))
}
