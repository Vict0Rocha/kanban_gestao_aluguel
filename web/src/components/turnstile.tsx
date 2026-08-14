"use client"

import * as React from "react"

const SCRIPT_SRC =
  "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit"

type TurnstileApi = {
  render: (
    element: HTMLElement,
    options: {
      sitekey: string
      callback: (token: string) => void
      "expired-callback": () => void
      "error-callback": (code?: string) => void
      theme?: "light" | "dark" | "auto"
    }
  ) => string
  remove: (widgetId: string) => void
}

declare global {
  interface Window {
    turnstile?: TurnstileApi
  }
}

/** A chave pública fica no bundle de propósito — é o par público do segredo. */
export const TURNSTILE_SITE_KEY =
  process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? ""

/** Sem chave configurada, o login funciona sem desafio. */
export const turnstileEnabled = TURNSTILE_SITE_KEY.length > 0

let scriptPromise: Promise<void> | null = null

/**
 * Carrega o script uma vez só por aba, mesmo que o componente monte de novo
 * (o React em modo estrito monta duas vezes em desenvolvimento).
 */
function loadScript(): Promise<void> {
  if (scriptPromise) return scriptPromise

  scriptPromise = new Promise<void>((resolve, reject) => {
    if (window.turnstile) {
      resolve()
      return
    }
    const script = document.createElement("script")
    script.src = SCRIPT_SRC
    script.async = true
    script.defer = true
    script.onload = () => resolve()
    script.onerror = () => {
      scriptPromise = null
      reject(new Error("turnstile-script"))
    }
    document.head.appendChild(script)
  })

  return scriptPromise
}

/**
 * Desafio anti-bot da Cloudflare na tela de login. Na maior parte das vezes
 * resolve sozinho, sem o usuário ver nada — só apresenta quebra-cabeça quando
 * o sinal é suspeito.
 *
 * O token gerado aqui vai junto no `signInWithPassword`, e quem valida é o
 * Supabase, no servidor, contra a secret key configurada no painel. Um cliente
 * adulterado que pule esta etapa simplesmente não recebe token válido, e o
 * login é recusado do outro lado.
 */
/**
 * A Cloudflare devolve um código no erro; sem ele a tela diz apenas "não deu
 * certo" e a causa vira adivinhação. Os dois primeiros aparecem em configuração
 * nova e têm conserto diferente, então vale distinguir.
 */
function explicarErro(code?: string): string {
  if (code?.startsWith("110200")) {
    return "Este endereço não está autorizado na configuração do Turnstile."
  }
  if (code?.startsWith("110100") || code?.startsWith("110110")) {
    return "A chave do Turnstile (site key) parece inválida."
  }
  if (code?.startsWith("300") || code?.startsWith("600")) {
    return "A verificação de segurança falhou. Recarregue a página."
  }
  return code
    ? `Não foi possível carregar a verificação de segurança (código ${code}).`
    : "Não foi possível carregar a verificação de segurança. Recarregue a página."
}

export function Turnstile({
  onToken,
  onError,
}: {
  onToken: (token: string | null) => void
  onError: (message: string) => void
}) {
  const containerRef = React.useRef<HTMLDivElement>(null)
  const onTokenRef = React.useRef(onToken)
  const onErrorRef = React.useRef(onError)

  // Os callbacks ficam em ref para que o widget seja montado uma vez só: se
  // entrassem nas dependências do effect abaixo, cada render do formulário
  // (a cada tecla digitada) destruiria e recriaria o desafio.
  React.useEffect(() => {
    onTokenRef.current = onToken
    onErrorRef.current = onError
  })

  React.useEffect(() => {
    if (!turnstileEnabled) return

    let widgetId: string | undefined
    let cancelled = false

    loadScript()
      .then(() => {
        if (cancelled || !containerRef.current || !window.turnstile) return
        widgetId = window.turnstile.render(containerRef.current, {
          sitekey: TURNSTILE_SITE_KEY,
          callback: (token) => onTokenRef.current(token),
          // O token vale poucos minutos. Ao expirar, zera para o formulário
          // pedir um novo desafio em vez de enviar algo que já não serve.
          "expired-callback": () => onTokenRef.current(null),
          "error-callback": (code) => {
            console.error("turnstile", code)
            onErrorRef.current(explicarErro(code))
          },
          theme: "auto",
        })
      })
      .catch(() => {
        if (!cancelled) {
          onErrorRef.current(
            "Não foi possível carregar a verificação de segurança. Verifique sua conexão."
          )
        }
      })

    return () => {
      cancelled = true
      if (widgetId && window.turnstile) window.turnstile.remove(widgetId)
    }
  }, [])

  if (!turnstileEnabled) return null

  return <div ref={containerRef} className="flex justify-center" />
}
