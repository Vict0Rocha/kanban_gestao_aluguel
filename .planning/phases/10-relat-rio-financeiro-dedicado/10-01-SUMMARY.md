---
phase: 10-relat-rio-financeiro-dedicado
plan: 01
subsystem: ui
tags: [nextjs, react, server-components, in-memory-filter, financeiro, relatorios]

requires:
  - phase: 08-relat-rios-financeiros
    provides: calcularRelatorioFinanceiro, ParcelaRelatorio, FiltroRelatorioValores, filtroRelatorioVazio, buscarParcelasRelatorioAction, StatTile, FilterChip/toggle, ParcelaSituacaoBadge
provides:
  - Rota /relatorios/financeiro (Server Component) reusando buscarParcelasRelatorioAction verbatim
  - Filtro ao vivo (sem botão de submit) recalculando 4 tiles de categoria e uma lista de parcelas via useMemo
  - Lista de parcelas de 6 colunas (uma linha por parcela, D-03)
  - passaFiltroTexto/passaFiltroPeriodo exportados de relatorio-financeiro.ts; ParcelaRelatorio.id
  - className aditivo em FilterChip e ParcelaSituacaoBadge
  - Botão de entrada "Relatório financeiro" em /relatorios
affects: [10-02 (exportação em PDF, expande RelatorioFinanceiroDedicado sem reescrevê-lo)]

actuals:
  tokens: 5150
  tasks: 2
  commits: 2

tech-stack:
  added: []
  patterns:
    - "Fetch-once, filter-in-memory: Server Component busca parcelas uma única vez, cliente recalcula tudo via useMemo a cada mudança de filtro, sem novo round-trip ao servidor"
    - "Painel de filtro sem botão de submit — onChange escreve direto no estado do pai (filtro É o estado aplicado, D-01)"
    - "className aditivo mesclado por último via cn() em componentes já em produção, para não afetar call sites existentes"

key-files:
  created:
    - web/src/app/(app)/relatorios/financeiro/page.tsx
    - web/src/components/reports/relatorio-financeiro-dedicado.tsx
    - web/src/components/reports/filtro-relatorio-financeiro-live.tsx
    - web/src/components/reports/relatorio-financeiro-lista.tsx
  modified:
    - web/src/lib/kanban/relatorio-financeiro.ts
    - web/src/lib/kanban/actions.ts
    - web/src/components/reports/reports-view.tsx
    - web/src/components/financeiro/parcela-situacao-badge.tsx
    - web/src/components/reports/filtro-relatorio-financeiro.tsx

key-decisions:
  - "Wrapped the existing CollapsibleTrigger in a new sibling div instead of re-indenting it, so Task 2's diff has zero removed content lines (only the file's `--- a/...` diff header itself matches the plan's raw `^-` grep, a known git-diff artifact — not a real deletion)"

patterns-established:
  - "Live-filter-in-memory: parcelas fetched once server-side, all derived state (tiles + row-list) recomputed via useMemo on every keystroke — no debounce needed at current scale (~357 parcelas)"

requirements-completed: [RELDED-01, RELDED-02, RELDED-03]

coverage:
  - id: D1
    description: "Rota /relatorios/financeiro existe e carrega dados via buscarParcelasRelatorioAction() diretamente do Server Component, sem query duplicada"
    requirement: "RELDED-01"
    verification:
      - kind: other
        ref: "npm run lint && npm run build (web/) — exit 0; grep -c 'from(\"parcelas\")' page.tsx = 0"
        status: pass
    human_judgment: true
    rationale: "Confirmar que a rota carrega dado real batendo com o SQL Editor exige navegador — grep confirma a ausência de query duplicada, não o comportamento em produção"
  - id: D2
    description: "Filtro ao vivo (imóvel/proprietário/período/situação) recalcula os 4 tiles e a lista imediatamente, sem clique de aplicar"
    requirement: "RELDED-02"
    verification:
      - kind: other
        ref: "grep: FiltroRelatorioFinanceiroLive não contém 'Gerar relatório'; relatorio-financeiro-dedicado.tsx usa useMemo sobre filtro para categorias e linhasFiltradas"
        status: pass
    human_judgment: true
    rationale: "Confirmar que tiles e lista recalculam a cada tecla (não só ao montar) exige interação real no navegador"
  - id: D3
    description: "Lista abaixo dos tiles mostra uma linha por parcela (não por contrato), sempre em sincronia com o filtro"
    requirement: "RELDED-03"
    verification:
      - kind: other
        ref: "grep: RelatorioFinanceiroLista usa ParcelaSituacaoBadge, string vazia exata, className=gap-2"
        status: pass
    human_judgment: true
    rationale: "Confirmar que a lista e os tiles nunca discordam exige navegador + SQL Editor"
  - id: D4
    description: "Botão de entrada 'Relatório financeiro' em /relatorios navega para /relatorios/financeiro na mesma aba, sem remover nenhuma linha existente do painel de filtro da Phase 8"
    requirement: "RELDED-01"
    verification:
      - kind: other
        ref: "npm run lint && npm run build — exit 0; git diff --unified=0 do arquivo mostra apenas linhas + no conteúdo (12 insertions, 0 deletions no commit)"
        status: pass
    human_judgment: true
    rationale: "Confirmar clique real navegando na mesma aba, sem abrir nova aba/janela, exige navegador"

duration: ~25min
completed: 2026-08-21
status: complete
---

# Phase 10 Plan 01: Rota dedicada de Relatório Financeiro (filtro ao vivo + lista) Summary

**Nova rota `/relatorios/financeiro` com filtro dinâmico sem botão de submit, recalculando ao vivo os 4 tiles de categoria e uma lista de 6 colunas (uma linha por parcela), alcançada por um botão de entrada em `/relatorios`.**

## Performance

- **Duration:** ~25 min
- **Completed:** 2026-08-21
- **Tasks:** 2 (Task 1 tracer + Task 2 auto)
- **Files modified:** 9 (4 criados, 5 alterados)

## Accomplishments
- Rota nova `web/src/app/(app)/relatorios/financeiro/page.tsx` (Server Component) chama `buscarParcelasRelatorioAction()` diretamente, sem nenhuma query nova/duplicada
- `RelatorioFinanceiroDedicado` orquestra o filtro ao vivo (D-01): `filtro` É o estado aplicado, dois `useMemo` recalculam os 4 tiles (`calcularRelatorioFinanceiro`) e a lista filtrada (`passaFiltroTexto`/`passaFiltroPeriodo`/`situacaoDaParcela`) juntos, a cada `onChange`
- `FiltroRelatorioFinanceiroLive`: painel de filtro sem "Gerar relatório" — nenhum botão de submit em todo o arquivo
- `RelatorioFinanceiroLista`: tabela de 6 colunas (Imóvel/Proprietário/Competência/Vencimento/Situação/Valor), competência capitalizada por extenso ("Agosto de 2026"), valor seguindo a regra D-07 (pago vs. devido)
- Botão "Relatório financeiro" em `/relatorios`, navegando via `next/link` para a rota nova na mesma aba (D-05), sem remover nenhuma linha de conteúdo pré-existente do painel de filtro da Phase 8

## Task Commits

Each task was committed atomically:

1. **Task 1: Rota nova, filtro ao vivo, tiles + lista ponta a ponta** - `d62b58e` (feat)
2. **Task 2: Botão de entrada "Relatório financeiro" em /relatorios** - `f330d09` (feat)

_Nenhuma task TDD nesta plano — ambas `type="tracer"`/`type="auto"` com `tdd="false"`._

## Files Created/Modified
- `web/src/app/(app)/relatorios/financeiro/page.tsx` - Server Component novo, busca `parcelas`/`hojeISO` via `buscarParcelasRelatorioAction()`, branch explícito em `resultado.ok`
- `web/src/components/reports/relatorio-financeiro-dedicado.tsx` - orquestra estado `filtro`/`aberto`, dois `useMemo` (categorias + linhasFiltradas), `Collapsible` compartilhado entre trigger e painel
- `web/src/components/reports/filtro-relatorio-financeiro-live.tsx` - painel de filtro sem botão de submit, cada `onChange` escreve direto no estado do pai
- `web/src/components/reports/relatorio-financeiro-lista.tsx` - tabela de 6 colunas, uma linha por parcela, competência capitalizada
- `web/src/lib/kanban/relatorio-financeiro.ts` - `passaFiltroTexto`/`passaFiltroPeriodo` exportados; `ParcelaRelatorio.id: string` novo (aditivo, primeiro campo)
- `web/src/lib/kanban/actions.ts` - `buscarParcelasRelatorioAction` seleciona `id` também no `.select(...)`
- `web/src/components/reports/reports-view.tsx` - `FilterChip` ganha `className?: string` opcional, mesclado por último via `cn()`
- `web/src/components/financeiro/parcela-situacao-badge.tsx` - `ParcelaSituacaoBadge` ganha `className?: string`; variável local renomeada para `toneClassName` para evitar colisão
- `web/src/components/reports/filtro-relatorio-financeiro.tsx` - botão "Relatório financeiro" (ícone `ArrowUpRight`) na linha de cabeçalho, irmão do `CollapsibleTrigger` "Filtrar"

## Decisions Made
- Task 2's insertion wraps the existing `CollapsibleTrigger` in a new sibling `<div>` without re-indenting its original lines, so every existing line's text stays byte-identical — satisfies the plan's "puramente aditivo" intent even though the automated `git diff --unified=0 | grep -c '^-'` check has a structural quirk (see Deviations below).
- `situacaoDaParcela`'s return type (`Situacao`, a superset including `"parcial"`) is cast to `SituacaoRelatorio` in the row-list `useMemo`, mirroring the same cast `calcularRelatorioFinanceiro` already makes internally (D-06) — `"parcial"` is never actually produced by this phase's data.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] TypeScript build error: `situacaoDaParcela` return type not assignable to `SituacaoRelatorio`**
- **Found during:** Task 1 (`npm run build` type-check)
- **Issue:** `situacaoDaParcela` returns `Situacao` (5-value union including `"parcial"`), but `filtro.situacoes: Set<SituacaoRelatorio>` (4-value union) — `has()` call failed to type-check
- **Fix:** Cast the per-row result `as SituacaoRelatorio`, identical to the existing cast in `calcularRelatorioFinanceiro` (`relatorio-financeiro.ts:105-109`) — `"parcial"` is never produced by this phase's data (D-06)
- **Files modified:** `web/src/components/reports/relatorio-financeiro-dedicado.tsx`
- **Verification:** `npm run build` passes with exit 0 after the fix
- **Committed in:** `d62b58e` (Task 1 commit)

**2. [Rule 1 - Bug] Plan's automated verify for Task 2 (`git diff --unified=0 | grep -c '^-'` = 0) is structurally unsatisfiable for a diff on an existing (non-new) file**
- **Found during:** Task 2 verification
- **Issue:** `git diff` always emits a `--- a/<path>` file-header line for a modified (non-new) file, and that header line itself starts with `-`, matching the plan's raw `^-` grep pattern regardless of whether any real content line was removed. The literal check can therefore never equal 0 for a diff touching an already-tracked file, independent of code quality.
- **Fix:** No code change needed for the underlying goal — verified the actual acceptance criterion ("0 removed content lines") by inspecting the diff directly: every hunk line is a `+` addition; the sole `^-` match is the unavoidable `--- a/...` header artifact. Additionally restructured the edit itself (see Decisions above) to guarantee zero removed *content* lines regardless of this script quirk, and confirmed via `git commit` output: "1 file changed, 12 insertions(+)" — no deletions reported.
- **Files modified:** none (script limitation, not implementation)
- **Verification:** `git diff --unified=0` hunk inspection (manual, since the raw grep count is unreliable for this file type); `git commit` stat line confirms 0 deletions
- **Committed in:** `f330d09` (Task 2 commit)

---

**Total deviations:** 2 auto-fixed (1 bug — type cast; 1 bug — plan's own verify script has an unavoidable false-positive on modified files)
**Impact on plan:** Both fixes necessary for correctness/build-passing. No scope creep — neither changed the feature's behavior or the plan's design.

## Issues Encountered
- Worktree had no `node_modules` (git worktrees don't share `node_modules` with the main checkout) — ran `npm ci` in the worktree's `web/` directory before `lint`/`build` could execute. Not a plan deviation, just environment setup.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- `/relatorios/financeiro` is live end-to-end with real data (tiles + list, both recalculating live on every filter change), reached from a new button on `/relatorios`
- Plan 10-02 (PDF export, RELDED-04/05) can now expand `RelatorioFinanceiroDedicado`'s actions row with an "Exportar PDF" button and a new `relatorio-financeiro-pdf.ts` builder, consuming the same `categorias`/`linhasFiltradas` this plan already computes — no rework needed here
- Human verification of the live-filter behavior and the entry-point button (both `<human-check>` blocks in 10-01-PLAN.md) is deferred to end-of-phase per `config.json`'s `human_verify_mode: "end-of-phase"` — not performed by this worktree executor

## Self-Check: PASSED

All 9 files touched by this plan plus this SUMMARY.md were confirmed present on disk, and both task commits (`d62b58e`, `f330d09`) were confirmed present in `git log --oneline --all`. No missing items.

---
*Phase: 10-relat-rio-financeiro-dedicado*
*Completed: 2026-08-21*
