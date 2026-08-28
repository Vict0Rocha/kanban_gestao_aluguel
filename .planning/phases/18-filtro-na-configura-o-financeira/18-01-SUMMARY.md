---
phase: 18-filtro-na-configura-o-financeira
plan: 01
subsystem: ui
tags: [react, nextjs, client-side-search, pagination]

# Dependency graph
requires:
  - phase: 15-exclus-o-de-card-com-destrava-e-pagina-o
    provides: "usePagination/Pagination hook and resetKey convention used by this filter"
provides:
  - "Live client-side search (SearchField) on /financeiro/configuracao filtering by número/endereço/proprietário"
  - "Local buildContratoMatcher/searchableText matcher for ContratoConfig, independent of search.ts's Card-typed matcher"
  - "usePagination resetKey composed from query state instead of a constant, resetting page on search change but not on router.refresh() from percentage/caução edits"
affects: []

# Actuals (#2632)
actuals:
  tokens: 1040
  tasks: 1
  commits: 1

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Local per-screen matcher (buildContratoMatcher/searchableText) mirroring search.ts's buildMatcher contract without importing it, for types that don't fit Card"
    - "resetKey composed from filter state (query), never from data-derived values (linhas/linhasFiltradas)"

key-files:
  created: []
  modified:
    - web/src/components/financeiro/configuracao-financeira-view.tsx

key-decisions:
  - "Matcher for ContratoConfig written locally in configuracao-financeira-view.tsx instead of extending search.ts's Card-typed buildMatcher (D-03)"
  - "resetKey changed from constant \"config\" to the query state itself, so filter changes reset pagination but unrelated router.refresh() calls (percentuais/caução dialogs) do not"

patterns-established:
  - "Per-screen bespoke search matcher pattern for types that don't extend Card (mirrors ContratoConfig's own bespoke-type precedent)"

requirements-completed: [FILTCFG-01, FILTCFG-02, FILTCFG-03, FILTCFG-04]

coverage:
  - id: D1
    description: "Live search field (SearchField) above the contract table filters by número/endereço/proprietário in real time, no submit button"
    requirement: "FILTCFG-01"
    verification:
      - kind: other
        ref: "grep assertions in 18-01-PLAN.md Task 1 <verify> (matcher functions, query state, SearchField import all present) + npm run build"
        status: pass
    human_judgment: true
    rationale: "Live filtering behavior in the browser (typing updates the table instantly, clearing restores full list) is only observable by interacting with the running app — grep/tsc/build confirm code shape, not rendered behavior."
  - id: D2
    description: "Changing the search term resets pagination to page 1; editing percentuais/caução (router.refresh()) on page 2+ does not reset the page"
    requirement: "FILTCFG-02"
    verification:
      - kind: other
        ref: "grep assertion confirming usePagination(linhasFiltradas, query) in 18-01-PLAN.md Task 1 <verify>"
        status: pass
    human_judgment: true
    rationale: "The resetKey surviving a real router.refresh() from ConfigurarPercentuaisDialog/CaucaoHistoricoSheet is only observable interactively (Pitfall 2/3, 15-RESEARCH.md/18-RESEARCH.md) — this is the plan's designated non-blocking human-check item."
  - id: D3
    description: "A search with no matches shows 'Nenhum contrato corresponde à busca.' instead of an empty-header table"
    requirement: "FILTCFG-03"
    verification:
      - kind: other
        ref: "grep assertion for the linhasFiltradas.length === 0 branch and its message text"
        status: pass
    human_judgment: false
  - id: D4
    description: "SearchField placeholder is explicit ('Buscar por número, endereço ou proprietário...'), never the default which mentions 'inquilino'"
    requirement: "FILTCFG-04"
    verification:
      - kind: other
        ref: "grep assertion for the explicit placeholder string"
        status: pass
    human_judgment: false

duration: 25min
completed: 2026-08-27
status: complete
---

# Phase 18 Plan 1: Filtro na Configuração financeira Summary

**Live client-side search field on /financeiro/configuracao filtering contracts by número/endereço/proprietário, reusing the existing SearchField component with a bespoke local matcher and a query-driven pagination resetKey.**

## Performance

- **Duration:** ~25 min
- **Completed:** 2026-08-27
- **Tasks:** 1
- **Files modified:** 1

## Accomplishments
- Added a live, client-side search (`SearchField`, reused as-is from the Board/Relatórios pattern) above the contract-configuration table, filtering by número, endereço, and proprietário with no submit button
- Wrote a local, ~15-line `buildContratoMatcher`/`searchableText` pair scoped to `ContratoConfig` — mirrors `search.ts`'s `buildMatcher` contract (AND multi-term, accent-insensitive) without importing or extending the `Card`-typed module (D-03)
- Recomposed `usePagination`'s `resetKey` from the constant `"config"` to the `query` state itself, so changing the search term resets to page 1 while `router.refresh()` from "Editar percentuais"/"Caução" dialogs never resets the user's page
- Added a third empty-state branch ("Nenhum contrato corresponde à busca.") distinct from the existing "Nenhum contrato cadastrado ainda." message

## Task Commits

1. **Task 1: Buscar contratos ao vivo — matcher, resetKey e SearchField ponta a ponta** - `4eee7ef` (feat)

**Plan metadata:** (this commit, `docs(18-01): complete...`, follows this SUMMARY)

## Files Created/Modified
- `web/src/components/financeiro/configuracao-financeira-view.tsx` - Added `searchableText`/`buildContratoMatcher` local matcher, `query`/`setQuery` state, `linhasFiltradas` memo, `SearchField` render inside the existing card, third empty-state branch, and `resetKey={query}` in place of the constant `"config"`

## Decisions Made
- Matcher for `ContratoConfig` kept entirely local to `configuracao-financeira-view.tsx`, never imported from or added to `web/src/lib/kanban/search.ts` — that module stays coherent around `Card`/`Column` (Board + Relatórios), per D-03 and the plan's explicit prohibition
- `resetKey` is exactly `query` (never `linhas`/`linhasFiltradas` or any data-derived value) — confirmed structurally via grep per Pitfall 2 of 18-RESEARCH.md

## Deviations from Plan

None - plan executed exactly as written. All six `<action>` steps were followed as specified; no Rule 1-4 deviations were needed.

## Issues Encountered

**Local build tooling:** This worktree had no `node_modules` (git worktrees don't share npm installs). Rather than running a full `npm install`, I linked/copied the main repo's `web/node_modules` into the worktree to run `npx tsc --noEmit`, `npm run lint`, and `npm run build`, then removed it afterward. A small number (13) of deeply-nested `@base-ui/react` files under the worktree's `node_modules` could not be deleted (`Acesso negado` / access denied — most likely OneDrive sync locking files mid-sync, since the whole repo lives under a OneDrive-synced folder). This is harmless: `node_modules` is gitignored (`web/.gitignore:4`), `git status --short` confirms only the intended source file is tracked as modified, and the main repo's original `node_modules` was verified intact (474 top-level entries) and untouched. No project files were affected.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

Phase 18 is a single-plan, zero-migration phase and is now functionally complete pending the plan's designated human-check (see below). No blockers for future phases — `search.ts` and `page.tsx` remain byte-for-byte unchanged, so no downstream phase's assumptions about those files are affected.

### Non-blocking human-check item (relay to user after merge)

Per `18-01-PLAN.md`'s `<human-check>`, the following should be verified interactively in the running app (not automatable by grep/tsc/build):

> Em `/financeiro/configuracao` (local ou produção), digitar um termo que bata com um contrato (número, endereço ou proprietário) e confirmar que a tabela filtra ao vivo; apagar o termo e confirmar que a lista completa volta. Em seguida, navegar para a página 2 (ou aplicar um termo que traga mais de 12 resultados e ir para a página 2), abrir "Editar percentuais" ou "Caução" de um contrato visível nessa página e salvar/registrar um evento — confirmar que a página permanece a mesma depois do `router.refresh()`. Por fim, digitar um termo sem nenhuma correspondência e conferir a mensagem "Nenhum contrato corresponde à busca."

Expected: busca filtra em tempo real sem round-trip visível; limpar restaura a lista completa; editar percentuais/caução na página 2+ NÃO volta o usuário para a página 1 (só mudar o termo de busca reseta); busca sem correspondência mostra a mensagem distinta, nunca uma tabela com cabeçalho vazio.

## Self-Check: PASSED

- FOUND: web/src/components/financeiro/configuracao-financeira-view.tsx
- FOUND: commit 4eee7ef

---
*Phase: 18-filtro-na-configura-o-financeira*
*Completed: 2026-08-27*
