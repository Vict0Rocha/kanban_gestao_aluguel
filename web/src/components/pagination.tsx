"use client"

import * as React from "react"
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

/**
 * Tamanho fixo de página — não configurável pelo usuário final (D-05,
 * 15-CONTEXT.md). Corrigido de 10 para 12 depois de uso real em produção
 * (correção pós-verificação, ver ROADMAP.md § Phase 15).
 */
const TAMANHO_PAGINA = 12

/** Quantos números de página ficam visíveis de uma vez — o resto vira
 * janela deslizante (ver `Pagination` abaixo). Correção pós-verificação:
 * o desenho original (D-05) não previa lista com centenas de páginas
 * (ex.: Relatório Financeiro dedicado sem filtro, 502 parcelas / 10 por
 * página = 51 botões) — visualmente inviável. */
const TAMANHO_JANELA = 5

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

/** Primeiro número da janela de `TAMANHO_JANELA` botões que contém `pagina`,
 * sempre dentro de `[1, totalPaginas]`. */
function inicioDaJanela(pagina: number, totalPaginas: number): number {
  const meio = Math.floor(TAMANHO_JANELA / 2)
  const tetoInicio = Math.max(1, totalPaginas - TAMANHO_JANELA + 1)
  return Math.min(Math.max(1, pagina - meio), tetoInicio)
}

/**
 * Navegação numerada (D-05, 15-CONTEXT.md) — nunca só Anterior/Próxima.
 * Correção pós-verificação (ROADMAP.md § Phase 15): o desenho original não
 * truncava a lista de números, o que ficou visualmente inviável em listas
 * com muitas páginas (ex.: 51 páginas sem filtro no Relatório Financeiro
 * dedicado). Agora mostra no máximo `TAMANHO_JANELA` (5) números por vez,
 * com um controle próprio para deslizar a janela (busca visual, não muda a
 * página atual) e um campo para pular direto a uma página quando a lista
 * está truncada.
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
  const [janelaInicio, setJanelaInicio] = React.useState(() =>
    inicioDaJanela(pagina, totalPaginas)
  )
  const [paginaSincronizada, setPaginaSincronizada] = React.useState(pagina)
  const [valorBusca, setValorBusca] = React.useState("")

  // Ajusta a janela durante a própria renderização quando a página muda por
  // navegação real (seta, clique num número, campo "Ir para") e a página
  // nova sai da janela atual — nunca quando só a janela é deslizada pelos
  // botões »/« (esses tocam só `janelaInicio`, sem passar por aqui), mesmo
  // padrão de comparação em render do reset de `usePagination` acima, para
  // nunca perder um frame mostrando a janela errada.
  if (pagina !== paginaSincronizada) {
    setPaginaSincronizada(pagina)
    if (pagina < janelaInicio || pagina >= janelaInicio + TAMANHO_JANELA) {
      setJanelaInicio(inicioDaJanela(pagina, totalPaginas))
    }
  }

  if (totalPaginas <= 1) return null

  const fimJanela = Math.min(janelaInicio + TAMANHO_JANELA - 1, totalPaginas)
  const numeros: number[] = []
  for (let n = janelaInicio; n <= fimJanela; n++) numeros.push(n)

  const temJanelaAnterior = janelaInicio > 1
  const temJanelaSeguinte = fimJanela < totalPaginas
  const mostrarBusca = totalPaginas > TAMANHO_JANELA

  function irParaPaginaDigitada(evento: React.FormEvent) {
    evento.preventDefault()
    const alvo = Number(valorBusca)
    if (Number.isInteger(alvo) && alvo >= 1 && alvo <= totalPaginas) {
      onPaginaChange(alvo)
      setValorBusca("")
    }
  }

  return (
    <div className="mt-4 flex flex-wrap items-center justify-center gap-1">
      <Button
        variant="ghost"
        size="icon"
        disabled={pagina === 1}
        aria-label="Página anterior"
        onClick={() => onPaginaChange(pagina - 1)}
      >
        <ChevronLeft className="size-4" />
      </Button>

      {temJanelaAnterior && (
        <Button
          variant="ghost"
          size="icon"
          aria-label={`Ver páginas ${Math.max(1, janelaInicio - TAMANHO_JANELA)} a ${janelaInicio - 1}`}
          title="Ver páginas anteriores"
          onClick={() =>
            setJanelaInicio(Math.max(1, janelaInicio - TAMANHO_JANELA))
          }
        >
          <ChevronsLeft className="size-4" />
        </Button>
      )}

      {numeros.map((n) => (
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

      {temJanelaSeguinte && (
        <Button
          variant="ghost"
          size="icon"
          aria-label={`Ver páginas ${fimJanela + 1} a ${Math.min(totalPaginas, fimJanela + TAMANHO_JANELA)}`}
          title="Ver mais páginas"
          onClick={() =>
            setJanelaInicio(
              Math.min(totalPaginas - TAMANHO_JANELA + 1, janelaInicio + TAMANHO_JANELA)
            )
          }
        >
          <ChevronsRight className="size-4" />
        </Button>
      )}

      <Button
        variant="ghost"
        size="icon"
        disabled={pagina === totalPaginas}
        aria-label="Próxima página"
        onClick={() => onPaginaChange(pagina + 1)}
      >
        <ChevronRight className="size-4" />
      </Button>

      {mostrarBusca && (
        <form
          className="ml-2 flex items-center gap-1.5"
          onSubmit={irParaPaginaDigitada}
        >
          <span className="text-xs text-muted-foreground">Ir para</span>
          <Input
            type="number"
            inputMode="numeric"
            min={1}
            max={totalPaginas}
            value={valorBusca}
            onChange={(evento) => setValorBusca(evento.target.value)}
            placeholder={String(pagina)}
            aria-label={`Ir para a página, de 1 a ${totalPaginas}`}
            className="h-8 w-16 text-center"
          />
        </form>
      )}
    </div>
  )
}
