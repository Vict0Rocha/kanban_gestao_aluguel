"use client"

import * as React from "react"
import { AlertCircle, X } from "lucide-react"

const AUTO_DISMISS_MS = 7000

/**
 * Aviso de escrita rejeitada. Deliberadamente sem portal e sem animação de
 * entrada/saída: o Base UI 1.6 não limpa os atributos [data-starting-style]/
 * [data-ending-style], o que já quebrou o Dialog e o Sheet deste projeto duas
 * vezes. Um elemento fixo simples não tem esse ciclo de vida para dar errado.
 */
export function WriteErrorToast({
  message,
  onDismiss,
}: {
  message: string | null
  onDismiss: () => void
}) {
  React.useEffect(() => {
    if (!message) return
    const timer = setTimeout(onDismiss, AUTO_DISMISS_MS)
    return () => clearTimeout(timer)
  }, [message, onDismiss])

  if (!message) return null

  return (
    <div
      // assertive: o usuário acabou de ver a ação "funcionar" na tela e ser
      // desfeita — precisa ser interrompido, não avisado quando sobrar tempo.
      role="alert"
      aria-live="assertive"
      className="fixed bottom-4 left-1/2 z-50 flex w-[min(26rem,calc(100vw-2rem))] -translate-x-1/2 items-start gap-3 rounded-xl border border-destructive/30 bg-card p-3 shadow-lg"
    >
      <AlertCircle className="mt-0.5 size-4 shrink-0 text-destructive" />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-foreground">{message}</p>
        <p className="mt-0.5 text-xs text-muted-foreground">
          A alteração foi desfeita. Verifique sua conexão e tente de novo.
        </p>
      </div>
      <button
        type="button"
        onClick={onDismiss}
        aria-label="Fechar aviso"
        className="shrink-0 rounded-md p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
      >
        <X className="size-3.5" />
      </button>
    </div>
  )
}
