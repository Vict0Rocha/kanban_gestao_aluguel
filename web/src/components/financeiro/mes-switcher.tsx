"use client"

import { cn } from "@/lib/utils"

/**
 * Segmented control de seleção única — não um FilterChip combinável. O
 * segmento ativo é uma superfície elevada (bg-card + shadow), nunca a cor de
 * destaque da marca: --primary já está reservado ao link ativo da navegação
 * e à pilha ativo/inativo do card (ver UI-SPEC, seção Color).
 */
export function MesSwitcher({
  value,
  onChange,
}: {
  value: "atual" | "proximo"
  onChange: (value: "atual" | "proximo") => void
}) {
  return (
    <div
      role="group"
      aria-label="Competência"
      className="inline-flex items-center gap-1 rounded-full bg-muted p-1"
    >
      <button
        type="button"
        aria-pressed={value === "atual"}
        onClick={() => onChange("atual")}
        className={cn(
          "rounded-full px-3 py-1 text-xs font-semibold transition-colors",
          value === "atual"
            ? "bg-card text-foreground shadow-sm"
            : "text-muted-foreground hover:text-foreground"
        )}
      >
        Mês atual
      </button>
      <button
        type="button"
        aria-pressed={value === "proximo"}
        onClick={() => onChange("proximo")}
        className={cn(
          "rounded-full px-3 py-1 text-xs font-semibold transition-colors",
          value === "proximo"
            ? "bg-card text-foreground shadow-sm"
            : "text-muted-foreground hover:text-foreground"
        )}
      >
        Próximo mês
      </button>
    </div>
  )
}
