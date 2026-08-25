import { ChevronLeft } from "lucide-react"
import Link from "next/link"

import { createClient } from "@/lib/supabase/server"
import { hojeEmCuiaba } from "@/lib/kanban/format"
import type { CaucaoEventoDetalhado } from "@/lib/kanban/taxas"
import {
  ConfiguracaoFinanceiraView,
  type ContratoConfig,
} from "@/components/financeiro/configuracao-financeira-view"

/**
 * A-02/UI-SPEC §1: única rota do projeto que lê `cards` sem filtro de
 * visibilidade (`arquivado_em`/`ativo`) — percentuais são configuração de
 * contrato, não dado escopado por tempo como as parcelas. Server Component,
 * mesmo molde de `relatorios/financeiro/page.tsx`: consulta direta, sem
 * Server Action, para a leitura inicial.
 */
export default async function ConfiguracaoFinanceiraPage() {
  const supabase = await createClient()

  let linhas: ContratoConfig[] = []
  let erro = false

  try {
    const { data, error } = await supabase
      .from("cards")
      .select(
        "id, numero, endereco, proprietario, percentual_administracao, percentual_comissao_primeiro_aluguel"
      )
      .order("numero", { ascending: true })

    if (error) throw error

    const cardIds = (data ?? []).map((card) => card.id)

    // A-01 (13-06-PLAN.md): busca TODOS os eventos de caução de uma vez
    // (`.in("card_id", cardIds)`) e agrupa por `card_id` em memória — mesmo
    // padrão de `primeiraCompetenciaPorCard` no plano 13-04. Isso evita uma
    // consulta por linha clicada e mantém o Sheet sem `useEffect`/fetch
    // próprio. Em erro desta segunda consulta, cai para `[]` em todos os
    // contratos — não derruba a página inteira.
    let caucaoPorCard: Record<string, CaucaoEventoDetalhado[]> = {}
    if (cardIds.length > 0) {
      try {
        const { data: eventos, error: erroCaucao } = await supabase
          .from("caucao_eventos")
          .select("id, card_id, tipo, valor, data, observacao, criado_em, profiles(full_name, email)")
          .in("card_id", cardIds)

        if (erroCaucao) throw erroCaucao

        caucaoPorCard = ((eventos ?? []) as unknown as (CaucaoEventoDetalhado & {
          card_id: string
        })[]).reduce<Record<string, CaucaoEventoDetalhado[]>>((agrupado, evento) => {
          const { card_id, ...resto } = evento
          if (!agrupado[card_id]) agrupado[card_id] = []
          agrupado[card_id].push(resto)
          return agrupado
        }, {})

        for (const lista of Object.values(caucaoPorCard)) {
          lista.sort((a, b) => (a.criado_em < b.criado_em ? -1 : a.criado_em > b.criado_em ? 1 : 0))
        }
      } catch (erroCaucaoCapturado) {
        console.error("financeiro/configuracao (caucao_eventos)", erroCaucaoCapturado)
        caucaoPorCard = {}
      }
    }

    linhas = (data ?? []).map((card) => ({
      id: card.id,
      numero: card.numero,
      endereco: card.endereco,
      proprietario: card.proprietario,
      percentualAdministracao: card.percentual_administracao,
      percentualComissaoPrimeiroAluguel: card.percentual_comissao_primeiro_aluguel,
      caucaoEventos: caucaoPorCard[card.id] ?? [],
    }))
  } catch (erroCapturado) {
    console.error("financeiro/configuracao", erroCapturado)
    erro = true
  }

  const todayISO = hojeEmCuiaba()

  return (
    <div className="flex flex-col gap-4 p-6">
      <div className="flex flex-col gap-2">
        <Link
          href="/financeiro"
          className="inline-flex w-fit items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <ChevronLeft className="size-3.5" />
          Financeiro
        </Link>
        <div>
          <h1 className="font-heading text-2xl font-semibold text-foreground">
            Configuração financeira
          </h1>
          <p className="text-sm text-muted-foreground">
            Percentual de administração e de comissão do primeiro aluguel,
            por contrato. Defaults: 10% de administração, 50% de comissão do
            primeiro aluguel.
          </p>
        </div>
      </div>

      <ConfiguracaoFinanceiraView linhas={linhas} todayISO={todayISO} erro={erro} />
    </div>
  )
}
