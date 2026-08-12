import type { Card, Column } from "./types"

/**
 * Comparação sem acento: quem digita com pressa escreve "sao joao" e espera
 * achar "São João". NFD separa a letra acentuada em base + sinal combinante,
 * e \p{M} (qualquer marca combinante) descarta o sinal que sobrou.
 */
export function normalizeText(value: string): string {
  return value
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
}

function onlyDigits(value: string): string {
  return value.replace(/\D/g, "")
}

/** Campos pelos quais uma pessoa reconhece um imóvel ao procurá-lo. */
function searchableText(card: Card): string {
  return normalizeText(
    [card.proprietario, card.endereco, card.inquilino, card.observacoes]
      .filter(Boolean)
      .join(" ")
  )
}

/**
 * Telefone e valor entram só como dígitos: o cadastro pode ter "(11) 99999-1234"
 * e a busca vir como "99999 1234" (ou o contrário), e nenhum dos dois formatos
 * acha o outro por texto puro. As datas ficam de fora de propósito — quem
 * procura por período usa o filtro de situação do contrato, e um ano digitado
 * aqui colidiria com pedaços de telefone e de valor.
 */
function searchableDigits(card: Card): string {
  return [card.telefone ? onlyDigits(card.telefone) : "", String(card.valor)]
    .filter(Boolean)
    .join(" ")
}

export type CardMatcher = (card: Card) => boolean

function parseTerms(query: string): string[] {
  return normalizeText(query).split(/\s+/).filter(Boolean)
}

export function isSearching(query: string): boolean {
  return parseTerms(query).length > 0
}

/**
 * Todos os termos precisam bater, cada um em qualquer campo: "maria flores"
 * acha a Maria da Rua das Flores, e não todo card que cite uma coisa ou outra.
 * A query é interpretada uma vez só, fora do laço que percorre os cards.
 */
export function buildMatcher(query: string): CardMatcher {
  const terms = parseTerms(query)
  if (terms.length === 0) return () => true

  return (card) => {
    const text = searchableText(card)
    const digits = searchableDigits(card)

    return terms.every((term) => {
      if (text.includes(term)) return true
      const termDigits = onlyDigits(term)
      return termDigits.length > 0 && digits.includes(termDigits)
    })
  }
}

export function cardMatches(card: Card, query: string): boolean {
  return buildMatcher(query)(card)
}

/** Mantém a contagem original para o board mostrar "2 de 14" na coluna. */
export type FilteredColumn = Column & { totalCards: number }

/**
 * Sempre devolve todas as colunas, mesmo as que ficaram sem nenhum card: sumir
 * com a coluna inteira esconderia justamente a informação que a busca existe
 * para dar — em que etapa do processo o imóvel está (ou não está).
 */
export function filterColumns(
  columns: Column[],
  query: string
): FilteredColumn[] {
  const matches = buildMatcher(query)

  return columns.map((column) => ({
    ...column,
    cards: column.cards.filter(matches),
    totalCards: column.cards.length,
  }))
}

export function countCards(columns: Column[]): number {
  return columns.reduce((total, column) => total + column.cards.length, 0)
}
