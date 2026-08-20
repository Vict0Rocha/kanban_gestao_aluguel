const currencyFormatter = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
})

export function formatCurrency(value: number) {
  return currencyFormatter.format(value)
}

const dateFormatter = new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
})

/** Expects a Postgres "YYYY-MM-DD" string, rendered in local time. */
export function formatDate(value: string) {
  const [year, month, day] = value.split("-").map(Number)
  return dateFormatter.format(new Date(year, month - 1, day))
}

const instantDateFormatter = new Intl.DateTimeFormat("pt-BR", {
  timeZone: "America/Cuiaba",
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
})

/**
 * Converte um instante (coluna `timestamptz`, ex: `arquivado_em`, gravado
 * como `new Date().toISOString()`) para a data de calendário em Cuiabá/MT —
 * fuso de referência do negócio.
 *
 * NÃO use `formatDate` com um valor de `timestamptz` cortado para os 10
 * primeiros caracteres: isso devolveria a data em UTC, não em Cuiabá.
 * Cuiabá é UTC-4, então qualquer instante entre 20h e meia-noite (hora
 * local) já caiu no dia seguinte em UTC — foi exatamente esse o bug
 * observado em produção com `arquivado_em` mostrando o dia seguinte ao
 * real. Um valor de `timestamptz` sempre carrega o deslocamento (`Z` ou
 * `+00:00`) explícito na string, então `new Date(value)` aqui é seguro —
 * a ambiguidade que `formatDate` evita só existe para strings de data pura,
 * sem hora nem fuso.
 */
export function formatInstantDate(value: string) {
  return instantDateFormatter.format(new Date(value))
}
