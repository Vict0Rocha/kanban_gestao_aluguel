import { createClient } from "@/lib/supabase/client"
import type { Card } from "./types"
import type { AlertStatus, AlertType } from "./alerts"

/**
 * O RLS do Postgres *filtra linhas*, não recusa a instrução. Um UPDATE ou
 * DELETE que a policy não deixa enxergar volta 200 com zero linhas afetadas —
 * não um erro. Sem transformar isso em exceção, a interface trata como sucesso,
 * a escrita otimista nunca é revertida, e o dado reaparece no próximo refresh.
 *
 * (INSERT é diferente: viola o WITH CHECK e erra sozinho.)
 */
function assertAffected(rows: unknown[] | null, acao: string): void {
  if (!rows || rows.length === 0) {
    throw new Error(
      `${acao}: nenhuma linha afetada — sem permissão ou registro já removido.`
    )
  }
}

export async function createColumn(boardId: string, name: string, position: number) {
  const supabase = createClient()
  const { data, error } = await supabase
    .from("columns")
    .insert({ board_id: boardId, name, position })
    .select()
    .single()

  if (error) throw error
  return data
}

export async function renameColumn(id: string, name: string) {
  const supabase = createClient()
  const { data, error } = await supabase
    .from("columns")
    .update({ name })
    .eq("id", id)
    .select("id")

  if (error) throw error
  assertAffected(data, "renomear coluna")
}

export async function updateColumnPosition(id: string, position: number) {
  const supabase = createClient()
  const { data, error } = await supabase
    .from("columns")
    .update({ position })
    .eq("id", id)
    .select("id")

  if (error) throw error
  assertAffected(data, "mover coluna")
}

export async function deleteColumn(id: string) {
  const supabase = createClient()
  const { data, error } = await supabase
    .from("columns")
    .delete()
    .eq("id", id)
    .select("id")

  if (error) throw error
  assertAffected(data, "excluir coluna")
}

export async function createCard(
  columnId: string,
  position: number,
  input: { proprietario: string; valor: number; endereco: string }
) {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const { data, error } = await supabase
    .from("cards")
    .insert({
      column_id: columnId,
      position,
      proprietario: input.proprietario,
      valor: input.valor,
      endereco: input.endereco,
      created_by: user?.id,
    })
    .select()
    .single<Card>()

  if (error) throw error
  return data
}

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

export async function updateCard(id: string, input: CardDetailsInput) {
  const supabase = createClient()
  // .single() já erra (PGRST116) quando o RLS filtra a linha, então aqui não
  // é preciso o assertAffected.
  const { data, error } = await supabase
    .from("cards")
    .update(input)
    .eq("id", id)
    .select()
    .single<Card>()

  if (error) throw error
  return data
}

export async function moveCard(id: string, columnId: string, position: number) {
  const supabase = createClient()
  const { data, error } = await supabase
    .from("cards")
    .update({ column_id: columnId, position })
    .eq("id", id)
    .select("id")

  if (error) throw error
  assertAffected(data, "mover imóvel")
}

/**
 * Records that this alert was handled. Alerts themselves are derived on read,
 * so a row here exists only once someone acts on one — the unique index on
 * (card_id, type, trigger_date) makes repeat clicks idempotent.
 */
export async function resolveAlert(input: {
  cardId: string
  type: AlertType
  triggerDate: string
  status: Exclude<AlertStatus, "pendente">
}) {
  const supabase = createClient()
  const { data, error } = await supabase
    .from("alerts")
    .upsert(
      {
        card_id: input.cardId,
        type: input.type,
        trigger_date: input.triggerDate,
        status: input.status,
      },
      { onConflict: "card_id,type,trigger_date" }
    )
    .select("id")

  if (error) throw error
  assertAffected(data, "resolver alerta")
}

export async function deleteCard(id: string) {
  const supabase = createClient()
  const { data, error } = await supabase
    .from("cards")
    .delete()
    .eq("id", id)
    .select("id")

  if (error) throw error
  assertAffected(data, "excluir imóvel")
}
