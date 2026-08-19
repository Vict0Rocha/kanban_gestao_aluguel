"use server"

import { createClient } from "@/lib/supabase/server"
import type { ActionResult, Card, CardDetailsInput } from "./types"
import type { AlertStatus, AlertType } from "./alerts"
import { somarLancamentos, statusDeParcela, type LancamentoResumo } from "./parcelas"
import {
  avaliarVisibilidadeParcela,
  EXCLUSAO_BLOQUEADA_POR_LANCAMENTO,
  EXCLUSAO_COLUNA_BLOQUEADA_POR_LANCAMENTO,
  MENSAGEM_PARCELA_OCULTA,
  type CardVisibilidade,
} from "./visibilidade"

/**
 * Camada de escrita do sistema. Tudo que grava passa por aqui.
 *
 * Duas defesas independentes, de propósito:
 *
 * 1. Estas actions rodam no servidor e validam antes de tocar no banco. É onde
 *    ficam as regras de negócio — o formulário no navegador valida só para dar
 *    resposta rápida, e não dá para confiar nele.
 *
 * 2. O cliente do Supabase usado aqui é o de sessão do usuário — nunca o
 *    de papel privilegiado (`service_role`) — então o RLS continua valendo
 *    por baixo: se esta camada tiver um bug de autorização, o banco ainda
 *    barra. Trocar essa escolha concentraria todo o risco nestas funções.
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
    // Nenhuma pré-checagem própria é acrescentada aqui — o trigger de banco
    // `cards_impede_exclusao_com_lancamento` (migration
    // 20260819000000_cards_arquivado_em.sql) já cobre este caminho de
    // cascade atomicamente, com o predicado exato de D-14, inclusive para
    // CADA card da coluna. Uma pré-checagem por coluna seria uma segunda
    // consulta e uma segunda cópia da regra; o que faltava não era a
    // trava, era a mensagem — por isso só o SQLSTATE do trigger é mapeado
    // aqui.
    if (error.code === "P0001") {
      return { ok: false, error: EXCLUSAO_COLUNA_BLOQUEADA_POR_LANCAMENTO }
    }
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

/**
 * Predicado de D-14 (qualquer lançamento de qualquer tipo trava a exclusão),
 * numa única implementação. `deleteCardAction` (a trava) e
 * `cardTemLancamentoAction` (o pré-voo do diálogo, plano 06.2-06) chamam
 * exatamente esta função — nenhum dos dois consulta por conta própria, pela
 * mesma disciplina de ponto único de verdade que `visibilidade.ts` documenta.
 *
 * `.limit(1)` faz a consulta parar no primeiro acerto, sem contar tudo — só
 * "existe" importa, não "quantos". `!inner` é obrigatório para filtrar por
 * coluna do embed, mesmo padrão que `financeiro/page.tsx` já usa.
 *
 * Devolve `true`/`false` quando a consulta funciona, e `null` quando ela
 * falha — a incerteza é devolvida ao chamador para decidir: a trava de
 * exclusão fecha (recusa), o pré-voo do diálogo abre (deixa o servidor
 * decidir de verdade no submit).
 */
async function cardTemLancamento(
  supabase: Awaited<ReturnType<typeof createClient>>,
  cardId: string
): Promise<boolean | null> {
  const { data, error } = await supabase
    .from("parcela_lancamentos")
    .select("id, parcelas!inner(card_id)")
    .eq("parcelas.card_id", cardId)
    .limit(1)

  if (error) {
    console.error("cardTemLancamento", error)
    return null
  }
  return (data?.length ?? 0) > 0
}

export async function deleteCardAction(cardId: string): Promise<ActionResult> {
  const sessao = await requireUser()
  if (!sessao) return { ok: false, error: NAO_AUTENTICADO }

  const invalido = id(cardId, "Imóvel")
  if (invalido) return { ok: false, error: invalido }

  // D-14/D-15: a trava real. A confirmação digitada (`excluir <numero>`)
  // que o plano 06.2-06 constrói na interface é conveniência — dá ao
  // usuário uma chance de parar antes de mandar o POST — e NUNCA foi a
  // trava. Esta função recusa mesmo quando chamada direto, fora da
  // interface, porque Server Actions são endpoints POST de verdade.
  const temLancamento = await cardTemLancamento(sessao.supabase, cardId)

  if (temLancamento === true) {
    return { ok: false, error: EXCLUSAO_BLOQUEADA_POR_LANCAMENTO }
  }
  if (temLancamento === null) {
    // Falha fechada: o custo de errar para o lado permissivo aqui é
    // destruição irreversível de histórico financeiro via cascade
    // (cards -> parcelas -> parcela_lancamentos). O custo de errar para o
    // lado restritivo é o usuário tentar de novo. Entre os dois, só o
    // primeiro é irreversível — por isso a verificação que falhou nunca
    // deixa passar.
    return { ok: false, error: erroDoBanco(undefined, "excluir o imóvel") }
  }

  const { data, error } = await sessao.supabase
    .from("cards")
    .delete()
    .eq("id", cardId)
    .select("id")

  if (error) {
    console.error("deleteCard", error)
    // Caminho de corrida: alguém registrou um lançamento entre a
    // verificação acima e este delete. O trigger de banco
    // `cards_impede_exclusao_com_lancamento` pega esse caso — e também
    // qualquer caminho de código futuro que esqueça a verificação — e
    // devolve o SQLSTATE de exceção do trigger, que vira a mesma frase
    // explicativa daqui.
    if (error.code === "P0001") {
      return { ok: false, error: EXCLUSAO_BLOQUEADA_POR_LANCAMENTO }
    }
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
 * Fixa "hoje" no servidor, repetindo exatamente a expressão já usada em
 * financeiro/page.tsx (A-04). Não vira utilitário compartilhado novo —
 * está fora do escopo desta fase, e `parcelas.ts` não pode importar nada
 * de servidor.
 */
function hojeISO(): string {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`
}

/**
 * D-04/D-15: esconder na tela é cosmético, esta função é a trava. Reconsulta
 * a parcela mais o card mais os lançamentos — nunca confia no que a tela
 * mandou — e chama a MESMA `avaliarVisibilidadeParcela` que decide o que o
 * Financeiro mostra (visibilidade.ts). Devolve `null` quando a escrita é
 * permitida, ou a frase de recusa (MENSAGEM_PARCELA_OCULTA) quando não é.
 */
async function exigirParcelaVisivel(
  supabase: Awaited<ReturnType<typeof createClient>>,
  parcelaId: string
): Promise<string | null> {
  const { data, error } = await supabase
    .from("parcelas")
    .select(
      "competencia, cards!inner(ativo, periodo_inicio, periodo_fim, arquivado_em), parcela_lancamentos(id)"
    )
    .eq("id", parcelaId)
    .maybeSingle()

  // Erro OU linha ausente recusa com a frase genérica — inclusive quando a
  // ausência vem do RLS filtrando a linha para quem está fora da allowlist
  // (T-06.2-18): a resposta segura é recusar, não presumir visível (D-04).
  if (error || !data) {
    console.error("trava de visibilidade da parcela (leitura)", error)
    return MENSAGEM_PARCELA_OCULTA.indeterminado
  }

  // Mesmo motivo já documentado em recalcularEGravarStatus: sem Database
  // generics no cliente, o embed precisa ser convertido via `unknown`.
  const parcela = data as unknown as {
    competencia: string
    cards: CardVisibilidade
    parcela_lancamentos: { id: string }[] | null
  }

  const resultado = avaliarVisibilidadeParcela({
    competencia: parcela.competencia,
    card: parcela.cards,
    temLancamento: (parcela.parcela_lancamentos?.length ?? 0) > 0,
    hojeISO: hojeISO(),
  })

  return resultado.visivel ? null : MENSAGEM_PARCELA_OCULTA[resultado.motivo]
}

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

  // D-04/D-15: a trava real. A ocultação na tela (filtrarParcelasVisiveis
  // em financeiro/page.tsx) é consequência, não a barreira — uma aba
  // desatualizada ainda pode tentar este POST, então esta reconsulta é
  // quem realmente decide.
  const recusa = await exigirParcelaVisivel(sessao.supabase, parcelaId)
  if (recusa) return { ok: false, error: recusa }

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

  // D-04/D-15: mesma trava de registrarPagamentoAction, mesmo ponto no
  // fluxo — depois da validação de campos, antes do insert.
  const recusa = await exigirParcelaVisivel(sessao.supabase, parcelaId)
  if (recusa) return { ok: false, error: recusa }

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

  // Mesmo helper de registrarPagamentoAction — nenhuma lógica de status
  // nova é escrita aqui, D-04 (o cálculo de status) é reusado, não
  // reimplementado.
  //
  // Comentário antigo desta linha (Phase 6) dizia que esta ação nunca
  // consulta nem condiciona a escrita à flag manual de contrato
  // ativo/inativo do card. Isso deixou de ser verdade nesta fase: a
  // trava de visibilidade acima (chamada logo após a validação de campos)
  // já reconsultou a parcela e decidiu aceitar ou recusar via
  // `avaliarVisibilidadeParcela` (visibilidade.ts), que entre outras
  // coisas olha a flag do contrato. Nem esta action nem
  // `registrarPagamentoAction` tomam decisão própria sobre situação do
  // contrato, período ou arquivamento — a decisão inteira vem de
  // `avaliarVisibilidadeParcela`.
  const erroStatus = await recalcularEGravarStatus(sessao.supabase, parcelaId)
  if (erroStatus) return { ok: false, error: erroStatus }

  return { ok: true, data: undefined }
}
