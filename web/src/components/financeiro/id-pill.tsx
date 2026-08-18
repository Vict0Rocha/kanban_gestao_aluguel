/**
 * Pílula de identificador sequencial do contrato (D-07/D-08, CONTRATO-03).
 * Componente de apresentação puro — sem "use client" — mesmo molde de
 * `parcela-situacao-badge.tsx`. Usado em dois lugares: o card do Board
 * (`card-item.tsx`) e a primeira coluna da tabela do Financeiro
 * (`parcelas-table.tsx`).
 *
 * Sem largura mínima fixa na classe: cresce com o conteúdo, para não
 * cortar/apertar a partir de 3 dígitos (UI Consideration "long-text").
 */
export function IdPill({ numero }: { numero: number }) {
  return (
    <span
      className="inline-flex h-5 items-center rounded-full bg-secondary/25 px-2 text-xs font-semibold tabular-nums text-secondary-foreground"
      aria-label={`Contrato número ${numero}`}
    >
      #{numero}
    </span>
  )
}
