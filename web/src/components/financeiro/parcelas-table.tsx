"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { Banknote, History, Lock, Unlock } from "lucide-react"

import { conciliarParcela } from "@/lib/kanban/queries"
import { formatCurrency, formatDate } from "@/lib/kanban/format"
import type { LinhaParcela } from "@/lib/kanban/parcelas"
import { percentualAplicavel } from "@/lib/kanban/taxas"
import { AjustarParcelaDialog } from "@/components/financeiro/ajustar-parcela-dialog"
import { ConciliarFalhaToast } from "@/components/financeiro/conciliar-falha-toast"
import { DestravarParcelaDialog } from "@/components/financeiro/destravar-parcela-dialog"
import { IdPill } from "@/components/financeiro/id-pill"
import { ParcelaHistoricoSheet } from "@/components/financeiro/parcela-historico-sheet"
import { ParcelaSituacaoBadge } from "@/components/financeiro/parcela-situacao-badge"
import { RegistrarPagamentoDialog } from "@/components/financeiro/registrar-pagamento-dialog"
import { Button } from "@/components/ui/button"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

const VAZIO_LABEL = {
  "sem-contrato-ativo":
    "Nenhum contrato ativo no momento. Marque um contrato como ativo no board para ele começar a gerar parcelas automaticamente.",
  "sem-parcela-hoje":
    "Nenhuma parcela vence hoje. Use os filtros para consultar outro período.",
  "sem-resultado-filtro":
    "Nenhuma parcela encontrada para os filtros aplicados.",
} as const

function AcoesCell({
  linha,
  todayISO,
  primeiraCompetenciaPorCard,
  onConciliarErro,
}: {
  linha: LinhaParcela
  todayISO: string
  primeiraCompetenciaPorCard: Record<string, string>
  onConciliarErro: (message: string) => void
}) {
  const router = useRouter()
  const [dialogoAberto, setDialogoAberto] = React.useState<
    "pagamento" | "ajustar" | "historico" | "destravar" | null
  >(null)
  const [conciliando, setConciliando] = React.useState(false)

  const handleConciliar = async () => {
    setConciliando(true)
    try {
      await conciliarParcela(linha.id)
      router.refresh()
    } catch (error) {
      onConciliarErro(
        error instanceof Error
          ? error.message
          : "Não foi possível conciliar a parcela. Tente novamente."
      )
    } finally {
      setConciliando(false)
    }
  }

  // D-01/D-08: se o contrato não tiver entrada no mapa (consulta de
  // primeira competência falhou, ver financeiro/page.tsx), assume que a
  // própria parcela é a primeira — fallback seguro que nunca derruba a
  // tela por causa disso.
  const primeiraCompetencia =
    primeiraCompetenciaPorCard[linha.cardId] ?? linha.competencia
  const { percentual, origem } = percentualAplicavel(
    linha.competencia,
    primeiraCompetencia,
    linha.percentualAdministracao,
    linha.percentualComissaoPrimeiroAluguel
  )

  return (
    <TableCell className="flex items-center gap-2">
      {linha.situacao === "conciliada" ? (
        <>
          <Button
            variant="outline"
            aria-label={`Destravar parcela — ${linha.endereco}`}
            onClick={() => setDialogoAberto("destravar")}
          >
            <Unlock className="size-4" />
            Destravar
          </Button>
          <Button
            variant="ghost"
            size="icon"
            aria-label={`Ver histórico de lançamentos — ${linha.endereco}`}
            onClick={() => setDialogoAberto("historico")}
          >
            <History className="size-4" />
          </Button>
        </>
      ) : (
        <>
          <Button
            variant="outline"
            aria-label={`Registrar pagamento — ${linha.endereco}`}
            onClick={() => setDialogoAberto("pagamento")}
          >
            <Banknote className="size-4" />
            Pagamento
          </Button>
          <Button
            variant="ghost"
            aria-label={`Ajustar valor — ${linha.endereco}`}
            onClick={() => setDialogoAberto("ajustar")}
          >
            Ajustar
          </Button>
          {linha.situacao === "paga" ? (
            <Button
              variant="ghost"
              aria-label={`Conciliar parcela — ${linha.endereco}`}
              disabled={conciliando}
              onClick={handleConciliar}
            >
              <Lock className="size-4" />
              {conciliando ? "Conciliando..." : "Conciliar"}
            </Button>
          ) : null}
          <Button
            variant="ghost"
            size="icon"
            aria-label={`Ver histórico de lançamentos — ${linha.endereco}`}
            onClick={() => setDialogoAberto("historico")}
          >
            <History className="size-4" />
          </Button>
        </>
      )}
      <RegistrarPagamentoDialog
        parcelaId={linha.id}
        endereco={linha.endereco}
        competencia={linha.competencia}
        valorDevido={linha.valorDevido}
        valorPago={linha.valorPago}
        percentualAplicavel={percentual}
        origemPercentual={origem}
        todayISO={todayISO}
        open={dialogoAberto === "pagamento"}
        onOpenChange={(open) => setDialogoAberto(open ? "pagamento" : null)}
      />
      <AjustarParcelaDialog
        parcelaId={linha.id}
        endereco={linha.endereco}
        competencia={linha.competencia}
        valorDevido={linha.valorDevido}
        open={dialogoAberto === "ajustar"}
        onOpenChange={(open) => setDialogoAberto(open ? "ajustar" : null)}
      />
      <ParcelaHistoricoSheet
        endereco={linha.endereco}
        competencia={linha.competencia}
        vencimento={linha.vencimento}
        historico={linha.historico}
        parcelaId={linha.id}
        parcelaConciliada={linha.situacao === "conciliada"}
        open={dialogoAberto === "historico"}
        onOpenChange={(open) => setDialogoAberto(open ? "historico" : null)}
      />
      <DestravarParcelaDialog
        parcelaId={linha.id}
        endereco={linha.endereco}
        competencia={linha.competencia}
        valorPago={linha.valorPago}
        open={dialogoAberto === "destravar"}
        onOpenChange={(open) => setDialogoAberto(open ? "destravar" : null)}
      />
    </TableCell>
  )
}

export function ParcelasTable({
  linhas,
  erro,
  vazio,
  todayISO,
  mensagemVazia,
  primeiraCompetenciaPorCard,
}: {
  linhas: LinhaParcela[]
  erro?: boolean
  vazio: "sem-contrato-ativo" | "sem-parcela-hoje" | "sem-resultado-filtro"
  todayISO: string
  /** Quando presente, substitui a string escolhida por `VAZIO_LABEL` — usada
   * pela nota contextual do Financeiro (plano 06.2-07) quando o filtro por
   * ID resolve para um contrato inativo ou arquivado e a lista vem vazia.
   * As três mensagens do mapa ficam inalteradas. */
  mensagemVazia?: string
  /** A-02 (13-04-PLAN.md): menor `competencia` por `card_id`, calculada uma
   * vez em financeiro/page.tsx para todos os contratos — `AcoesCell` usa
   * para decidir a `origem` da taxa sugerida (D-08). */
  primeiraCompetenciaPorCard: Record<string, string>
}) {
  const [conciliarErro, setConciliarErro] = React.useState<string | null>(null)

  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      {erro ? (
        <p className="text-sm text-muted-foreground">
          Não foi possível carregar as parcelas. Tente novamente.
        </p>
      ) : linhas.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          {mensagemVazia ?? VAZIO_LABEL[vazio]}
        </p>
      ) : (
        <div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>ID</TableHead>
                <TableHead>Imóvel</TableHead>
                <TableHead>Proprietário</TableHead>
                <TableHead>Vencimento</TableHead>
                <TableHead className="text-right">Valor devido</TableHead>
                <TableHead className="text-right">Valor pago</TableHead>
                <TableHead>Situação</TableHead>
                <TableHead>Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {linhas.map((linha) => (
                <TableRow key={linha.id}>
                  <TableCell>
                    <IdPill numero={linha.numero} />
                  </TableCell>
                  <TableCell className="text-sm font-semibold text-foreground">
                    {linha.endereco}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {linha.proprietario}
                  </TableCell>
                  <TableCell className="tabular-nums text-muted-foreground">
                    {formatDate(linha.vencimento)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatCurrency(linha.valorDevido)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatCurrency(linha.valorPago)}
                  </TableCell>
                  <TableCell>
                    <ParcelaSituacaoBadge situacao={linha.situacao} />
                  </TableCell>
                  <AcoesCell
                    linha={linha}
                    todayISO={todayISO}
                    primeiraCompetenciaPorCard={primeiraCompetenciaPorCard}
                    onConciliarErro={setConciliarErro}
                  />
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <ConciliarFalhaToast
            message={conciliarErro}
            onDismiss={() => setConciliarErro(null)}
          />
        </div>
      )}
    </div>
  )
}
