"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { ArchiveRestore } from "lucide-react"

import { formatCurrency, formatDate } from "@/lib/kanban/format"
import type { Card } from "@/lib/kanban/types"
import { desarquivarCard } from "@/lib/kanban/queries"
import { IdPill } from "@/components/financeiro/id-pill"
import { Button } from "@/components/ui/button"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

export type ContratoArquivado = Pick<
  Card,
  "id" | "numero" | "endereco" | "proprietario" | "inquilino" | "valor"
> & {
  /** `timestamptz`. Cortado para os 10 primeiros caracteres antes de
   * `formatDate` — ver célula "Arquivado em" abaixo. Nunca passa pelo
   * construtor `Date` com a string bruta. */
  arquivado_em: string
}

/**
 * Componente de cliente: precisa do botão de desarquivar, da sua linha de
 * erro e de `router.refresh()`. Painel único, sem tiles de estatística, sem
 * gráfico, sem filtro — estacionamento de baixo tráfego, não superfície de
 * análise (ver UI-SPEC "Arquivados page").
 */
export function ArquivadosView({
  contratos,
  erroCarregamento,
}: {
  contratos: ContratoArquivado[]
  erroCarregamento: boolean
}) {
  const router = useRouter()
  const [desarquivandoId, setDesarquivandoId] = React.useState<string | null>(
    null
  )
  const [erroDesarquivar, setErroDesarquivar] = React.useState<string | null>(
    null
  )

  async function handleDesarquivar(id: string) {
    setDesarquivandoId(id)
    setErroDesarquivar(null)
    try {
      await desarquivarCard(id)
      router.refresh()
    } catch (erroCapturado) {
      // Sem diálogo de confirmação: desarquivar não destrói nada, não cria
      // nada, e é desfeito pelo botão de arquivar no card restaurado. Em
      // falha, a linha do contrato permanece na lista.
      setErroDesarquivar(
        erroCapturado instanceof Error
          ? erroCapturado.message
          : "Não foi possível desarquivar o imóvel. Tente novamente."
      )
    } finally {
      setDesarquivandoId(null)
    }
  }

  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <h2 className="font-heading text-base font-bold text-foreground">
        Contratos arquivados
      </h2>
      <p className="mt-0.5 text-sm text-muted-foreground">
        Desarquivar devolve o contrato ao funcionamento normal, com as
        parcelas que já existiam.
      </p>

      {erroCarregamento ? (
        <p className="mt-4 text-sm text-muted-foreground">
          Não foi possível carregar os contratos arquivados. Tente novamente.
        </p>
      ) : (
        <>
          {erroDesarquivar && (
            <p role="alert" className="mt-4 text-sm text-destructive">
              {erroDesarquivar}
            </p>
          )}

          {contratos.length === 0 ? (
            <p className="mt-4 text-sm text-muted-foreground">
              Nenhum contrato arquivado. Quando você arquivar um imóvel no
              board, ele aparece aqui — e pode voltar quando quiser.
            </p>
          ) : (
            <div className="mt-4">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>ID</TableHead>
                    <TableHead>Imóvel</TableHead>
                    <TableHead>Proprietário</TableHead>
                    <TableHead>Inquilino</TableHead>
                    <TableHead className="text-right">Valor</TableHead>
                    <TableHead>Arquivado em</TableHead>
                    <TableHead>Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {contratos.map((contrato) => {
                    const desarquivando = desarquivandoId === contrato.id
                    return (
                      <TableRow key={contrato.id}>
                        <TableCell>
                          <IdPill numero={contrato.numero} />
                        </TableCell>
                        <TableCell className="text-sm font-semibold text-foreground">
                          {contrato.endereco}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {contrato.proprietario}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {contrato.inquilino ?? "—"}
                        </TableCell>
                        <TableCell className="text-right tabular-nums text-foreground">
                          {formatCurrency(contrato.valor)}
                        </TableCell>
                        <TableCell className="tabular-nums text-muted-foreground">
                          {formatDate(contrato.arquivado_em.slice(0, 10))}
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="outline"
                            aria-label={`Desarquivar ${contrato.endereco}`}
                            disabled={desarquivando}
                            onClick={() => handleDesarquivar(contrato.id)}
                          >
                            <ArchiveRestore className="size-4" />
                            {desarquivando ? "Desarquivando..." : "Desarquivar"}
                          </Button>
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </>
      )}
    </div>
  )
}
