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
