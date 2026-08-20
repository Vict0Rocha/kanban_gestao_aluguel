"use client"

import * as React from "react"

import { cn } from "@/lib/utils"
import type { Card } from "@/lib/kanban/types"
import type { CardDetailsInput } from "@/lib/kanban/types"
import { contarParcelasOrfas } from "@/lib/kanban/queries"
import { IdPill } from "@/components/financeiro/id-pill"
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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"

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

/**
 * Pré-voo de poda (D-05), disparado no submit — não na abertura do diálogo,
 * ao contrário de `PendenciaEstado` em `arquivar-contrato-dialog.tsx`. Fica
 * fail-closed de propósito: `"falhou"` nunca deixa `handleSubmit` prosseguir
 * para `onSave` sem uma contagem confirmada do servidor (diferente dos
 * pré-voos de `arquivar-contrato-dialog.tsx`/`excluir-contrato-dialog.tsx`,
 * que falham-abertos porque o servidor ali é só backstop — aqui o servidor
 * já vai apagar de verdade, então uma falha de pré-voo não pode virar um
 * salvamento sem aviso).
 */
type PodaEstado =
  | { fase: "idle" }
  | { fase: "verificando" }
  | { fase: "confirmando"; quantidade: number }
  | { fase: "falhou" }

export function CardDetailDialog({
  card,
  open,
  onOpenChange,
  onSave,
  onToggleAtivo,
}: {
  card: Card
  open: boolean
  onOpenChange: (open: boolean) => void
  onSave: (id: string, input: CardDetailsInput) => Promise<void>
  onToggleAtivo: (id: string, ativo: boolean) => void
}) {
  const [form, setForm] = React.useState(() => toFormState(card))
  const [error, setError] = React.useState<string | null>(null)
  const [saving, setSaving] = React.useState(false)
  const [poda, setPoda] = React.useState<PodaEstado>({ fase: "idle" })

  // Reset the form to the card's current data every time the dialog opens
  // (e.g. after a previous edit was cancelled without saving).
  const [wasOpen, setWasOpen] = React.useState(open)
  if (open !== wasOpen) {
    setWasOpen(open)
    if (open) {
      setForm(toFormState(card))
      setError(null)
      setPoda({ fase: "idle" })
    }
  }

  function set<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  // Sequência de salvamento reusada tanto pelo caminho sem fricção (sem
  // mudança de data, ou pré-voo devolvendo 0 órfãs) quanto pelo
  // "Confirmar e salvar" do AlertDialog de D-05 — mesmo `onSave` + mesmo
  // fechamento no sucesso, só o texto de fallback do erro muda conforme o
  // slot onde ele aparece (UI-SPEC "Save fails after confirmation").
  async function salvarCard(mensagemErroPadrao: string) {
    setSaving(true)
    setError(null)
    try {
      await onSave(card.id, {
        proprietario: form.proprietario.trim(),
        endereco: form.endereco.trim(),
        valor: Number(form.valor.replace(",", ".")),
        inquilino: form.inquilino.trim() || null,
        telefone: form.telefone.trim() || null,
        periodo_inicio: form.periodo_inicio || null,
        periodo_fim: form.periodo_fim || null,
        observacoes: form.observacoes.trim() || null,
      })
      setPoda({ fase: "idle" })
      onOpenChange(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : mensagemErroPadrao)
    } finally {
      setSaving(false)
    }
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

    // D-04/D-05: a poda só é consultada quando periodo_inicio e/ou
    // periodo_fim realmente mudam nesta edição — qualquer outro campo salva
    // direto, sem fricção nova.
    const datasMudaram =
      form.periodo_inicio !== (card.periodo_inicio ?? "") ||
      form.periodo_fim !== (card.periodo_fim ?? "")

    if (!datasMudaram) {
      await salvarCard("Não foi possível salvar. Tente novamente.")
      return
    }

    setPoda({ fase: "verificando" })
    setError(null)
    try {
      const { quantidade } = await contarParcelasOrfas(
        card.id,
        form.periodo_inicio || null,
        form.periodo_fim || null
      )
      if (quantidade > 0) {
        // PARA aqui — o AlertDialogAction do diálogo de confirmação é quem
        // decide se `onSave` roda, não este handler.
        setPoda({ fase: "confirmando", quantidade })
        return
      }
      setPoda({ fase: "idle" })
      await salvarCard("Não foi possível salvar. Tente novamente.")
    } catch {
      // Fail-closed (D-05): uma falha no pré-voo NUNCA prossegue para
      // `onSave` sem uma contagem confirmada.
      setPoda({ fase: "falhou" })
      setError(
        "Não foi possível confirmar as mudanças no período. Tente novamente."
      )
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Detalhes do imóvel</DialogTitle>
        </DialogHeader>

        {/* Fora do form: escrita otimista imediata via onToggleAtivo, sem
            esperar o botão "Salvar" do formulário abaixo. */}
        <div className="flex items-center justify-between gap-2 border-b border-border pb-4">
          <span className="text-sm font-medium text-foreground">Situação</span>
          <div className="flex items-center gap-2">
            <IdPill numero={card.numero} variant="subtle" />
            <button
              type="button"
              onClick={() => onToggleAtivo(card.id, !card.ativo)}
              aria-label={
                card.ativo
                  ? `Marcar ${card.endereco} como inativo`
                  : `Marcar ${card.endereco} como ativo`
              }
              className={cn(
                "rounded-full border px-2 py-1 text-xs font-semibold transition-colors",
                card.ativo
                  ? "border-primary/40 bg-primary/10 text-primary"
                  : "border-border bg-muted text-muted-foreground"
              )}
            >
              {card.ativo ? "Ativo" : "Inativo"}
            </button>
          </div>
        </div>

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
            <Button
              type="submit"
              disabled={saving || poda.fase === "verificando"}
            >
              {poda.fase === "verificando"
                ? "Verificando..."
                : saving
                  ? "Salvando..."
                  : "Salvar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>

      {/* D-05: confirmação antes de apagar, aninhada dentro do mesmo
          CardDetailDialog — Cancelar só fecha este AlertDialog, preservando
          as datas editadas (não salvas) no formulário por trás. */}
      <AlertDialog
        open={poda.fase === "confirmando"}
        onOpenChange={(nextOpen) => {
          if (!nextOpen) setPoda({ fase: "idle" })
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Esta alteração vai apagar parcelas
            </AlertDialogTitle>
            <AlertDialogDescription>
              {poda.fase === "confirmando" && poda.quantidade === 1
                ? `${card.endereco} — o contrato ${card.numero}: 1 parcela ficou fora do novo período e será apagada. Só parcelas sem nenhum pagamento ou lançamento são apagadas — as demais continuam intactas. Esta ação não pode ser desfeita.`
                : `${card.endereco} — o contrato ${card.numero}: ${
                    poda.fase === "confirmando" ? poda.quantidade : 0
                  } parcelas ficaram fora do novo período e serão apagadas. Só parcelas sem nenhum pagamento ou lançamento são apagadas — as demais continuam intactas. Esta ação não pode ser desfeita.`}
            </AlertDialogDescription>
          </AlertDialogHeader>

          {error && <p className="text-sm text-destructive">{error}</p>}

          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              disabled={saving}
              onClick={() => {
                void salvarCard(
                  "Não foi possível salvar as alterações. Tente novamente."
                )
              }}
            >
              {saving ? "Salvando..." : "Confirmar e salvar"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Dialog>
  )
}
