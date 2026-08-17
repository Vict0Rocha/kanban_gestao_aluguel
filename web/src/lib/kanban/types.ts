export type Card = {
  id: string
  column_id: string
  position: number
  proprietario: string
  valor: number
  endereco: string
  inquilino: string | null
  telefone: string | null
  periodo_inicio: string | null
  periodo_fim: string | null
  observacoes: string | null
  ativo: boolean
  created_at: string
  updated_at: string
}

export type Column = {
  id: string
  board_id: string
  name: string
  position: number
  cards: Card[]
}

/** Campos editáveis de um imóvel, como chegam do formulário de detalhes. */
export type CardDetailsInput = {
  proprietario: string
  valor: number
  endereco: string
  inquilino: string | null
  telefone: string | null
  periodo_inicio: string | null
  periodo_fim: string | null
  observacoes: string | null
}

/**
 * Retorno das Server Actions. Não usamos `throw` para erro de validação porque
 * o Next substitui a mensagem de exceções por um texto genérico em produção —
 * a mensagem útil ficaria só no log do servidor, e o usuário veria "erro
 * inesperado". Como valor de retorno, ela chega intacta.
 */
export type ActionResult<T = void> =
  | { ok: true; data: T }
  | { ok: false; error: string }
