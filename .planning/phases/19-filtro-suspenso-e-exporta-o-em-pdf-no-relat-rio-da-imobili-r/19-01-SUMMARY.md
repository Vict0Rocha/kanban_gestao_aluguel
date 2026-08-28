---
phase: 19-filtro-suspenso-e-exporta-o-em-pdf-no-relat-rio-da-imobili-r
plan: 01
subsystem: ui
tags: [react, nextjs, jspdf, jspdf-autotable, base-ui-collapsible, client-side-filter]

# Dependency graph
requires:
  - phase: 10-relat-rio-financeiro-dedicado
    provides: Collapsible + live-filter + Exportar PDF composition already shipped (relatorio-financeiro-dedicado.tsx, relatorio-financeiro-pdf.ts)
  - phase: 13-relatorio-de-reconciliacao-financeira-da-imobiliaria
    provides: buscarReconciliacaoAction, reconciliacao.ts types, dinheiro-imobiliaria-view.tsx base
  - phase: 15-paginacao
    provides: usePagination/resetKey pattern
  - phase: 18-configuracao-financeira
    provides: normalizeText as the current live-matcher convention
provides:
  - "5-field live filter panel (Imóvel/Proprietário/Inquilino/ID do contrato/Período) on /relatorios/imobiliaria, no submit button"
  - "buscarReconciliacaoAction now fetches cards.inquilino (previously unfetched)"
  - "PDF export (Exportar PDF) mirroring the Relatório Financeiro PDF structure for Dinheiro da imobiliária"
affects: [reports, relatorios/imobiliaria, financeiro]

# Actuals (#2632)
actuals:
  tokens: 7915
  tasks: 2
  commits: 2

tech-stack:
  added: []
  patterns:
    - "Collapsible suspenso shell + live (no-submit) filter body composition, now used a second time (dinheiro-imobiliaria-view.tsx, after relatorio-financeiro-dedicado.tsx)"
    - "normalizeText-based accent-insensitive text matcher for a third live filter (reconciliacao.ts, after relatorio-financeiro.ts/configuracao-financeira-view.tsx)"
    - "Exact-integer 'ID do contrato' matcher (Number.isInteger guard, never substring), mirrored client-side from financeiro/page.tsx's server-side precedent"

key-files:
  created:
    - web/src/components/reports/filtro-reconciliacao.tsx
    - web/src/components/reports/reconciliacao-pdf.ts
  modified:
    - web/src/lib/kanban/actions.ts
    - web/src/lib/kanban/reconciliacao.ts
    - web/src/components/reports/dinheiro-imobiliaria-view.tsx

key-decisions:
  - "Widened buscarReconciliacaoAction's two .select() calls to include cards.inquilino — additive, no migration, no auth/error-handling change (D-04)"
  - "Used normalizeText (accent-insensitive) over passaFiltroTexto (plain lowercase substring) for the 3 text fields — most recent codebase convention (Phase 18)"
  - "ID do contrato uses exact-integer comparison (Number.isInteger guard), never substring — mirrors financeiro/page.tsx's server-side precedent"
  - "resetKey composed as a plain pipe-joined string of the 5 filter fields only, never derived from taxas/caucaoEventos/linhas — avoids resetting pagination on unrelated data refreshes"
  - "On-screen empty-state message changed from 'Nenhuma taxa ou movimento de caução no período selecionado.' to '...encontrado para os filtros aplicados.' since results can now be filtered out by 5 fields, not just Período (see Deviations)"

patterns-established:
  - "Third live-matcher panel using the Collapsible-shell + no-submit-button composition (D-01, already proven in Phase 10) — this phase confirms the pattern generalizes to a second report screen without any new design work"

requirements-completed: [FILTIMOB-01, FILTIMOB-02, FILTIMOB-03, FILTIMOB-04, PDFIMOB-01, PDFIMOB-02]

coverage:
  - id: D1
    description: "Painel 'Filtrar' suspenso com 5 campos (Imóvel/Proprietário/Inquilino/ID do contrato/Período) filtra a lista e os StatTiles ao vivo, sem botão de submit"
    requirement: "FILTIMOB-01"
    verification:
      - kind: automated_ui
        ref: "grep verify chain, Task 1 <verify> (19-01-PLAN.md) — TASK1_TRACER_OK"
        status: pass
    human_judgment: true
    rationale: "Comportamento renderizado do filtro ao vivo (atualização em tempo real, interação) só é observável interagindo com a tela real — grep/tsc confirmam a forma do código, não o comportamento pós-interação. human_verify_mode: end-of-phase (config.json)."
  - id: D2
    description: "buscarReconciliacaoAction busca cards.inquilino nas duas consultas, tornando o campo Inquilino filtrável de verdade"
    requirement: "FILTIMOB-02"
    verification:
      - kind: unit
        ref: "grep -c 'cards(endereco, proprietario, numero, inquilino)' actions.ts == 2"
        status: pass
    human_judgment: false
  - id: D3
    description: "ID do contrato usa comparação exata de inteiro (Number.isInteger guard), nunca substring"
    requirement: "FILTIMOB-03"
    verification:
      - kind: unit
        ref: "passaFiltroIdReconciliacao in reconciliacao.ts — code inspection + tsc/lint/build pass"
        status: pass
    human_judgment: true
    rationale: "Comportamento de runtime (digitar '1' não deve casar com '#12'/'#120') só é confirmável interagindo com a tela real."
  - id: D4
    description: "Mudar qualquer um dos 5 campos do filtro reseta a paginação para a página 1; ações não relacionadas não resetam"
    requirement: "FILTIMOB-04"
    verification:
      - kind: unit
        ref: "resetKey composed from filtro.{imovel,proprietario,inquilino,id,periodo} only — dinheiro-imobiliaria-view.tsx"
        status: pass
    human_judgment: true
    rationale: "Reset de paginação após interação real (mudar filtro na página 2) só é observável em runtime."
  - id: D5
    description: "Botão 'Exportar PDF' gera um PDF com cabeçalho de 5 filtros, 6 totais e a lista completa na mesma ordem DESC da tela"
    requirement: "PDFIMOB-01"
    verification:
      - kind: automated_ui
        ref: "grep verify chain, Task 2 <verify> (19-01-PLAN.md) — TASK2_PDF_OK"
        status: pass
    human_judgment: true
    rationale: "Estrutura real do PDF gerado (layout, quebra de página, texto renderizado) só é verificável abrindo o arquivo."
  - id: D6
    description: "Botão 'Exportar PDF' mostra 'Exportando...' e fica desabilitado durante a geração"
    requirement: "PDFIMOB-02"
    verification:
      - kind: unit
        ref: "disabled={exportando} + {exportando ? \"Exportando...\" : \"Exportar PDF\"} — dinheiro-imobiliaria-view.tsx"
        status: pass
    human_judgment: true
    rationale: "Estado visual durante geração real do PDF só é confirmável em runtime."

duration: 25min
completed: 2026-08-28
status: complete
---

# Phase 19 Plan 01: Filtro suspenso e exportação em PDF no relatório da imobiliária Summary

**5-field live filter panel (Imóvel/Proprietário/Inquilino/ID do contrato/Período) plus a jsPDF/jspdf-autotable-based "Exportar PDF" export, both mirroring the already-shipped Relatório Financeiro composition, added to `/relatorios/imobiliaria`.**

## Performance

- **Duration:** ~25 min
- **Started:** 2026-08-28 (session start)
- **Completed:** 2026-08-28T08:30:41-04:00
- **Tasks:** 2
- **Files modified:** 5 (3 modified, 2 created)

## Accomplishments
- `buscarReconciliacaoAction` widened to fetch `cards.inquilino` in both `.select()` calls (taxas_imobiliaria, caucao_eventos) — additive, zero migration
- `reconciliacao.ts` gained `FiltroReconciliacaoValores`, `filtroReconciliacaoVazio`, `passaFiltroTextoReconciliacao` (accent-insensitive via `normalizeText`), `passaFiltroIdReconciliacao` (exact-integer match), `passaFiltroCardsReconciliacao`
- New `FiltroReconciliacao` component (5 live-updating fields, no submit button) mirroring `filtro-relatorio-financeiro-live.tsx`
- `DinheiroImobiliariaView` restructured with a `Collapsible`/`CollapsibleTrigger`/`CollapsiblePanel` shell (copied verbatim from `relatorio-financeiro-dedicado.tsx`), a composed `resetKey` of the 5 filter fields, and `LinhaLista.tipoLabel` (plain-string label for the PDF)
- New `reconciliacao-pdf.ts` module (`exportarReconciliacaoPDF`) mirroring `relatorio-financeiro-pdf.ts` block-for-block: same colors, same dynamic-import discipline, `doc.getNumberOfPages()` (not `.internal.`), `showHead: "everyPage"` (not `headerRows`)
- "Exportar PDF" button + `handleExportarPDF` + dismissible error alert wired next to the `CollapsibleTrigger`

## Task Commits

Each task was committed atomically:

1. **Task 1: Filtro suspenso ao vivo ponta a ponta** - `31bf9e1` (feat)
2. **Task 2: Exportar PDF ponta a ponta** - `85d057b` (feat)

_Note: no TDD tasks in this plan (tdd="false" on both)._

## Files Created/Modified
- `web/src/lib/kanban/actions.ts` - `buscarReconciliacaoAction`'s two `.select()` calls widened with `inquilino`
- `web/src/lib/kanban/reconciliacao.ts` - widened `cards` embed types + 5 new filter type/functions
- `web/src/components/reports/filtro-reconciliacao.tsx` - new, 5-field live filter body
- `web/src/components/reports/dinheiro-imobiliaria-view.tsx` - Collapsible shell, filtro/aberto/exportando/erroExportacao state, resetKey, tipoLabel, "Exportar PDF" button + error alert
- `web/src/components/reports/reconciliacao-pdf.ts` - new, PDF export module

## Decisions Made
- Used `normalizeText` (accent-insensitive) over the older `passaFiltroTexto` (plain substring) for the 3 text fields — matches the most recently shipped live-matcher convention (Phase 18)
- ID do contrato: exact-integer comparison (`Number.isInteger` guard), never substring — mirrors the existing server-side precedent (`financeiro/page.tsx`)
- `resetKey` is a plain pipe-joined string of the 5 raw filter field values, never derived from `taxas`/`caucaoEventos`/`linhas`

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Corrected the on-screen empty-state message to reflect the wider filter surface**
- **Found during:** Task 1 (restructuring `dinheiro-imobiliaria-view.tsx`)
- **Issue:** The original empty-state text ("Nenhuma taxa ou movimento de caução no período selecionado.") only ever mentioned "período" because Período was the only filter. With 5 filter fields now able to empty the list, that message would be misleading (e.g., a wrong "Inquilino" spelling emptying the list while the message still blames "período").
- **Fix:** Updated the message to "Nenhuma taxa ou movimento de caução encontrado para os filtros aplicados." — matches the equivalent PDF empty-state message (D-05/Task 2) and no longer references a single field.
- **Files modified:** `web/src/components/reports/dinheiro-imobiliaria-view.tsx`
- **Verification:** `npx tsc --noEmit` / `npm run lint` / `npm run build` all pass; text change has no type/behavior impact.
- **Committed in:** `31bf9e1` (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (1 bug/correctness)
**Impact on plan:** Cosmetic text correction only, no scope creep — keeps the two "no results" messages (on-screen and PDF) consistent with the 5-field filter surface this phase introduced.

## Issues Encountered
- The worktree had no `node_modules` installed (`web/`) at the start of this plan — ran `npm ci` before any verification could execute. Not a deviation from the plan's code (no plan file touched), just an environment setup step required to run `tsc`/`lint`/`build`.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- `/relatorios/imobiliaria` now has full filter/export parity with `/relatorios/financeiro` (Phase 10's Relatório Financeiro dedicado) — both reports share the same suspenso+live+PDF composition pattern.
- No blockers. Two non-blocking `<human-check>` items remain (documented in this plan's `<verify>` blocks, `human_verify_mode: end-of-phase` per config.json) — see final report to the user.

---
*Phase: 19-filtro-suspenso-e-exporta-o-em-pdf-no-relat-rio-da-imobili-r*
*Completed: 2026-08-28*

## Self-Check: PASSED

- FOUND: web/src/components/reports/filtro-reconciliacao.tsx
- FOUND: web/src/components/reports/reconciliacao-pdf.ts
- FOUND: commit 31bf9e1 (Task 1)
- FOUND: commit 85d057b (Task 2)
