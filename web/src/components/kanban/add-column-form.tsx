"use client"

import * as React from "react"
import { Plus } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

export function AddColumnForm({
  onCreate,
}: {
  onCreate: (name: string) => Promise<void>
}) {
  const [editing, setEditing] = React.useState(false)
  const [name, setName] = React.useState("")
  const [submitting, setSubmitting] = React.useState(false)

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    const trimmed = name.trim()
    if (!trimmed) {
      setEditing(false)
      return
    }
    setSubmitting(true)
    try {
      await onCreate(trimmed)
      setName("")
      setEditing(false)
    } catch {
      // keep the form open with the typed name so the user can retry
    } finally {
      setSubmitting(false)
    }
  }

  if (!editing) {
    return (
      <Button
        variant="ghost"
        className="h-10 w-72 shrink-0 justify-start gap-2 text-muted-foreground hover:text-foreground"
        onClick={() => setEditing(true)}
      >
        <Plus className="size-4" />
        Nova coluna
      </Button>
    )
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="flex w-72 shrink-0 flex-col gap-2 rounded-2xl border border-border bg-muted/40 p-3"
    >
      <Input
        autoFocus
        placeholder="Nome da coluna"
        value={name}
        disabled={submitting}
        onChange={(event) => setName(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Escape") {
            setName("")
            setEditing(false)
          }
        }}
      />
      <div className="flex gap-2">
        <Button type="submit" size="sm" disabled={submitting}>
          Adicionar
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => {
            setName("")
            setEditing(false)
          }}
        >
          Cancelar
        </Button>
      </div>
    </form>
  )
}
