import { cn } from "@/lib/utils"

/**
 * Pílula de identificador sequencial do contrato (D-07/D-08, CONTRATO-03).
 * Componente de apresentação puro — sem "use client" — mesmo molde de
 * `parcela-situacao-badge.tsx`. Usado em dois lugares: o card do Board
 * (`card-item.tsx`) e a primeira coluna da tabela do Financeiro
 * (`parcelas-table.tsx`).
 *
 * Sem largura mínima fixa na classe: cresce com o conteúdo, para não
 * cortar/apertar a partir de 3 dígitos (UI Consideration "long-text").
 *
 * `variant="subtle"` é exclusiva do card do Board (face do card e diálogo de
 * detalhes) — a pílula fica mais discreta para não competir com o valor do
 * aluguel, e mostra só o número, sem o prefixo "#" (pedido do usuário depois
 * de ver em produção). `parcelas-table.tsx` não passa a prop e mantém a
 * aparência "default" de sempre, com "#N".
 */
export function IdPill({
  numero,
  variant = "default",
}: {
  numero: number
  variant?: "default" | "subtle"
}) {
  return (
    <span
      className={cn(
        "inline-flex h-5 items-center rounded-full px-2 text-xs tabular-nums",
        variant === "default" &&
          "bg-secondary/25 font-semibold text-secondary-foreground",
        variant === "subtle" && "bg-muted font-medium text-muted-foreground"
      )}
      aria-label={`Contrato número ${numero}`}
    >
      {variant === "subtle" ? numero : `#${numero}`}
    </span>
  )
}
