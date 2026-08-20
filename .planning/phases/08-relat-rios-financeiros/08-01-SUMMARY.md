---
phase: 08-relat-rios-financeiros
plan: 01
subsystem: ui
tags: [nextjs, react, supabase, server-component, client-state, financial-report]

# Dependency graph
requires:
  - phase: 05-financeiro-parcelas
    provides: "situacaoDaParcela, somarLancamentos, StatusParcela, LancamentoResumo (web/src/lib/kanban/parcelas.ts) — reused verbatim, never reimplemented"
  - phase: 06.2-ciclo-de-vida-do-contrato
    provides: "precedent for 'archived contract keeps its financial history' (D-01/D-05 of 06.2), cited by analogy for this phase's D-05"
provides:
  - "Relatório financeiro de 4 categorias (pagas, a vencer, vencidas, conciliadas) dentro de /relatorios, com contagem + total em dinheiro por categoria"
  - "calcularRelatorioFinanceiro (web/src/lib/kanban/relatorio-financeiro.ts) — agregação pura, reusa situacaoDaParcela/somarLancamentos"
  - "Query parcelas em relatorios/page.tsx deliberadamente sem filtro de arquivado/ativo (D-05) — contrato arquivado/inativo conta nos totais"
  - "Painel de filtro suspenso (imóvel, proprietário, período, situação) disparado só pelo clique em Gerar relatório (D-04)"
affects: [relatorios, financeiro-modulo-v2]

actuals:
  tokens: 4816
  tasks: 2
  commits: 2

tech-stack:
  added: []
  patterns:
    - "Client-side aggregation over a server-fetched dataset, gated by an explicit 'Gerar relatório' button rather than live onChange filtering (D-04) — the app's second filtering paradigm alongside the URL-driven live filters already used by /financeiro"
    - "Deliberate, commented exception to the Phase 6.2 visibility rule (arquivado_em/ativo filters) — documented inline at the exact point in the query so a future maintainer doesn't 'fix' it back in"

key-files:
  created:
    - web/src/lib/kanban/relatorio-financeiro.ts
    - web/src/components/reports/relatorio-financeiro.tsx
    - web/src/components/reports/filtro-relatorio-financeiro.tsx
  modified:
    - web/src/app/(app)/relatorios/page.tsx
    - web/src/components/reports/reports-view.tsx

key-decisions:
  - "D-05 (user, from 08-CONTEXT.md): archived/inactive contracts count toward the financial report's totals — the new parcelas query in relatorios/page.tsx deliberately omits .is(\"cards.arquivado_em\", null) and .eq(\"cards.ativo\", true), unlike the existing columns/cards query on the same page"
  - "D-04 (user): 'Gerar relatório' button is the sole trigger for recalculation — `aplicado` state only changes inside onGerar, never on a field's onChange"
  - "D-06/D-07 (planning discretion, informed by existing code): the 4 categories reuse situacaoDaParcela/somarLancamentos verbatim; pagas/conciliadas sum valorPago, a_vencer/vencida sum max(valorDevido-valorPago, 0)"
  - "D-08: period filter applies to competencia, not vencimento — consistent with the Financeiro tab's period semantics"
  - "Deviation (executor-discovered): the plan's automated verify used `grep -c '^-'` on `git diff --unified=0` output to count removed lines, but that pattern also matches the diff's own `--- a/file` header line, producing an off-by-one over-count (1 for Task 1, 3 for Task 2, expected 0 and 2 respectively). Verified the true content-removal count with `grep '^-' | grep -vc '^--- '`, which returned 0 for Task 1 and exactly 2 for Task 2 — matching the plan's actual intent (zero pre-existing lines removed, then only the two `export` additions in Task 2). No code change was needed; this is a verify-script artifact, not a defect in the implementation."

patterns-established:
  - "New report sections under /relatorios are added as sibling components inserted between the header block and the existing filter card, never modifying existing JSX — verified via git diff --unified=0 line-removal count"

requirements-completed: [FINREL-01, FINREL-02, FINREL-03, FINREL-04, FINREL-05]

coverage:
  - id: D1
    description: "Relatório financeiro mostra 4 categorias (pagas, a vencer, vencidas, conciliadas), cada uma com contagem de parcelas e total em dinheiro, calculadas por calcularRelatorioFinanceiro reusando situacaoDaParcela/somarLancamentos"
    requirement: "FINREL-01"
    verification:
      - kind: automated_ui
        ref: "grep assertions in 08-01-PLAN.md Task 1 <verify> (export function calcularRelatorioFinanceiro / situacaoDaParcela / somarLancamentos / D-06 / D-07 present in relatorio-financeiro.ts)"
        status: pass
    human_judgment: true
    rationale: "Numbers matching the real database (including archived/inactive contracts) require a human to compare the rendered tiles against a live SQL query in production — grep confirms the code path exists, not that the rendered totals are correct against real data."
  - id: D2
    description: "Contratos arquivados/inativos entram nos 4 totais — a query nova em relatorios/page.tsx não aplica .is(\"cards.arquivado_em\", null) nem .eq(\"cards.ativo\", true) (D-05)"
    requirement: "FINREL-02"
    verification:
      - kind: unit
        ref: "grep -A4 'from(\"parcelas\")' web/src/app/(app)/relatorios/page.tsx | grep -Ec 'arquivado_em|eq(\"ativo\"' == 0 (08-01-PLAN.md Task 1 <verify>)"
        status: pass
    human_judgment: false
  - id: D3
    description: "Botão 'Gerar relatório' é o único gatilho da consulta — nenhum campo/chip recalcula sozinho (D-04)"
    requirement: "FINREL-03"
    verification: []
    human_judgment: true
    rationale: "Requires live browser interaction (typing in a field, toggling a chip, observing the tiles do NOT change until the click) — not verifiable by static grep/build checks."
  - id: D4
    description: "Filtros por imóvel, proprietário, período e situação combinam em E lógico sem resetar um o outro (FINREL-05)"
    requirement: "FINREL-05"
    verification:
      - kind: unit
        ref: "grep assertions in 08-01-PLAN.md Task 2 <verify> (SITUACAO_OPTIONS with 4 entries, type=\"month\", temFiltroPreenchido, toggle(, onGerar(campos) all present in filtro-relatorio-financeiro.tsx)"
        status: pass
    human_judgment: true
    rationale: "Combining all four filters and confirming the intersection narrows results correctly requires real interaction and eyeballing the result — grep confirms the code exists, not the runtime combination logic."
  - id: D5
    description: "Parcela vencida calculada na leitura via vencimento < hojeEmCuiaba(), nunca gravada (FINREL, Pilares cruzados)"
    requirement: "FINREL-04"
    verification:
      - kind: unit
        ref: "situacaoDaParcela reused verbatim from parcelas.ts (no new date-comparison logic written) — grep -q 'situacaoDaParcela' relatorio-financeiro.ts, 08-01-PLAN.md Task 1 <verify>"
        status: pass
    human_judgment: false

duration: 15min
completed: 2026-08-20
status: complete
---

# Phase 8 Plan 1: Relatórios financeiros Summary

**Relatório financeiro de 4 categorias (pagas/a vencer/vencidas/conciliadas) com contagem + R$ dentro de `/relatorios`, incluindo contratos arquivados/inativos (D-05), atrás de um painel de filtro suspenso disparado só pelo clique em "Gerar relatório" (D-04)**

## Performance

- **Duration:** ~15 min
- **Tasks:** 2/2 completed
- **Files modified:** 5 (3 new, 2 modified)

## Accomplishments

- Nova query `parcelas` em `relatorios/page.tsx`, deliberadamente sem `.is("cards.arquivado_em", null)`/`.eq("cards.ativo", true)` (D-05) — contrato arquivado/inativo entra nos totais do relatório financeiro, ao contrário de tudo mais no app
- `calcularRelatorioFinanceiro` (novo módulo puro `relatorio-financeiro.ts`) reusa `situacaoDaParcela`/`somarLancamentos` de `parcelas.ts` verbatim — nenhuma reclassificação/re-soma reimplementada (D-06/D-07)
- `RelatorioFinanceiro`/`FiltroRelatorioFinanceiro` (componentes novos, `components/reports/`) encaixados em `reports-view.tsx` como adição estrita — `git diff --unified=0` confirma zero linhas pré-existentes removidas nesse arquivo na Task 1
- Painel de filtro suspenso completo: campos Imóvel/Proprietário/Período + chips de situação (Pagas/A vencer/Vencidas/Conciliadas), todos combináveis em E lógico, aplicados de uma vez só ao clicar "Gerar relatório" (D-04/FINREL-05) — "Limpar filtros" só aparece quando há algo preenchido
- `FilterChip`/`toggle` de `reports-view.tsx` exportados e reusados verbatim pelo novo painel (nenhuma reimplementação de chip multi-seleção)

## Task Commits

Each task was committed atomically:

1. **Task 1: Query sem filtro de arquivado/ativo, agregação das 4 categorias, "Gerar relatório" ponta a ponta** - `0c186eb` (feat)
2. **Task 2: Painel de filtro completo — imóvel, proprietário, período, chips de situação (FINREL-05)** - `b93d7c6` (feat)

_No TDD tasks in this plan — both tasks are `type="auto"`/`type="tracer"`, not `tdd="true"`._

## Files Created/Modified

- `web/src/lib/kanban/relatorio-financeiro.ts` - Tipos + `calcularRelatorioFinanceiro` (agregação pura das 4 categorias)
- `web/src/components/reports/relatorio-financeiro.tsx` - Orquestra estado `aplicado`, renderiza grade de 4 `StatTile` ou estados vazio/erro
- `web/src/components/reports/filtro-relatorio-financeiro.tsx` - Painel suspenso: campos + chips de situação + botão "Gerar relatório"/"Limpar filtros"
- `web/src/app/(app)/relatorios/page.tsx` - Nova query `parcelas` sem filtro de arquivado/ativo (D-05), passa `parcelas`/`erroRelatorioFinanceiro` para `ReportsView`
- `web/src/components/reports/reports-view.tsx` - Encaixe do bloco novo (Task 1); `FilterChip`/`toggle` exportados (Task 2, exatamente 2 linhas alteradas)

## Decisions Made

- Reused `situacaoDaParcela`/`somarLancamentos` from `parcelas.ts` verbatim for all 4-category classification and money totals (D-06/D-07) — no reimplementation
- The new `parcelas` query intentionally omits the Phase 6.2 archived/inactive filter (D-05), documented with an inline comment at the exact query call site referencing 08-CONTEXT.md, so a future maintainer doesn't "fix" it back in
- Period filter matches on `competencia`, not `vencimento` (D-08), consistent with the Financeiro tab
- Filter panel closed by default, with no URL-driven persistence (simplification vs. `FiltroParcelas`, documented in code as "Claude's Discretion" per 08-CONTEXT.md, since D-04 makes this a client-local session-state flow, not URL-driven)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Installed missing node_modules via `npm ci`**
- **Found during:** Task 1, running the automated `<verify>` block
- **Issue:** The worktree had no `node_modules` directory at all — `npm run lint`/`npm run build` failed immediately with "eslint not recognized"
- **Fix:** Ran `npm ci` in `web/` to install exactly what `package-lock.json` already specifies — not a new/unverified package, just restoring the existing locked dependency tree for this fresh worktree
- **Files modified:** none tracked (node_modules is gitignored)
- **Verification:** `npm run lint` and `npm run build` both succeeded afterward
- **Committed in:** n/a (gitignored, not committed)

**2. [Documented, not a code fix] Off-by-one in the plan's `git diff --unified=0 | grep -c '^-'` line-removal check**
- **Found during:** Task 1 and Task 2 `<verify>` execution
- **Issue:** `git diff --unified=0` always emits a `--- a/<file>` header line, which itself starts with `-` and is counted by a bare `grep -c '^-'`. This inflated the removed-line count by exactly 1 in both tasks (1 instead of 0 for Task 1, 3 instead of 2 for Task 2), even though zero pre-existing content lines were actually touched in Task 1 and exactly the two intended `export` additions were the only content change in Task 2.
- **Fix:** No code change — verified the plan's true intent using `git diff --unified=0 -- <file> | grep '^-' | grep -vc '^--- '`, which correctly returned `0` (Task 1) and `2` (Task 2), confirming `reports-view.tsx`'s pre-existing content is untouched beyond the two sanctioned `export` keyword additions.
- **Files modified:** none (verification methodology only)
- **Verification:** Manually inspected the diff output line-by-line to confirm the header-line explanation, then re-ran the corrected count
- **Committed in:** n/a

---

**Total deviations:** 2 (1 Rule 3 blocking-issue fix, 1 documented verify-script artifact with no code impact)
**Impact on plan:** No scope creep. Both are environment/verification-methodology issues, not defects in the shipped code — the D-05 query, the byte-for-byte `reports-view.tsx` preservation, and the exactly-2-line `export` diff in Task 2 all hold under the corrected, intent-accurate check.

## Issues Encountered

None beyond the two deviations documented above.

## User Setup Required

None - no external service configuration required. No database migration, no new environment variable, no Server Action.

## Manual Verification Required (relay to human operator)

This plan's automated `<verify>` (lint + build + grep/git-diff assertions) is complete and passing. Per the plan, actual browser/SQL-comparison behavior needs manual confirmation in production. Exact text from both tasks' `<human-check>` blocks:

### Task 1 human-check

**test:** Abrir `/relatorios` em produção sem nenhum contrato filtrado. Confirmar que o painel "Relatório financeiro" aparece fechado, logo abaixo do parágrafo "Uma visão geral da carteira...", acima do card de filtro de contrato já existente. Abrir o painel, clicar "Gerar relatório" sem preencher nada. Comparar os 4 números (contagem + R$) contra uma consulta no SQL Editor do Supabase: `select case when status in ('paga') then 'paga' when status = 'conciliada' then 'conciliada' when vencimento < '<hoje em Cuiabá>' then 'vencida' else 'a_vencer' end as situacao, count(*) from parcelas group by 1;` (mais a soma de `valor_pago`/`valor_devido - valor_pago` via lançamentos, ou conferir visualmente que a contagem bate). Confirmar que um contrato arquivado ou inativo (se houver algum em produção) está incluído nesses totais — não sumiu como sumiria no Financeiro.

**expected:** Os 4 tiles (Pagas/A vencer/Vencidas/Conciliadas) mostram contagem e "R$" reais, batendo com a consulta SQL, incluindo parcelas de contrato arquivado/inativo. Antes do clique, o texto "Ajuste os filtros acima e clique em Gerar relatório..." aparece no lugar da grade. O resto da página (h1, subtítulo, card de filtro de contrato, 4 StatTiles originais, gráfico, tabela) está pixel-idêntico ao que já estava em produção antes desta fase.

**why_human:** Números batendo com o banco e "nada mudou no resto da página" exigem olhar a tela e cruzar com uma consulta real — grep não confirma valor renderizado nem paridade visual.

### Task 2 human-check

**test:** Na mesma tela, abrir o painel "Relatório financeiro". Preencher Imóvel com um trecho de endereço real, Proprietário com um nome real, Período com um mês onde existam parcelas, e ativar dois chips de situação (ex.: "A vencer" + "Vencidas"). Alternar um chip e observar a tela ANTES de clicar em "Gerar relatório" — os tiles não devem mudar. Só então clicar "Gerar relatório" e conferir que o resultado é a interseção de todos os filtros (contagens menores ou iguais ao total sem filtro). Clicar "Limpar filtros" e confirmar que os três campos voltam a vazio, os chips voltam a "Todas" e o botão "Limpar filtros" some (só reaparece ao preencher algo de novo).

**expected:** Nenhum campo nem chip altera o resultado sozinho — só o clique em "Gerar relatório" recalcula (D-04). Os quatro filtros (imóvel, proprietário, período, situação) combinam em E lógico, sem que preencher um resete os outros (FINREL-05). "Limpar filtros" só aparece quando há algo preenchido e limpa os quatro campos de uma vez.

**why_human:** Confirmar que a tela não recalcula "ao vivo" e que os filtros combinam corretamente exige interação real no navegador — grep confirma que o código existe, não que o comportamento de clique único se sustenta.

## Next Phase Readiness

- This is the final phase of the Módulo Financeiro v2.0 milestone — no next phase is planned within this milestone
- The implementation is read-only (no writes to `parcelas`/`parcela_lancamentos`), so it carries no data-integrity risk pending human verification
- Blocker before merge to `main`: none from the executor's side — human review of the D-05 query and the `reports-view.tsx` diff (as requested), plus the two manual browser/SQL checks above, are the only remaining steps before deploy

---
*Phase: 08-relat-rios-financeiros*
*Completed: 2026-08-20*

## Self-Check: PASSED

All 6 created/modified files confirmed present on disk (`web/src/lib/kanban/relatorio-financeiro.ts`, `web/src/components/reports/relatorio-financeiro.tsx`, `web/src/components/reports/filtro-relatorio-financeiro.tsx`, `web/src/app/(app)/relatorios/page.tsx`, `web/src/components/reports/reports-view.tsx`, this SUMMARY.md). Both task commit hashes (`0c186eb`, `b93d7c6`) confirmed present in `git log --oneline --all`.
