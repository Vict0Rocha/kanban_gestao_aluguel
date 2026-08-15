"use client"

import * as React from "react"
import { AlertTriangle, RotateCw } from "lucide-react"

import { Button } from "@/components/ui/button"

/**
 * Rede de segurança de nível acima: pega o que o `(app)/error.tsx` não pega —
 * erro dentro do próprio `(app)/layout.tsx`, como o cálculo de alertas ou a
 * montagem da barra lateral. Sem isto, uma falha ali deixaria a página em
 * branco, já que um `error.tsx` não envolve o layout do mesmo segmento.
 *
 * Aqui a barra lateral não sobrevive (é justamente o que falhou), então a tela
 * é autossuficiente.
 */
export default function RootError({
  error,
  retry,
}: {
  error: Error & { digest?: string }
  retry: () => void
}) {
  React.useEffect(() => {
    console.error(error)
  }, [error])

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="flex w-full max-w-md flex-col items-center gap-4 rounded-2xl border border-border bg-card p-8 text-center">
        <div className="flex size-11 items-center justify-center rounded-full bg-destructive/10">
          <AlertTriangle className="size-5 text-destructive" />
        </div>

        <div className="flex flex-col gap-1.5">
          <h2 className="font-heading text-lg font-bold text-foreground">
            Não foi possível carregar o sistema
          </h2>
          <p className="text-sm text-muted-foreground">
            Seus dados estão salvos. Tente novamente em alguns instantes.
          </p>
        </div>

        <Button onClick={() => retry()} className="mt-1">
          <RotateCw className="size-4" />
          Tentar de novo
        </Button>

        {error.digest && (
          <p className="text-xs text-muted-foreground">
            Código do erro: <code className="font-mono">{error.digest}</code>
          </p>
        )}
      </div>
    </div>
  )
}
