---
phase: 17-exclus-o-de-coluna-sem-cascade-para-cards-ativos
plan: 01
subsystem: kanban
tags: [nextjs, server-actions, supabase-js, react, ui]

# Dependency graph
requires:
  - phase: 16-reordenar-e-arquivar-em-massa
    provides: "GAP/handleReordenar position formula, columns={columns} pattern precedent"
provides:
  - "excluirColunaComMovimentoAction — combined move-then-delete Server Action, never trusts client cardIds"
  - "excluirColunaComMovimento client wrapper (queries.ts)"
  - "ExcluirColunaDialog — three-branch column-delete dialog (empty / blocked / picker)"
  - "deleteColumnAction hardened with a non-empty-column server-side precheck"
affects: [kanban, columns, cascade-safety]

# Actuals (#2632)
actuals:
  tokens: 7268
  tasks: 3
  commits: 3

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Combined move-then-delete Server Action re-queries both sides (board_id, current cards) at write time instead of accepting client-supplied ids — same discipline as podarParcelasOrfas"
    - "Three-branch dialog component (empty/blocked/picker) resolved synchronously from already-known client state, no async pre-flight"

key-files:
  created:
    - web/src/components/kanban/excluir-coluna-dialog.tsx
  modified:
    - web/src/lib/kanban/actions.ts
    - web/src/lib/kanban/queries.ts
    - web/src/components/kanban/column.tsx
    - web/src/components/kanban/board.tsx
    - docs/data-model.md

key-decisions:
  - "Combined Server Action (move + delete in one server call), not two client round-trips — closes the raw-endpoint bypass risk that two separate calls would leave open (17-RESEARCH.md Finding 2)"
  - "deleteColumnAction hardened with its own non-empty-column precheck (Task 2) beyond CONTEXT.md's explicit discretion, because EXCOL-04's guarantee must hold at the server boundary, not just by UI convention"
  - "Zero database migration — on delete cascade stays as a safety net; the app now guarantees the column is empty before delete runs"

patterns-established:
  - "Column-delete dialog (three branches) as the template for future confirm-with-side-effect dialogs where the branch decision is already known client-side"

requirements-completed: [EXCOL-01, EXCOL-02, EXCOL-03, EXCOL-04]

coverage:
  - id: D1
    description: "Excluir uma coluna vazia continua idêntico a hoje — confirmação simples, sem seletor"
    requirement: "EXCOL-01"
    verification:
      - kind: unit
        ref: "grep: ExcluirColunaDialog vazia branch unchanged AlertDialog text"
        status: pass
    human_judgment: true
    rationale: "Visual/UX confirmation of the unchanged branch requires a human looking at the rendered dialog — grep proves code shape, not rendered behavior (plan's own human-check)"
  - id: D2
    description: "Excluir uma coluna com cards abre seletor de destino; confirmar move todos os cards e exclui a coluna numa única ação"
    requirement: "EXCOL-02"
    verification:
      - kind: unit
        ref: "npx tsc --noEmit / npm run lint — structural verify of excluirColunaComMovimentoAction, ExcluirColunaDialog picker branch, handleDeleteColumnComMovimento"
        status: pass
    human_judgment: true
    rationale: "Multi-branch dialog UI flow and optimistic write — plan's own human-check explicitly requires visual confirmation on Board"
  - id: D3
    description: "Coluna única do board com cards bloqueia a exclusão com 'Crie outra coluna antes de excluir esta.'"
    requirement: "EXCOL-03"
    verification:
      - kind: unit
        ref: "grep: 'Crie outra coluna antes de excluir esta' in excluir-coluna-dialog.tsx"
        status: pass
    human_judgment: true
    rationale: "Blocked-state rendering needs visual confirmation per plan's human-check"
  - id: D4
    description: "Nenhum card ativo é apagado em cascata — reforçado por reconsulta server-side e por precheck em deleteColumnAction"
    requirement: "EXCOL-04"
    verification:
      - kind: unit
        ref: "npx tsc --noEmit / npm run lint / npm run build — all pass; precheck query confirmed via grep"
        status: pass
    human_judgment: true
    rationale: "Regression against the real database trigger (card with a genuine lançamento) requires a live financial entry — plan's Task 3 human-check, not reproducible by grep/tsc"

# Metrics
duration: 20min
completed: 2026-08-27
status: complete
---

# Phase 17 Plan 1: Excluir coluna sem cascade para cards ativos Summary

**Column deletion now moves active cards to a chosen destination before deleting the column — combined server action re-queries board_id and cards at write time, plus a server-side precheck hardens `deleteColumnAction` against non-empty columns — zero database migration.**

## Performance

- **Duration:** ~20 min
- **Started:** 2026-08-27T16:35:00-04:00 (approx)
- **Completed:** 2026-08-27T16:44:07-04:00
- **Tasks:** 3
- **Files modified:** 6 (1 created, 5 modified)

## Accomplishments
- New combined Server Action `excluirColunaComMovimentoAction(columnId, destinoColumnId)` moves all of a column's cards to a chosen destination and deletes the column in one server call, re-querying both columns' `board_id` and the origin column's current cards at write time — never trusts a client-supplied card list.
- New `ExcluirColunaDialog` component with three branches: empty column (unchanged simple confirm), no destination available (blocked with clear message), and a column picker (mirrors `ReordenarDialog`'s visual pattern) that moves-then-deletes in a single fire-and-forget action.
- `deleteColumnAction` hardened with a non-empty-column precheck — closes the raw-endpoint bypass risk so EXCOL-04's guarantee holds at the server boundary, not just by UI convention.
- `docs/data-model.md` updated to document the new decision and cross-reference the now-partially-stale trigger bullet.

## Task Commits

Each task was committed atomically:

1. **Task 1: Excluir coluna com cards, movendo-os para outra coluna — ponta a ponta** (tracer) - `4a8dde8` (feat)
2. **Task 2: Travar `deleteColumnAction` contra coluna não vazia — hardening server-side (EXCOL-04)** - `73d2367` (fix)
3. **Task 3: Documentar em `docs/data-model.md` e verificação final ponta a ponta da fase** - `2082365` (docs)

_Note: no TDD tasks in this plan (`tdd="false"` on all three)._

## Files Created/Modified
- `web/src/lib/kanban/actions.ts` - `excluirColunaComMovimentoAction` (new, combined move+delete) and `deleteColumnAction` (hardened with precheck)
- `web/src/lib/kanban/queries.ts` - `excluirColunaComMovimento` thin client wrapper
- `web/src/components/kanban/excluir-coluna-dialog.tsx` - new `ExcluirColunaDialog` component, three branches
- `web/src/components/kanban/column.tsx` - wired `ExcluirColunaDialog`, added `columns`/`onDeleteColumnComMovimento` props, removed orphaned `Trash2`/`Button`/`AlertDialog*` imports
- `web/src/components/kanban/board.tsx` - added `handleDeleteColumnComMovimento`, passed `columns={columns}` to `<Column>` for the first time
- `docs/data-model.md` - new "Coluna sempre vazia antes de excluir" bullet + cross-reference note on the trigger bullet

## Decisions Made
- Combined Server Action instead of two client round-trips (D-01/D-03, `17-CONTEXT.md`; resolved in `17-RESEARCH.md` Finding 2 for a security reason, not just simplicity) — a two-call sequence would leave `deleteColumnAction` independently reachable against a non-empty column.
- Server-side re-query of cards/board_id, never a client-supplied `cardIds` array — mirrors `podarParcelasOrfas`'s discipline.
- `deleteColumnAction` precheck included in this same plan (17-RESEARCH.md Finding 4/Open Question 1) rather than deferred, since it's a few lines inside a function already being touched for the stale-comment removal.

## Deviations from Plan

None - plan executed exactly as written. The plan's own recommended code samples (17-RESEARCH.md) were followed near-verbatim per the plan's `<action>` instructions.

## Issues Encountered

The sandboxed Bash tool refused long `cd ... && ... && ...` chained commands inside this worktree (safety guard against complex commands that can't be verified to stay inside the worktree). Verification was split into individual `Grep` tool calls (one per grep assertion) plus separate single-command `Bash` calls for `npx tsc --noEmit` / `npm run lint` / `npm run build`, all from the worktree's `web/` directory. All checks passed; no functional impact on the plan's `<verify>` intent, only the mechanics of running it.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

EXCOL-01..04 closed at the code level. Three items remain for human verification after merge (plan's own non-blocking `<human-check>` notes, not automatable):

1. **Task 1 human-check** — On the Board: delete an empty column (should behave exactly as before, EXCOL-01); delete a column with 2-3 cards and pick a destination in the picker (should move+delete in one action, EXCOL-02); on a test board with a single column containing cards, attempt to delete it (should block with "Crie outra coluna antes de excluir esta.", EXCOL-03).
2. **Task 3 human-check (negative regression)** — Create a card with a real financial lançamento (pagamento/acréscimo/desconto/taxa/caução) and attempt to delete its column (with another column available as destination) — deletion should still be blocked by the `cards_impede_exclusao_com_lancamento` trigger, unchanged by this phase.

No blockers. No database migration was created (D-03 held) — confirmed no new files in `supabase/migrations/`.

---
*Phase: 17-exclus-o-de-coluna-sem-cascade-para-cards-ativos*
*Completed: 2026-08-27*

## Self-Check: PASSED

- FOUND: `web/src/components/kanban/excluir-coluna-dialog.tsx`
- FOUND: commit `4a8dde8` (Task 1)
- FOUND: commit `73d2367` (Task 2)
- FOUND: commit `2082365` (Task 3)
