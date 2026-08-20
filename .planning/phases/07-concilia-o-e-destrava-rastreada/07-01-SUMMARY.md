---
phase: 07-concilia-o-e-destrava-rastreada
plan: 01
subsystem: financeiro
tags: [server-actions, supabase, nextjs, row-level-lock, financeiro]

# Dependency graph
requires:
  - phase: 06-baixa-e-ajustes-de-parcela
    provides: registrarPagamentoAction/ajustarParcelaAction, exigirParcelaVisivel, o padrão AcoesCell/ParcelasTable
  - phase: 06.2-ciclo-de-vida-do-contrato
    provides: exigirParcelaVisivel como trava real de escrita (D-15), padrão de toast fixo (write-error-toast.tsx)
provides:
  - conciliarParcelaAction — UPDATE condicionado a status='paga', grava conciliada_em/conciliada_by da sessão
  - conciliarParcela (bridge em queries.ts)
  - ConciliarFalhaToast — cópia de WriteErrorToast com subtexto próprio
  - Botão Conciliar em AcoesCell (linha paga), sem diálogo
  - exigirParcelaNaoConciliada — trava adicional de escrita sobre parcela conciliada, chamada por registrarPagamentoAction/ajustarParcelaAction
affects: [07-02-destravar-parcela, relatorios-financeiros]

# Actuals (#2632)
actuals:
  tokens: 48
  tasks: 2
  commits: 2

tech-stack:
  added: []
  patterns:
    - "UPDATE condicionado (.eq(status, valor-esperado)) como trava de corrida real, sem read-then-write"
    - "Trava de escrita em camadas: exigirParcelaVisivel (Phase 6.2) + exigirParcelaNaoConciliada (Phase 7), ambas obrigatórias, nenhuma substitui a outra"
    - "Toast de falha por cópia-e-renomeação (não import/reexport) quando o subtexto precisa divergir por semântica (otimista vs. não-otimista)"

key-files:
  created:
    - web/src/components/financeiro/conciliar-falha-toast.tsx
  modified:
    - web/src/lib/kanban/actions.ts
    - web/src/lib/kanban/queries.ts
    - web/src/components/financeiro/parcelas-table.tsx

key-decisions:
  - "conciliarParcelaAction não chama exigirParcelaVisivel (D-09) — documentado em comentário no código para não ser 'consertado' por engano no futuro"
  - "exigirParcelaNaoConciliada roda DEPOIS de exigirParcelaVisivel nas duas actions, nunca reaproveita a mesma consulta — mantém as duas travas independentes e auditáveis"
  - "Erro genérico de leitura em exigirParcelaNaoConciliada reaproveita MENSAGEM_PARCELA_OCULTA.indeterminado (já existente) em vez de criar frase nova para um caso de borda raro"

patterns-established:
  - "Segunda trava de escrita camada sobre a primeira: mesmo ponto de chamada (logo após validação de campos, antes do insert), sem fundir as duas consultas"

requirements-completed: [CONCIL-01, CONCIL-02]

coverage:
  - id: D1
    description: "conciliarParcelaAction grava status='conciliada'/conciliada_em/conciliada_by num único UPDATE condicionado a status='paga'; conciliada_by/conciliada_em vêm exclusivamente da sessão do servidor"
    requirement: "CONCIL-01"
    verification:
      - kind: other
        ref: "grep assertions in 07-01-PLAN.md Task 1 <verify> — export async function conciliarParcelaAction, eq(status, paga), conciliada_by: sessao.user.id"
        status: pass
    human_judgment: true
    rationale: "Grep confirms the source shape, but the actual click-to-badge-change flow and the two-tab race producing the new toast require a human in a real browser session against production data — not exercisable from this sandbox."
  - id: D2
    description: "Botão Conciliar em AcoesCell só renderiza quando linha.situacao === 'paga', chama a Server Action direto sem diálogo, e o toast de falha é único por tabela"
    requirement: "CONCIL-01"
    verification:
      - kind: other
        ref: "grep assertions in 07-01-PLAN.md Task 1 <verify> — situacao === \"paga\", ConciliarFalhaToast rendered once in ParcelasTable"
        status: pass
    human_judgment: true
    rationale: "Visual behavior (label swap to Conciliando..., disabled state, router.refresh, badge update) needs a human click in the browser."
  - id: D3
    description: "registrarPagamentoAction e ajustarParcelaAction recusam escrita sobre parcela conciliada com a frase exata da UI-SPEC, camada adicional sobre exigirParcelaVisivel"
    requirement: "CONCIL-02"
    verification:
      - kind: other
        ref: "grep assertions in 07-01-PLAN.md Task 2 <verify> — exigirParcelaNaoConciliada count=3, MENSAGEM_PARCELA_CONCILIADA verbatim, exigirParcelaVisivel unchanged"
        status: pass
    human_judgment: true
    rationale: "Confirms the source-level guard structure; whether the message actually renders in the dialog's inline error slot in the browser needs a human click."

# Metrics
duration: ~10min
completed: 2026-08-20
status: complete
---

# Phase 7 Plan 1: Conciliar uma parcela paga, ponta a ponta, e travar escrita sobre parcela conciliada Summary

**`conciliarParcelaAction` (UPDATE condicionado a `status='paga'`) ligada ao botão Conciliar em `parcelas-table.tsx`, mais `exigirParcelaNaoConciliada` como segunda trava de servidor sobre `registrarPagamentoAction`/`ajustarParcelaAction`**

## Performance

- **Duration:** ~10 min
- **Started:** 2026-08-19T22:01:39-04:00 (plan commit)
- **Completed:** 2026-08-19T22:10:34-04:00 (Task 2 commit)
- **Tasks:** 2/2
- **Files modified:** 4 (1 created, 3 modified)

## Accomplishments
- Uma parcela `paga` ganhou o botão "Conciliar" (ghost, ícone `Lock`, entre Ajustar e Histórico), um único clique sem diálogo, chamando `conciliarParcelaAction` que grava `status`, `conciliada_em`, `conciliada_by` num único UPDATE condicionado a `status='paga'` — essa condição é a trava real de corrida (D-01), não uma checagem prévia.
- `conciliada_em`/`conciliada_by` vêm exclusivamente de `new Date().toISOString()`/`sessao.user.id` no servidor, nunca de parâmetro do cliente.
- Novo componente `ConciliarFalhaToast`, cópia visual exata de `WriteErrorToast` com subtexto próprio ("Tente novamente.") porque Conciliar não é otimista.
- `registrarPagamentoAction` e `ajustarParcelaAction` agora chamam `exigirParcelaNaoConciliada` logo depois de `exigirParcelaVisivel` (Phase 6.2) — camada adicional, não substituição — recusando qualquer escrita sobre uma parcela `conciliada` com a frase exata da UI-SPEC.

## Task Commits

Each task was committed atomically:

1. **Task 1: Conciliar uma parcela paga — um clique, ponta a ponta** - `0a9584f` (feat)
2. **Task 2: Trava de escrita para parcela conciliada — servidor, não só a tela** - `26fa42e` (feat)

_Both automated `<verify>` blocks (lint + build + grep assertions) passed for each task before commit. This plan has no separate plan-metadata commit — final metadata step below handles STATE/ROADMAP/REQUIREMENTS._

## Files Created/Modified
- `web/src/components/financeiro/conciliar-falha-toast.tsx` - Novo. `ConciliarFalhaToast`, cópia de `write-error-toast.tsx` com subtexto "Tente novamente."
- `web/src/lib/kanban/actions.ts` - `conciliarParcelaAction` (Task 1); `MENSAGEM_PARCELA_CONCILIADA` + `exigirParcelaNaoConciliada` + chamadas em `registrarPagamentoAction`/`ajustarParcelaAction` (Task 2)
- `web/src/lib/kanban/queries.ts` - `conciliarParcela` bridge, import de `conciliarParcelaAction`
- `web/src/components/financeiro/parcelas-table.tsx` - Estado `conciliarErro` elevado em `ParcelasTable`, botão Conciliar condicional em `AcoesCell`, `ConciliarFalhaToast` renderizado uma vez por tabela

## Decisions Made
- `conciliarParcelaAction` deliberadamente não chama `exigirParcelaVisivel` (D-09) — comentário no código explica por quê, para que uma leitura futura não "conserte" adicionando a chamada por engano.
- `exigirParcelaNaoConciliada` reaproveita `MENSAGEM_PARCELA_OCULTA.indeterminado` (já existente) para o caso de borda de erro/linha ausente, em vez de criar uma frase nova só para esse caminho raro.
- A trava nova roda sempre DEPOIS de `exigirParcelaVisivel`, numa consulta separada — nunca funde as duas checagens numa query só, mantendo as duas travas auditáveis e independentes (documentado em comentário no ponto de chamada de ambas as actions).

## Deviations from Plan

None - plan executed exactly as written. (Um erro de edição durante a execução inseriu `conciliarParcelaAction` duas vezes no arquivo por causa de um `replace_all` genérico atingir dois pontos idênticos do arquivo — corrigido antes do commit, removendo a duplicata; o arquivo final tem exatamente uma definição, confirmado por grep antes de commitar. Não é uma mudança de escopo, é uma correção de processo de edição, sem impacto no código commitado.)

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required. Nenhuma migração de banco foi necessária (schema já vivo desde a Phase 4).

## Next Phase Readiness
- `conciliarParcelaAction`/`conciliarParcela` e a trava `exigirParcelaNaoConciliada` estão prontos para o plano 07-02 (Destravar), que devolve `status` para `'paga'` e depende desta trava já existir.
- **Human-check pendente (não bloqueante para este plano, ver abaixo):** os dois blocos `<human-check>` do plano precisam de confirmação visual manual em produção, depois do merge/deploy. Texto verbatim reproduzido no relatório final para consolidação com os itens de human-check do plano 07-02.

---
*Phase: 07-concilia-o-e-destrava-rastreada*
*Completed: 2026-08-20*

## Self-Check: PASSED

- FOUND: web/src/components/financeiro/conciliar-falha-toast.tsx
- FOUND: .planning/phases/07-concilia-o-e-destrava-rastreada/07-01-SUMMARY.md
- FOUND commit: 0a9584f
- FOUND commit: 26fa42e
