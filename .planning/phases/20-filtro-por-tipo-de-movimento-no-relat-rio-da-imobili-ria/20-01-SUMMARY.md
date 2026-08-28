---
phase: 20-filtro-por-tipo-de-movimento-no-relat-rio-da-imobili-ria
plan: 01
subsystem: ui
tags: [react, typescript, next.js, client-filter, tabela, chips]

# Dependency graph
requires:
  - phase: 19-filtro-por-imovel-proprietario-inquilino-no-relatorio-da-imobiliaria
    provides: "Painel suspenso FiltroReconciliacao com 5 campos, FiltroReconciliacaoValores, calcularReconciliacao, exportarReconciliacaoPDF consumindo linhas já filtradas"
provides:
  - "TipoMovimentoReconciliacao (OrigemTaxa | \"caucao\") e passaFiltroTipoReconciliacao em reconciliacao.ts"
  - "Sexto campo tipos: Set<TipoMovimentoReconciliacao> em FiltroReconciliacaoValores"
  - "4º parâmetro obrigatório (tipos) em calcularReconciliacao, sem valor padrão"
  - "Linha de chips Todos/Administração/Comissão 1º aluguel/Caução no painel suspenso de /relatorios/imobiliaria"
  - "Coluna Contrato trocada de endereço para proprietário; nova coluna Inquilino"
affects: [relatorios-imobiliaria, reconciliacao-pdf-redesign]

# Actuals (#2632)
actuals:
  tokens: 2360
  tasks: 1
  commits: 1

tech-stack:
  added: []
  patterns:
    - "Chip multi-select com Set vazio = sem filtro, reusando FilterChip/toggle (reports-view.tsx) — mesmo padrão de situacoes no Relatório Financeiro dedicado"
    - "resetKey de usePagination compondo um Set via [...set].sort().join(',')"

key-files:
  created: []
  modified:
    - web/src/lib/kanban/reconciliacao.ts
    - web/src/components/reports/filtro-reconciliacao.tsx
    - web/src/components/reports/dinheiro-imobiliaria-view.tsx

key-decisions:
  - "TipoMovimentoReconciliacao reusa OrigemTaxa como superset (OrigemTaxa | \"caucao\"), sem função de mapeamento (D-02, 20-CONTEXT.md)"
  - "4º parâmetro de calcularReconciliacao é obrigatório, sem default — tripwire de compilação forçando a atualização do único call site"
  - "Cadeia de filtro de caução usa sempre a constante \"caucao\", nunca evento.tipo, evitando reintroduzir filtragem por subtipo"
  - "reconciliacao-pdf.ts não foi tocado — recebe linhas já pré-filtradas automaticamente (D-08/D-09)"

patterns-established:
  - "Segundo uso de FilterChip/toggle fora do Relatório Financeiro dedicado, confirmando o padrão como reusável entre relatórios"

requirements-completed: [TIPOIMOB-01, TIPOIMOB-02, TIPOIMOB-03, COLIMOB-01, COLIMOB-02, COLIMOB-03]

coverage:
  - id: D1
    description: "Chips Todos/Administração/Comissão 1º aluguel/Caução no painel suspenso filtram lista, StatTiles e PDF; nenhum chip marcado por padrão"
    requirement: "TIPOIMOB-01"
    verification:
      - kind: unit
        ref: "grep asserting campos.tipos.size === 0 / campos.tipos.has(option.value) / passaFiltroTipoReconciliacao usage in both filter chains"
        status: pass
    human_judgment: true
    rationale: "Comportamento renderizado (chips filtrando lista+StatTiles+PDF juntos) só é observável interagindo com a tela e o PDF exportado reais"
  - id: D2
    description: "Caução é um único chip cobrindo os três subtipos (recebida/devolvida/usada) juntos"
    requirement: "TIPOIMOB-02"
    verification:
      - kind: unit
        ref: "grep asserting passaFiltroTipoReconciliacao(\"caucao\", ...) literal constant in both reconciliacao.ts and dinheiro-imobiliaria-view.tsx"
        status: pass
    human_judgment: true
    rationale: "Confirmar visualmente que o chip único realmente agrupa os três subtipos na lista renderizada requer interação humana"
  - id: D3
    description: "Desmarcar um tipo zera o StatTile correspondente (nunca esconde) e o PDF exportado passa a receber linhas já filtradas, sem mudar de layout"
    requirement: "TIPOIMOB-03"
    verification:
      - kind: unit
        ref: "grep asserting calcularReconciliacao 4th required param (no default) + git diff --quiet on reconciliacao-pdf.ts"
        status: pass
    human_judgment: true
    rationale: "O zeramento visual do StatTile e a estrutura real do PDF exportado com filtro ativo só são observáveis interagindo com a tela e o arquivo"
  - id: D4
    description: "Célula Contrato mostra proprietário (mesmo formato IdPill+texto); nova coluna Inquilino ao lado; endereço sai completamente da tela"
    requirement: "COLIMOB-01"
    verification:
      - kind: unit
        ref: "grep asserting linha.cards?.proprietario, linha.cards?.inquilino, TableHead>Inquilino< present and cards?.endereco absent in dinheiro-imobiliaria-view.tsx"
        status: pass
    human_judgment: false
  - id: D5
    description: "Nenhum campo de endereço removido de LinhaLista/TaxaImobiliariaRelatorio.cards/CaucaoEventoRelatorio.cards; zero migração de banco"
    requirement: "COLIMOB-02"
    verification:
      - kind: unit
        ref: "tsc --noEmit + lint + build all pass; git status --porcelain supabase/migrations empty"
        status: pass
    human_judgment: false
  - id: D6
    description: "reconciliacao-pdf.ts permanece byte a byte inalterado"
    requirement: "COLIMOB-03"
    verification:
      - kind: unit
        ref: "git diff --quiet -- web/src/components/reports/reconciliacao-pdf.ts"
        status: pass
    human_judgment: false

duration: ~15min
completed: 2026-08-28
status: complete
---

# Phase 20 Plan 01: Filtro por tipo de movimento no relatório da imobiliária Summary

**Chip row (Todos/Administração/Comissão 1º aluguel/Caução) filtering the imobiliária reconciliation list, six StatTiles, and the exported PDF together, plus a Contrato→proprietário / new Inquilino column swap — all client-side, zero schema change.**

## Performance

- **Duration:** ~15 min
- **Started:** 2026-08-28T13:53Z (approx.)
- **Completed:** 2026-08-28T13:54:33Z
- **Tasks:** 1 (tracer, covering the entire phase end-to-end)
- **Files modified:** 3

## Accomplishments
- Added `TipoMovimentoReconciliacao` (`OrigemTaxa | "caucao"`) and `passaFiltroTipoReconciliacao` to `reconciliacao.ts`, plus a `tipos: Set<TipoMovimentoReconciliacao>` field on `FiltroReconciliacaoValores`/`filtroReconciliacaoVazio`
- Made `calcularReconciliacao` take a required 4th parameter (`tipos`, no default) so the single existing call site had to be updated — a deliberate compile-time tripwire
- Added a chip row (Todos/Administração/Comissão 1º aluguel/Caução) to `FiltroReconciliacao`, reusing `FilterChip`/`toggle` already shipped for "Situação" in the dedicated financial report
- Wired the type filter into both `linhas` filter chains (taxa and caução) in `DinheiroImobiliariaView`, with the caução chain always using the literal `"caucao"` constant instead of `evento.tipo`
- Composed the sorted `Set` into `resetKey` so click order never changes the pagination-reset identity
- Swapped the "Contrato" cell to show proprietário instead of endereço (same IdPill+text visual shape) and added a new "Inquilino" column
- Left `reconciliacao-pdf.ts` completely untouched — it now automatically receives pre-filtered `linhas`

## Task Commits

Each task was committed atomically:

1. **Task 1: Filtro por tipo de movimento ponta a ponta — chip row, filtro de tipo (lista+totais) e troca de colunas** - `ff38006` (feat)

**Plan metadata:** (pending — see final commit below)

## Files Created/Modified
- `web/src/lib/kanban/reconciliacao.ts` - `TipoMovimentoReconciliacao`, `passaFiltroTipoReconciliacao`, `tipos` field, required 4th param on `calcularReconciliacao`
- `web/src/components/reports/filtro-reconciliacao.tsx` - Chip row (Todos/Administração/Comissão 1º aluguel/Caução), `temFiltroPreenchido` extended
- `web/src/components/reports/dinheiro-imobiliaria-view.tsx` - Both `linhas` filter chains gain the type clause, `resetKey` extended, "Contrato" cell swapped to proprietário, new "Inquilino" column

## Decisions Made
- `TipoMovimentoReconciliacao` reuses `OrigemTaxa` as a superset (`OrigemTaxa | "caucao"`) — no mapping function needed, matching Pattern 2 of 20-RESEARCH.md
- `calcularReconciliacao`'s 4th parameter is required with no default — intentional compile-time tripwire (D-03/D-04)
- Caução filter chain always checks the literal `"caucao"` constant, never `evento.tipo`, to avoid silently reintroducing per-subtype filtering (D-02, Pitfall 3)
- `reconciliacao-pdf.ts` left untouched per D-08/D-09 — PDF redesign explicitly deferred to a future phase

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None. `node_modules` was not present in this worktree checkout and required `npm install` before `tsc`/`lint`/`build` could run — a one-time setup step, not a plan deviation.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- `/relatorios/imobiliaria` now has a fully wired type filter affecting list, totals, and PDF export
- `reconciliacao-pdf.ts` is unchanged and ready for a future PDF redesign phase (deferred idea, D-09) when the user brings a template
- **Non-blocking human-check to relay to the user after merge** (from 20-01-PLAN.md `<human-check>`): open "Filtrar" on `/relatorios/imobiliaria`, click each type chip (Administração, Comissão 1º aluguel, Caução) individually and in combination — confirm the list shows only matching rows, unchecked-type StatTiles show R$ 0,00 (never disappear from the grid), and "Total recebido" reflects only checked types. Confirm the "Caução" chip brings recebido/devolvido/usado together (never split by subtype). Click "Todos" and confirm everything reappears. Check the table: "Contrato" column shows ID+proprietário (no longer endereço), new "Inquilino" column right after, no address anywhere in the row. Finally, with an active type filter, click "Exportar PDF" and open the file — confirm the PDF list only has the filtered types, with the same layout as always (Data/Contrato/Tipo/Valor/Observação columns, Contrato still showing "#numero endereco" — the PDF does not change layout in this phase, D-08/D-09).

---
*Phase: 20-filtro-por-tipo-de-movimento-no-relat-rio-da-imobili-ria*
*Completed: 2026-08-28*

## Self-Check: PASSED

All 3 modified source files and the SUMMARY.md exist on disk; commit `ff38006` found in git history.
