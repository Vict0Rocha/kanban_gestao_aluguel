"use client"

import { formatDate } from "@/lib/kanban/format"
import type { LinhaParcela } from "@/lib/kanban/parcelas"
import {
  FiltroParcelas,
  type FiltroValores,
} from "@/components/financeiro/filtro-parcelas"
import { ParcelasTable } from "@/components/financeiro/parcelas-table"

/**
 * Contrato resolvido pela busca por ID numérico no Financeiro (plano
 * 06.2-07) — `null` quando não há filtro por ID, o id não é numérico, nenhum
 * contrato tem aquele número, ou a consulta falhou. A ausência de dado aqui
 * nunca é distinguida do "contrato ativo e não arquivado": nos dois casos a
 * nota fica em silêncio.
 */
export type ContratoFiltro = {
  numero: number
  ativo: boolean
  arquivado_em: string | null
} | null

/**
 * D-01/D-02 (Phase 6.1): não há mais seletor de competência — o servidor já
 * resolveu a única lista relevante (padrão "vencendo hoje" ou, a partir do
 * plano 06.1-05, o resultado de um filtro). `FiltroParcelas` decide o
 * cabeçalho (título/subtítulo/contador) a partir de `filtrosAtivos`; este
 * componente só decide o estado vazio e repassa para `ParcelasTable`.
 */
export function FinanceiroView({
  linhas,
  temContratoAtivo,
  erro,
  todayISO,
  filtrosAtivos,
  filtroInicial,
  contratoFiltro,
}: {
  linhas: LinhaParcela[]
  temContratoAtivo: boolean
  erro?: boolean
  todayISO: string
  filtrosAtivos: boolean
  filtroInicial: FiltroValores
  contratoFiltro: ContratoFiltro
}) {
  const vazio = !temContratoAtivo
    ? "sem-contrato-ativo"
    : filtrosAtivos
      ? "sem-resultado-filtro"
      : "sem-parcela-hoje"

  const titulo = filtrosAtivos ? "Resultado da busca" : "Vencendo hoje"
  const subtitulo = filtrosAtivos ? undefined : formatDate(todayISO)

  // Nota contextual (plano 06.2-07 / UI-SPEC "Silence in the Financeiro"):
  // arquivado tem precedência sobre inativo — é a explicação mais completa
  // e a única que traz um caminho de saída (desarquivar em Arquivados).
  // Contrato ativo e não arquivado, ou ausência de `contratoFiltro`: sem
  // nota, e a mensagem de vazio da Phase 6.1 fica verbatim como está.
  const nota = !contratoFiltro
    ? null
    : contratoFiltro.arquivado_em !== null
      ? `O contrato ${contratoFiltro.numero} está arquivado, por isso não aparece no Financeiro. Você pode desarquivar em Arquivados.`
      : !contratoFiltro.ativo
        ? `O contrato ${contratoFiltro.numero} está inativo. Parcelas de meses futuros não aparecem aqui — as de meses passados e a do mês atual continuam.`
        : null

  // Regra de uma linha em um lugar só: lista vazia -> a nota substitui a
  // mensagem do painel (via `mensagemVazia`); lista com linhas -> a nota é
  // um parágrafo entre o cabeçalho de filtro e o painel. Nunca as duas.
  const notaComoParagrafo = nota !== null && linhas.length > 0

  return (
    <div className="flex flex-col gap-4">
      <FiltroParcelas
        titulo={titulo}
        subtitulo={subtitulo}
        totalResultados={linhas.length}
        filtrosAtivos={filtrosAtivos}
        filtroInicial={filtroInicial}
      />
      {notaComoParagrafo && (
        <p className="text-sm text-muted-foreground">{nota}</p>
      )}
      <ParcelasTable
        linhas={linhas}
        erro={erro}
        vazio={vazio}
        todayISO={todayISO}
        mensagemVazia={linhas.length === 0 ? (nota ?? undefined) : undefined}
      />
    </div>
  )
}
