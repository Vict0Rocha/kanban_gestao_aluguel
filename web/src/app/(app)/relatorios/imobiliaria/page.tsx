import { ChevronLeft } from "lucide-react"
import Link from "next/link"

import { buscarReconciliacaoAction } from "@/lib/kanban/actions"
import { DinheiroImobiliariaView } from "@/components/reports/dinheiro-imobiliaria-view"

export default async function DinheiroImobiliariaPage() {
  const resultado = await buscarReconciliacaoAction()

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
            Dinheiro da imobiliária
          </h1>
          <p className="text-sm text-muted-foreground">
            Taxas de administração, comissão do primeiro aluguel e movimento
            de caução — confira contra o extrato do banco.
          </p>
        </div>
      </div>

      {resultado.ok ? (
        <DinheiroImobiliariaView
          taxas={resultado.data.taxas}
          caucaoEventos={resultado.data.caucaoEventos}
          hojeISO={resultado.data.hojeISO}
        />
      ) : (
        <p className="text-sm text-muted-foreground">
          Não foi possível carregar os dados agora. Tente novamente.
        </p>
      )}
    </div>
  )
}
