import { ChevronLeft } from "lucide-react"
import Link from "next/link"

import { buscarParcelasRelatorioAction } from "@/lib/kanban/actions"
import { RelatorioFinanceiroDedicado } from "@/components/reports/relatorio-financeiro-dedicado"

export default async function RelatorioFinanceiroPage() {
  const resultado = await buscarParcelasRelatorioAction()

  return (
    <div className="flex flex-col gap-4 p-6">
      <div className="flex flex-col gap-2">
        <Link
          href="/relatorios"
          className="inline-flex w-fit items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <ChevronLeft className="size-3.5" />
          Relatórios
        </Link>
        <div>
          <h1 className="font-heading text-2xl font-semibold text-foreground">
            Relatório Financeiro
          </h1>
          <p className="text-sm text-muted-foreground">
            Os filtros abaixo atualizam os totais e a lista na hora — sem
            precisar clicar em nada.
          </p>
        </div>
      </div>

      {resultado.ok ? (
        <RelatorioFinanceiroDedicado
          parcelas={resultado.data.parcelas}
          hojeISO={resultado.data.hojeISO}
        />
      ) : (
        <p className="text-sm text-muted-foreground">
          Não foi possível carregar o relatório agora. Tente novamente.
        </p>
      )}
    </div>
  )
}
