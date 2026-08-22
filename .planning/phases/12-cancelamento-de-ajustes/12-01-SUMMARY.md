---
phase: 12-cancelamento-de-ajustes
plan: 01
subsystem: payments
tags: [nextjs, supabase, server-actions, financeiro]

# Dependency graph
requires:
  - phase: 11-cancelamento-de-pagamento
    provides: cancelarPagamentoAction/cancelarPagamento/CancelarPagamentoDialog (o mecanismo de cancelamento por lançamento, generalizado nesta fase)
provides:
  - "cancelarLancamentoAction/cancelarLancamento (renomeados e ampliados) — DELETE condicionado a .in(\"tipo\", [\"pagamento\",\"acrescimo\",\"desconto\"])"
  - "CancelarLancamentoDialog (renomeado, tipo-aware via TIPO[tipo].label)"
  - "TIPO exportado de lancamento-tipo-label.tsx"
  - "docs/data-model.md documentando o escopo ampliado da segunda exceção ao livro-razão append-only"
affects: [financeiro, parcela-historico-sheet]

# Actuals (#2632)
actuals:
  tokens: 5243
  tasks: 2
  commits: 2

tech-stack:
  added: []
  patterns:
    - "Widen-not-duplicate: allowlist .in(\"tipo\", [...]) substitui .eq(\"tipo\", \"pagamento\") como trava de corrida, nunca um blocklist"
    - "Diálogo genérico tipo-aware lendo rótulos de uma fonte central exportada (TIPO), em vez de três componentes duplicados"

key-files:
  created:
    - web/src/components/financeiro/cancelar-lancamento-dialog.tsx
  modified:
    - web/src/lib/kanban/actions.ts
    - web/src/lib/kanban/queries.ts
    - web/src/components/financeiro/parcela-historico-sheet.tsx
    - web/src/components/financeiro/lancamento-tipo-label.tsx
    - docs/data-model.md

key-decisions:
  - "Renomeado cancelarPagamentoAction/cancelarPagamento/CancelarPagamentoDialog para cancelarLancamentoAction/cancelarLancamento/CancelarLancamentoDialog (Claude's Discretion, 12-CONTEXT.md) — os símbolos agora cobrem três tipos, manter o nome antigo criaria dessincronia semântica permanente"
  - "Strings acao de erroDoBanco/semLinhas generalizadas de 'cancelar o pagamento' para 'cancelar o lançamento' — tipo-neutro no servidor, o fallback client-side no diálogo continua tipo-específico"
  - "docs/data-model.md continua chamando a exceção de 'segunda' (não 'terceira') — é a mesma exceção da Phase 11 com escopo maior, não uma nova"

patterns-established:
  - "Allowlist explícito de tipo em vez de blocklist: qualquer mecanismo de exclusão sobre parcela_lancamentos deve nomear os tipos elegíveis, nunca excluir só destrava"

requirements-completed: [CANAJU-01, CANAJU-02, CANAJU-03, CANAJU-04]

coverage:
  - id: D1
    description: "Botão 'Cancelar' aparece ao lado de cada lançamento tipo='acrescimo' ou tipo='desconto' dentro de ParcelaHistoricoSheet, mesmo local/visual do botão de pagamento já em produção desde a Phase 11"
    requirement: "CANAJU-01"
    verification:
      - kind: other
        ref: "source assertion: [\"pagamento\", \"acrescimo\", \"desconto\"].includes(lancamento.tipo) && !parcelaConciliada em parcela-historico-sheet.tsx:107"
        status: pass
    human_judgment: true
    rationale: "Composição visual Sheet+AlertDialog alcançada a partir de linhas novas (acréscimo/desconto) nunca testada em produção antes desta fase — requer checagem humana (12-01-PLAN.md human-check)"
  - id: D2
    description: "Clicar 'Cancelar' num acréscimo/desconto abre CancelarLancamentoDialog (componente único, renomeado) mostrando TIPO[tipo].label e o valor; confirmar apaga de verdade a linha em parcela_lancamentos"
    requirement: "CANAJU-02"
    verification:
      - kind: other
        ref: "source assertion: CancelarLancamentoDialog exporta, lê TIPO[tipo].label, DELETE .eq(\"id\",lancamentoId).eq(\"parcela_id\",parcelaId).in(\"tipo\",[...]) em actions.ts:1310-1316"
        status: pass
    human_judgment: true
    rationale: "Confirmação real de DELETE contra o banco requer teste manual em produção (12-01-PLAN.md human-check)"
  - id: D3
    description: "Depois do DELETE, recalcularEGravarStatus relê todos os lançamentos restantes e regrava o status — cancelarLancamentoAction nunca fixa um valor de status por conta própria"
    requirement: "CANAJU-03"
    verification:
      - kind: other
        ref: "source assertion: recalcularEGravarStatus(sessao.supabase, parcelaId) chamado após o DELETE bem-sucedido, ausência de literal de status hardcoded em actions.ts:1330"
        status: pass
    human_judgment: false
  - id: D4
    description: "Parcela conciliada nunca aceita cancelamento de acréscimo/desconto — botão oculto via parcelaConciliada e exigirParcelaNaoConciliada recusa no servidor"
    requirement: "CANAJU-04"
    verification:
      - kind: other
        ref: "source assertion: exigirParcelaNaoConciliada(sessao.supabase, parcelaId) chamado antes do DELETE em actions.ts:1307; !parcelaConciliada na condição do gatilho em parcela-historico-sheet.tsx:107"
        status: pass
    human_judgment: false

duration: 20min
completed: 2026-08-21
status: complete
---

# Phase 12 Plan 01: Cancelamento de ajustes Summary

**Cancelamento de lançamento (Phase 11) ampliado de `tipo='pagamento'` para `pagamento`/`acrescimo`/`desconto`, com Server Action, wrapper e diálogo de confirmação renomeados de `cancelarPagamentoAction`/`CancelarPagamentoDialog` para `cancelarLancamentoAction`/`CancelarLancamentoDialog`, e `TIPO` exportado de `lancamento-tipo-label.tsx` como fonte única dos rótulos.**

## Performance

- **Duration:** ~20 min
- **Tasks:** 2
- **Files modified:** 6 (1 renomeado)

## Accomplishments
- `cancelarLancamentoAction` (`actions.ts`): DELETE condicionado a `.eq("id", lancamentoId).eq("parcela_id", parcelaId).in("tipo", ["pagamento", "acrescimo", "desconto"])` — allowlist explícito, nunca alcança `tipo='destrava'` — seguido de `recalcularEGravarStatus`, nunca gravando status por conta própria
- `CancelarLancamentoDialog` (renomeado de `CancelarPagamentoDialog`, arquivo renomeado via `git mv` para preservar histórico) gera título/descrição/botão a partir de `TIPO[tipo].label`, um componente só para os três tipos (D-08), preservando byte-a-byte o guard `{data ? \` em ${formatDate(data)}\` : ""}` que corrigiu o bug de produção `284e52b`
- `ParcelaHistoricoSheet`: gatilho "Cancelar" ampliado de `lancamento.tipo === "pagamento"` para `["pagamento", "acrescimo", "desconto"].includes(lancamento.tipo)`, prop `tipo` passada ao diálogo
- `docs/data-model.md` documenta o escopo ampliado da mesma segunda exceção (não uma terceira) ao livro-razão append-only, nomeando `destrava` como permanentemente excluído

## Task Commits

Each task was committed atomically:

1. **Task 1: Cancelar acréscimo/desconto ponta a ponta — widen + rename + diálogo tipo-aware (CANAJU-01..04)** - `fbadec8` (feat)
2. **Task 2: Ampliar (não duplicar) a entrada de docs/data-model.md sobre a exceção ao livro-razão append-only** - `b65ca01` (docs)

_Note: this plan has no plan-metadata commit separate from task commits — see final_commit for STATE.md/ROADMAP.md/REQUIREMENTS.md._

## Files Created/Modified
- `web/src/lib/kanban/actions.ts` — `cancelarPagamentoAction` renomeada e ampliada para `cancelarLancamentoAction`
- `web/src/lib/kanban/queries.ts` — import e wrapper renomeados para `cancelarLancamentoAction`/`cancelarLancamento`
- `web/src/components/financeiro/cancelar-lancamento-dialog.tsx` — renomeado de `cancelar-pagamento-dialog.tsx`, agora tipo-aware
- `web/src/components/financeiro/parcela-historico-sheet.tsx` — gatilho ampliado para três tipos, prop `tipo` passada ao diálogo
- `web/src/components/financeiro/lancamento-tipo-label.tsx` — `TIPO` agora exportado
- `docs/data-model.md` — entrada de "Cancelamento de pagamento" ampliada para "Cancelamento de pagamento e ajustes"

## Decisions Made
- Renomear os quatro símbolos (`cancelarPagamentoAction`/`cancelarPagamento`/`CancelarPagamentoDialog`/`cancelar-pagamento-dialog.tsx`) em vez de manter o nome antigo — decisão já tomada no PLAN.md (Claude's Discretion, 12-CONTEXT.md), escopo confirmado em exatamente 4 arquivos antes de planejar
- Generalizar as strings `acao` de `erroDoBanco()`/`semLinhas()` server-side para "cancelar o lançamento" (tipo-neutro), mantendo o fallback client-side tipo-específico no diálogo — decisão já registrada no PLAN.md

## Deviations from Plan

None — plan executado exatamente como escrito. Único ajuste mecânico: a condição do gatilho em `parcela-historico-sheet.tsx` foi mantida em uma única linha (em vez de quebrada em duas) para casar byte-a-byte com a asserção de fonte do `<verify>` do plano; `npm run lint`/`prettier` não reformatou essa linha.

## Issues Encountered
- O worktree de execução não tinha `node_modules` instalado (worktrees não compartilham `node_modules` com o checkout principal) — rodei `npm install` no worktree antes de `npm run lint`/`npm run build`. Não é uma mudança de código, só infraestrutura de execução local.

## User Setup Required

None - nenhuma configuração de serviço externo necessária. Nenhuma migração de banco (nenhum tipo novo, nenhuma coluna nova — RLS de `parcela_lancamentos` já cobre DELETE desde a Phase 4).

## Next Phase Readiness
- CANAJU-01..04 completos: o gestor consegue cancelar acréscimo/desconto lançado por engano, com `destrava` permanentemente fora do mecanismo (D-01)
- Verificação humana pendente (human-check do PLAN.md): abrir `/financeiro` em produção, testar o botão "Cancelar" para um lançamento `acrescimo` e um `desconto`, confirmar que o `AlertDialog` abre corretamente por cima do Sheet, que nenhum lançamento `destrava` mostra o botão, e que uma parcela conciliada não aceita cancelamento de nenhum tipo

---
*Phase: 12-cancelamento-de-ajustes*
*Completed: 2026-08-21*
