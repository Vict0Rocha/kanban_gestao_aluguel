"use client"

import * as React from "react"
import { ChevronLeft, ChevronRight } from "lucide-react"

import { Button } from "@/components/ui/button"

/** Tamanho fixo de página — não configurável pelo usuário final (D-05, 15-CONTEXT.md). */
const TAMANHO_PAGINA = 10

/**
 * Hook genérico de paginação em memória. Fatiamento é 100% client-side sobre
 * um array já trazido e já filtrado do servidor — nenhuma query nova.
 *
 * O reset de página é decidido por `resetKey`: uma chave de identidade do
 * filtro (ex.: `JSON.stringify(filtroAtivo)`), comparada durante a
 * própria renderização (nunca num efeito pós-render) contra o valor
 * guardado da última renderização. Isso evita a armadilha de resetar a
 * página a cada `router.refresh()` disparado por uma mutação não
 * relacionada ao filtro (ex.: conciliar, cancelar lançamento) — ver
 * Pitfall 3, 15-RESEARCH.md.
 */
export function usePagination<T>(itens: T[], resetKey: unknown) {
  const [pagina, setPagina] = React.useState(1)
  const [ultimaChave, setUltimaChave] = React.useState(resetKey)

  // Ajusta o estado durante a própria renderização (padrão React para
  // resetar estado quando um input externo muda) em vez de num efeito
  // pós-render — evita um frame extra mostrando a página errada antes do
  // reset.
  if (resetKey !== ultimaChave) {
    setUltimaChave(resetKey)
    setPagina(1)
  }

  const totalPaginas = Math.max(1, Math.ceil(itens.length / TAMANHO_PAGINA))
  // Math.min garante que a página nunca fica vazia se a lista encolher
  // entre uma renderização e outra (ex.: filtro reduz o total de itens).
  const paginaEfetiva = Math.min(pagina, totalPaginas)
  const inicio = (paginaEfetiva - 1) * TAMANHO_PAGINA
  const itensDaPagina = itens.slice(inicio, inicio + TAMANHO_PAGINA)

  return { itensDaPagina, pagina: paginaEfetiva, totalPaginas, setPagina }
}

/**
 * Navegação numerada (1, 2, 3… + setas anterior/próxima) — nunca só
 * Anterior/Próxima (D-05, 15-CONTEXT.md). Sem lógica de elipse/truncamento:
 * no volume atual do projeto (~46-48 registros / 10 por página ≈ 5 páginas)
 * uma lista simples de botões numerados cobre o caso real.
 */
export function Pagination({
  pagina,
  totalPaginas,
  onPaginaChange,
}: {
  pagina: number
  totalPaginas: number
  onPaginaChange: (pagina: number) => void
}) {
  if (totalPaginas <= 1) return null

  return (
    <div className="mt-4 flex items-center justify-center gap-1">
      <Button
        variant="ghost"
        size="icon"
        disabled={pagina === 1}
        aria-label="Página anterior"
        onClick={() => onPaginaChange(pagina - 1)}
      >
        <ChevronLeft className="size-4" />
      </Button>
      {Array.from({ length: totalPaginas }, (_, i) => i + 1).map((n) => (
        <Button
          key={n}
          variant={n === pagina ? "default" : "ghost"}
          size="icon"
          aria-current={n === pagina ? "page" : undefined}
          onClick={() => onPaginaChange(n)}
        >
          {n}
        </Button>
      ))}
      <Button
        variant="ghost"
        size="icon"
        disabled={pagina === totalPaginas}
        aria-label="Próxima página"
        onClick={() => onPaginaChange(pagina + 1)}
      >
        <ChevronRight className="size-4" />
      </Button>
    </div>
  )
}
