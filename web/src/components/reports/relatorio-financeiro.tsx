"use client"

import * as React from "react"
import { AlertCircle, CheckCircle2, Clock, Lock, type LucideIcon } from "lucide-react"

import { formatCurrency } from "@/lib/kanban/format"
import { buscarParcelasRelatorioAction } from "@/lib/kanban/actions"
import {
  calcularRelatorioFinanceiro,
  type FiltroRelatorioValores,
  type ParcelaRelatorio,
  type SituacaoRelatorio,
} from "@/lib/kanban/relatorio-financeiro"
import { StatTile } from "@/components/reports/stat-tile"
import { FiltroRelatorioFinanceiro } from "@/components/reports/filtro-relatorio-financeiro"

/** Mesmo mapeamento ícone-situação de `ParcelaSituacaoBadge` (Financeiro). */
const ICONE_E_ROTULO: Record<SituacaoRelatorio, { icon: LucideIcon; label: string }> = {
  paga: { icon: CheckCircle2, label: "Pagas" },
  a_vencer: { icon: Clock, label: "A vencer" },
  vencida: { icon: AlertCircle, label: "Vencidas" },
  conciliada: { icon: Lock, label: "Conciliadas" },
}

type Dados = { parcelas: ParcelaRelatorio[]; hojeISO: string }

export function RelatorioFinanceiro() {
  // D-04: `aplicado` só muda dentro de `onGerar` (acionado pelo clique em
  // "Gerar relatório" em FiltroRelatorioFinanceiro), nunca em resposta a um
  // campo isolado — é isso que impede a consulta de rodar "ao vivo".
  const [aplicado, setAplicado] = React.useState<FiltroRelatorioValores | null>(
    null
  )
  // Sem prop vinda do servidor: cada clique em "Gerar relatório" busca dados
  // novos via `buscarParcelasRelatorioAction`, em vez de reaproveitar o que
  // veio na carga inicial da página. Sem isso, uma aba deixada aberta
  // enquanto um contrato é editado ou uma parcela é paga em outro lugar
  // mostraria sempre o retrato de quando a página carregou.
  const [dados, setDados] = React.useState<Dados | null>(null)
  const [carregando, setCarregando] = React.useState(false)
  const [erro, setErro] = React.useState(false)

  const categorias = React.useMemo(
    () =>
      aplicado && dados
        ? calcularRelatorioFinanceiro(dados.parcelas, aplicado, dados.hojeISO)
        : null,
    [aplicado, dados]
  )

  async function gerar(filtro: FiltroRelatorioValores) {
    setCarregando(true)
    setErro(false)
    const resultado = await buscarParcelasRelatorioAction()
    setCarregando(false)

    if (!resultado.ok) {
      setErro(true)
      setAplicado(null)
      return
    }

    setDados(resultado.data)
    setAplicado(filtro)
  }

  function limpar() {
    setAplicado(null)
    setErro(false)
  }

  return (
    <div className="flex flex-col gap-3">
      <FiltroRelatorioFinanceiro
        onGerar={gerar}
        onLimpar={limpar}
        carregando={carregando}
      />

      {erro ? (
        <p className="text-sm text-muted-foreground">
          Não foi possível gerar o relatório agora. Tente novamente.
        </p>
      ) : categorias === null ? (
        <p className="text-sm text-muted-foreground">
          Ajuste os filtros acima e clique em{" "}
          <span className="font-semibold text-foreground">
            Gerar relatório
          </span>{" "}
          para ver pagas, a vencer, vencidas e conciliadas.
        </p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {categorias.map((categoria) => {
            const { icon, label } = ICONE_E_ROTULO[categoria.situacao]
            return (
              <StatTile
                key={categoria.situacao}
                icon={icon}
                label={label}
                value={String(categoria.quantidade)}
                hint={formatCurrency(categoria.total)}
                tone={
                  categoria.situacao === "vencida" && categoria.quantidade > 0
                    ? "alert"
                    : "default"
                }
              />
            )
          })}
        </div>
      )}
    </div>
  )
}
