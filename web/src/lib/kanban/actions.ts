"use server"

import { createClient } from "@/lib/supabase/server"
import type { ActionResult, Card, CardDetailsInput } from "./types"
import type { AlertStatus, AlertType } from "./alerts"
import { GAP } from "./position"
import {
  parcelaOrfaApagavel,
  somarLancamentos,
  statusDeParcela,
  type LancamentoResumo,
  type ParcelaCandidataPoda,
} from "./parcelas"
import { origemTaxa } from "./taxas"
import { hojeEmCuiaba } from "./format"
import type { ParcelaRelatorio } from "./relatorio-financeiro"
import type {
  CaucaoEventoRelatorio,
  TaxaImobiliariaRelatorio,
} from "./reconciliacao"
import {
  avaliarVisibilidadeParcela,
  EXCLUSAO_BLOQUEADA_POR_LANCAMENTO,
  EXCLUSAO_COLUNA_BLOQUEADA_POR_LANCAMENTO,
  MENSAGEM_PARCELA_OCULTA,
  parcelaVisivel,
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

/**
 * Espelha `taxas_imobiliaria_valor_nao_negativo`. Diferença deliberada para
 * `valorLancamento` acima: aceita `valor === 0` (só recusa `< 0`, não finito,
 * ou `>= 10_000_000`) — D-03: R$ 0,00 é um valor de taxa da imobiliária
 * legítimo, não um lançamento vazio a recusar.
 */
function valorNaoNegativo(valor: unknown, mensagem: string): string | null {
  if (typeof valor !== "number" || !Number.isFinite(valor)) return mensagem
  if (valor < 0 || valor >= 10_000_000) return mensagem
  return null
}

/** Usada por `registrarPagamentoAction` e `registrarEventoCaucaoAction` (plano 13-06) — o
 * diálogo de ajuste não tem campo de data (A-04). */
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

const CARDIDS_DEMAIS_COLUNA = "Muitos imóveis nesta coluna para mover de uma vez."

/**
 * Combina "mover todos os cards da coluna para outra" + "excluir a coluna"
 * numa única chamada de servidor (D-01/D-03, 17-CONTEXT.md). Nunca aceita
 * a lista de cardIds do cliente — reconsulta os cards da coluna de origem
 * no momento da escrita, mesma disciplina de podarParcelasOrfas — e nunca
 * confia que `destinoColumnId` pertence ao mesmo board sem reconferir.
 */
export async function excluirColunaComMovimentoAction(
  columnId: string,
  destinoColumnId: string
): Promise<ActionResult> {
  const sessao = await requireUser()
  if (!sessao) return { ok: false, error: NAO_AUTENTICADO }

  const invalido = id(columnId, "Coluna") ?? id(destinoColumnId, "Coluna de destino")
  if (invalido) return { ok: false, error: invalido }

  if (columnId === destinoColumnId) {
    return { ok: false, error: "A coluna de destino precisa ser diferente da coluna sendo excluída." }
  }

  // Server-authoritative: reconsulta as duas colunas, confirma que existem
  // e pertencem ao mesmo board — nunca confia num destino vindo do cliente.
  const { data: colunas, error: erroColunas } = await sessao.supabase
    .from("columns")
    .select("id, board_id")
    .in("id", [columnId, destinoColumnId])
  if (erroColunas) {
    console.error("excluirColunaComMovimento (colunas)", erroColunas)
    return { ok: false, error: erroDoBanco(erroColunas.code, "excluir a coluna") }
  }
  const origem = colunas?.find((c) => c.id === columnId)
  const destino = colunas?.find((c) => c.id === destinoColumnId)
  if (!origem || !destino) return { ok: false, error: semLinhas("excluir a coluna") }
  if (origem.board_id !== destino.board_id) {
    return { ok: false, error: "A coluna de destino precisa estar no mesmo board." }
  }

  // Reconsulta os cards da coluna de origem, na ordem visual atual — nunca
  // recebe essa lista de fora (mesmo motivo de podarParcelasOrfas).
  const { data: cards, error: erroCards } = await sessao.supabase
    .from("cards")
    .select("id")
    .eq("column_id", columnId)
    .order("position", { ascending: true })
  if (erroCards) {
    console.error("excluirColunaComMovimento (cards)", erroCards)
    return { ok: false, error: erroDoBanco(erroCards.code, "excluir a coluna") }
  }

  const cardIds = (cards ?? []).map((c) => c.id)
  if (cardIds.length > 200) return { ok: false, error: CARDIDS_DEMAIS_COLUNA }

  if (cardIds.length > 0) {
    // Base = maior position já usada no destino, para não colidir com
    // cards que já estavam lá (mesmo cuidado de handleCreateCard).
    const { data: ultimoDestino } = await sessao.supabase
      .from("cards")
      .select("position")
      .eq("column_id", destinoColumnId)
      .order("position", { ascending: false })
      .limit(1)
      .maybeSingle()
    const base = ultimoDestino?.position ?? 0

    const resultados = await Promise.all(
      cardIds.map((cardId, index) =>
        sessao.supabase
          .from("cards")
          .update({ column_id: destinoColumnId, position: base + (index + 1) * GAP })
          .eq("id", cardId)
          .select("id")
      )
    )
    const comErro = resultados.find((r) => r.error)
    if (comErro?.error) {
      console.error("excluirColunaComMovimento (mover)", comErro.error)
      return { ok: false, error: erroDoBanco(comErro.error.code, "mover os imóveis") }
    }
    const semLinha = resultados.some((r) => !r.data || r.data.length === 0)
    if (semLinha) return { ok: false, error: semLinhas("mover os imóveis") }
  }

  // A coluna está agora garantidamente vazia — mesmo caminho de
  // deleteColumnAction (P0001 mapeado do mesmo jeito, defesa em
  // profundidade mesmo sem cards restantes para cascatear).
  const { data, error } = await sessao.supabase
    .from("columns")
    .delete()
    .eq("id", columnId)
    .select("id")
  if (error) {
    console.error("excluirColunaComMovimento (delete)", error)
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

/**
 * Poda síncrona de parcelas órfãs (D-01/D-02/D-04), chamada só de dentro de
 * `updateCardAction` — nunca a partir de outro caminho. `novoInicio`/
 * `novoFim` são os valores JÁ gravados pelo UPDATE que acabou de rodar (mesmo
 * cálculo, nunca recalculado diferente).
 *
 * **Nunca recebe a lista de ids de fora desta função.** Reconsulta o
 * conjunto de candidatas na hora do delete — a consulta abaixo É a fonte de
 * verdade, rodada milissegundos antes do delete, sem pausa de usuário no
 * meio (Pitfall 1 do RESEARCH.md). O intervalo residual de corrida é o
 * tempo entre a SELECT e o DELETE desta mesma chamada de servidor — não o
 * intervalo (de segundos/minutos) entre o pré-voo consultivo
 * (`contarParcelasOrfasAction`) e a confirmação do usuário.
 *
 * `.eq("status", "aberta")` dentro do próprio `.delete()` é a segunda camada
 * de defesa que o supabase-js consegue expressar sem uma function de banco —
 * o cliente não tem um `NOT EXISTS` para `.delete()`, por isso não há um
 * guard `NOT EXISTS` direto no comando.
 *
 * Um DELETE que apaga menos do que o esperado (inclusive zero) NÃO é
 * `semLinhas` — é o resultado correto quando a corrida excluiu alguma
 * candidata no meio do caminho (ex.: um lançamento foi registrado entre a
 * SELECT e o DELETE); não trata como falha.
 */
async function podarParcelasOrfas(
  supabase: Awaited<ReturnType<typeof createClient>>,
  cardId: string,
  novoInicio: string | null,
  novoFim: string | null
): Promise<string | null> {
  const { data, error } = await supabase
    .from("parcelas")
    .select("id, competencia, status, parcela_lancamentos(id)")
    .eq("card_id", cardId)
    .eq("status", "aberta")

  if (error) {
    console.error("podarParcelasOrfas (leitura)", error)
    return erroDoBanco(error.code, "salvar o imóvel")
  }

  const hojeISO = hojeEmCuiaba()
  const candidatas = (data ?? []) as unknown as ParcelaCandidataPoda[]
  const idsOrfas = candidatas
    .filter((parcela) => parcelaOrfaApagavel(parcela, novoInicio, novoFim, hojeISO))
    .map((parcela) => parcela.id)

  if (idsOrfas.length === 0) return null

  const { data: apagadas, error: erroDelete } = await supabase
    .from("parcelas")
    .delete()
    .in("id", idsOrfas)
    .eq("status", "aberta")
    .select("id")

  if (erroDelete) {
    console.error("podarParcelasOrfas (delete)", erroDelete)
    return erroDoBanco(erroDelete.code, "salvar o imóvel")
  }

  // D-01 é uma exceção deliberada ao livro-razão append-only (T-09-03) —
  // este log é o backstop de auditoria mínimo para uma investigação futura,
  // mesmo não sendo um erro.
  console.error("podarParcelasOrfas: parcelas apagadas", {
    cardId,
    idsApagados: (apagadas ?? []).map((parcela) => parcela.id),
  })

  return null
}

export async function updateCardAction(
  cardId: string,
  input: CardDetailsInput
): Promise<ActionResult<Card>> {
  const sessao = await requireUser()
  if (!sessao) return { ok: false, error: NAO_AUTENTICADO }

  const invalido = id(cardId, "Imóvel") ?? validarDetalhes(input)
  if (invalido) return { ok: false, error: invalido }

  // D-04: lê o período ANTES do UPDATE para detectar, depois, se ele
  // realmente mudou de valor nesta gravação — a poda só dispara nesse caso.
  const { data: antes, error: erroAntes } = await sessao.supabase
    .from("cards")
    .select("periodo_inicio, periodo_fim")
    .eq("id", cardId)
    .maybeSingle()

  if (erroAntes || !antes) {
    console.error("updateCard (leitura do período anterior)", erroAntes)
    return { ok: false, error: erroDoBanco(erroAntes?.code, "salvar o imóvel") }
  }

  const novoInicio = input.periodo_inicio || null
  const novoFim = input.periodo_fim || null

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
      periodo_inicio: novoInicio,
      periodo_fim: novoFim,
      observacoes: input.observacoes?.trim() || null,
    })
    .eq("id", cardId)
    .select()
    .single<Card>()

  if (error || !data) {
    console.error("updateCard", error)
    return { ok: false, error: erroDoBanco(error?.code, "salvar o imóvel") }
  }

  // D-01/D-02/D-04: a poda faz parte do mesmo salvamento — uma falha na
  // exclusão não pode virar um salvamento "meio sucesso" que deixa órfã
  // para trás sem avisar. Só dispara quando periodo_inicio e/ou periodo_fim
  // realmente mudaram de valor nesta chamada.
  if (antes.periodo_inicio !== novoInicio || antes.periodo_fim !== novoFim) {
    const erroPoda = await podarParcelasOrfas(sessao.supabase, cardId, novoInicio, novoFim)
    if (erroPoda) return { ok: false, error: erroPoda }
  }

  return { ok: true, data }
}

/**
 * Pré-voo consultivo de D-05: mesma consulta e o mesmo `parcelaOrfaApagavel`
 * que `podarParcelasOrfas` usa, mas só de leitura — nenhum `.update()`/
 * `.delete()` no corpo desta função. Nunca é usada para montar a lista do
 * DELETE real (Pitfall 1 do RESEARCH.md); o card-detail-dialog.tsx chama
 * esta action só para mostrar a contagem antes de o usuário confirmar.
 */
export async function contarParcelasOrfasAction(
  cardId: string,
  novoInicio: string | null,
  novoFim: string | null
): Promise<ActionResult<{ quantidade: number }>> {
  const sessao = await requireUser()
  if (!sessao) return { ok: false, error: NAO_AUTENTICADO }

  const invalido =
    id(cardId, "Imóvel") ??
    validarData(novoInicio, "Data de início") ??
    validarData(novoFim, "Data de fim") ??
    validarPeriodo(novoInicio, novoFim)
  if (invalido) return { ok: false, error: invalido }

  const { data, error } = await sessao.supabase
    .from("parcelas")
    .select("id, competencia, status, parcela_lancamentos(id)")
    .eq("card_id", cardId)
    .eq("status", "aberta")

  if (error) {
    console.error("contarParcelasOrfas", error)
    return { ok: false, error: erroDoBanco(error.code, "consultar as parcelas do imóvel") }
  }

  const hojeISO = hojeEmCuiaba()
  const candidatas = (data ?? []) as unknown as ParcelaCandidataPoda[]
  const quantidade = candidatas.filter((parcela) =>
    parcelaOrfaApagavel(parcela, novoInicio, novoFim, hojeISO)
  ).length

  return { ok: true, data: { quantidade } }
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

const CARDIDS_VAZIO = "Nenhum imóvel selecionado."
const CARDIDS_DEMAIS = "Muitos imóveis selecionados de uma vez."

/**
 * Reordenação em massa (REORD-01..03, 16-CONTEXT.md): move todos os
 * `cardIds` recebidos para `columnId`, na ordem em que chegam, com posições
 * novas sequenciais via `GAP` — o cliente decide a ordem visual (coluna a
 * coluna, cima a baixo), esta action só grava.
 *
 * Cap defensivo de `cardIds.length > 200` ANTES de qualquer chamada ao
 * banco — mesma filosofia "fail closed" de `deleteCardAction` acima, aqui
 * contra DoS via array artificialmente grande (T-16-06).
 *
 * Supabase-js não expressa valores diferentes por linha numa única query;
 * por isso `Promise.all` de updates individuais, não um único `update ...
 * where id = any(...)`.
 */
export async function reordenarCardsAction(
  cardIds: string[],
  columnId: string
): Promise<ActionResult> {
  const sessao = await requireUser()
  if (!sessao) return { ok: false, error: NAO_AUTENTICADO }

  const invalidoColuna = id(columnId, "Coluna")
  if (invalidoColuna) return { ok: false, error: invalidoColuna }

  if (!Array.isArray(cardIds) || cardIds.length === 0) {
    return { ok: false, error: CARDIDS_VAZIO }
  }
  if (cardIds.length > 200) {
    return { ok: false, error: CARDIDS_DEMAIS }
  }
  for (const cardId of cardIds) {
    const invalidoCard = id(cardId, "Imóvel")
    if (invalidoCard) return { ok: false, error: invalidoCard }
  }

  const resultados = await Promise.all(
    cardIds.map((cardId, index) =>
      sessao.supabase
        .from("cards")
        .update({ column_id: columnId, position: (index + 1) * GAP })
        .eq("id", cardId)
        .select("id")
    )
  )

  const comErro = resultados.find((resultado) => resultado.error)
  if (comErro?.error) {
    console.error("reordenarCards", comErro.error)
    return { ok: false, error: erroDoBanco(comErro.error.code, "reordenar os imóveis") }
  }
  const semLinha = resultados.some((resultado) => !resultado.data || resultado.data.length === 0)
  if (semLinha) {
    return { ok: false, error: semLinhas("reordenar os imóveis") }
  }
  return { ok: true, data: undefined }
}

/**
 * Predicado de D-14 (06.2-CONTEXT.md), reaberto pontualmente pela Phase 15
 * (D-01/D-03, 15-CONTEXT.md): um lançamento `tipo='destrava'` nunca soma
 * valor (é registro de auditoria, não dinheiro se movendo — mesma razão que
 * já o excluía do cancelamento em `cancelarLancamentoAction`, D-01
 * 12-CONTEXT.md, reaberto também pela Phase 15) e por isso deixa de travar a
 * exclusão do card. `deleteCardAction` (a trava) e `cardTemLancamentoAction`
 * (o pré-voo do diálogo, plano 06.2-06) chamam exatamente esta função —
 * nenhum dos dois consulta por conta própria, pela mesma disciplina de ponto
 * único de verdade que `visibilidade.ts` documenta.
 *
 * `.limit(1)` faz a consulta parar no primeiro acerto, sem contar tudo — só
 * "existe" importa, não "quantos". `!inner` é obrigatório para filtrar por
 * coluna do embed, mesmo padrão que `financeiro/page.tsx` já usa.
 *
 * Devolve `true`/`false` quando a consulta funciona, e `null` quando ela
 * falha — a incerteza é devolvida ao chamador para decidir: a trava de
 * exclusão fecha (recusa), o pré-voo do diálogo abre (deixa o servidor
 * decidir de verdade no submit).
 *
 * A-04 (13-04-PLAN.md): amplia para checar também `taxas_imobiliaria` e
 * `caucao_eventos` — o backstop de banco (`impedir_exclusao_de_card_com_lancamento`,
 * plano 13-01, relaxado pela Phase 15 só para `parcela_lancamentos`) já
 * verifica as três; deixar este pré-voo do app checando só
 * `parcela_lancamentos` criaria uma janela em que o diálogo de exclusão
 * mostra "pode excluir" e o banco recusa. `card_id` é direto nas duas tabelas
 * novas (sem FK indireta via `parcelas`), então cada checagem é um
 * `select("id").eq("card_id", cardId).limit(1)` simples — mais simples que a
 * consulta de `parcela_lancamentos` acima, que precisa do `!inner`. Nenhuma
 * das duas ganha filtro de tipo — `taxas_imobiliaria`/`caucao_eventos` não
 * têm coluna `tipo` equivalente a `destrava`, cada linha já É dinheiro de
 * verdade. Curto-circuita: se a primeira consulta já achar linha, devolve
 * `true` sem rodar as outras duas.
 */
async function tabelaTemCard(
  supabase: Awaited<ReturnType<typeof createClient>>,
  tabela: "taxas_imobiliaria" | "caucao_eventos",
  cardId: string
): Promise<boolean | null> {
  const { data, error } = await supabase.from(tabela).select("id").eq("card_id", cardId).limit(1)

  if (error) {
    console.error("cardTemLancamento", tabela, error)
    return null
  }
  return (data?.length ?? 0) > 0
}

async function cardTemLancamento(
  supabase: Awaited<ReturnType<typeof createClient>>,
  cardId: string
): Promise<boolean | null> {
  const { data, error } = await supabase
    .from("parcela_lancamentos")
    .select("id, parcelas!inner(card_id)")
    .eq("parcelas.card_id", cardId)
    .in("tipo", ["pagamento", "acrescimo", "desconto"])
    .limit(1)

  if (error) {
    console.error("cardTemLancamento", error)
    return null
  }
  if ((data?.length ?? 0) > 0) return true

  const temTaxa = await tabelaTemCard(supabase, "taxas_imobiliaria", cardId)
  if (temTaxa === null) return null
  if (temTaxa) return true

  return tabelaTemCard(supabase, "caucao_eventos", cardId)
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
// Arquivamento (D-07/D-08/D-10/D-12)
// ------------------------------------------------------------------

export async function arquivarCardAction(cardId: string): Promise<ActionResult> {
  const sessao = await requireUser()
  if (!sessao) return { ok: false, error: NAO_AUTENTICADO }

  const invalido = id(cardId, "Imóvel")
  if (invalido) return { ok: false, error: invalido }

  // Arquivamento e situação do contrato (`ativo`) são ortogonais de
  // propósito: se arquivar também desativasse, desarquivar teria de
  // adivinhar se o contrato estava ativo antes dessa gravação — e essa
  // informação já teria sido perdida. D-12 diz que desarquivar devolve o
  // contrato ao funcionamento normal, não a um estado inventado, então
  // esta action nunca toca `ativo`.
  //
  // D-01/D-02 (16-CONTEXT.md): a partir da Phase 16, arquivar também
  // desvincula o card de qualquer coluna (`column_id: null`) — antes,
  // o card continuava apontando para a coluna em que estava, e excluir
  // essa coluna apagava o card arquivado em cascata (`on delete cascade`
  // de `columns`), sem aviso nenhum, sempre que ele não tinha nenhum
  // lançamento financeiro real. Um `column_id` nulo nunca é alcançado por
  // esse cascade — o risco fecha por construção, não por checagem de
  // aplicação.
  const { data, error } = await sessao.supabase
    .from("cards")
    .update({ arquivado_em: new Date().toISOString(), column_id: null })
    .eq("id", cardId)
    .select("id")

  if (error) {
    console.error("arquivarCard", error)
    return { ok: false, error: erroDoBanco(error.code, "arquivar o imóvel") }
  }
  if (!data || data.length === 0) {
    return { ok: false, error: semLinhas("arquivar o imóvel") }
  }
  return { ok: true, data: undefined }
}

export async function desarquivarCardAction(cardId: string): Promise<ActionResult> {
  const sessao = await requireUser()
  if (!sessao) return { ok: false, error: NAO_AUTENTICADO }

  const invalido = id(cardId, "Imóvel")
  if (invalido) return { ok: false, error: invalido }

  // Nada é regenerado aqui (D-01/D-03/D-12, visibilidade.ts). D-02/D-04
  // (16-CONTEXT.md, Phase 16): card arquivado não tem mais column_id —
  // desarquivar sempre atribui a primeira coluna do board, nunca a antiga.
  const { data: board, error: erroBoard } = await sessao.supabase
    .from("boards").select("id").order("created_at").limit(1).maybeSingle()
  if (erroBoard || !board) {
    console.error("desarquivarCard (board)", erroBoard)
    return { ok: false, error: erroDoBanco(erroBoard?.code, "desarquivar o imóvel") }
  }

  const { data: primeiraColuna, error: erroColuna } = await sessao.supabase
    .from("columns").select("id").eq("board_id", board.id)
    .order("position", { ascending: true }).limit(1).maybeSingle()
  if (erroColuna) {
    console.error("desarquivarCard (coluna)", erroColuna)
    return { ok: false, error: erroDoBanco(erroColuna.code, "desarquivar o imóvel") }
  }
  if (!primeiraColuna) {
    return { ok: false, error: "Crie uma coluna antes de desarquivar." }
  }

  const { data, error } = await sessao.supabase
    .from("cards")
    .update({ arquivado_em: null, column_id: primeiraColuna.id })
    .eq("id", cardId)
    .select("id")

  if (error) {
    console.error("desarquivarCard", error)
    return { ok: false, error: erroDoBanco(error.code, "desarquivar o imóvel") }
  }
  if (!data || data.length === 0) {
    return { ok: false, error: semLinhas("desarquivar o imóvel") }
  }
  return { ok: true, data: undefined }
}

/**
 * Pré-voo do diálogo de exclusão (plano 06.2-06). Chama o MESMO
 * `cardTemLancamento` que é a trava real em `deleteCardAction` — não uma
 * consulta parecida. Quando a verificação falha, esta action devolve falha
 * (não `{ temLancamento: null }`): o diálogo trata isso como "não deu para
 * conferir" e cai na variante permissiva, porque o servidor — não este
 * pré-voo — é o portão de verdade (D-15). Um pré-voo instável nunca pode
 * travar sozinho uma exclusão legítima.
 */
export async function cardTemLancamentoAction(
  cardId: string
): Promise<ActionResult<{ temLancamento: boolean }>> {
  const sessao = await requireUser()
  if (!sessao) return { ok: false, error: NAO_AUTENTICADO }

  const invalido = id(cardId, "Imóvel")
  if (invalido) return { ok: false, error: invalido }

  const temLancamento = await cardTemLancamento(sessao.supabase, cardId)
  if (temLancamento === null) {
    return { ok: false, error: erroDoBanco(undefined, "conferir o histórico do imóvel") }
  }
  return { ok: true, data: { temLancamento } }
}

/**
 * O aviso de pendência de D-10: quantas parcelas em aberto o contrato tem e
 * quanto falta pagar, para o popup de arquivamento mostrar antes de
 * confirmar. D-10 é explícito: avisa, nunca bloqueia — em erro de
 * consulta esta action devolve falha, e o diálogo (plano 06.2-06) tem
 * estado próprio para isso, sem nunca desabilitar o botão de arquivar por
 * causa dele.
 */
export async function contarParcelasEmAbertoAction(
  cardId: string
): Promise<ActionResult<{ quantidade: number; total: number }>> {
  const sessao = await requireUser()
  if (!sessao) return { ok: false, error: NAO_AUTENTICADO }

  const invalido = id(cardId, "Imóvel")
  if (invalido) return { ok: false, error: invalido }

  const { data, error } = await sessao.supabase
    .from("parcelas")
    .select(
      "competencia, valor_original, cards!inner(ativo, periodo_inicio, periodo_fim, arquivado_em), parcela_lancamentos(tipo, valor)"
    )
    .eq("card_id", cardId)

  if (error) {
    console.error("contarParcelasEmAberto", error)
    return { ok: false, error: erroDoBanco(error.code, "consultar as parcelas do imóvel") }
  }

  // Mesmo motivo documentado em recalcularEGravarStatus: sem Database
  // generics no cliente, os embeds são inferidos de um jeito que não bate
  // exatamente com o shape real devolvido pelo PostgREST.
  const parcelas = (data ?? []) as unknown as {
    competencia: string
    valor_original: number
    cards: CardVisibilidade
    parcela_lancamentos: LancamentoResumo[] | null
  }[]

  let quantidade = 0
  let total = 0

  for (const parcela of parcelas) {
    // Terceiro consumidor da regra única de D-01: o aviso conta exatamente
    // o que o usuário enxerga no Financeiro, não linhas que a regra
    // esconde.
    const visivel = parcelaVisivel({
      competencia: parcela.competencia,
      card: parcela.cards,
      temLancamento: (parcela.parcela_lancamentos?.length ?? 0) > 0,
      hojeISO: hojeEmCuiaba(),
    })
    if (!visivel) continue

    const { valorDevido, valorPago } = somarLancamentos(
      parcela.valor_original,
      parcela.parcela_lancamentos
    )
    const status = statusDeParcela(valorDevido, valorPago)
    if (status === "paga" || status === "conciliada") continue

    quantidade += 1
    total += Math.max(valorDevido - valorPago, 0)
  }

  return { ok: true, data: { quantidade, total } }
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
    hojeISO: hojeEmCuiaba(),
  })

  return resultado.visivel ? null : MENSAGEM_PARCELA_OCULTA[resultado.motivo]
}

const MENSAGEM_PARCELA_CONCILIADA =
  "Esta parcela está conciliada e travada contra alteração. Destrave antes de registrar pagamento ou lançar um ajuste."

/**
 * CONCIL-02/D-03: trava ADICIONAL à de `exigirParcelaVisivel` acima — não a
 * substitui, não reaproveita a mesma consulta, roda depois dela. Uma
 * parcela pode estar simultaneamente "visível" pela regra de D-01/6.2 e
 * "travada" por esta regra; as duas checagens precisam passar para a
 * escrita seguir. Relê `status` direto do banco, nunca confia no que a
 * tela mandou (mesma disciplina da trava de visibilidade).
 */
async function exigirParcelaNaoConciliada(
  supabase: Awaited<ReturnType<typeof createClient>>,
  parcelaId: string
): Promise<string | null> {
  const { data, error } = await supabase
    .from("parcelas")
    .select("status")
    .eq("id", parcelaId)
    .maybeSingle()

  if (error || !data) {
    console.error("trava de conciliada da parcela (leitura)", error)
    return MENSAGEM_PARCELA_OCULTA.indeterminado
  }

  if (data.status === "conciliada") {
    return MENSAGEM_PARCELA_CONCILIADA
  }
  return null
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
  observacao: string | null,
  taxaImobiliaria: number
): Promise<ActionResult> {
  const sessao = await requireUser()
  if (!sessao) return { ok: false, error: NAO_AUTENTICADO }

  const invalido =
    id(parcelaId, "Parcela") ??
    valorLancamento(valor, "Informe um valor de pagamento válido.") ??
    dataObrigatoria(data) ??
    textoOpcional(observacao, "Observação", 2000) ??
    valorNaoNegativo(taxaImobiliaria, "Informe um valor de taxa válido.")
  if (invalido) return { ok: false, error: invalido }

  // D-04/D-15: a trava real. A ocultação na tela (filtrarParcelasVisiveis
  // em financeiro/page.tsx) é consequência, não a barreira — uma aba
  // desatualizada ainda pode tentar este POST, então esta reconsulta é
  // quem realmente decide.
  const recusa = await exigirParcelaVisivel(sessao.supabase, parcelaId)
  if (recusa) return { ok: false, error: recusa }

  // CONCIL-02/D-03: trava ADICIONAL à de visibilidade acima — não a
  // substitui. Uma parcela `conciliada` já é visível (tem lançamento), mas
  // fica travada contra novo lançamento até ser destravada.
  const recusaConciliada = await exigirParcelaNaoConciliada(sessao.supabase, parcelaId)
  if (recusaConciliada) return { ok: false, error: recusaConciliada }

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

  // A taxa (`taxaImobiliaria`, validada acima) é gravada DEPOIS de o
  // recálculo de status da parcela abaixo já ter terminado com sucesso,
  // nunca antes e nunca dentro dele — chamado exatamente uma vez nesta
  // função, só para o INSERT em `parcela_lancamentos` que acabou de
  // acontecer. O INSERT em `taxas_imobiliaria` mais abaixo não aciona um
  // segundo recálculo de status. Esta é a fronteira estrutural de D-04
  // expressa em código: nenhuma leitura de `taxas_imobiliaria` participa de
  // `somarLancamentos`/`statusDeParcela`. A partir da Phase 14, o INSERT de
  // taxa abaixo também grava `lancamento_id: inserido[0].id` — é esse valor
  // que permite `cancelarLancamentoAction` arrastar a taxa junto via
  // `on delete cascade` quando o pagamento é cancelado (CANIMOB-03), sem
  // exigir nenhuma mudança em `cancelarLancamentoAction` em si.
  const erroStatus = await recalcularEGravarStatus(sessao.supabase, parcelaId)
  if (erroStatus) return { ok: false, error: erroStatus }

  // A-01 (13-04-PLAN.md): a `origem` gravada é sempre recalculada aqui, a
  // partir do `card_id`/`competencia` reais da parcela — nunca confiada a um
  // valor calculado no cliente. Isso evita que uma aba desatualizada (com os
  // percentuais editados em outra aba entre o carregamento da página e o
  // clique em "Registrar pagamento") grave uma `origem` errada.
  const { data: parcelaDaTaxa, error: erroParcelaDaTaxa } = await sessao.supabase
    .from("parcelas")
    .select("card_id, competencia")
    .eq("id", parcelaId)
    .maybeSingle()

  if (erroParcelaDaTaxa || !parcelaDaTaxa) {
    console.error("registrarPagamento (leitura parcela p/ taxa)", erroParcelaDaTaxa)
    return { ok: false, error: erroDoBanco(erroParcelaDaTaxa?.code, "registrar a taxa da imobiliária") }
  }

  const { card_id: cardIdDaTaxa, competencia: competenciaDaParcela } =
    parcelaDaTaxa as unknown as { card_id: string; competencia: string }

  // A-02: o banco já devolve o mínimo (`order by competencia asc limit 1`),
  // sem trazer linha a mais — mesmo padrão documentado em taxas.ts.
  const { data: primeiraParcela, error: erroPrimeiraParcela } = await sessao.supabase
    .from("parcelas")
    .select("competencia")
    .eq("card_id", cardIdDaTaxa)
    .order("competencia", { ascending: true })
    .limit(1)
    .maybeSingle()

  if (erroPrimeiraParcela || !primeiraParcela) {
    console.error("registrarPagamento (primeira competência)", erroPrimeiraParcela)
    return { ok: false, error: erroDoBanco(erroPrimeiraParcela?.code, "registrar a taxa da imobiliária") }
  }

  const origem = origemTaxa(
    competenciaDaParcela,
    (primeiraParcela as unknown as { competencia: string }).competencia
  )

  const { data: taxaInserida, error: erroTaxa } = await sessao.supabase
    .from("taxas_imobiliaria")
    .insert({
      parcela_id: parcelaId,
      card_id: cardIdDaTaxa,
      origem,
      valor: taxaImobiliaria,
      // A mesma `data` do pagamento, não `current_date` — a taxa nasce no
      // mesmo instante contábil do pagamento que a gerou.
      data,
      observacao: null,
      criado_por: sessao.user.id,
      lancamento_id: inserido[0].id,
    })
    .select("id")

  if (erroTaxa) {
    console.error("registrarPagamento (taxa)", erroTaxa)
    return { ok: false, error: erroDoBanco(erroTaxa.code, "registrar a taxa da imobiliária") }
  }
  if (!taxaInserida || taxaInserida.length === 0) {
    return { ok: false, error: semLinhas("registrar a taxa da imobiliária") }
  }

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

  // CONCIL-02/D-03: trava ADICIONAL à de visibilidade acima — não a
  // substitui. Uma parcela `conciliada` já é visível (tem lançamento), mas
  // fica travada contra novo lançamento até ser destravada.
  const recusaConciliada = await exigirParcelaNaoConciliada(sessao.supabase, parcelaId)
  if (recusaConciliada) return { ok: false, error: recusaConciliada }

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

/**
 * CONCIL-01/D-01/D-02/D-07: conciliar é um clique direto, sem diálogo — o
 * UPDATE condicionado a `status = "paga"` É a trava de corrida (D-01),
 * não uma leitura seguida de escrita. Se a parcela não estiver em `paga`
 * (já conciliada, aberta, parcial, ou some por RLS), o `.eq` devolve zero
 * linhas e cai no mesmo `semLinhas` que qualquer outra trava de corrida
 * do arquivo. `conciliada_em`/`conciliada_by` vêm exclusivamente da sessão
 * do servidor (D-02), mesmo padrão de `created_by` em `createCardAction`.
 *
 * Deliberadamente NÃO chama `exigirParcelaVisivel` aqui — D-09 é
 * explícito: conciliar continua disponível independente de
 * ativo/inativo/arquivado, e uma parcela `paga` sempre tem um lançamento
 * `pagamento`, então a visibilidade já é garantida por outro caminho
 * (`avaliarVisibilidadeParcela`, que olha `temLancamento`). Não
 * "consertar" adicionando essa chamada depois.
 */
export async function conciliarParcelaAction(parcelaId: string): Promise<ActionResult> {
  const sessao = await requireUser()
  if (!sessao) return { ok: false, error: NAO_AUTENTICADO }

  const invalido = id(parcelaId, "Parcela")
  if (invalido) return { ok: false, error: invalido }

  const { data, error } = await sessao.supabase
    .from("parcelas")
    .update({
      status: "conciliada",
      conciliada_em: new Date().toISOString(),
      conciliada_by: sessao.user.id,
    })
    .eq("id", parcelaId)
    .eq("status", "paga")
    .select("id")

  if (error) {
    console.error("conciliarParcela", error)
    return { ok: false, error: erroDoBanco(error.code, "conciliar a parcela") }
  }
  if (!data || data.length === 0) {
    return { ok: false, error: semLinhas("conciliar a parcela") }
  }
  return { ok: true, data: undefined }
}

/**
 * CONCIL-03/D-04/D-05: o desfazer rastreado de `conciliarParcelaAction` —
 * exige motivo, sempre. Dois passos, ambos decididos e executados aqui, no
 * servidor: grava um lançamento `tipo='destrava'` (valor 0, evento de
 * estado, não move dinheiro — mesma leitura de `somarLancamentos` em
 * parcelas.ts) e devolve `parcelas.status` para `"paga"`.
 *
 * O teto de `motivo` é **500**, não 2000: reflete a CHECK
 * `parcela_lancamentos_motivo_tamanho` da migration
 * `20260816000000_financeiro_schema.sql`, distinta da CHECK de 2000 que
 * cobre `observacao` nos outros lançamentos. Banco é a autoridade final
 * (mesmo princípio do cabeçalho deste arquivo).
 */
export async function destravarParcelaAction(
  parcelaId: string,
  motivo: string
): Promise<ActionResult> {
  const sessao = await requireUser()
  if (!sessao) return { ok: false, error: NAO_AUTENTICADO }

  const invalido = id(parcelaId, "Parcela") ?? textoObrigatorio(motivo, "Motivo", 500)
  if (invalido) return { ok: false, error: invalido }

  // Relê o status atual antes de qualquer gravação — nunca confia no que a
  // tela mandou. Só uma parcela `conciliada` pode ser destravada; chamar
  // esta action direto numa parcela paga/aberta/parcial é recusado aqui,
  // antes de qualquer INSERT/UPDATE (T-07-06).
  const { data: parcela, error: erroLeitura } = await sessao.supabase
    .from("parcelas")
    .select("status")
    .eq("id", parcelaId)
    .maybeSingle()

  if (erroLeitura || !parcela) {
    console.error("destravarParcela (leitura)", erroLeitura)
    return { ok: false, error: erroDoBanco(erroLeitura?.code, "destravar a parcela") }
  }
  if (parcela.status !== "conciliada") {
    return {
      ok: false,
      error: "Esta parcela não está conciliada — não há o que destravar.",
    }
  }

  // Deliberadamente NÃO chama `exigirParcelaVisivel` aqui — mesma razão de
  // D-09 documentada em `conciliarParcelaAction`: uma parcela `conciliada`
  // sempre tem lançamento (o `pagamento` que a levou a `paga` antes de ser
  // conciliada), então já é visível por outro caminho
  // (`avaliarVisibilidadeParcela`, que olha `temLancamento`).
  const { data: inserido, error: erroInsert } = await sessao.supabase
    .from("parcela_lancamentos")
    .insert({
      parcela_id: parcelaId,
      tipo: "destrava",
      valor: 0,
      motivo: motivo.trim(),
      // D-02: vem da sessão do servidor, nunca do que o cliente mandou —
      // mesmo raciocínio de createCardAction/registrarPagamentoAction.
      criado_por: sessao.user.id,
    })
    .select("id")

  if (erroInsert) {
    console.error("destravarParcela (insert)", erroInsert)
    return { ok: false, error: erroDoBanco(erroInsert.code, "destravar a parcela") }
  }
  if (!inserido || inserido.length === 0) {
    return { ok: false, error: semLinhas("destravar a parcela") }
  }

  // Sem condição adicional de status no `.eq` — o SELECT acima já confirmou
  // `conciliada` poucos milissegundos antes, e o INSERT que acabou de
  // acontecer é o que autoriza esta gravação.
  const { data: atualizado, error: erroUpdate } = await sessao.supabase
    .from("parcelas")
    .update({ status: "paga" })
    .eq("id", parcelaId)
    .select("id")

  if (erroUpdate) {
    console.error("destravarParcela (update)", erroUpdate)
    return { ok: false, error: erroDoBanco(erroUpdate.code, "destravar a parcela") }
  }
  if (!atualizado || atualizado.length === 0) {
    return { ok: false, error: semLinhas("destravar a parcela") }
  }

  return { ok: true, data: undefined }
}

/**
 * CANAJU-01..04/CANDEST-02: desfaz um acréscimo, desconto, pagamento ou
 * destrava marcado por engano — D-01 (11-CONTEXT.md)/D-02 (12-CONTEXT.md)
 * apaga de verdade a linha em `parcela_lancamentos`, reversão deliberada do
 * livro-razão append-only que o resto deste arquivo segue (mesmo trade-off
 * já confirmado pelo usuário, sem checkpoint novo). Cada lançamento
 * (`pagamento`/`acrescimo`/`desconto`/`destrava`) tem seu próprio botão
 * (D-02, 11-CONTEXT.md), então o DELETE é condicionado ao `id` daquele
 * lançamento específico, nunca a todos os lançamentos da parcela de uma vez.
 *
 * A trava de corrida real (D-06/race safety) é o próprio DELETE condicionado
 * aos três `.eq()`/`.in()` — id do lançamento, parcela_id e o allowlist de
 * tipo — mesmo formato do `.eq("status","paga")` de `conciliarParcelaAction`,
 * nunca uma leitura seguida de escrita separada. O allowlist era de três
 * tipos e excluía `destrava` de propósito (D-01, 12-CONTEXT.md); a Phase 15
 * reabre pontualmente essa exceção (D-01/D-02, 15-CONTEXT.md) e amplia para
 * quatro tipos — CONCIL-04 continua intocado, porque cancelar remove só a
 * linha de auditoria (quem destravou, quando, por quê), nunca desfaz o
 * destravamento em si.
 */
export async function cancelarLancamentoAction(
  parcelaId: string,
  lancamentoId: string
): Promise<ActionResult> {
  const sessao = await requireUser()
  if (!sessao) return { ok: false, error: NAO_AUTENTICADO }

  const invalido = id(parcelaId, "Parcela") ?? id(lancamentoId, "Lançamento")
  if (invalido) return { ok: false, error: invalido }

  // D-06: mesma trava que registrarPagamentoAction/ajustarParcelaAction já
  // usam, reuso verbatim — nenhuma parcela conciliada aceita cancelamento de
  // lançamento nenhum.
  const recusaConciliada = await exigirParcelaNaoConciliada(sessao.supabase, parcelaId)
  if (recusaConciliada) return { ok: false, error: recusaConciliada }

  const { data, error } = await sessao.supabase
    .from("parcela_lancamentos")
    .delete()
    .eq("id", lancamentoId)
    .eq("parcela_id", parcelaId)
    .in("tipo", ["pagamento", "acrescimo", "desconto", "destrava"])
    .select("id")

  if (error) {
    console.error("cancelarLancamento", error)
    return { ok: false, error: erroDoBanco(error.code, "cancelar o lançamento") }
  }
  if (!data || data.length === 0) {
    return { ok: false, error: semLinhas("cancelar o lançamento") }
  }

  // D-03: a única decisão de status desta função. Relê TODOS os lançamentos
  // restantes e regrava — o resultado pode legitimamente pousar em aberta ou
  // parcial, dependendo do que sobrar no livro-razão; esta função nunca
  // grava um valor de status por conta própria.
  const erroStatus = await recalcularEGravarStatus(sessao.supabase, parcelaId)
  if (erroStatus) return { ok: false, error: erroStatus }

  return { ok: true, data: undefined }
}

/**
 * CANIMOB-02/D-04 (14-CONTEXT.md): mesmo padrão de cancelarLancamentoAction
 * acima, mas sobre `taxas_imobiliaria` — sem `.in("tipo", [...])` (não existe
 * coluna `tipo` nesta tabela, cada linha já É uma taxa) e SEM chamar
 * `recalcularEGravarStatus` (D-04, 13-CONTEXT.md continua valendo: taxa
 * nunca participa do cálculo de status da parcela).
 *
 * Cancelar um `tipo='pagamento'` que gerou esta taxa também a remove — não
 * por código aqui, mas pelo `on delete cascade` de
 * `taxas_imobiliaria.lancamento_id -> parcela_lancamentos.id` (migração
 * 20260826000000_taxas_imobiliaria_lancamento_id.sql, D-03/CANIMOB-03,
 * 14-CONTEXT.md) — a cascata é 100% do banco, nenhuma segunda chamada de
 * DELETE nesta função.
 */
export async function cancelarTaxaImobiliariaAction(
  parcelaId: string,
  taxaId: string
): Promise<ActionResult> {
  const sessao = await requireUser()
  if (!sessao) return { ok: false, error: NAO_AUTENTICADO }

  const invalido = id(parcelaId, "Parcela") ?? id(taxaId, "Taxa")
  if (invalido) return { ok: false, error: invalido }

  const recusaConciliada = await exigirParcelaNaoConciliada(sessao.supabase, parcelaId)
  if (recusaConciliada) return { ok: false, error: recusaConciliada }

  const { data, error } = await sessao.supabase
    .from("taxas_imobiliaria")
    .delete()
    .eq("id", taxaId)
    .eq("parcela_id", parcelaId)
    .select("id")

  if (error) {
    console.error("cancelarTaxaImobiliaria", error)
    return { ok: false, error: erroDoBanco(error.code, "cancelar a taxa") }
  }
  if (!data || data.length === 0) {
    return { ok: false, error: semLinhas("cancelar a taxa") }
  }

  return { ok: true, data: undefined }
}

// ------------------------------------------------------------------
// Configuração financeira (Phase 13)
// ------------------------------------------------------------------

/**
 * Espelha a CHECK constraint de `percentual_administracao`/
 * `percentual_comissao_primeiro_aluguel` (migration da Phase 13): recusa
 * não-número/não-finito ou fora da faixa 0–100. O banco é a autoridade
 * final — esta checagem só existe para devolver uma mensagem legível em vez
 * de um erro cru do Postgres.
 */
function percentualValido(valor: unknown, campo: string): string | null {
  if (typeof valor !== "number" || !Number.isFinite(valor)) {
    return `${campo} inválido — informe um percentual entre 0 e 100.`
  }
  if (valor < 0 || valor > 100) {
    return `${campo} inválido — informe um percentual entre 0 e 100.`
  }
  return null
}

/**
 * IMOB-01: grava os dois percentuais do contrato usados por
 * `registrarPagamentoAction` (plano 13-04) para sugerir a taxa da
 * imobiliária no próximo pagamento. Esta action só faz `update` em `cards`
 * — nunca toca `taxas_imobiliaria` nem `parcela_lancamentos`: uma mudança de
 * percentual vale só para pagamentos futuros, o mesmo princípio de D-05
 * (sem retroativo) já usado em `vencimentoDaCompetencia` — "uma mudança de
 * regra de geração nunca reescreve o que já foi gerado".
 */
export async function salvarPercentuaisAction(
  cardId: string,
  percentualAdministracao: number,
  percentualComissaoPrimeiroAluguel: number
): Promise<ActionResult> {
  const sessao = await requireUser()
  if (!sessao) return { ok: false, error: NAO_AUTENTICADO }

  const invalido =
    id(cardId, "Imóvel") ??
    percentualValido(percentualAdministracao, "Percentual de administração") ??
    percentualValido(
      percentualComissaoPrimeiroAluguel,
      "Percentual de comissão do primeiro aluguel"
    )
  if (invalido) return { ok: false, error: invalido }

  const { data, error } = await sessao.supabase
    .from("cards")
    .update({
      percentual_administracao: percentualAdministracao,
      percentual_comissao_primeiro_aluguel: percentualComissaoPrimeiroAluguel,
    })
    .eq("id", cardId)
    .select("id")

  if (error) return { ok: false, error: erroDoBanco(error.code, "salvar os percentuais") }
  if (!data || data.length === 0) return { ok: false, error: semLinhas("salvar os percentuais") }
  return { ok: true, data: undefined }
}

/** Recusa qualquer valor fora do allowlist de `caucao_eventos_tipo_valido`. */
function tipoCaucaoValido(valor: unknown): string | null {
  if (valor !== "recebido" && valor !== "devolvido" && valor !== "usado") {
    return "Tipo de evento de caução inválido."
  }
  return null
}

/**
 * D-06/IMOB-04: grava um evento novo do ciclo de caução — sempre um INSERT,
 * nunca um UPDATE sobre uma linha já existente (mesmo espírito append-only
 * do resto do sistema). Esta action só toca `caucao_eventos` — nunca
 * `parcela_lancamentos` nem `taxas_imobiliaria`, e nunca chama
 * `recalcularEGravarStatus`: caução é uma terceira tabela estruturalmente
 * separada (T-13-25), ligada só a `card_id`.
 *
 * Nenhuma trava de saldo — devolver/usar mais do que o `saldoCaucao` atual
 * não é recusado aqui (A-02, 13-05-PLAN.md); o campo já vem pré-preenchido
 * com o saldo no diálogo, mas permanece editável para cobrir devolução/uso
 * parcial ou correção de um valor recebido incorretamente como um NOVO
 * evento, nunca uma edição do antigo (D-06).
 */
export async function registrarEventoCaucaoAction(
  cardId: string,
  tipo: "recebido" | "devolvido" | "usado",
  valor: number,
  data: string,
  observacao: string | null
): Promise<ActionResult> {
  const sessao = await requireUser()
  if (!sessao) return { ok: false, error: NAO_AUTENTICADO }

  const invalido =
    id(cardId, "Imóvel") ??
    tipoCaucaoValido(tipo) ??
    valorLancamento(valor, "Informe um valor válido.") ??
    dataObrigatoria(data) ??
    textoOpcional(observacao, "Observação", 2000)
  if (invalido) return { ok: false, error: invalido }

  const { data: inserido, error } = await sessao.supabase
    .from("caucao_eventos")
    .insert({
      card_id: cardId,
      tipo,
      valor,
      data,
      observacao: observacao?.trim() || null,
      criado_por: sessao.user.id,
    })
    .select("id")

  if (error) {
    return {
      ok: false,
      error: erroDoBanco(
        error.code,
        `registrar ${tipo === "recebido" ? "o recebimento" : tipo === "devolvido" ? "a devolução" : "o uso"} da caução`
      ),
    }
  }
  if (!inserido || inserido.length === 0) {
    return { ok: false, error: semLinhas("registrar o evento de caução") }
  }
  return { ok: true, data: undefined }
}

/**
 * CANIMOB-04/D-05 (14-CONTEXT.md): só o evento mais recente de caução pode
 * ser cancelado por vez — cancelar o mais recente libera o que sobrou no
 * novo topo, permitindo desfazer o ciclo inteiro sequencialmente, nunca um
 * evento do meio. A checagem "sou eu o mais recente" é reconfirmada aqui,
 * no servidor, a cada chamada — nunca confia que o botão só apareceu no
 * evento certo na tela (mesmo princípio de toda trava financeira deste
 * arquivo).
 *
 * Duas etapas (SELECT decide, DELETE confia na leitura recente por uma
 * janela pequena) — mesmo padrão de `destravarParcelaAction` acima, que já
 * documenta essa janela de corrida tolerada. Nunca toca
 * `parcela_lancamentos`/`taxas_imobiliaria` — `caucao_eventos` continua uma
 * terceira tabela isolada (D-06, 13-CONTEXT.md).
 */
export async function cancelarEventoCaucaoAction(
  cardId: string,
  eventoId: string
): Promise<ActionResult> {
  const sessao = await requireUser()
  if (!sessao) return { ok: false, error: NAO_AUTENTICADO }

  const invalido = id(cardId, "Imóvel") ?? id(eventoId, "Evento de caução")
  if (invalido) return { ok: false, error: invalido }

  const { data: maisRecente, error: erroLeitura } = await sessao.supabase
    .from("caucao_eventos")
    .select("id")
    .eq("card_id", cardId)
    .order("criado_em", { ascending: false })
    .limit(1)
    .maybeSingle()

  if (erroLeitura || !maisRecente) {
    console.error("cancelarEventoCaucao (leitura)", erroLeitura)
    return { ok: false, error: erroDoBanco(erroLeitura?.code, "cancelar o evento de caução") }
  }
  if (maisRecente.id !== eventoId) {
    return {
      ok: false,
      error: "Este não é mais o evento mais recente de caução — atualize a página.",
    }
  }

  const { data, error } = await sessao.supabase
    .from("caucao_eventos")
    .delete()
    .eq("id", eventoId)
    .eq("card_id", cardId)
    .select("id")

  if (error) {
    console.error("cancelarEventoCaucao (delete)", error)
    return { ok: false, error: erroDoBanco(error.code, "cancelar o evento de caução") }
  }
  if (!data || data.length === 0) {
    return { ok: false, error: semLinhas("cancelar o evento de caução") }
  }

  return { ok: true, data: undefined }
}

// ------------------------------------------------------------------
// Relatório financeiro
// ------------------------------------------------------------------

/**
 * Única fonte da consulta usada pelo relatório financeiro — chamada tanto
 * pela primeira carga de `relatorios/page.tsx` (RSC) quanto por cada clique
 * em "Gerar relatório" no cliente (`RelatorioFinanceiro`). Existe como action
 * (em vez de só uma função de `queries.ts`) justamente para que o cliente
 * consiga buscar dados frescos a cada clique — sem isso, um usuário com a
 * aba de Relatórios aberta há um tempo, gerando o relatório de novo, receberia
 * sempre os mesmos dados da carga inicial da página, mesmo que o contrato
 * tenha sido editado ou uma parcela paga em outra aba/dispositivo nesse meio
 * tempo.
 *
 * D-05: propositalmente SEM `.is("cards.arquivado_em", null)` e SEM
 * `.eq("cards.ativo"/"ativo", true)` — o relatório financeiro inclui contrato
 * arquivado/inativo (exceção deliberada à regra de visibilidade da Phase 6.2
 * — ver 08-CONTEXT.md D-05).
 */
export async function buscarParcelasRelatorioAction(): Promise<
  ActionResult<{ parcelas: ParcelaRelatorio[]; hojeISO: string }>
> {
  const sessao = await requireUser()
  if (!sessao) return { ok: false, error: NAO_AUTENTICADO }

  const { data, error } = await sessao.supabase
    .from("parcelas")
    .select(
      "id, competencia, vencimento, valor_original, status, cards(endereco, proprietario), parcela_lancamentos(tipo, valor)"
    )

  if (error) {
    console.error("buscarParcelasRelatorio", error)
    return { ok: false, error: erroDoBanco(error.code, "carregar o relatório") }
  }

  // Mesmo cast de relatorios/page.tsx: o parser de `.select()` do
  // supabase-js não conhece o schema e infere o embed `cards` como array,
  // mas `parcelas.card_id -> cards.id` é muitos-para-um — o PostgREST sempre
  // devolve um objeto único ou null aqui, nunca array.
  return {
    ok: true,
    data: {
      parcelas: (data ?? []) as unknown as ParcelaRelatorio[],
      hojeISO: hojeEmCuiaba(),
    },
  }
}

// Relatório de reconciliação (Phase 13)

/**
 * Espelha `buscarParcelasRelatorioAction`: sem filtro de período no
 * servidor — o filtro roda em memória no cliente (D-01), a cada troca de
 * mês, sem round-trip novo. Sem filtro de `arquivado_em`/`ativo` pelo mesmo
 * motivo de D-05 (Phase 8): o relatório de reconciliação inclui contrato
 * arquivado/inativo — dinheiro que a imobiliária já recebeu não deixa de
 * ter sido recebido só porque o contrato mudou de estado depois.
 */
export async function buscarReconciliacaoAction(): Promise<
  ActionResult<{
    taxas: TaxaImobiliariaRelatorio[]
    caucaoEventos: CaucaoEventoRelatorio[]
    hojeISO: string
  }>
> {
  const sessao = await requireUser()
  if (!sessao) return { ok: false, error: NAO_AUTENTICADO }

  const { data: taxas, error: erroTaxas } = await sessao.supabase
    .from("taxas_imobiliaria")
    .select("id, data, valor, origem, observacao, cards(endereco, proprietario, numero)")

  if (erroTaxas) return { ok: false, error: erroDoBanco(erroTaxas.code, "carregar o relatório") }

  const { data: caucaoEventos, error: erroCaucao } = await sessao.supabase
    .from("caucao_eventos")
    .select("id, data, valor, tipo, observacao, cards(endereco, proprietario, numero)")

  if (erroCaucao) return { ok: false, error: erroDoBanco(erroCaucao.code, "carregar o relatório") }

  return {
    ok: true,
    data: {
      taxas: (taxas ?? []) as unknown as TaxaImobiliariaRelatorio[],
      caucaoEventos: (caucaoEventos ?? []) as unknown as CaucaoEventoRelatorio[],
      hojeISO: hojeEmCuiaba(),
    },
  }
}
