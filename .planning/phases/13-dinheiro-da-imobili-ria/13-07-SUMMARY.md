---
phase: 13-dinheiro-da-imobili-ria
plan: 07
subsystem: reports
tags: [nextjs, react, typescript, supabase, tailwind, server-actions]

# Dependency graph
requires:
  - phase: 13-dinheiro-da-imobili-ria (13-04)
    provides: "taxas_imobiliaria table + origemTaxa/percentualAplicavel + registro de taxa no pagamento"
  - phase: 13-dinheiro-da-imobili-ria (13-06)
    provides: "caucao_eventos table + saldoCaucao/statusCaucao + CaucaoEventoLabel + registrarEventoCaucaoAction"
provides:
  - "reconciliacao.ts: TaxaImobiliariaRelatorio/CaucaoEventoRelatorio types, passaFiltroPeriodoReconciliacao, calcularReconciliacao (pure aggregation)"
  - "buscarReconciliacaoAction (actions.ts): reads taxas_imobiliaria + caucao_eventos, no server-side period filter"
  - "route /relatorios/imobiliaria + DinheiroImobiliariaView: six stat tiles + descending-by-date unified list, live month filter"
  - "second entry button ('Dinheiro da imobiliária') alongside RELDED-01's 'Relatório financeiro' button, same visual weight"
affects: [13-dinheiro-da-imobili-ria (phase completion), reports, financeiro]

# Actuals (#2632)
actuals:
  tokens: 4090
  tasks: 1
  commits: 1

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "One-file-per-report aggregation module (reconciliacao.ts mirrors relatorio-financeiro.ts) — types/filter/aggregation scoped to a single report, never mixed into taxas.ts's multi-surface calc module"
    - "Unified list assembled client-side from two separate arrays (taxas + caucaoEventos), never merged server-side — mirrors the two real tables"

key-files:
  created:
    - web/src/lib/kanban/reconciliacao.ts
    - "web/src/app/(app)/relatorios/imobiliaria/page.tsx"
    - web/src/components/reports/dinheiro-imobiliaria-view.tsx
  modified:
    - web/src/lib/kanban/actions.ts
    - web/src/components/reports/filtro-relatorio-financeiro.tsx

key-decisions:
  - "totalRecebido = administracao + comissao + caucaoRecebida only — caucaoDevolvida/caucaoUsada deliberately excluded, commented explicitly in code per UI-SPEC §4 (devolvida is cash outflow, usada is not a bank movement)"
  - "List sort inverted relative to relatorio-financeiro-dedicado.tsx's ascending convention: comparator uses b.data before a.data for descending (most-recent-first), matching the 'just got the bank statement' reading pattern"
  - "No shared TaxaOrigemBadge component created — kept as a local map/component inside dinheiro-imobiliaria-view.tsx per A-03, since no other screen needs to label taxa by origem"

patterns-established:
  - "Reports with a single filter field skip the Filtrar/Fechar filtros collapsible toggle entirely (used by 3+ field filters elsewhere) — filter is always visible inline"

requirements-completed: [IMOB-05]

coverage:
  - id: D1
    description: "Route /relatorios/imobiliaria with six stat tiles (Administração, Comissão 1º aluguel, Total recebido no período, Caução recebida, Caução devolvida, Caução usada) and a descending-by-date unified event list, filtered live by month with no server round-trip"
    requirement: "IMOB-05"
    verification:
      - kind: other
        ref: "cd web && npm run lint && npm run build (exit 0, route /relatorios/imobiliaria listed in build output)"
        status: pass
      - kind: other
        ref: "grep assertions in 13-07-PLAN.md <acceptance_criteria> — all 11 confirmed (see Task Commits notes below)"
        status: pass
      - kind: manual_procedural
        ref: "Task 3 (checkpoint:human-verify) — operador confirmou em produção: os dois botões de entrada com mesmo peso visual, os cinco totais individuais batendo com a soma SQL do mês testado, 'Total recebido no período' excluindo devolvida/usada, filtro de período trocando sem chamada de rede nova, mês vazio zerando os seis tiles com a mensagem de lista vazia, e a lista em ordem descendente com o tipo certo em cada linha"
        status: pass
    human_judgment: true
    rationale: "Confirmado em produção pelo usuário — 'Fiz os testes e tudo rodou como o esperado.'"

# Metrics
duration: ~25min (Task 1) + verificação em produção
completed: 2026-08-25
status: complete
---

# Phase 13 Plan 07: Relatório de reconciliação (Dinheiro da imobiliária) Summary

**Complete: `/relatorios/imobiliaria` route with six stat tiles and a live-filtered, descending-by-date event list built from `taxas_imobiliaria` + `caucao_eventos`, confirmed against production data by the user ("Fiz os testes e tudo rodou como o esperado."). This closes IMOB-05 and Phase 13 in full.**

## Performance

- **Duration:** ~25 min (Task 1) + production verification
- **Completed:** 2026-08-25
- **Tasks:** 2/2
- **Files modified:** 5

## Accomplishments
- `web/src/lib/kanban/reconciliacao.ts`: pure aggregation module (mirrors `relatorio-financeiro.ts`) — `TaxaImobiliariaRelatorio`, `CaucaoEventoRelatorio`, `passaFiltroPeriodoReconciliacao`, `calcularReconciliacao`, with `totalRecebido` explicitly excluding `caucaoDevolvida`/`caucaoUsada`
- `buscarReconciliacaoAction` in `actions.ts`: reads both `taxas_imobiliaria` and `caucao_eventos` unfiltered (no period, no `arquivado_em`/`ativo` filter — mirrors D-05), filtering happens client-side
- New route `/relatorios/imobiliaria` + `DinheiroImobiliariaView`: six `StatTile`s in `grid gap-4 sm:grid-cols-2 lg:grid-cols-3`, unified descending-by-date list (taxas + caução events merged client-side per A-02), live month filter with no server round-trip
- Second entry button "Dinheiro da imobiliária" (icon `Landmark`) added next to the existing "Relatório financeiro" button in `filtro-relatorio-financeiro.tsx`, same visual weight

## Task Commits

Each task was committed atomically:

1. **Task 1: `reconciliacao.ts` + `buscarReconciliacaoAction` + rota + view + botão de entrada** - `cf6fa65` (feat)

Task 2 (checkpoint:human-verify, gate=blocking) — confirmado pelo usuário em produção, sem código adicional necessário.

## Files Created/Modified
- `web/src/lib/kanban/reconciliacao.ts` - Pure aggregation: types, period filter, `calcularReconciliacao` with the six totals
- `web/src/lib/kanban/actions.ts` - New `buscarReconciliacaoAction`, reads `taxas_imobiliaria` + `caucao_eventos`
- `web/src/app/(app)/relatorios/imobiliaria/page.tsx` - New Server Component route, mirrors `relatorios/financeiro/page.tsx`
- `web/src/components/reports/dinheiro-imobiliaria-view.tsx` - New client component: six tiles + live-filtered descending list
- `web/src/components/reports/filtro-relatorio-financeiro.tsx` - Added second entry button "Dinheiro da imobiliária"

## Decisions Made
- `totalRecebido` sums only administração + comissão + caucaoRecebida, with an explicit code comment (not just UI copy) stating why devolvida/usada are excluded — this is the plan's core correctness requirement (T-13-31 in the threat model) and was verified via the `<acceptance_criteria>` grep: `grep -A2 'totalRecebido:' reconciliacao.ts | grep -c 'caucaoDevolvida\|caucaoUsada'` returns 0
- List sort comparator is the ascending comparator from `relatorio-financeiro-dedicado.tsx` with `a`/`b` swapped (`b.data < a.data ? -1 : ...`), producing descending order — deliberate divergence documented inline
- No shared badge component for taxa-origin labeling (A-03) — kept as a local `TAXA_ORIGEM` map + `TaxaOrigemBadge` inside the view file, since only this screen needs it

## Deviations from Plan

None - plan's Task 1 executed exactly as written. Node dependencies (`node_modules`) were missing in this git worktree and had to be installed via `npm install` before lint/build could run — this is standard worktree setup, not a plan deviation (no plan files affected, `package-lock.json` was not modified since the existing lockfile was respected).

## Issues Encountered
- `node_modules` was absent in this worktree (fresh checkout via `git worktree`). Ran `npm install` (no `package.json`/`package-lock.json` changes) before `npm run lint`/`npm run build` — both then passed cleanly.
- `grep -c` on the acceptance-criteria checks that expect a **zero** count (e.g., the `totalRecebido` exclusion check, the no-PDF/no-Collapsible check) exits with a non-zero shell status even though it prints "0" correctly — this is standard `grep -c` behavior, not a defect. Verified each check individually rather than chaining with `&&`.

## Acceptance Criteria Verification (Task 1)

All 11 items from `<acceptance_criteria>` confirmed:

1. `cd web && npm run lint && npm run build` → both exit 0; build output lists `/relatorios/imobiliaria`
2. `test -f web/src/lib/kanban/reconciliacao.ts` → exists
3. `grep -c 'export function calcularReconciliacao' reconciliacao.ts` → `1`
4. `grep -c 'caucaoDevolvida\|caucaoUsada' reconciliacao.ts` → `10` (variables exist); `grep -A2 'totalRecebido:' reconciliacao.ts | grep -c 'caucaoDevolvida\|caucaoUsada'` → `0` (exclusion confirmed)
5. `grep -c 'export async function buscarReconciliacaoAction' actions.ts` → `1`
6. `test -f "web/src/app/(app)/relatorios/imobiliaria/page.tsx"` → exists
7. `test -f web/src/components/reports/dinheiro-imobiliaria-view.tsx` → exists
8. `grep -c 'exportarRelatorioFinanceiroPDF\|FileDown\|Collapsible' dinheiro-imobiliaria-view.tsx` → `0`
9. `grep -c 'sort' dinheiro-imobiliaria-view.tsx` → `1`; `grep -A1 '\.sort(' dinheiro-imobiliaria-view.tsx` shows `b.data < a.data ? -1 : b.data > a.data ? 1 : 0` (descending, `b.data` before `a.data`)
10. `grep -c 'Nenhuma taxa ou movimento de caução no período selecionado.' dinheiro-imobiliaria-view.tsx` → `1`
11. `grep -c '"/relatorios/imobiliaria"' filtro-relatorio-financeiro.tsx` → `1`
12. `grep -c 'Landmark' filtro-relatorio-financeiro.tsx` → `2` (import + usage)

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

**This plan is complete.** The user confirmed Task 2 in production: the two entry buttons in `/relatorios` have equal visual weight, the five individual totals matched the SQL Editor sums for the tested month, "Total recebido no período" correctly excluded devolvida/usada, switching to an empty month zeroed all six tiles (not hidden) with no network round-trip, and the list rendered newest-first with correct type badges.

IMOB-01 through IMOB-05 are now all delivered — this was the last plan in Phase 13. Next: full phase closure (ROADMAP.md/REQUIREMENTS.md/STATE.md marking Phase 13 complete with all 5 success criteria).

**Blocker:** None.

## Self-Check: PASSED

- FOUND: web/src/lib/kanban/reconciliacao.ts
- FOUND: web/src/app/(app)/relatorios/imobiliaria/page.tsx
- FOUND: web/src/components/reports/dinheiro-imobiliaria-view.tsx
- FOUND: .planning/phases/13-dinheiro-da-imobili-ria/13-07-SUMMARY.md
- FOUND commit: cf6fa65

---
*Phase: 13-dinheiro-da-imobili-ria*
*Completed: 2026-08-25*
