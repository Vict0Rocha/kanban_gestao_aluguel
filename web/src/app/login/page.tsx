"use client"

import * as React from "react"
import { useRouter } from "next/navigation"

import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Turnstile, turnstileEnabled } from "@/components/turnstile"

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = React.useState("")
  const [password, setPassword] = React.useState("")
  const [error, setError] = React.useState<string | null>(null)
  const [loading, setLoading] = React.useState(false)
  const [captchaToken, setCaptchaToken] = React.useState<string | null>(null)

  // Sem o desafio configurado, não há o que esperar antes de enviar.
  const aguardandoDesafio = turnstileEnabled && !captchaToken

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    if (aguardandoDesafio) return

    setLoading(true)
    setError(null)

    const supabase = createClient()
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
      // Quem confere é o Supabase, no servidor, contra a secret key do painel.
      ...(captchaToken ? { options: { captchaToken } } : {}),
    })

    if (error) {
      // O Supabase distingue credencial errada de desafio recusado; sem essa
      // separação, um token expirado apareceria como "senha incorreta" e a
      // pessoa ficaria tentando de novo sem entender o motivo.
      setError(
        error.message.toLowerCase().includes("captcha")
          ? "Verificação de segurança expirou. Tente novamente."
          : "E-mail ou senha incorretos."
      )
      setCaptchaToken(null)
      setLoading(false)
      return
    }

    router.replace("/")
    router.refresh()
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm rounded-2xl border border-border bg-card p-8 shadow-sm">
        <div className="mb-6 flex flex-col items-center gap-2 text-center">
          <div className="flex size-10 items-center justify-center rounded-lg bg-primary text-base font-bold text-primary-foreground">
            K
          </div>
          <h1 className="font-heading text-xl font-extrabold text-foreground">
            Kanban Aluguel
          </h1>
          <p className="text-sm text-muted-foreground">
            Entre com sua conta para continuar.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="email">E-mail</Label>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="password">Senha</Label>
            <Input
              id="password"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
          </div>

          <Turnstile
            onToken={setCaptchaToken}
            onError={() =>
              setError(
                "Não foi possível carregar a verificação de segurança. Recarregue a página."
              )
            }
          />

          {error && <p className="text-sm text-destructive">{error}</p>}

          <Button
            type="submit"
            disabled={loading || aguardandoDesafio}
            className="mt-2"
          >
            {loading ? "Entrando..." : "Entrar"}
          </Button>
        </form>
      </div>
    </div>
  )
}
