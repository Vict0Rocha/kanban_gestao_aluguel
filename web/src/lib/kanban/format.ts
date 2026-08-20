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

const isoDateInCuiabaFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: "America/Cuiaba",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
})

/**
 * "Hoje" no fuso de referência do negócio (Cuiabá/MT, UTC-4), como
 * "YYYY-MM-DD". Único jeito correto de calcular "hoje" no servidor.
 *
 * `new Date().getFullYear()/getMonth()/getDate()` lê o fuso do PROCESSO,
 * não o do negócio — em produção (Vercel) o processo roda em UTC, que
 * difere de Cuiabá em até 4 horas. Das 20h à meia-noite, hora de Cuiabá,
 * o servidor já "virou o dia" em UTC enquanto ainda é hoje em Cuiabá — é
 * exatamente esse o bug observado em produção (2026-08-19, `arquivado_em`
 * mostrando 20/08 antes das 20h de Cuiabá). O locale "en-CA" é só um
 * truque de formatação: é o locale cujo formato padrão de data já é
 * "YYYY-MM-DD", então não precisa reconstruir a string à mão a partir de
 * `getFullYear`/`getMonth`/`getDate` (que reintroduziriam o mesmo bug).
 */
export function hojeEmCuiaba(): string {
  return isoDateInCuiabaFormatter.format(new Date())
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
