"use client"

import * as React from "react"

import { cardTemLancamento, deleteCard } from "@/lib/kanban/queries"
import { EXCLUSAO_BLOQUEADA_POR_LANCAMENTO } from "@/lib/kanban/visibilidade"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
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

/**
 * Quatro fases do pré-voo. `bloqueado` é alcançado tanto pela resposta do
 * pré-voo (`cardTemLancamento`) quanto — no lugar, sem fechar o diálogo —
 * por uma recusa do próprio `deleteCard` no submit: o pré-voo é
 * conveniência, o servidor é o portão de verdade (D-15).
 */
type PreVooFase =
  | "verificando"
  | "permitido"
  | "bloqueado"
  | "verificacao-falhou"

function normalizar(texto: string): string {
  return texto.trim().toLowerCase().replace(/\s+/g, " ")
}

export function ExcluirContratoDialog({
  card,
  open,
  onOpenChange,
  onExcluido,
  onPedirArquivamento,
}: {
  card: { id: string; endereco: string; numero: number }
  open: boolean
  onOpenChange: (open: boolean) => void
  onExcluido: (cardId: string) => void
  onPedirArquivamento: () => void
}) {
  const [fase, setFase] = React.useState<PreVooFase>("verificando")
  const [confirmacao, setConfirmacao] = React.useState("")
  const [saving, setSaving] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  // Resincroniza a cada abertura: sem isso, o texto digitado e o resultado
  // do pré-voo de um card anterior vazariam para o próximo.
  const [wasOpen, setWasOpen] = React.useState(open)
  if (open !== wasOpen) {
    setWasOpen(open)
    if (open) {
      setFase("verificando")
      setConfirmacao("")
      setSaving(false)
      setError(null)
    }
  }

  React.useEffect(() => {
    if (!open) return
    let cancelado = false
    cardTemLancamento(card.id)
      .then(({ temLancamento }) => {
        if (cancelado) return
        setFase(temLancamento ? "bloqueado" : "permitido")
      })
      .catch(() => {
        if (!cancelado) setFase("verificacao-falhou")
      })
    return () => {
      cancelado = true
    }
  }, [open, card.id])

  const alvo = `excluir ${card.numero}`
  const confere = normalizar(confirmacao) === alvo
  const mostrarDivergencia = confirmacao.length > 0 && !confere

  async function handleConfirm() {
    setSaving(true)
    setError(null)
    try {
      await deleteCard(card.id)
      onExcluido(card.id)
      onOpenChange(false)
    } catch (err) {
      const mensagem = err instanceof Error ? err.message : ""
      if (mensagem === EXCLUSAO_BLOQUEADA_POR_LANCAMENTO) {
        // Caminho de corrida: o pré-voo passou, mas o servidor recusou no
        // submit. Troca para a variante bloqueada no lugar — sem fechar o
        // diálogo, sem toast — para o usuário cair na oferta de arquivar.
        setFase("bloqueado")
        setSaving(false)
        return
      }
      setError(
        mensagem || "Não foi possível excluir o imóvel. Tente novamente."
      )
      setSaving(false)
    }
  }

  if (fase === "bloqueado") {
    return (
      <AlertDialog open={open} onOpenChange={onOpenChange}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Este contrato não pode ser excluído
            </AlertDialogTitle>
            <AlertDialogDescription>
              {card.endereco} — o contrato {card.numero} já tem lançamento
              financeiro registrado (pagamento, baixa parcial, acréscimo ou
              desconto). Excluir apagaria esse histórico junto, então a
              exclusão fica bloqueada.
            </AlertDialogDescription>
          </AlertDialogHeader>

          <p className="text-sm text-muted-foreground">
            Se o contrato acabou, arquive: ele sai do board, do Financeiro,
            dos relatórios e dos alertas, e o histórico continua guardado.
          </p>

          <AlertDialogFooter>
            <AlertDialogCancel variant="outline">Fechar</AlertDialogCancel>
            <AlertDialogAction
              variant="default"
              onClick={() => {
                onOpenChange(false)
                onPedirArquivamento()
              }}
            >
              Arquivar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    )
  }

  const verificando = fase === "verificando"

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            Excluir este contrato definitivamente?
          </AlertDialogTitle>
          <AlertDialogDescription>
            {card.endereco} — o contrato {card.numero} e todas as parcelas
            geradas para ele serão apagados. Esta ação é irreversível: não há
            como desfazer nem recuperar depois.
          </AlertDialogDescription>
        </AlertDialogHeader>

        {verificando && (
          <p className="text-sm text-muted-foreground">
            Conferindo o histórico financeiro...
          </p>
        )}

        {fase === "verificacao-falhou" && (
          <p className="text-xs text-muted-foreground">
            Não foi possível conferir o histórico financeiro agora. A
            exclusão ainda será verificada no servidor.
          </p>
        )}

        {!verificando && (
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="confirmacao-exclusao">
              Para confirmar, digite excluir {card.numero}
            </Label>
            <Input
              id="confirmacao-exclusao"
              value={confirmacao}
              onChange={(event) => setConfirmacao(event.target.value)}
              placeholder={`excluir ${card.numero}`}
              autoComplete="off"
              autoCapitalize="none"
              spellCheck={false}
            />
            {mostrarDivergencia && (
              <p className="text-xs text-muted-foreground">
                O texto ainda não confere. Digite exatamente: excluir{" "}
                {card.numero}
              </p>
            )}
          </div>
        )}

        {error && <p className="text-sm text-destructive">{error}</p>}

        <AlertDialogFooter>
          <AlertDialogCancel>Cancelar</AlertDialogCancel>
          {!verificando && (
            <AlertDialogAction
              variant="destructive"
              disabled={!confere || saving}
              onClick={() => {
                void handleConfirm()
              }}
            >
              {saving ? "Excluindo..." : "Excluir definitivamente"}
            </AlertDialogAction>
          )}
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
