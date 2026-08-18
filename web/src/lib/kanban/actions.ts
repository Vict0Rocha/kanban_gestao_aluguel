"use server"

import { createClient } from "@/lib/supabase/server"
import type { ActionResult, Card, CardDetailsInput } from "./types"
import type { AlertStatus, AlertType } from "./alerts"
import { somarLancamentos, statusDeParcela, type LancamentoResumo } from "./parcelas"

/**
 * Camada de escrita do sistema. Tudo que grava passa por aqui.
 *
 * Duas defesas independentes, de propósito:
 *
 * 1. Estas actions rodam no servidor e validam antes de tocar no banco. É onde
 *    ficam as regras de negócio — o formulário no navegador valida só para dar
 *    resposta rápida, e não dá para confiar nele.
 *
 * 2. O cliente do Supabase usado aqui é o de sessão do usuário, não o
 *    `service_role`. Então o RLS continua valendo por baixo: se esta camada
 *    tiver um bug de autorização, o banco ainda barra. Trocar por
 *    `service_role` concentraria todo o risco nestas funções.
 *
 * Server Actions são endpoints POST de verdade, alcançáveis fora da interface,
 * e a checagem de sessão da página não se estende até aqui — por isso cada
 * action chama `requireUser()` por conta própria.
 */

// ------------------------------------------------------------------
// Sessão
// ------------------------------------------------------------------

async function requireUser() {
  const supabase = await createClient()
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser()

  if (error || !user) return null
  return { supabase, user }
}

const NAO_AUTENTICADO = "Sessão expirada. Entre novamente para continuar."

// ------------------------------------------------------------------
// Validação — os limites espelham as CHECK constraints da migration
// 20260811000000_security_hardening.sql. O banco é a autoridade final;
// aqui a checagem existe para devolver uma mensagem que faça sentido
// em vez de um erro cru do Postgres.
// ------------------------------------------------------------------

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const TELEFONE = /^[0-9()+.\-\s]{8,25}$/
const DATA_ISO = /^\d{4}-\d{2}-\d{2}$/

function textoObrigatorio(valor: unknown, campo: string, max: number) {
  if (typeof valor !== "string" || valor.trim().length === 0) {
    return `${campo} é obrigatório.`
  }
  if (valor.trim().length > max) {
    return `${campo} deve ter no máximo ${max} caracteres.`
  }
  return null
}

function textoOpcional(valor: unknown, campo: string, max: number) {
  if (valor === null || valor === undefined) return null
  if (typeof valor !== "string") return `${campo} inválido.`
  if (valor.length > max) return `${campo} deve ter no máximo ${max} caracteres.`
  return null
}

function id(valor: unknown, campo: string) {
  if (typeof valor !== "string" || !UUID.test(valor)) return `${campo} inválido.`
  return null
}

function numeroFinito(valor: unknown, campo: string) {
  if (typeof valor !== "number" || !Number.isFinite(valor)) {
    return `${campo} inválido.`
  }
  return null
}

/**
 * Espelha `parcela_lancamentos_valor_nao_negativo` +
 * `parcela_lancamentos_valor_exigido`. O chamador passa a frase certa para
 * cada diálogo (A-02) — esta função não tem texto fixo.
 */
function valorLancamento(valor: unknown, mensagem: string): string | null {
  if (typeof valor !== "number" || !Number.isFinite(valor)) return mensagem
  if (valor <= 0 || valor >= 10_000_000) return mensagem
  return null
}

/** Só é usada por `registrarPagamentoAction` — o diálogo de ajuste não tem campo de data (A-04). */
function dataObrigatoria(valor: unknown): string | null {
  if (typeof valor !== "string" || valor.length === 0 || !DATA_ISO.test(valor)) {
    return "Informe a data do pagamento."
  }
  return null
}

function booleano(valor: unknown, campo: string) {
  if (typeof valor !== "boolean") return `${campo} inválido.`
  return null
}

function validarValor(valor: unknown) {
  if (typeof valor !== "number" || !Number.isFinite(valor)) {
    return "Informe um valor de aluguel válido."
  }
  if (valor <= 0) return "O valor do aluguel precisa ser maior que zero."
  if (valor >= 10_000_000) return "O valor do aluguel parece alto demais."
  return null
}

function validarData(valor: unknown, campo: string) {
  if (valor === null || valor === undefined || valor === "") return null
  if (typeof valor !== "string" || !DATA_ISO.test(valor)) {
    return `${campo} inválida.`
  }
  return null
}

/** Regras que envolvem mais de um campo ao mesmo tempo. */
function validarDetalhes(input: CardDetailsInput): string | null {
  return (
    textoObrigatorio(input.proprietario, "Proprietário", 200) ??
    textoObrigatorio(input.endereco, "Endereço", 300) ??
    validarValor(input.valor) ??
    textoOpcional(input.inquilino, "Inquilino", 200) ??
    textoOpcional(input.observacoes, "Observações", 2000) ??
    validarData(input.periodo_inicio, "Data de início") ??
    validarData(input.periodo_fim, "Data de fim") ??
    validarTelefone(input.telefone) ??
    validarPeriodo(input.periodo_inicio, input.periodo_fim)
  )
}

function validarTelefone(telefone: string | null) {
  if (telefone === null || telefone === "") return null
  if (typeof telefone !== "string" || !TELEFONE.test(telefone)) {
    return "Telefone inválido. Use apenas números, espaços, parênteses e traços."
  }
  return null
}

function validarPeriodo(inicio: string | null, fim: string | null) {
  if (!inicio || !fim) return null
  if (fim < inicio) return "O fim do contrato não pode ser antes do início."
  return null
}

// ------------------------------------------------------------------
// Tradução de erro do banco
// ------------------------------------------------------------------

/**
 * O RLS *filtra linhas*, não recusa a instrução: um UPDATE ou DELETE que a
 * policy não deixa enxergar volta sucesso com zero linhas afetadas. Sem tratar
 * isso como falha, a interface reverteria nada e o dado reapareceria no próximo
 * refresh. (INSERT é diferente — viola o WITH CHECK e erra sozinho.)
 */
function semLinhas(acao: string) {
  return `Não foi possível ${acao}: sem permissão ou o registro já não existe.`
}

/** Mensagens do Postgres não devem vazar cruas para a tela. */
function erroDoBanco(codigo: string | undefined, acao: string) {
  if (codigo === "23514") return "Os dados informados não passaram na validação."
  if (codigo === "23503") return "O registro relacionado não existe mais."
  if (codigo === "PGRST116") return semLinhas(acao)
  return `Não foi possível ${acao}. Tente novamente.`
}

// ------------------------------------------------------------------
// Colunas
// ------------------------------------------------------------------

export async function createColumnAction(
  boardId: string,
  name: string,
  position: number
): Promise<ActionResult<{ id: string; board_id: string; name: string; position: number }>> {
  const sessao = await requireUser()
  if (!sessao) return { ok: false, error: NAO_AUTENTICADO }

  const invalido =
    id(boardId, "Board") ??
    textoObrigatorio(name, "Nome da coluna", 60) ??
    numeroFinito(position, "Posição")
  if (invalido) return { ok: false, error: invalido }

  const { data, error } = await sessao.supabase
    .from("columns")
    .insert({ board_id: boardId, name: name.trim(), position })
    .select("id, board_id, name, position")
    .single()

  if (error || !data) {
    console.error("createColumn", error)
    return { ok: false, error: erroDoBanco(error?.code, "criar a coluna") }
  }
  return { ok: true, data }
}

export async function renameColumnAction(
  columnId: string,
  name: string
): Promise<ActionResult> {
  const sessao = await requireUser()
  if (!sessao) return { ok: false, error: NAO_AUTENTICADO }

  const invalido =
    id(columnId, "Coluna") ?? textoObrigatorio(name, "Nome da coluna", 60)
  if (invalido) return { ok: false, error: invalido }

  const { data, error } = await sessao.supabase
    .from("columns")
    .update({ name: name.trim() })
    .eq("id", columnId)
    .select("id")

  if (error) {
    console.error("renameColumn", error)
    return { ok: false, error: erroDoBanco(error.code, "renomear a coluna") }
  }
  if (!data || data.length === 0) {
    return { ok: false, error: semLinhas("renomear a coluna") }
  }
  return { ok: true, data: undefined }
}

export async function moveColumnAction(
  columnId: string,
  position: number
): Promise<ActionResult> {
  const sessao = await requireUser()
  if (!sessao) return { ok: false, error: NAO_AUTENTICADO }

  const invalido = id(columnId, "Coluna") ?? numeroFinito(position, "Posição")
  if (invalido) return { ok: false, error: invalido }

  const { data, error } = await sessao.supabase
    .from("columns")
    .update({ position })
    .eq("id", columnId)
    .select("id")

  if (error) {
    console.error("moveColumn", error)
    return { ok: false, error: erroDoBanco(error.code, "mover a coluna") }
  }
  if (!data || data.length === 0) {
    return { ok: false, error: semLinhas("mover a coluna") }
  }
  return { ok: true, data: undefined }
}

export async function deleteColumnAction(columnId: string): Promise<ActionResult> {
  const sessao = await requireUser()
  if (!sessao) return { ok: false, error: NAO_AUTENTICADO }

  const invalido = id(columnId, "Coluna")
  if (invalido) return { ok: false, error: invalido }

  const { data, error } = await sessao.supabase
    .from("columns")
    .delete()
    .eq("id", columnId)
    .select("id")

  if (error) {
    console.error("deleteColumn", error)
    return { ok: false, error: erroDoBanco(error.code, "excluir a coluna") }
  }
  if (!data || data.length === 0) {
    return { ok: false, error: semLinhas("excluir a coluna") }
  }
  return { ok: true, data: undefined }
}

// ------------------------------------------------------------------
// Imóveis
// ------------------------------------------------------------------

export async function createCardAction(
  columnId: string,
  position: number,
  input: { proprietario: string; valor: number; endereco: string }
): Promise<ActionResult<Card>> {
  const sessao = await requireUser()
  if (!sessao) return { ok: false, error: NAO_AUTENTICADO }

  const invalido =
    id(columnId, "Coluna") ??
    numeroFinito(position, "Posição") ??
    textoObrigatorio(input?.proprietario, "Proprietário", 200) ??
    textoObrigatorio(input?.endereco, "Endereço", 300) ??
    validarValor(input?.valor)
  if (invalido) return { ok: false, error: invalido }

  const { data, error } = await sessao.supabase
    .from("cards")
    .insert({
      column_id: columnId,
      position,
      proprietario: input.proprietario.trim(),
      endereco: input.endereco.trim(),
      valor: input.valor,
      // Vem da sessão no servidor, nunca do que o cliente mandou: assim
      // ninguém consegue gravar um imóvel em nome de outra pessoa.
      created_by: sessao.user.id,
    })
    .select()
    .single<Card>()

  if (error || !data) {
    console.error("createCard", error)
    return { ok: false, error: erroDoBanco(error?.code, "criar o imóvel") }
  }
  return { ok: true, data }
}

export async function updateCardAction(
  cardId: string,
  input: CardDetailsInput
): Promise<ActionResult<Card>> {
  const sessao = await requireUser()
  if (!sessao) return { ok: false, error: NAO_AUTENTICADO }

  const invalido = id(cardId, "Imóvel") ?? validarDetalhes(input)
  if (invalido) return { ok: false, error: invalido }

  // Monta o registro campo a campo em vez de repassar o objeto recebido:
  // assim uma propriedade extra vinda do cliente (created_by, id, o que for)
  // não chega ao banco de carona.
  const { data, error } = await sessao.supabase
    .from("cards")
    .update({
      proprietario: input.proprietario.trim(),
      endereco: input.endereco.trim(),
      valor: input.valor,
      inquilino: input.inquilino?.trim() || null,
      telefone: input.telefone?.trim() || null,
      periodo_inicio: input.periodo_inicio || null,
      periodo_fim: input.periodo_fim || null,
      observacoes: input.observacoes?.trim() || null,
    })
    .eq("id", cardId)
    .select()
    .single<Card>()

  if (error || !data) {
    console.error("updateCard", error)
    return { ok: false, error: erroDoBanco(error?.code, "salvar o imóvel") }
  }
  return { ok: true, data }
}

export async function moveCardAction(
  cardId: string,
  columnId: string,
  position: number
): Promise<ActionResult> {
  const sessao = await requireUser()
  if (!sessao) return { ok: false, error: NAO_AUTENTICADO }

  const invalido =
    id(cardId, "Imóvel") ??
    id(columnId, "Coluna") ??
    numeroFinito(position, "Posição")
  if (invalido) return { ok: false, error: invalido }

  const { data, error } = await sessao.supabase
    .from("cards")
    .update({ column_id: columnId, position })
    .eq("id", cardId)
    .select("id")

  if (error) {
    console.error("moveCard", error)
    return { ok: false, error: erroDoBanco(error.code, "mover o imóvel") }
  }
  if (!data || data.length === 0) {
    return { ok: false, error: semLinhas("mover o imóvel") }
  }
  return { ok: true, data: undefined }
}

export async function deleteCardAction(cardId: string): Promise<ActionResult> {
  const sessao = await requireUser()
  if (!sessao) return { ok: false, error: NAO_AUTENTICADO }

  const invalido = id(cardId, "Imóvel")
  if (invalido) return { ok: false, error: invalido }

  const { data, error } = await sessao.supabase
    .from("cards")
    .delete()
    .eq("id", cardId)
    .select("id")

  if (error) {
    console.error("deleteCard", error)
    return { ok: false, error: erroDoBanco(error.code, "excluir o imóvel") }
  }
  if (!data || data.length === 0) {
    return { ok: false, error: semLinhas("excluir o imóvel") }
  }
  return { ok: true, data: undefined }
}

export async function setCardAtivoAction(
  cardId: string,
  ativo: boolean
): Promise<ActionResult> {
  const sessao = await requireUser()
  if (!sessao) return { ok: false, error: NAO_AUTENTICADO }

  const invalido = id(cardId, "Imóvel") ?? booleano(ativo, "Situação do contrato")
  if (invalido) return { ok: false, error: invalido }

  const { data, error } = await sessao.supabase
    .from("cards")
    .update({ ativo })
    .eq("id", cardId)
    .select("id")

  if (error) {
    console.error("setCardAtivo", error)
    return { ok: false, error: erroDoBanco(error.code, "atualizar o imóvel") }
  }
  if (!data || data.length === 0) {
    return { ok: false, error: semLinhas("atualizar o imóvel") }
  }
  return { ok: true, data: undefined }
}

// ------------------------------------------------------------------
// Alertas
// ------------------------------------------------------------------

const TIPOS_ALERTA: AlertType[] = ["contrato_vencendo", "contrato_vencido"]
const STATUS_ALERTA: AlertStatus[] = ["enviado", "descartado"]

/**
 * Registra que o alerta foi tratado. Os alertas em si são derivados da data do
 * contrato a cada leitura, então uma linha só existe aqui depois que alguém
 * agiu — e o índice único em (card_id, type, trigger_date) torna cliques
 * repetidos idempotentes.
 */
export async function resolveAlertAction(input: {
  cardId: string
  type: AlertType
  triggerDate: string
  status: Exclude<AlertStatus, "pendente">
}): Promise<ActionResult> {
  const sessao = await requireUser()
  if (!sessao) return { ok: false, error: NAO_AUTENTICADO }

  const invalido =
    id(input?.cardId, "Imóvel") ?? validarData(input?.triggerDate, "Data do alerta")
  if (invalido) return { ok: false, error: invalido }

  // Enums do banco: comparar contra a lista fechada evita mandar um valor
  // qualquer e receber um erro cru do Postgres de volta.
  if (!TIPOS_ALERTA.includes(input.type)) {
    return { ok: false, error: "Tipo de alerta inválido." }
  }
  if (!STATUS_ALERTA.includes(input.status)) {
    return { ok: false, error: "Situação de alerta inválida." }
  }
  if (!input.triggerDate) {
    return { ok: false, error: "Data do alerta é obrigatória." }
  }

  const { data, error } = await sessao.supabase
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

  if (error) {
    console.error("resolveAlert", error)
    return { ok: false, error: erroDoBanco(error.code, "registrar o alerta") }
  }
  if (!data || data.length === 0) {
    return { ok: false, error: semLinhas("registrar o alerta") }
  }
  return { ok: true, data: undefined }
}

// ------------------------------------------------------------------
// Parcelas
// ------------------------------------------------------------------

/**
 * Única função que `registrarPagamentoAction`/`ajustarParcelaAction` usam
 * para decidir o novo status — nenhum dos dois recalcula por conta própria
 * (evita duplicar a regra de D-04 entre pagamento e ajuste). Sempre relê a
 * soma de TODOS os lançamentos direto do banco, nunca aplica um delta.
 */
async function recalcularEGravarStatus(
  supabase: Awaited<ReturnType<typeof createClient>>,
  parcelaId: string
): Promise<string | null> {
  const { data, error } = await supabase
    .from("parcelas")
    .select("valor_original, parcela_lancamentos(tipo, valor)")
    .eq("id", parcelaId)
    .single()

  if (error || !data) {
    console.error("recalcularEGravarStatus (leitura)", error)
    return erroDoBanco(error?.code, "atualizar a situação da parcela")
  }

  // Mesmo motivo já documentado em page.tsx: este cliente não tem Database
  // generics, então o embed `parcela_lancamentos` é inferido de um jeito que
  // não bate exatamente com o shape real devolvido pelo PostgREST.
  const parcela = data as unknown as {
    valor_original: number
    parcela_lancamentos: LancamentoResumo[] | null
  }

  const { valorDevido, valorPago } = somarLancamentos(
    parcela.valor_original,
    parcela.parcela_lancamentos
  )
  const status = statusDeParcela(valorDevido, valorPago)

  const { data: atualizado, error: erroUpdate } = await supabase
    .from("parcelas")
    .update({ status })
    .eq("id", parcelaId)
    .select("id")

  if (erroUpdate) {
    console.error("recalcularEGravarStatus (update)", erroUpdate)
    return erroDoBanco(erroUpdate.code, "atualizar a situação da parcela")
  }
  if (!atualizado || atualizado.length === 0) {
    return semLinhas("atualizar a situação da parcela")
  }
  return null
}

export async function registrarPagamentoAction(
  parcelaId: string,
  valor: number,
  data: string,
  observacao: string | null
): Promise<ActionResult> {
  const sessao = await requireUser()
  if (!sessao) return { ok: false, error: NAO_AUTENTICADO }

  const invalido =
    id(parcelaId, "Parcela") ??
    valorLancamento(valor, "Informe um valor de pagamento válido.") ??
    dataObrigatoria(data) ??
    textoOpcional(observacao, "Observação", 2000)
  if (invalido) return { ok: false, error: invalido }

  const { data: inserido, error } = await sessao.supabase
    .from("parcela_lancamentos")
    .insert({
      parcela_id: parcelaId,
      tipo: "pagamento",
      valor,
      data,
      observacao: observacao?.trim() || null,
      // D-02: vem da sessão do servidor, nunca do que o cliente mandou —
      // mesmo raciocínio de createCardAction. criado_em fica no default
      // now() do banco.
      criado_por: sessao.user.id,
    })
    .select("id")

  if (error) {
    console.error("registrarPagamento", error)
    return { ok: false, error: erroDoBanco(error.code, "registrar o pagamento") }
  }
  if (!inserido || inserido.length === 0) {
    return { ok: false, error: semLinhas("registrar o pagamento") }
  }

  const erroStatus = await recalcularEGravarStatus(sessao.supabase, parcelaId)
  if (erroStatus) return { ok: false, error: erroStatus }

  return { ok: true, data: undefined }
}

const TIPOS_AJUSTE: Array<"acrescimo" | "desconto"> = ["acrescimo", "desconto"]

export async function ajustarParcelaAction(
  parcelaId: string,
  tipo: "acrescimo" | "desconto",
  valor: number,
  observacao: string | null
): Promise<ActionResult> {
  const sessao = await requireUser()
  if (!sessao) return { ok: false, error: NAO_AUTENTICADO }

  const invalido =
    id(parcelaId, "Parcela") ??
    (TIPOS_AJUSTE.includes(tipo) ? null : "Tipo de ajuste inválido.") ??
    valorLancamento(valor, "Informe um valor de ajuste válido.") ??
    textoOpcional(observacao, "Observação", 2000)
  if (invalido) return { ok: false, error: invalido }

  // Sem campo `data` (A-04, fica no default current_date do banco).
  const { data: inserido, error } = await sessao.supabase
    .from("parcela_lancamentos")
    .insert({
      parcela_id: parcelaId,
      tipo,
      valor,
      observacao: observacao?.trim() || null,
      criado_por: sessao.user.id,
    })
    .select("id")

  if (error) {
    console.error("ajustarParcela", error)
    return { ok: false, error: erroDoBanco(error.code, "registrar o ajuste") }
  }
  if (!inserido || inserido.length === 0) {
    return { ok: false, error: semLinhas("registrar o ajuste") }
  }

  // Mesmo helper da Task 1 — nenhuma lógica de status nova é escrita aqui,
  // D-04 é reusado, não reimplementado. Esta ação nunca consulta ou
  // condiciona a escrita à flag manual de contrato ativo/inativo do card
  // (D-07) — só setCardAtivoAction e garantirParcelas tocam nessa flag.
  const erroStatus = await recalcularEGravarStatus(sessao.supabase, parcelaId)
  if (erroStatus) return { ok: false, error: erroStatus }

  return { ok: true, data: undefined }
}
