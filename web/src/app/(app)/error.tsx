"use client"

import * as React from "react"
import { AlertTriangle, RotateCw } from "lucide-react"

import { Button } from "@/components/ui/button"

/**
 * Captura erro de renderização do board e dos relatórios. Fica neste nível
 * (e não na raiz) de propósito: o `error.tsx` não envolve o `layout.tsx` do
 * mesmo segmento, então a barra lateral continua na tela e a pessoa consegue
 * navegar para a outra página em vez de ficar presa.
 *
 * Erros vindos de Server Component chegam aqui com mensagem genérica em
 * produção — o texto real fica só no log do servidor. Por isso mostramos o
 * `digest`: é o que permite casar a tela com a linha certa do log da Vercel.
 */
export default function AppError({
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
    <div className="flex h-full items-center justify-center p-6">
      <div className="flex max-w-md flex-col items-center gap-4 rounded-2xl border border-border bg-card p-8 text-center">
        <div className="flex size-11 items-center justify-center rounded-full bg-destructive/10">
          <AlertTriangle className="size-5 text-destructive" />
        </div>

        <div className="flex flex-col gap-1.5">
          <h2 className="font-heading text-lg font-bold text-foreground">
            Algo deu errado ao carregar esta tela
          </h2>
          <p className="text-sm text-muted-foreground">
            Nenhum dado foi perdido. Tentar de novo costuma resolver — se
            insistir, recarregue a página.
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
