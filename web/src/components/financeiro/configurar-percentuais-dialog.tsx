"use client"

import * as React from "react"
import { useRouter } from "next/navigation"

import { salvarPercentuais } from "@/lib/kanban/queries"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

export function ConfigurarPercentuaisDialog({
  cardId,
  endereco,
  percentualAdministracao,
  percentualComissaoPrimeiroAluguel,
  open,
  onOpenChange,
}: {
  cardId: string
  endereco: string
  percentualAdministracao: number
  percentualComissaoPrimeiroAluguel: number
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const router = useRouter()
  const [administracao, setAdministracao] = React.useState(() =>
    String(percentualAdministracao)
  )
  const [comissao, setComissao] = React.useState(() =>
    String(percentualComissaoPrimeiroAluguel)
  )
  const [error, setError] = React.useState<string | null>(null)
  const [saving, setSaving] = React.useState(false)

  // Resincroniza o formulário toda vez que o diálogo reabre — mesmo truque
  // de RegistrarPagamentoDialog/AjustarParcelaDialog.
  const [wasOpen, setWasOpen] = React.useState(open)
  if (open !== wasOpen) {
    setWasOpen(open)
    if (open) {
      setAdministracao(String(percentualAdministracao))
      setComissao(String(percentualComissaoPrimeiroAluguel))
      setError(null)
    }
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()

    const parsedAdministracao = Number(administracao.replace(",", "."))
    const parsedComissao = Number(comissao.replace(",", "."))
    const administracaoValida =
      Number.isFinite(parsedAdministracao) &&
      parsedAdministracao >= 0 &&
      parsedAdministracao <= 100
    const comissaoValida =
      Number.isFinite(parsedComissao) && parsedComissao >= 0 && parsedComissao <= 100
    if (!administracaoValida || !comissaoValida) {
      setError("Informe um percentual válido para administração e comissão.")
      return
    }

    setSaving(true)
    setError(null)
    try {
      await salvarPercentuais(cardId, parsedAdministracao, parsedComissao)
      onOpenChange(false)
      router.refresh()
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "Não foi possível salvar os percentuais. Tente novamente."
      )
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Editar percentuais — {endereco}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="percentual-administracao">
              Percentual de administração (%)
            </Label>
            <Input
              id="percentual-administracao"
              inputMode="decimal"
              placeholder="10"
              value={administracao}
              onChange={(e) => setAdministracao(e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="percentual-comissao">
              Percentual de comissão do primeiro aluguel (%)
            </Label>
            <Input
              id="percentual-comissao"
              inputMode="decimal"
              placeholder="50"
              value={comissao}
              onChange={(e) => setComissao(e.target.value)}
            />
          </div>

          <p className="text-sm text-muted-foreground">
            No primeiro mês do contrato, a comissão substitui a administração — os dois percentuais não somam.
          </p>

          {error && <p className="text-sm text-destructive">{error}</p>}

          <DialogFooter>
            <Button type="submit" disabled={saving}>
              {saving ? "Salvando..." : "Salvar percentuais"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
