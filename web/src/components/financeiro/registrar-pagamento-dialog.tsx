"use client"

import * as React from "react"
import { useRouter } from "next/navigation"

import { cn } from "@/lib/utils"
import { formatCurrency } from "@/lib/kanban/format"
import {
  ORIGENS_TAXA,
  percentualDaOrigem,
  type OrigemTaxa,
} from "@/lib/kanban/taxas"
import { registrarPagamento } from "@/lib/kanban/queries"
import { TAXA_ORIGEM } from "@/components/financeiro/taxa-origem-label"
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

const mesFormatter = new Intl.DateTimeFormat("pt-BR", { month: "long" })

/**
 * `competencia` chega como "YYYY-MM-01" — nunca `new Date(competencia)`
 * direto (mesmo motivo documentado em report.ts/parcelas.ts: esse
 * construtor lê a string como UTC e adianta a data um dia no Brasil).
 */
function descricaoCompetencia(endereco: string, competencia: string): string {
  const [anoStr, mesStr] = competencia.split("-")
  const ano = Number(anoStr)
  const mes = Number(mesStr)
  const mesPorExtenso = mesFormatter.format(new Date(ano, mes - 1, 1))
  return `${endereco} — competência ${mesPorExtenso}/${ano}`
}

function valorInicial(valorDevido: number, valorPago: number): string {
  const restante = valorDevido - valorPago
  if (restante <= 0) return ""
  return restante.toFixed(2).replace(".", ",")
}

/** Arredonda para 2 casas decimais, sem os erros de ponto flutuante de
 * `Math.round(x * 100) / 100` puro em alguns casos de borda. */
function round2(valor: number): number {
  return Math.round((valor + Number.EPSILON) * 100) / 100
}

/** D-03: mesmo quando "Valor recebido" está vazio, a sugestão é R$ 0,00 —
 * nunca um campo em branco por padrão. */
function calcularTaxaInicial(percentualAplicavel: number, valorBase: string): string {
  const parsedValorBase = valorBase ? Number(valorBase.replace(",", ".")) : 0
  const base = Number.isFinite(parsedValorBase) ? parsedValorBase : 0
  return round2((percentualAplicavel / 100) * base)
    .toFixed(2)
    .replace(".", ",")
}

export function RegistrarPagamentoDialog({
  parcelaId,
  endereco,
  competencia,
  valorDevido,
  valorPago,
  percentualAdministracao,
  percentualComissaoPrimeiroAluguel,
  origemSugerida,
  todayISO,
  open,
  onOpenChange,
}: {
  parcelaId: string
  endereco: string
  competencia: string
  valorDevido: number
  valorPago: number
  percentualAdministracao: number
  percentualComissaoPrimeiroAluguel: number
  /** Tipo já marcado ao abrir (D-08: comissão do 1º aluguel na parcela de
   * menor competência do contrato, administração nas demais). É só o ponto de
   * partida — o usuário pode trocar, e o que ele deixar marcado é gravado. */
  origemSugerida: OrigemTaxa
  todayISO: string
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const router = useRouter()
  const percentualDe = (tipo: OrigemTaxa) =>
    percentualDaOrigem(tipo, percentualAdministracao, percentualComissaoPrimeiroAluguel)
  const [valor, setValor] = React.useState(() =>
    valorInicial(valorDevido, valorPago)
  )
  const [data, setData] = React.useState(todayISO)
  const [observacao, setObservacao] = React.useState("")
  const [origem, setOrigem] = React.useState<OrigemTaxa>(origemSugerida)
  const [taxa, setTaxa] = React.useState(() =>
    calcularTaxaInicial(
      percentualDe(origemSugerida),
      valorInicial(valorDevido, valorPago)
    )
  )
  const [taxaTocada, setTaxaTocada] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [saving, setSaving] = React.useState(false)

  // Resincroniza o formulário toda vez que o diálogo reabre — mesmo truque
  // de CardDetailDialog.
  const [wasOpen, setWasOpen] = React.useState(open)
  if (open !== wasOpen) {
    setWasOpen(open)
    if (open) {
      const valorInicialCalculado = valorInicial(valorDevido, valorPago)
      setValor(valorInicialCalculado)
      setData(todayISO)
      setObservacao("")
      setOrigem(origemSugerida)
      setTaxa(
        calcularTaxaInicial(percentualDe(origemSugerida), valorInicialCalculado)
      )
      setTaxaTocada(false)
      setError(null)
    }
  }

  // Trocar o tipo troca também o percentual da sugestão — mesma regra de
  // "Valor recebido" (abaixo): a taxa que o usuário já digitou nunca é
  // sobrescrita.
  function handleOrigemChange(nova: OrigemTaxa) {
    setOrigem(nova)
    if (!taxaTocada) {
      setTaxa(calcularTaxaInicial(percentualDe(nova), valor))
    }
  }

  const origemLabel =
    origem === "administracao" ? "administração" : "comissão do primeiro aluguel"

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()

    const parsedValor = Number(valor.replace(",", "."))
    if (!valor || !Number.isFinite(parsedValor) || parsedValor <= 0) {
      setError("Informe um valor de pagamento válido.")
      return
    }
    if (!data) {
      setError("Informe a data do pagamento.")
      return
    }
    const parsedTaxa = Number(taxa.replace(",", "."))
    if (!Number.isFinite(parsedTaxa) || parsedTaxa < 0) {
      setError("Informe um valor de taxa válido.")
      return
    }

    setSaving(true)
    setError(null)
    try {
      await registrarPagamento(
        parcelaId,
        parsedValor,
        data,
        observacao.trim() || null,
        parsedTaxa,
        origem
      )
      onOpenChange(false)
      router.refresh()
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "Não foi possível registrar o pagamento. Tente novamente."
      )
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Registrar pagamento</DialogTitle>
          <p className="text-sm text-muted-foreground">
            {descricaoCompetencia(endereco, competencia)}
          </p>
          <p className="text-sm text-muted-foreground">
            Valor devido: {formatCurrency(valorDevido)} · Já pago:{" "}
            {formatCurrency(valorPago)}
          </p>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="valor-pagamento">Valor recebido (R$)</Label>
            <Input
              id="valor-pagamento"
              inputMode="decimal"
              placeholder="0,00"
              value={valor}
              onChange={(e) => {
                setValor(e.target.value)
                // Sugestão viva (UI-SPEC §2): recalcula a taxa a partir do
                // novo valor recebido, a menos que o usuário já tenha
                // editado o campo de taxa diretamente nesta abertura do
                // diálogo — nesse caso o valor dele nunca é sobrescrito.
                if (!taxaTocada) {
                  setTaxa(calcularTaxaInicial(percentualDe(origem), e.target.value))
                }
              }}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label id="tipo-recebimento-imobiliaria">
              Tipo de recebimento da imobiliária
            </Label>
            <div
              role="group"
              aria-labelledby="tipo-recebimento-imobiliaria"
              className="inline-flex items-center gap-1 self-start rounded-full bg-muted p-1"
            >
              {ORIGENS_TAXA.map((opcao) => (
                <button
                  key={opcao}
                  type="button"
                  aria-pressed={origem === opcao}
                  onClick={() => handleOrigemChange(opcao)}
                  className={cn(
                    "rounded-full px-3 py-1 text-xs font-semibold transition-colors",
                    origem === opcao
                      ? "bg-card text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  {TAXA_ORIGEM[opcao].label}
                </button>
              ))}
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="taxa-imobiliaria">Taxa da imobiliária (R$)</Label>
            <Input
              id="taxa-imobiliaria"
              inputMode="decimal"
              placeholder="0,00"
              value={taxa}
              onChange={(e) => {
                // Marca taxaTocada ANTES de gravar o valor — nesta ordem,
                // para que o próximo onChange de "Valor recebido" já veja
                // taxaTocada verdadeiro e pare de sobrescrever este campo.
                setTaxaTocada(true)
                setTaxa(e.target.value)
              }}
            />
            <p className="text-xs text-muted-foreground">
              Sugestão: {percentualDe(origem)}% de {origemLabel} sobre o valor
              recebido. Para não cobrar taxa neste pagamento, informe 0,00.
            </p>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="data-pagamento">Data do pagamento</Label>
            <Input
              id="data-pagamento"
              type="date"
              value={data}
              onChange={(e) => setData(e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="observacao-pagamento">Observação (opcional)</Label>
            <Textarea
              id="observacao-pagamento"
              placeholder="Ex.: pago via Pix"
              value={observacao}
              onChange={(e) => setObservacao(e.target.value)}
            />
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}

          <DialogFooter>
            <Button type="submit" disabled={saving}>
              {saving ? "Registrando..." : "Registrar pagamento"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
