import { ChevronLeft } from "lucide-react"
import Link from "next/link"

import { createClient } from "@/lib/supabase/server"
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

    linhas = (data ?? []).map((card) => ({
      id: card.id,
      numero: card.numero,
      endereco: card.endereco,
      proprietario: card.proprietario,
      percentualAdministracao: card.percentual_administracao,
      percentualComissaoPrimeiroAluguel: card.percentual_comissao_primeiro_aluguel,
    }))
  } catch (erroCapturado) {
    console.error("financeiro/configuracao", erroCapturado)
    erro = true
  }

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

      <ConfiguracaoFinanceiraView linhas={linhas} erro={erro} />
    </div>
  )
}
