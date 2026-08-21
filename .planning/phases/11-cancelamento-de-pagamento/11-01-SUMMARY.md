---
phase: 11-cancelamento-de-pagamento
plan: 01
subsystem: payments
tags: [nextjs, supabase, server-actions, alert-dialog, financeiro]

requires:
  - phase: 07-concilia-o-e-destrava-rastreada
    provides: "exigirParcelaNaoConciliada (trava de conciliada, reusada verbatim)"
  - phase: 06-baixa-e-ajustes-de-parcela
    provides: "recalcularEGravarStatus/somarLancamentos/statusDeParcela (recalculo de status, reusado verbatim)"
provides:
  - "cancelarPagamentoAction (actions.ts) — DELETE condicionado id+parcela_id+tipo=pagamento, trava conciliada, recalculo de status"
  - "cancelarPagamento (queries.ts) — ponte client/server"
  - "CancelarPagamentoDialog — AlertDialog de confirmacao simples, sem motivo, variant destructive"
  - "botao Cancelar por lancamento tipo=pagamento em ParcelaHistoricoSheet, oculto em parcela conciliada"
  - "docs/data-model.md — segunda excecao documentada ao livro-razao append-only"
affects: [financeiro, parcela-historico-sheet, docs-data-model]

actuals:
  tokens: 4740
  tasks: 2
  commits: 2

tech-stack:
  added: []
  patterns:
    - "DELETE condicionado a tres .eq() encadeados (id, parcela_id, tipo) como trava de corrida real — mesmo formato do .eq(status,'paga') de conciliarParcelaAction"
    - "AlertDialog aberto de dentro de um Sheet ja aberto (primeira ocorrencia desta composicao de portal no codebase)"

key-files:
  created:
    - web/src/components/financeiro/cancelar-pagamento-dialog.tsx
  modified:
    - web/src/lib/kanban/actions.ts
    - web/src/lib/kanban/queries.ts
    - web/src/components/financeiro/parcela-historico-sheet.tsx
    - web/src/components/financeiro/parcelas-table.tsx
    - docs/data-model.md

key-decisions:
  - "D-01 (11-CONTEXT.md, ja confirmado pelo usuario): cancelar apaga de verdade a linha em parcela_lancamentos — sem estorno, sem checkpoint novo neste plano"
  - "Reuso verbatim de exigirParcelaNaoConciliada e recalcularEGravarStatus — nenhuma logica de status/trava reimplementada"
  - "AlertDialogCancel rotulado 'Voltar' em vez de 'Cancelar' para evitar a colisao 'cancelar o cancelamento' (UI-SPEC)"

patterns-established:
  - "Segunda exceção deliberada ao livro-razão append-only, documentada lado a lado com a Phase 9 em docs/data-model.md"

requirements-completed: [CANPAG-01, CANPAG-02, CANPAG-03, CANPAG-04]

coverage:
  - id: D1
    description: "Botão 'Cancelar' por lançamento tipo='pagamento' dentro de ParcelaHistoricoSheet, oculto quando a parcela está conciliada"
    requirement: "CANPAG-01"
    verification:
      - kind: other
        ref: "grep asserts in 11-01-PLAN.md automated verify block (parcelaConciliada, Trash2, CancelarPagamentoDialog, tipo === \"pagamento\" && !parcelaConciliada) — all passed"
        status: pass
    human_judgment: true
    rationale: "Composição AlertDialog-dentro-de-Sheet é inédita neste codebase e tem histórico documentado de bug de animação (data-starting-style/data-ending-style) na mesma classe de composição — requer verificação visual humana em produção antes de considerar a fase concluída, per must_haves.truths statement 'composition (backstop)' do plano."
  - id: D2
    description: "Confirmação simples (sem motivo) mostrando valor/data do pagamento; confirmar apaga de verdade a linha do banco"
    requirement: "CANPAG-02"
    verification:
      - kind: other
        ref: "npm run lint && npm run build (exit 0) + grep asserts do CancelarPagamentoDialog (título, descrição, Voltar, variant destructive)"
        status: pass
    human_judgment: true
    rationale: "Comportamento de escrita real contra o banco de produção (DELETE) — só verificação manual em produção confirma o fluxo fim a fim sem risco de dado."
  - id: D3
    description: "Status da parcela recalculado a partir do que resta no livro-razão após o DELETE, nunca hardcoded"
    requirement: "CANPAG-03"
    verification:
      - kind: other
        ref: "awk source-assertion sobre o corpo de cancelarPagamentoAction: chama recalcularEGravarStatus(sessao.supabase, parcelaId) e nunca contém 'status: \"aberta\"' — passou"
        status: pass
    human_judgment: false
  - id: D4
    description: "Parcela conciliada nunca aceita cancelamento de lançamento, trava aplicada no servidor (exigirParcelaNaoConciliada) além da UI"
    requirement: "CANPAG-04"
    verification:
      - kind: other
        ref: "source-assertion: cancelarPagamentoAction chama exigirParcelaNaoConciliada(sessao.supabase, parcelaId) antes do DELETE — passou"
        status: pass
    human_judgment: false
  - id: D5
    description: "docs/data-model.md documenta a segunda exceção deliberada ao princípio append-only, citando Phase 9 e Phase 11 lado a lado"
    verification:
      - kind: other
        ref: "grep asserts: Phase 9, Phase 11, parcela_lancamentos, cancelamento, e as duas bullets pré-existentes intactas — todos passaram; git diff confirma só a frase ajustada + a bullet nova, nada removido"
        status: pass
    human_judgment: false

duration: ~10min
completed: 2026-08-21
status: complete
---

# Phase 11 Plan 01: Cancelamento de pagamento Summary

**Botão "Cancelar" por lançamento em `ParcelaHistoricoSheet` que apaga de verdade um pagamento (`cancelarPagamentoAction`, DELETE condicionado a id+parcela_id+tipo, recálculo de status via `recalcularEGravarStatus`), com a trava de conciliada reusada verbatim (`exigirParcelaNaoConciliada`) — e a segunda exceção documentada ao livro-razão append-only em `docs/data-model.md`.**

## Performance

- **Duration:** ~10min (execução) — commits às 14:50 e 14:51 UTC-4, sobre base às 14:41
- **Tasks:** 2/2 completos
- **Files modified:** 6 (1 criado, 5 modificados)

## Accomplishments
- `cancelarPagamentoAction` (`actions.ts`) nova: `requireUser()` → valida `parcelaId`/`lancamentoId` → `exigirParcelaNaoConciliada` (D-06) → `DELETE` em `parcela_lancamentos` condicionado a `.eq("id", lancamentoId).eq("parcela_id", parcelaId).eq("tipo", "pagamento")` (a trava de corrida real) → `recalcularEGravarStatus` (D-03, nunca hardcode) → retorno
- `cancelarPagamento` (`queries.ts`), wrapper de uma linha, mesmo molde de `conciliarParcela`/`destravarParcela`
- `CancelarPagamentoDialog` novo — cópia estrutural do branch destrutivo de `ExcluirContratoDialog`, sem pré-voo e sem confirmação digitada (D-04): título "Cancelar este pagamento?", descrição com valor/data via `formatCurrency`/`formatDate`, `AlertDialogCancel` rotulado "Voltar" (evita a colisão "cancelar o cancelamento"), `AlertDialogAction variant="destructive"` rotulado "Cancelar pagamento"/"Cancelando..."
- `ParcelaHistoricoSheet` — dois props novos (`parcelaId`, `parcelaConciliada`), botão "Cancelar" (`ghost`, `size="xs"`, ícone `Trash2`) renderizado só quando `lancamento.tipo === "pagamento" && !parcelaConciliada`, uma instância do diálogo controlada por `cancelando: LancamentoDetalhado | null`
- `parcelas-table.tsx` — `AcoesCell` passa `parcelaId={linha.id}` e `parcelaConciliada={linha.situacao === "conciliada"}` para o Sheet; mudança puramente aditiva (`git diff --unified=0` confirma 0 linhas removidas)
- `docs/data-model.md` — ressalva na descrição de `parcela_lancamentos` + nova bullet em "Decisões de design" citando a Phase 9 (apagava `parcelas`) e a Phase 11 (apaga `parcela_lancamentos` em si) lado a lado, com escopo exato e a consequência aceita (sem rastro de quem/quando/por quê)

## Task Commits

Each task was committed atomically:

1. **Task 1: Cancelar pagamento ponta a ponta (tracer)** - `d71b71e` (feat)
2. **Task 2: Documentar a segunda exceção append-only** - `7d8cde0` (docs)

## Files Created/Modified
- `web/src/lib/kanban/actions.ts` - nova `cancelarPagamentoAction`, entre `destravarParcelaAction` e a seção "Relatório financeiro"
- `web/src/lib/kanban/queries.ts` - import + wrapper `cancelarPagamento`
- `web/src/components/financeiro/cancelar-pagamento-dialog.tsx` (novo) - `CancelarPagamentoDialog`
- `web/src/components/financeiro/parcela-historico-sheet.tsx` - botão "Cancelar" por lançamento + trava de visibilidade + estado do diálogo
- `web/src/components/financeiro/parcelas-table.tsx` - `AcoesCell` passa `parcelaId`/`parcelaConciliada` para o Sheet
- `docs/data-model.md` - nova entrada em "Decisões de design" + ressalva na descrição de `parcela_lancamentos`

## Decisions Made
- D-01 (já travada em 11-CONTEXT.md, não reaberta aqui): apagar a linha de verdade, sem estorno — o `<reversibility rating="one-way">` da Task 1 só preserva o sinal no registro do plano, sem inserir checkpoint novo
- Reuso verbatim de `exigirParcelaNaoConciliada`/`recalcularEGravarStatus` — nenhuma lógica de trava ou status duplicada
- `AlertDialogCancel` rotulado "Voltar" (não o "Cancelar" padrão do resto do código-base) para evitar a colisão "cancelar o cancelamento", per Copywriting Contract do UI-SPEC

## Deviations from Plan

None - plan executed exactly as written. `npm install` foi necessário no worktree isolado (node_modules não estava presente ali) para rodar `npm run lint`/`npm run build` — infraestrutura de execução, não uma mudança de código, não registrada como desvio de Regra 1-4.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness

Fase 11 tem só este plano (01). Falta o `<human-check>` da Task 1 e da Task 2 — em particular a composição `AlertDialog` aberto de dentro de `Sheet` já aberto (primeira ocorrência desse tipo de portal-sobre-portal no código-base, com histórico documentado de bug de animação `data-starting-style`/`data-ending-style` na mesma classe de composição em `conciliar-falha-toast.tsx`). Verificação em produção pendente: abrir/fechar o diálogo de dentro do Sheet (caminho "Voltar" e caminho de confirmar), cancelar um pagamento real e conferir o status recalculado, e confirmar que o botão não aparece numa parcela conciliada. Se a animação quebrar como já quebrou duas vezes antes neste projeto, o contorno já está documentado no UI-SPEC: remover as classes `data-starting-style`/`data-ending-style` só para esta composição.

## Known Stubs

Nenhum. `cancelarPagamentoAction`/`cancelarPagamento`/`CancelarPagamentoDialog` são implementações reais e completas, sem dado mockado nem placeholder.

## Threat Flags

Nenhuma superfície nova além da já registrada em `<threat_model>` do plano (T-11-01 a T-11-04, T-11-SC) — nenhuma migração, nenhum pacote novo, nenhuma rota nova.

## Self-Check: PASSED

- FOUND: web/src/lib/kanban/actions.ts (cancelarPagamentoAction presente, linha 1293)
- FOUND: web/src/lib/kanban/queries.ts (cancelarPagamento presente)
- FOUND: web/src/components/financeiro/cancelar-pagamento-dialog.tsx
- FOUND: web/src/components/financeiro/parcela-historico-sheet.tsx (modificado, props parcelaId/parcelaConciliada)
- FOUND: web/src/components/financeiro/parcelas-table.tsx (modificado, threading aditivo confirmado)
- FOUND: docs/data-model.md (modificado, nova bullet + ressalva)
- FOUND commit: d71b71e (feat(11-01): cancelar pagamento ponta a ponta)
- FOUND commit: 7d8cde0 (docs(11-01): documentar segunda excecao)
- `npm run lint` — exit 0
- `npm run build` — exit 0, sem erros de TypeScript
- Todos os grep/awk asserts do bloco `<automated>` da Task 1 e da Task 2 passaram

---
*Phase: 11-cancelamento-de-pagamento*
*Completed: 2026-08-21*
