"use client"

import { useRouter } from "next/navigation"
import { ShieldAlert } from "lucide-react"

import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"

/**
 * Tela para quem entrou mas não está na allowlist.
 *
 * Sem isto, o RLS filtra todas as linhas em silêncio e a pessoa vê um board
 * vazio — tecnicamente correto, mas indistinguível de "não há dados" ou de um
 * bug. Já confundiu na prática.
 *
 * O texto não revela quem está na lista nem como ela funciona: só diz que o
 * acesso depende de liberação e a quem recorrer.
 */
export function AcessoPendente({ email }: { email?: string }) {
  const router = useRouter()

  async function sair() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.replace("/login")
    router.refresh()
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="flex w-full max-w-md flex-col items-center gap-4 rounded-2xl border border-border bg-card p-8 text-center">
        <div className="flex size-11 items-center justify-center rounded-full bg-primary/10">
          <ShieldAlert className="size-5 text-primary" />
        </div>

        <div className="flex flex-col gap-1.5">
          <h1 className="font-heading text-lg font-bold text-foreground">
            Acesso ainda não liberado
          </h1>
          <p className="text-sm text-muted-foreground">
            Seu login funcionou, mas esta conta ainda não tem permissão para ver
            os imóveis. Peça a liberação a quem administra o sistema.
          </p>
        </div>

        {email && (
          <p className="rounded-lg bg-muted px-3 py-2 text-xs text-muted-foreground">
            Conectado como <span className="font-medium">{email}</span>
          </p>
        )}

        <Button variant="outline" onClick={sair} className="mt-1">
          Sair
        </Button>
      </div>
    </div>
  )
}
