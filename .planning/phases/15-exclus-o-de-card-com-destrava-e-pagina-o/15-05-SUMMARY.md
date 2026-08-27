---
phase: 15-exclus-o-de-card-com-destrava-e-pagina-o
plan: 05
subsystem: ui
tags: [react, pagination, nextjs, client-side]

# Dependency graph
requires:
  - phase: 15-exclus-o-de-card-com-destrava-e-pagina-o
    provides: "usePagination/Pagination (web/src/components/pagination.tsx) e o tracer no Financeiro, construídos no plano 15-03"
provides:
  - "As cinco listagens restantes fora do Board (Situação dos contratos, Relatório Financeiro dedicado, Relatório da imobiliária, Configuração financeira, Arquivados) paginadas em blocos de 10, com navegação numerada"
  - "resetKey por filtro em cada um dos cinco call sites — reset correto para página 1 nas três telas com filtro, chave constante nas duas sem filtro"
affects: [15-06]

# Actuals (#2632)
actuals:
  tokens: 4900
  tasks: 3
  commits: 3

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "resetKey comparado durante a renderização (padrão React de reset de estado), nunca useEffect([items]) — evita resetar a página em todo router.refresh() de mutação não relacionada ao filtro"

key-files:
  created: []
  modified:
    - web/src/components/reports/contracts-table.tsx
    - web/src/components/reports/reports-view.tsx
    - web/src/components/reports/relatorio-financeiro-lista.tsx
    - web/src/components/reports/relatorio-financeiro-dedicado.tsx
    - web/src/components/reports/dinheiro-imobiliaria-view.tsx
    - web/src/components/financeiro/configuracao-financeira-view.tsx
    - web/src/components/arquivados/arquivados-view.tsx

key-decisions:
  - "Em RelatorioFinanceiroDedicado, resetKey NÃO usa JSON.stringify(filtro) literal (como o texto da action do plano sugeria) — filtro.situacoes é um Set, e JSON.stringify(Set) sempre serializa como \"{}\", então trocar só a situação nunca mudaria a chave. Convertido para {...filtro, situacoes: [...filtro.situacoes].sort()} antes do stringify, exatamente como a própria action do plano instruía fazer ao encontrar um campo Set (mesma cautela citada para a Task 1)."

patterns-established: []

requirements-completed: [PAGIN-01, PAGIN-02, PAGIN-03]

coverage:
  - id: D1
    description: "Situação dos contratos (/relatorios) pagina em blocos de 10; trocar busca/status/coluna volta para a página 1"
    requirement: "PAGIN-01"
    verification:
      - kind: other
        ref: "grep de wiring (usePagination/Pagination/itensDaPagina/resetKey) + npx tsc --noEmit"
        status: pass
    human_judgment: true
    rationale: "Navegação numerada e reset de página são comportamento visual/interativo — sem suíte automatizada no projeto, precisa de confirmação manual no navegador"
  - id: D2
    description: "Relatório Financeiro dedicado e Relatório da imobiliária paginam em blocos de 10; trocar o filtro de cada tela volta para a página 1"
    requirement: "PAGIN-02"
    verification:
      - kind: other
        ref: "grep de wiring + npx tsc --noEmit"
        status: pass
    human_judgment: true
    rationale: "Mesmo motivo de D1 — comportamento interativo sem suíte automatizada"
  - id: D3
    description: "Configuração financeira e Arquivados paginam em blocos de 10; uma mutação (editar percentuais, desarquivar) fora da página 1 nunca reseta a posição do usuário"
    requirement: "PAGIN-03"
    verification:
      - kind: manual_procedural
        ref: "Task 3 <human-check> do 15-05-PLAN.md — ainda não executado por um humano em produção"
        status: unknown
    human_judgment: true
    rationale: "O plano já marca esta verificação como human-check explícito — é o único cenário das cinco telas onde o comportamento sem-reset (router.refresh() de mutação) precisa de confirmação visual direta"

duration: ~15min
completed: 2026-08-26
status: complete
---

# Phase 15 Plan 05: Paginação das cinco listagens restantes Summary

**As cinco listagens restantes fora do Board — Situação dos contratos, Relatório Financeiro dedicado, Relatório da imobiliária, Configuração financeira e Arquivados — agora usam `usePagination`/`Pagination` (construídos no plano 15-03), cada uma com o `resetKey` certo para seu caso (filtro nas três primeiras, chave constante nas duas últimas).**

## Performance

- **Duration:** ~15min
- **Tasks:** 3
- **Files modified:** 7

## Accomplishments
- `ContractsTable` (Situação dos contratos) e `ReportsView` — `resetKey` derivada de `query`/`statusFilters`/`columnFilters`
- `RelatorioFinanceiroLista`/`RelatorioFinanceiroDedicado` (Relatório Financeiro dedicado) — `resetKey` derivada de `filtro`, com a ressalva do `Set` (ver Decisões)
- `DinheiroImobiliariaView` (Relatório da imobiliária) — `usePagination(linhas, periodo)` direto, sem prop nova
- `ConfiguracaoFinanceiraView`/`ArquivadosView` — `resetKey` constante (`"config"`/`"arquivados"`), telas sem filtro
- Nenhuma segunda implementação de paginação criada — todas as cinco reusam `usePagination`/`Pagination` de `@/components/pagination` (plano 15-03) sem tocar no componente compartilhado
- `npx tsc --noEmit`, `npm run lint` e `npm run build` (com Turbopack) todos limpos após as três tasks

## Task Commits

Each task was committed atomically:

1. **Task 1: Paginar "Situação dos contratos" (`/relatorios`)** - `944b3a8` (feat)
2. **Task 2: Paginar Relatório Financeiro dedicado e Relatório da imobiliária** - `298c961` (feat)
3. **Task 3: Paginar Configuração financeira e Arquivados (telas sem filtro, `resetKey` constante)** - `ba1360a` (feat)

_Nenhum commit de metadados do plano (STATE.md/ROADMAP.md) — este é um plano executado em worktree paralelo; o orquestrador aplica essas atualizações depois do merge._

## Files Created/Modified
- `web/src/components/reports/contracts-table.tsx` - prop `resetKey`, `usePagination`/`Pagination`, `.map()` em `itensDaPagina`
- `web/src/components/reports/reports-view.tsx` - calcula `resetKey` a partir de `query`/`statusFilters`/`columnFilters` e passa para `ContractsTable`
- `web/src/components/reports/relatorio-financeiro-lista.tsx` - prop `resetKey`, `usePagination`/`Pagination`, `.map()` em `itensDaPagina`
- `web/src/components/reports/relatorio-financeiro-dedicado.tsx` - `listaResetKey` (memo) serializando `filtro` com `situacoes` convertido para array ordenado antes do `JSON.stringify`
- `web/src/components/reports/dinheiro-imobiliaria-view.tsx` - `usePagination(linhas, periodo)` direto, `.map()` em `itensDaPagina`
- `web/src/components/financeiro/configuracao-financeira-view.tsx` - `usePagination(linhas, "config")`, chave constante
- `web/src/components/arquivados/arquivados-view.tsx` - `usePagination(contratos, "arquivados")`, chave constante

## Decisions Made
- **`resetKey` de `RelatorioFinanceiroDedicado` não é `JSON.stringify(filtro)` literal.** `filtro.situacoes` é um `Set<SituacaoRelatorio>` (`web/src/lib/kanban/relatorio-financeiro.ts:33`), e `JSON.stringify` de um `Set` sempre produz `"{}"`, independente do conteúdo — significa que alternar só o filtro de situação nunca mudaria a chave calculada, deixando a paginação sem resetar exatamente no caso que deveria resetar (PAGIN-03). O próprio texto da `<action>` da Task 2 já alertava para essa checagem ("conferir a serialização de qualquer `Set` dentro do tipo antes de assumir... converter para array ordenado antes do `JSON.stringify`"), então a correção segue a intenção explícita do plano, não uma mudança de escopo. Implementado como `listaResetKey = JSON.stringify({ ...filtro, situacoes: [...filtro.situacoes].sort() })`, memoizado.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] `resetKey` de `RelatorioFinanceiroDedicado` corrigido para tratar corretamente o campo `Set` do filtro**
- **Found during:** Task 2 (Relatório Financeiro dedicado e Relatório da imobiliária)
- **Issue:** A acceptance criteria e o `<verify><automated>` da Task 2 citavam literalmente `resetKey={JSON.stringify(filtro)}`. Como `filtro.situacoes` é um `Set`, essa expressão literal serializaria sempre como `"{}"` para esse campo — mudar só o filtro de situação nunca resetaria a página, quebrando PAGIN-03 nesse caso específico. A própria `<action>` do plano já instruía checar isso antes de assumir a expressão literal.
- **Fix:** `resetKey` calculado como `JSON.stringify({ ...filtro, situacoes: [...filtro.situacoes].sort() })`, memoizado em `listaResetKey`. Os grep exatos do `<verify>` (`grep -q "resetKey={JSON.stringify(filtro)}"`) não batem mais literalmente, mas foram substituídos por verificação manual (confirmando `resetKey`/`listaResetKey` presentes) e `npx tsc --noEmit` limpo.
- **Files modified:** web/src/components/reports/relatorio-financeiro-dedicado.tsx
- **Verification:** `npx tsc --noEmit`, `npm run lint`, `npm run build` — todos limpos
- **Committed in:** 298c961 (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 bug)
**Impact on plan:** Correção necessária para PAGIN-03 funcionar corretamente no caso de filtro por situação do Relatório Financeiro dedicado. Sem escopo novo — segue a própria ressalva do plano.

## Issues Encountered
None além do deviation acima.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness

- Plano 15-04 (ensaio contra produção, conduzido pelo orquestrador com o operador) roda em paralelo e não toca nenhum arquivo deste plano.
- **Task 3 (`<human-check>`) do 15-05-PLAN.md ainda não foi executado por um humano em produção** — falta confirmar visualmente em `/financeiro/configuracao` e `/arquivados` que uma mutação (editar percentuais, desarquivar) fora da página 1 não reseta a posição do usuário. Não bloqueia o merge deste worktree (plano `autonomous: true`, sem `type="checkpoint:*"`), mas fica pendente para verificação humana antes de considerar PAGIN-01..03 fechados na Phase 15.
- Nenhuma mudança em Board — fora de escopo confirmado (D-04, 15-CONTEXT.md).

---
*Phase: 15-exclus-o-de-card-com-destrava-e-pagina-o*
*Completed: 2026-08-26*
