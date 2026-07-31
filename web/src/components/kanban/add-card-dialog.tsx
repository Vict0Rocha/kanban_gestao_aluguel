"use client"

import * as React from "react"
import { Plus } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"

export function AddCardDialog({
  onCreate,
}: {
  onCreate: (input: {
    proprietario: string
    valor: number
    endereco: string
  }) => Promise<void>
}) {
  const [open, setOpen] = React.useState(false)
  const [proprietario, setProprietario] = React.useState("")
  const [endereco, setEndereco] = React.useState("")
  const [valor, setValor] = React.useState("")
  const [error, setError] = React.useState<string | null>(null)
  const [submitting, setSubmitting] = React.useState(false)

  function reset() {
    setProprietario("")
    setEndereco("")
    setValor("")
    setError(null)
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()

    const parsedValor = Number(valor.replace(",", "."))
    if (!proprietario.trim() || !endereco.trim() || !valor) {
      setError("Preencha proprietário, endereço e valor.")
      return
    }
    if (!Number.isFinite(parsedValor) || parsedValor <= 0) {
      setError("Informe um valor de aluguel válido.")
      return
    }

    setSubmitting(true)
    setError(null)
    try {
      await onCreate({
        proprietario: proprietario.trim(),
        endereco: endereco.trim(),
        valor: parsedValor,
      })
      reset()
      setOpen(false)
    } catch {
      setError("Não foi possível criar o card. Tente novamente.")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next)
        if (!next) reset()
      }}
    >
      <DialogTrigger
        render={
          <Button
            variant="ghost"
            className="w-full justify-start gap-2 text-muted-foreground hover:text-foreground"
          />
        }
      >
        <Plus className="size-4" />
        Adicionar imóvel
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Novo imóvel</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="proprietario">Proprietário</Label>
            <Input
              id="proprietario"
              value={proprietario}
              onChange={(event) => setProprietario(event.target.value)}
              autoFocus
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="endereco">Endereço</Label>
            <Input
              id="endereco"
              value={endereco}
              onChange={(event) => setEndereco(event.target.value)}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="valor">Valor do aluguel (R$)</Label>
            <Input
              id="valor"
              inputMode="decimal"
              placeholder="1500"
              value={valor}
              onChange={(event) => setValor(event.target.value)}
            />
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}

          <DialogFooter>
            <Button type="submit" disabled={submitting}>
              {submitting ? "Criando..." : "Criar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
