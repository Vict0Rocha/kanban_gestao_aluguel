"use client"

import * as React from "react"
import { Search, X } from "lucide-react"

import { cn } from "@/lib/utils"
import { Input } from "@/components/ui/input"

/**
 * Campo de busca do board e dos relatórios. A filtragem é toda no cliente,
 * sobre os cards que a página já carregou, então cada tecla digitada atualiza
 * a tela na hora — sem ida ao servidor e sem debounce para atrapalhar.
 */
export function SearchField({
  value,
  onChange,
  placeholder = "Buscar por proprietário, endereço, inquilino...",
  className,
  /** Lido por leitores de tela a cada mudança de resultado. */
  resultSummary,
}: {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  className?: string
  resultSummary?: string
}) {
  const inputRef = React.useRef<HTMLInputElement>(null)

  function clear() {
    onChange("")
    inputRef.current?.focus()
  }

  return (
    <div className={cn("relative w-full sm:max-w-sm", className)}>
      <Search
        className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground"
        aria-hidden="true"
      />
      <Input
        ref={inputRef}
        // O X nativo do type="search" no Chrome duplicaria o botão de limpar,
        // e ele não recebe foco por teclado — por isso some via appearance.
        type="search"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Escape" && value) {
            event.preventDefault()
            clear()
          }
        }}
        placeholder={placeholder}
        aria-label="Buscar imóveis"
        className="h-9 pr-8 pl-8 [&::-webkit-search-cancel-button]:appearance-none"
      />
      {value && (
        <button
          type="button"
          onClick={clear}
          aria-label="Limpar busca"
          className="absolute top-1/2 right-1.5 flex size-6 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
        >
          <X className="size-3.5" />
        </button>
      )}
      {resultSummary && (
        <p role="status" aria-live="polite" className="sr-only">
          {resultSummary}
        </p>
      )}
    </div>
  )
}
