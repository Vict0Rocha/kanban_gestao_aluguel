import type { ActionResult, Card, CardDetailsInput } from "./types"
import type { AlertStatus, AlertType } from "./alerts"
import {
  ajustarParcelaAction,
  arquivarCardAction,
  cancelarLancamentoAction,
  cardTemLancamentoAction,
  conciliarParcelaAction,
  contarParcelasEmAbertoAction,
  contarParcelasOrfasAction,
  createCardAction,
  createColumnAction,
  deleteCardAction,
  deleteColumnAction,
  desarquivarCardAction,
  destravarParcelaAction,
  moveCardAction,
  moveColumnAction,
  registrarPagamentoAction,
  renameColumnAction,
  resolveAlertAction,
  setCardAtivoAction,
  updateCardAction,
} from "./actions"

/**
 * Ponte entre a interface e as Server Actions em `actions.ts`.
 *
 * As actions devolvem `{ ok, error }` em vez de lançar exceção, porque o Next
 * troca a mensagem de erros lançados por um texto genérico em produção. Aqui a
 * mensagem volta a virar exceção, que é o que os componentes já esperam: o
 * board desfaz a alteração otimista no `catch` e mostra o aviso. Assim a
 * mensagem escrita no servidor chega inteira na tela.
 */
async function unwrap<T>(promise: Promise<ActionResult<T>>): Promise<T> {
  const result = await promise
  if (!result.ok) throw new Error(result.error)
  return result.data
}

export async function createColumn(boardId: string, name: string, position: number) {
  return unwrap(createColumnAction(boardId, name, position))
}

export async function renameColumn(id: string, name: string) {
  return unwrap(renameColumnAction(id, name))
}

export async function updateColumnPosition(id: string, position: number) {
  return unwrap(moveColumnAction(id, position))
}

export async function deleteColumn(id: string) {
  return unwrap(deleteColumnAction(id))
}

export async function createCard(
  columnId: string,
  position: number,
  input: { proprietario: string; valor: number; endereco: string }
): Promise<Card> {
  return unwrap(createCardAction(columnId, position, input))
}

export async function updateCard(
  id: string,
  input: CardDetailsInput
): Promise<Card> {
  return unwrap(updateCardAction(id, input))
}

export async function moveCard(id: string, columnId: string, position: number) {
  return unwrap(moveCardAction(id, columnId, position))
}

export async function deleteCard(id: string) {
  return unwrap(deleteCardAction(id))
}

export async function setCardAtivo(id: string, ativo: boolean) {
  return unwrap(setCardAtivoAction(id, ativo))
}

export async function arquivarCard(id: string) {
  return unwrap(arquivarCardAction(id))
}

export async function desarquivarCard(id: string) {
  return unwrap(desarquivarCardAction(id))
}

export async function cardTemLancamento(id: string) {
  return unwrap(cardTemLancamentoAction(id))
}

export async function contarParcelasEmAberto(id: string) {
  return unwrap(contarParcelasEmAbertoAction(id))
}

export async function contarParcelasOrfas(
  cardId: string,
  novoInicio: string | null,
  novoFim: string | null
) {
  return unwrap(contarParcelasOrfasAction(cardId, novoInicio, novoFim))
}

export async function resolveAlert(input: {
  cardId: string
  type: AlertType
  triggerDate: string
  status: Exclude<AlertStatus, "pendente">
}) {
  return unwrap(resolveAlertAction(input))
}

export async function registrarPagamento(
  parcelaId: string,
  valor: number,
  data: string,
  observacao: string | null
) {
  return unwrap(registrarPagamentoAction(parcelaId, valor, data, observacao))
}

export async function ajustarParcela(
  parcelaId: string,
  tipo: "acrescimo" | "desconto",
  valor: number,
  observacao: string | null
) {
  return unwrap(ajustarParcelaAction(parcelaId, tipo, valor, observacao))
}

export async function conciliarParcela(parcelaId: string) {
  return unwrap(conciliarParcelaAction(parcelaId))
}

export async function destravarParcela(parcelaId: string, motivo: string) {
  return unwrap(destravarParcelaAction(parcelaId, motivo))
}

export async function cancelarLancamento(parcelaId: string, lancamentoId: string) {
  return unwrap(cancelarLancamentoAction(parcelaId, lancamentoId))
}
