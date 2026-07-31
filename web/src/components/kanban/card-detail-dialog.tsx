"use client"

import * as React from "react"

import type { Card } from "@/lib/kanban/types"
import type { CardDetailsInput } from "@/lib/kanban/queries"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

function toFormState(card: Card) {
  return {
    proprietario: card.proprietario,
    endereco: card.endereco,
    valor: String(card.valor),
    inquilino: card.inquilino ?? "",
    telefone: card.telefone ?? "",
    periodo_inicio: card.periodo_inicio ?? "",
    periodo_fim: card.periodo_fim ?? "",
    observacoes: card.observacoes ?? "",
  }
}

export function CardDetailDialog({
  card,
  open,
  onOpenChange,
  onSave,
}: {
  card: Card
  open: boolean
  onOpenChange: (open: boolean) => void
  onSave: (id: string, input: CardDetailsInput) => Promise<void>
}) {
  const [form, setForm] = React.useState(() => toFormState(card))
  const [error, setError] = React.useState<string | null>(null)
  const [saving, setSaving] = React.useState(false)

  // Reset the form to the card's current data every time the dialog opens
  // (e.g. after a previous edit was cancelled without saving).
  const [wasOpen, setWasOpen] = React.useState(open)
  if (open !== wasOpen) {
    setWasOpen(open)
    if (open) {
      setForm(toFormState(card))
      setError(null)
    }
  }

  function set<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()

    const parsedValor = Number(form.valor.replace(",", "."))
    if (!form.proprietario.trim() || !form.endereco.trim() || !form.valor) {
      setError("Proprietário, endereço e valor são obrigatórios.")
      return
    }
    if (!Number.isFinite(parsedValor) || parsedValor <= 0) {
      setError("Informe um valor de aluguel válido.")
      return
    }

    setSaving(true)
    setError(null)
    try {
      await onSave(card.id, {
        proprietario: form.proprietario.trim(),
        endereco: form.endereco.trim(),
        valor: parsedValor,
        inquilino: form.inquilino.trim() || null,
        telefone: form.telefone.trim() || null,
        periodo_inicio: form.periodo_inicio || null,
        periodo_fim: form.periodo_fim || null,
        observacoes: form.observacoes.trim() || null,
      })
      onOpenChange(false)
    } catch {
      setError("Não foi possível salvar. Tente novamente.")
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Detalhes do imóvel</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-3">
            <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
              Obrigatórios
            </p>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="proprietario">Proprietário</Label>
              <Input
                id="proprietario"
                value={form.proprietario}
                onChange={(e) => set("proprietario", e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="endereco">Endereço</Label>
              <Input
                id="endereco"
                value={form.endereco}
                onChange={(e) => set("endereco", e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="valor">Valor do aluguel (R$)</Label>
              <Input
                id="valor"
                inputMode="decimal"
                value={form.valor}
                onChange={(e) => set("valor", e.target.value)}
              />
            </div>
          </div>

          <div className="flex flex-col gap-3 border-t border-border pt-4">
            <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
              Opcionais
            </p>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="inquilino">Inquilino</Label>
              <Input
                id="inquilino"
                value={form.inquilino}
                onChange={(e) => set("inquilino", e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="telefone">Telefone</Label>
              <Input
                id="telefone"
                type="tel"
                placeholder="(00) 00000-0000"
                value={form.telefone}
                onChange={(e) => set("telefone", e.target.value)}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="periodo_inicio">Início do aluguel</Label>
                <Input
                  id="periodo_inicio"
                  type="date"
                  value={form.periodo_inicio}
                  onChange={(e) => set("periodo_inicio", e.target.value)}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="periodo_fim">Fim do aluguel</Label>
                <Input
                  id="periodo_fim"
                  type="date"
                  value={form.periodo_fim}
                  onChange={(e) => set("periodo_fim", e.target.value)}
                />
              </div>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="observacoes">Observações</Label>
              <Textarea
                id="observacoes"
                rows={3}
                value={form.observacoes}
                onChange={(e) => set("observacoes", e.target.value)}
              />
            </div>
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}

          <DialogFooter>
            <Button type="submit" disabled={saving}>
              {saving ? "Salvando..." : "Salvar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
