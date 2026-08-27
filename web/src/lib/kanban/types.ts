export type Card = {
  id: string
  // Nulo enquanto o contrato está arquivado (D-01/D-05, 16-CONTEXT.md) —
  // arquivar desvincula o card de qualquer coluna de propósito, fechando o
  // risco de exclusão em cascata de D-02. Sempre preenchido enquanto o
  // contrato está em operação normal (não arquivado); o Board nunca vê um
  // `column_id` nulo porque sua query já filtra `arquivado_em is null`.
  column_id: string | null
  position: number
  numero: number
  proprietario: string
  valor: number
  endereco: string
  inquilino: string | null
  telefone: string | null
  periodo_inicio: string | null
  periodo_fim: string | null
  observacoes: string | null
  ativo: boolean
  // Nulo = não arquivado (D-07). Guarda QUANDO o contrato foi arquivado,
  // não só SE foi — coluna já existe no banco desde o plano 06.2-03, este
  // tipo só a expõe para a UI dos planos 06.2-06/06.2-07.
  arquivado_em: string | null
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
