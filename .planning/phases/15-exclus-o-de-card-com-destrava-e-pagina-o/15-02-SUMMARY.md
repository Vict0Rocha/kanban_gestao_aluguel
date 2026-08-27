---
phase: 15-exclus-o-de-card-com-destrava-e-pagina-o
plan: 02
subsystem: payments
tags: [supabase, server-actions, nextjs, kanban-financeiro]

# Dependency graph
requires:
  - phase: 12-cancelamento-de-ajustes
    provides: "cancelarLancamentoAction (então cancelarPagamentoAction) e o botão Cancelar em ParcelaHistoricoSheet, generalizados para pagamento/acrescimo/desconto"
provides:
  - "cancelarLancamentoAction aceita tipo='destrava' no .in() do DELETE sobre parcela_lancamentos"
  - "Botão 'Cancelar' em ParcelaHistoricoSheet aparece também para lançamentos tipo='destrava'"
  - "docs/data-model.md corrigido: destrava não fica mais descrito como excluído para sempre do mecanismo de cancelamento"
affects: [15-06-checkpoint-migracao, financeiro, cancelamento]

actuals:
  tokens: 3125
  tasks: 2
  commits: 2

tech-stack:
  added: []
  patterns:
    - "Widen mecânico de allowlist .in(\"tipo\", [...]) — mesmo padrão já usado nas Phases 11→12 (pagamento → +acrescimo/desconto), agora Phase 12→15 (+destrava)"

key-files:
  created: []
  modified:
    - web/src/lib/kanban/actions.ts
    - web/src/components/financeiro/parcela-historico-sheet.tsx
    - docs/data-model.md

key-decisions:
  - "Reabertura pontual de D-01 (12-CONTEXT.md) confirmada em D-01/D-02 de 15-CONTEXT.md: cancelar destrava não reabre a conciliação nem afeta status, porque somarLancamentos nunca soma tipo='destrava'"
  - "Nenhum componente novo — CancelarLancamentoDialog e lancamento-tipo-label.tsx já resolviam destrava corretamente (despacham por item.kind, não por union fechado de tipo), confirmado por leitura integral, nenhuma linha alterada nos dois arquivos"

patterns-established: []

requirements-completed: [CANDEST-02, CANDEST-03]

coverage:
  - id: D1
    description: "cancelarLancamentoAction aceita tipo='destrava' no DELETE (.in(\"tipo\", [\"pagamento\", \"acrescimo\", \"desconto\", \"destrava\"]))"
    requirement: "CANDEST-02"
    verification:
      - kind: other
        ref: "grep confirma .in(\"tipo\", [...]) widenado em web/src/lib/kanban/actions.ts:1444, e ausência da versão de três tipos em todo o arquivo"
        status: pass
      - kind: other
        ref: "npx tsc --noEmit (web/) — WIDEN_OK"
        status: pass
    human_judgment: false
  - id: D2
    description: "Botão 'Cancelar' aparece em ParcelaHistoricoSheet para item.tipo === 'destrava', respeitando !parcelaConciliada"
    requirement: "CANDEST-02"
    verification:
      - kind: other
        ref: "grep confirma condição widenada em parcela-historico-sheet.tsx:128 ([\"pagamento\",\"acrescimo\",\"desconto\",\"destrava\"].includes(item.tipo))"
        status: pass
    human_judgment: true
    rationale: "Verificação visual do botão renderizado e do fluxo de cancelamento completo (clique → diálogo → DELETE → status inalterado) requer navegador/produção — não coberta por teste automatizado neste projeto (sem suíte de testes, D-06 STATE.md)"
  - id: D3
    description: "Uma parcela conciliada continua recusando cancelamento de destrava (herdado de exigirParcelaNaoConciliada, sem trava nova)"
    requirement: "CANDEST-03"
    verification:
      - kind: other
        ref: "leitura de fonte: exigirParcelaNaoConciliada (actions.ts:993-1012) roda antes do DELETE independente do valor de tipo, nenhuma linha nova adicionada"
        status: pass
    human_judgment: false
  - id: D4
    description: "docs/data-model.md deixa de descrever destrava como excluído 'para sempre' do mecanismo de cancelamento"
    verification:
      - kind: other
        ref: "grep confirma ausência de 'fica permanentemente fora deste mecanismo' e presença de 'reabre pontualmente'/'15-CONTEXT' em docs/data-model.md — DOCS_OK"
        status: pass
    human_judgment: false

duration: ~15min
completed: 2026-08-26
status: complete
---

# Phase 15 Plan 02: Widen do cancelamento de lançamento para incluir destrava Summary

**`cancelarLancamentoAction` e o botão "Cancelar" de `ParcelaHistoricoSheet` passam a aceitar `tipo='destrava'`, reabrindo pontualmente D-01 (Phase 12) sem criar nenhum componente novo.**

## Performance

- **Duration:** ~15 min
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments
- `cancelarLancamentoAction` aceita os quatro tipos `pagamento`/`acrescimo`/`desconto`/`destrava` no `.in()` do DELETE sobre `parcela_lancamentos` — mesmo widen mecânico de uma linha já feito na Phase 12
- Botão "Cancelar" em `ParcelaHistoricoSheet` aparece também para lançamentos `tipo='destrava'`, respeitando `!parcelaConciliada` como já respeitava para os outros três tipos
- `docs/data-model.md` corrigido: a frase que descrevia `destrava` como "permanentemente" fora do mecanismo de cancelamento agora registra a reabertura pontual da Phase 15

## Task Commits

Each task was committed atomically:

1. **Task 1: Widenar o cancelamento de lançamento para incluir `destrava`** - `eebe47f` (feat)
2. **Task 2: Corrigir `docs/data-model.md`** - `79d4f30` (docs)

_Nenhuma task TDD — plano `type: execute`, tasks `type="tracer"`/`type="auto"`._

## Files Created/Modified
- `web/src/lib/kanban/actions.ts` - `.in("tipo", [...])` widenado para incluir `destrava`; comentário JSDoc de `cancelarLancamentoAction` atualizado para citar D-01/D-02 de `15-CONTEXT.md` como a reabertura pontual
- `web/src/components/financeiro/parcela-historico-sheet.tsx` - condição de renderização do botão "Cancelar" (linha 128) widenada para incluir `item.tipo === "destrava"`
- `docs/data-model.md` - bullet "Cancelamento de pagamento e ajustes" corrigido: `destrava` deixa de ser descrito como excluído "para sempre" do mecanismo

## Decisions Made
- Nenhum componente novo criado — `CancelarLancamentoDialog` e `lancamento-tipo-label.tsx` já resolviam `destrava` corretamente porque despacham por `item.kind === "lancamento"`, não por um union de `tipo` fechado. Confirmado por leitura integral antes de editar, conforme instruído pelo plano (MUST NOT prohibitions).
- Não foi tocado `cardTemLancamento` nem qualquer caminho de exclusão de card — reservado para o plano 15-06, depois que a migração do plano 15-01 estiver aplicada em produção.

## Deviations from Plan

None - plan executado exatamente como escrito. As duas tasks (widen do allowlist + condição do botão, depois correção da doc) seguiram o `<action>` do plano linha por linha; nenhum bug, funcionalidade crítica faltante, ou bloqueio inesperado foi encontrado.

## Issues Encountered
O worktree não tinha `node_modules` próprio (não compartilha com o checkout principal) — `npm install` rodado antes de `npx tsc --noEmit`, `npm run lint` e `npm run build`, mesmo padrão já visto em execuções anteriores de plano em worktree isolado neste projeto (Phases 12/14).

## User Setup Required

None - nenhuma configuração de serviço externo necessária.

## Next Phase Readiness
- CANDEST-02/CANDEST-03 completos e verificados por asserção de fonte + `tsc`/lint/build. Falta apenas verificação humana em produção (fluxo completo: destravar uma parcela conciliada, ver o lançamento `destrava` no histórico, clicar "Cancelar", confirmar que a linha some sem afetar o status) — não incluída neste plano (`type="tracer"` foi verificado por automação, não por checkpoint humano, porque este plano roda em modo autônomo/paralelo dentro de uma wave).
- CANDEST-01 (widen de `cardTemLancamento` para excluir card com histórico de `destrava`) permanece bloqueado pelo plano 15-06, que depende da migração do plano 15-01 estar aplicada em produção — nenhuma mudança feita neste plano na trava de exclusão de card.
- Nenhum bloqueio para os planos paralelos da Wave 1 (15-01, 15-03) — este plano não tocou nenhum arquivo compartilhado com eles.

---
*Phase: 15-exclus-o-de-card-com-destrava-e-pagina-o*
*Completed: 2026-08-26*

## Self-Check: PASSED

- FOUND: web/src/lib/kanban/actions.ts
- FOUND: web/src/components/financeiro/parcela-historico-sheet.tsx
- FOUND: docs/data-model.md
- FOUND: commit eebe47f
- FOUND: commit 79d4f30
