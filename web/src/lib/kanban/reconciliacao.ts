import type { OrigemTaxa, TipoCaucao } from "./taxas"
import { normalizeText } from "./search"

/**
 * Mesma regra de `relatorio-financeiro.ts`: este módulo NÃO pode importar
 * "@/lib/supabase/server" nem "next/headers" — é consumido diretamente por
 * `dinheiro-imobiliaria-view.tsx` ("use client"), e um import de
 * next/headers quebraria esse bundle.
 *
 * Um arquivo por relatório (A-01, 13-07-PLAN.md): `taxas.ts` guarda o
 * cálculo de origem/percentual/saldo reusado por MÚLTIPLAS superfícies
 * (diálogo de pagamento, tabela de Configuração financeira, Sheet de
 * caução); este arquivo guarda só o que o relatório de reconciliação
 * precisa — tipos de linha, filtro por período, os seis totais.
 */

export type TaxaImobiliariaRelatorio = {
  id: string
  data: string
  valor: number
  origem: OrigemTaxa
  observacao: string | null
  cards: {
    endereco: string
    proprietario: string
    numero: number
    inquilino: string | null
  } | null
}

export type CaucaoEventoRelatorio = {
  id: string
  data: string
  valor: number
  tipo: TipoCaucao
  observacao: string | null
  cards: {
    endereco: string
    proprietario: string
    numero: number
    inquilino: string | null
  } | null
}

/**
 * Mesmo corpo de `passaFiltroPeriodo` (relatorio-financeiro.ts), mas
 * comparando `data` (não `competencia`) contra "YYYY-MM". Período fora do
 * formato é ignorado silenciosamente — nunca derruba o relatório.
 */
export function passaFiltroPeriodoReconciliacao(
  data: string,
  periodo: string
): boolean {
  if (!/^\d{4}-\d{2}$/.test(periodo)) return true
  return data.startsWith(periodo)
}

/** Os 5 campos do painel suspenso (FILTIMOB-01..03, 19-CONTEXT.md D-03). */
export type FiltroReconciliacaoValores = {
  imovel: string
  proprietario: string
  inquilino: string
  id: string
  periodo: string
}

export function filtroReconciliacaoVazio(): FiltroReconciliacaoValores {
  return { imovel: "", proprietario: "", inquilino: "", id: "", periodo: "" }
}

/**
 * Campo vazio nunca filtra. Accent-insensitive via `normalizeText`
 * (search.ts) — mesmo padrão do live-matcher mais recente do projeto
 * (configuracao-financeira-view.tsx, Phase 18).
 */
export function passaFiltroTextoReconciliacao(
  valor: string,
  filtro: string
): boolean {
  const alvo = normalizeText(filtro.trim())
  if (!alvo) return true
  return normalizeText(valor).includes(alvo)
}

/**
 * Mesmo padrão server-side de `financeiro/page.tsx:64-65,135-136` —
 * comparação exata de inteiro, nunca substring. Id não numérico é ignorado
 * (filtro não derruba nenhuma linha), nunca lança exceção.
 */
export function passaFiltroIdReconciliacao(
  numero: number,
  filtro: string
): boolean {
  const digitos = filtro.trim()
  if (!digitos) return true
  const alvo = Number.isInteger(Number(digitos)) ? Number(digitos) : null
  return alvo !== null && numero === alvo
}

/**
 * Composição única dos 4 campos derivados de `cards` — reusada tanto para
 * taxaLinhas quanto para caucaoLinhas dentro do useMemo de `linhas`
 * (dinheiro-imobiliaria-view.tsx). `passaFiltroPeriodoReconciliacao` fica de
 * fora daqui de propósito: opera sobre `taxa.data`/`evento.data`, não sobre
 * `cards`, e continua sendo chamada separadamente.
 */
export function passaFiltroCardsReconciliacao(
  cards: {
    endereco: string
    proprietario: string
    numero: number
    inquilino: string | null
  } | null,
  filtro: FiltroReconciliacaoValores
): boolean {
  if (!passaFiltroTextoReconciliacao(cards?.endereco ?? "", filtro.imovel))
    return false
  if (
    !passaFiltroTextoReconciliacao(cards?.proprietario ?? "", filtro.proprietario)
  )
    return false
  if (!passaFiltroTextoReconciliacao(cards?.inquilino ?? "", filtro.inquilino))
    return false
  if (!passaFiltroIdReconciliacao(cards?.numero ?? -1, filtro.id)) return false
  return true
}

export type ReconciliacaoTotais = {
  administracao: number
  comissao: number
  caucaoRecebida: number
  caucaoDevolvida: number
  caucaoUsada: number
  totalRecebido: number
}

/**
 * Única função de agregação do relatório de reconciliação — chamada só pelo
 * componente cliente (`DinheiroImobiliariaView`), nunca no servidor.
 */
export function calcularReconciliacao(
  taxas: TaxaImobiliariaRelatorio[],
  caucaoEventos: CaucaoEventoRelatorio[],
  periodo: string
): ReconciliacaoTotais {
  let administracao = 0
  let comissao = 0
  let caucaoRecebida = 0
  let caucaoDevolvida = 0
  let caucaoUsada = 0

  for (const taxa of taxas) {
    if (!passaFiltroPeriodoReconciliacao(taxa.data, periodo)) continue
    if (taxa.origem === "administracao") administracao += taxa.valor
    else comissao += taxa.valor
  }

  for (const evento of caucaoEventos) {
    if (!passaFiltroPeriodoReconciliacao(evento.data, periodo)) continue
    if (evento.tipo === "recebido") caucaoRecebida += evento.valor
    else if (evento.tipo === "devolvido") caucaoDevolvida += evento.valor
    else caucaoUsada += evento.valor
  }

  return {
    administracao,
    comissao,
    caucaoRecebida,
    caucaoDevolvida,
    caucaoUsada,
    // UI-SPEC §4: soma só as três categorias de entrada de caixa real —
    // administração + comissão + caução recebida. `caucaoDevolvida` e
    // `caucaoUsada` são DELIBERADAMENTE excluídas daqui: devolvida é saída
    // de caixa (o dinheiro sai do banco), usada não é movimento bancário
    // nenhum (é uma reclassificação de um valor já recebido antes). Somar
    // qualquer uma das duas nesta linha estaria contando dinheiro que nunca
    // entrou no banco neste período, ou que já saiu dele.
    totalRecebido: administracao + comissao + caucaoRecebida,
  }
}
