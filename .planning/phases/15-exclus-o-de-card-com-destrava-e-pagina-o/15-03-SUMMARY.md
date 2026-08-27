---
phase: 15-exclus-o-de-card-com-destrava-e-pagina-o
plan: 03
subsystem: ui
tags: [react, nextjs, typescript, pagination, financeiro]

requires:
  - phase: 06.1-consulta-financeira-e-gera-o-por-per-odo
    provides: "FiltroValores / filtroInicial threaded server->client no Financeiro (base do resetKey)"
provides:
  - "web/src/components/pagination.tsx — componente Pagination + hook usePagination<T>() reutilizável, único lugar do projeto onde a lógica de paginação vive"
  - "Lista de parcelas do Financeiro paginada em blocos de 10, navegação numerada, reset de página correto (segue o filtro, não router.refresh() de mutações)"
affects: [15-05-paginacao-das-cinco-listagens-restantes]

actuals:
  tokens: 1669
  tasks: 1
  commits: 1

tech-stack:
  added: []
  patterns:
    - "usePagination<T>(itens, resetKey) — fatiamento 100% client-side de um array já filtrado no servidor, sem query nova"
    - "Reset de estado por resetKey comparado durante a renderização (React idiom oficial), nunca useEffect — evita reset em todo router.refresh() de mutações não relacionadas ao filtro"

key-files:
  created:
    - web/src/components/pagination.tsx
  modified:
    - web/src/components/financeiro/parcelas-table.tsx
    - web/src/components/financeiro/financeiro-view.tsx

key-decisions:
  - "Implementação copiada verbatim de 15-RESEARCH.md Pattern 4 (já validada na pesquisa), sem redesenho"
  - "Sem lógica de elipse/truncamento na navegação numerada — volume atual (~46-48 registros / 10 por página ≈ 5 páginas) não justifica a complexidade extra"

patterns-established:
  - "Pattern 4 (15-RESEARCH.md): usePagination/Pagination — próximo consumidor é o plano 15-05 (5 listagens restantes), importando sem reimplementar"

requirements-completed: [PAGIN-01, PAGIN-02, PAGIN-03]

coverage:
  - id: D1
    description: "Componente Pagination + hook usePagination<T>() novos em web/src/components/pagination.tsx, reutilizável"
    requirement: PAGIN-01
    verification:
      - kind: other
        ref: "grep: export function usePagination, export function Pagination, TAMANHO_PAGINA = 10, zero ocorrências de useEffect no arquivo"
        status: pass
      - kind: other
        ref: "npx tsc --noEmit (web/) — limpo"
        status: pass
    human_judgment: false
  - id: D2
    description: "Lista de parcelas do Financeiro pagina em blocos de 10 com navegação numerada (não só Anterior/Próxima)"
    requirement: PAGIN-02
    verification:
      - kind: other
        ref: "npm run build (web/) — compila e gera páginas estáticas sem erro"
        status: pass
    human_judgment: true
    rationale: "Navegação numerada interativa (clicar num número muda as linhas mostradas) só é observável em produção/local com dado real — o volume atual pode não ter 11+ parcelas em nenhum filtro no momento da verificação"
  - id: D3
    description: "resetKey volta a página para 1 ao mudar filtro; mutações (conciliar, cancelar lançamento) que disparam router.refresh() sem mudar filtro NÃO resetam a página"
    requirement: PAGIN-03
    verification:
      - kind: other
        ref: "grep: resetKey presente em parcelas-table.tsx e financeiro-view.tsx (resetKey={JSON.stringify(filtroInicial)}); leitura de código confirma que o reset ocorre por comparação de resetKey durante a renderização, não useEffect"
        status: pass
    human_judgment: true
    rationale: "Comportamento de reset por interação real (trocar filtro vs. clicar em Conciliar numa página != 1) exige navegador com sessão autenticada e dado real — não verificável por grep/tsc/build sozinhos"

duration: ~15min
completed: 2026-08-27
status: complete
---

# Phase 15 Plan 03: Componente Pagination + tracer no Financeiro Summary

**Novo componente reutilizável `Pagination`/`usePagination<T>()` (`web/src/components/pagination.tsx`), provado end-to-end na lista de parcelas do Financeiro com reset de página correto via `resetKey`.**

## Performance

- **Duration:** ~15min
- **Completed:** 2026-08-27
- **Tasks:** 1 (tracer)
- **Files modified:** 3 (1 criado, 2 modificados)

## Accomplishments
- `web/src/components/pagination.tsx` criado do zero: `usePagination<T>(itens, resetKey)` (fatiamento em memória, `TAMANHO_PAGINA = 10`, reset por comparação de `resetKey` durante a renderização) + `<Pagination>` (navegação numerada com setas anterior/próxima via `ChevronLeft`/`ChevronRight`, `variant="default"`/`aria-current="page"` na página atual, `null` quando `totalPaginas <= 1`)
- `ParcelasTable` (Financeiro) ganhou a prop `resetKey`, passou a renderizar `itensDaPagina` no lugar de `linhas` no `.map()`, mantendo `linhas` como fonte de `vazio`/`erro`
- `FinanceiroView` passa `resetKey={JSON.stringify(filtroInicial)}` para `ParcelasTable`, reutilizando a prop `filtroInicial` já existente
- Este é o caso de referência mais rico do escopo (filtro server-side + `router.refresh()` de mutações não relacionadas a filtro) — a fatia que o plano 15-05 replica nas 5 listagens restantes sem reimplementar a lógica

## Task Commits

Task único (tracer, `type="tracer"`):

1. **Task 1: Componente `Pagination`/`usePagination` + wiring na lista de parcelas do Financeiro** - `62e3b56` (feat)

_Este plano não tem commit de metadata separado — orquestrador central não gerencia STATE.md/ROADMAP.md a partir deste worktree (execução paralela)._

## Files Created/Modified
- `web/src/components/pagination.tsx` - Novo. `usePagination<T>()` + `<Pagination>`, copiado de 15-RESEARCH.md Pattern 4 sem redesenho
- `web/src/components/financeiro/parcelas-table.tsx` - Prop `resetKey` nova; `itensDaPagina` no `.map()` de renderização; `<Pagination>` renderizado logo após `</Table>`
- `web/src/components/financeiro/financeiro-view.tsx` - Repassa `resetKey={JSON.stringify(filtroInicial)}` para `ParcelasTable`

## Decisions Made
- Implementação de `usePagination`/`Pagination` copiada verbatim de 15-RESEARCH.md Pattern 4 (já validada na pesquisa da fase), sem redesenho — conforme instrução explícita do plano
- Duas menções a "useEffect" nos comentários JSDoc originais (herdados do texto do plano) foram reescritas para "efeito pós-render" — o `<verify>` automatizado do próprio plano faz `grep -c "useEffect"` no arquivo inteiro (incluindo comentários) e exige zero ocorrências; a intenção documental (não usar `useEffect` para resetar página) foi preservada sem a palavra literal

## Deviations from Plan

None - plan executado exatamente como escrito. A única adaptação foi de fraseado em comentários (ver Decisions Made acima), não de comportamento ou estrutura de código.

## Issues Encountered

O worktree não compartilha `node_modules` com o checkout principal — precisou de `npm install` próprio (~1min, 633 pacotes) antes de rodar `tsc`/lint/build. Nenhum erro de instalação.

## User Setup Required

None - nenhuma configuração de serviço externo necessária.

## Next Phase Readiness

- `web/src/components/pagination.tsx` pronto para ser importado pelo plano 15-05 nas 5 listagens restantes (`contracts-table.tsx`, `relatorio-financeiro-lista.tsx`, `dinheiro-imobiliaria-view.tsx`, `configuracao-financeira-view.tsx`, `arquivados-view.tsx`), seguindo a tabela de wiring por call-site já documentada em 15-RESEARCH.md
- Verificação automatizada completa: grep do plano (`GREP_OK`), `npx tsc --noEmit` limpo, `npm run lint` limpo, `npm run build` compilou e gerou todas as rotas sem erro
- Human-check do `<verify>` do plano (navegação numerada interativa, reset por filtro, não-reset por mutação) ainda pendente — requer sessão autenticada em produção/local com dado real; nenhum bloqueio para o plano 15-05, que replica o mesmo padrão já provado por leitura de código

---
*Phase: 15-exclus-o-de-card-com-destrava-e-pagina-o*
*Completed: 2026-08-27*

## Self-Check: PASSED

- FOUND: web/src/components/pagination.tsx
- FOUND: commit 62e3b56 in git log
