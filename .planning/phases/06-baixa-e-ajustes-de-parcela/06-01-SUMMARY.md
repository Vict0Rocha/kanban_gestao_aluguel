---
phase: 06-baixa-e-ajustes-de-parcela
plan: 01
subsystem: payments
tags: [nextjs, server-actions, supabase, postgrest, react]

requires:
  - phase: 05-aba-financeiro-com-parcelas-autom-ticas
    provides: "ParcelasTable, FinanceiroView, somarLancamentos/situacaoDaParcela/montarLinhas em parcelas.ts, parcela_lancamentos schema (Phase 4)"
provides:
  - "registrarPagamentoAction/registrarPagamento — baixa total ou parcial em um único diálogo pré-preenchido"
  - "ajustarParcelaAction/ajustarParcela — acréscimo/desconto com alternador de tipo"
  - "recalcularEGravarStatus — recálculo de parcelas.status a partir da soma do livro-razão, compartilhado pelas duas actions"
  - "statusDeParcela() — regra pura de D-04 com a fronteira de A-03 (desconto que zera valor devido de parcela já paga)"
  - "coluna Ações na ParcelasTable (Pagamento + Ajustar)"
affects: [06-02-historico, 07-conciliacao-e-destrava]

actuals:
  tokens: 7100
  tasks: 2
  commits: 2

tech-stack:
  added: []
  patterns:
    - "Server Action de escrita financeira: requireUser() → validar → INSERT em parcela_lancamentos → recalcularEGravarStatus() (relê soma do livro-razão inteiro, nunca aplica delta) → UPDATE parcelas.status"
    - "Diálogo autocontido (sem callback ao pai): chama a função-ponte de queries.ts diretamente, router.refresh() no sucesso — mesmo padrão de alerts-panel.tsx, não o onSave de CardDetailDialog"
    - "Diálogo mostra error.message real (erroDoBanco()-sanitizado), não uma string genérica fixa — desvio deliberado do catch de CardDetailDialog, documentado na UI-SPEC"

key-files:
  created:
    - web/src/components/financeiro/registrar-pagamento-dialog.tsx
    - web/src/components/financeiro/ajustar-parcela-dialog.tsx
  modified:
    - web/src/lib/kanban/parcelas.ts
    - web/src/lib/kanban/actions.ts
    - web/src/lib/kanban/queries.ts
    - "web/src/app/(app)/financeiro/page.tsx"
    - web/src/components/financeiro/financeiro-view.tsx
    - web/src/components/financeiro/parcelas-table.tsx

key-decisions:
  - "Task 1 (tracer) e Task 2 (auto) executadas em sequência sem parar no gate de tracer padrão — o prompt do orquestrador definiu explicitamente que a única pausa deste plano é a Task 3 (checkpoint:human-verify), consistente com a seção <reversibility> do próprio plano (custly, não one-way; nenhum checkpoint:decision inserido de propósito)"
  - "A-01/A-02/A-03/A-04/A-05 do plano seguidos ao pé da letra: ordem decrescente do histórico, mensagem do cliente reusada no servidor, statusDeParcela resolve para 'parcial' quando desconto zera valorDevido de parcela já paga, ajuste não envia data (default current_date), motivo fica de fora dos três INSERTs"

requirements-completed: [BAIXA-01, BAIXA-02, BAIXA-03, BAIXA-04, BAIXA-05, FINUI-04, FINSEG-03]

coverage:
  - id: D1
    description: "Registrar pagamento (baixa total em 2 cliques, diálogo pré-preenchido) grava lançamento tipo=pagamento e recalcula parcelas.status"
    requirement: "BAIXA-01"
    verification:
      - kind: automated_ui
        ref: "cd web && npm run lint && npm run build"
        status: pass
    human_judgment: true
    rationale: "Requer confirmar contra parcelas reais de produção (Task 3, checkpoint:human-verify) — 2 cliques efetivos, pré-preenchimento correto e status virando Paga só podem ser confirmados com dados reais no navegador"
  - id: D2
    description: "Baixa parcial deixa a parcela Parcial; completar o restante depois vira Paga sozinha, sem edição manual"
    requirement: "BAIXA-02"
    verification: []
    human_judgment: true
    rationale: "Sequência de duas ações consecutivas contra a mesma parcela real — só verificável em produção (Task 3, passo 2)"
  - id: D3
    description: "Ajustar (acréscimo/desconto, mesmo diálogo com alternador) muda o valor devido; acréscimo pode devolver uma parcela Paga para Parcial"
    requirement: "BAIXA-03, BAIXA-04"
    verification: []
    human_judgment: true
    rationale: "O comportamento 'paga volta a parcial' (SC3 do ROADMAP) é a sequência mais importante da verificação humana — Task 3, passo 3"
  - id: D4
    description: "Toda ação insere uma linha nova em parcela_lancamentos (nunca UPDATE/DELETE), com criado_por da sessão e observação"
    requirement: "BAIXA-05"
    verification:
      - kind: unit
        ref: "leitura manual do corpo de registrarPagamentoAction/ajustarParcelaAction em actions.ts — nenhum .update()/.delete() contra parcela_lancamentos"
        status: pass
    human_judgment: true
    rationale: "A garantia estrutural (só .insert()) é verificável por leitura de código, mas a confirmação de criado_por/criado_em reais e da consulta SQL fica para Task 3, passo 6"
  - id: D5
    description: "Erro do banco chega como frase em português via erroDoBanco(), nunca texto cru do Postgres"
    requirement: "FINSEG-03"
    verification:
      - kind: unit
        ref: "leitura manual — as duas Server Actions só retornam erro via erroDoBanco()/semLinhas(); os dois diálogos renderizam só error.message"
        status: pass
    human_judgment: false
  - id: D6
    description: "Parcela de contrato inativo (cards.ativo=false) continua aceitando Pagamento e Ajustar sem filtro"
    requirement: "D-07, CONTRATO-02"
    verification:
      - kind: unit
        ref: "grep -i ativo dentro do corpo de registrarPagamentoAction e ajustarParcelaAction — nenhuma ocorrência fora de comentário"
        status: pass
    human_judgment: true
    rationale: "Confirmação end-to-end (marcar contrato inativo no board, registrar pagamento na parcela) é o passo 5 da Task 3"

duration: 45min
completed: 2026-08-18
status: halted
---

# Phase 6 Plan 1: Registrar pagamento e ajustar valor Summary

**Server Actions `registrarPagamentoAction`/`ajustarParcelaAction` gravam em `parcela_lancamentos` pela sessão do usuário e recalculam `parcelas.status` via um único helper compartilhado (`recalcularEGravarStatus`), com dois novos diálogos (Pagamento, Ajustar) na coluna Ações da tabela Financeiro.**

## Performance

- **Duration:** 45 min
- **Started:** 2026-08-17T23:49:00Z (aprox.)
- **Completed:** 2026-08-18T00:34:00Z
- **Tasks:** 2 de 3 (Task 3 é `checkpoint:human-verify` — aguardando verificação do operador)
- **Files modified:** 9 (7 modificados, 2 novos)

## Accomplishments
- Fatia vertical completa de ponta a ponta para registrar pagamento: linha → `AcoesCell` → `RegistrarPagamentoDialog` → `registrarPagamento` (queries.ts) → `registrarPagamentoAction` (actions.ts) → INSERT em `parcela_lancamentos` → `recalcularEGravarStatus` → UPDATE `parcelas.status` → `router.refresh()`
- `ajustarParcelaAction` reusa o mesmo `recalcularEGravarStatus` da Task 1 — a regra de D-04 (`paga`/`parcial`/`aberta`) existe em um único lugar, nunca duplicada entre os dois caminhos de escrita
- `statusDeParcela()` implementa D-04 com a fronteira de A-03 documentada inline: um desconto que zera ou torna negativo o valor devido de uma parcela já paga resolve para `"parcial"`, não `"paga"` nem `"aberta"`
- Coluna Ações nova na `ParcelasTable` (7ª coluna, à esquerda) com os controles `Pagamento` (`variant="outline"`) e `Ajustar` (`variant="ghost"`), seguindo o Color/Copywriting Contract da UI-SPEC ao pé da letra
- `page.tsx` estende o `.select()` de `parcelas` com o embed detalhado (`id, tipo, valor, data, observacao, motivo, criado_em, profiles(...)`), reaproveitando o cast já documentado `as unknown as ParcelaComCard[]` sem introduzir um cast novo

## Task Commits

Cada task foi commitada atomicamente:

1. **Task 1: Fatia vertical — registrar pagamento ponta a ponta** - `f14c2e0` (feat)
2. **Task 2: Ajustar valor — acréscimo e desconto reaproveitando o mesmo recálculo de status** - `a8a586c` (feat)
3. **Task 3: Conferir pagamento e ajuste contra parcelas reais de produção** - PENDENTE (checkpoint:human-verify, não executável pelo agente)

_Nenhuma commit de plano/metadados ainda — este plano roda em worktree isolado; STATE.md/ROADMAP.md são atualizados pelo orquestrador após o merge._

## Files Created/Modified
- `web/src/lib/kanban/parcelas.ts` - `statusDeParcela()`, tipo `LancamentoDetalhado`, `ParcelaComCard.parcela_lancamentos`/`LinhaParcela.lancamentos` estendidos, `montarLinhas` populando `lancamentos` (ordem decrescente, A-01)
- `web/src/lib/kanban/actions.ts` - `valorLancamento`/`dataObrigatoria` (validadores), `recalcularEGravarStatus` (helper privado compartilhado), `registrarPagamentoAction`, `ajustarParcelaAction`, `TIPOS_AJUSTE`
- `web/src/lib/kanban/queries.ts` - `registrarPagamento`, `ajustarParcela` (pontes `unwrap()`)
- `web/src/app/(app)/financeiro/page.tsx` - `.select()` estendido com o embed detalhado + `profiles`; prop `todayISO={hojeISO}`
- `web/src/components/financeiro/financeiro-view.tsx` - prop `todayISO` repassada a `ParcelasTable`
- `web/src/components/financeiro/parcelas-table.tsx` - `"use client"`, coluna Ações, componente local `AcoesCell` com os dois botões e os dois diálogos como irmãos da célula
- `web/src/components/financeiro/registrar-pagamento-dialog.tsx` (novo) - diálogo de pagamento, pré-preenchido, valida client-side, mostra `error.message` real
- `web/src/components/financeiro/ajustar-parcela-dialog.tsx` (novo) - diálogo de ajuste com alternador Acréscimo/Desconto (classes de `mes-switcher.tsx`), nota de consequência sempre visível

## Decisions Made
- Tasks 1 e 2 executadas em sequência sem o gate de tracer padrão pausar entre elas — o prompt do orquestrador para esta execução definiu explicitamente que a única pausa do plano é a Task 3, alinhado com a seção `<reversibility>` do próprio PLAN.md (nenhum `checkpoint:decision` foi inserido de propósito; o raio do estrago de uma regra de status errada se autocorrige no próximo lançamento gravado sobre a mesma parcela)
- Nenhuma decisão de arquitetura fora do já fixado em `06-CONTEXT.md`/`06-UI-SPEC.md`/`planner_assumptions` do PLAN.md foi necessária — A-01 a A-05 seguidos ao pé da letra

## Deviations from Plan

None - plano executado exatamente como escrito nas Tasks 1 e 2.

Duas divergências puramente cosméticas entre a contagem literal de alguns `grep -c` dos `acceptance_criteria` e o resultado real, sem impacto funcional (comportamento verificado por leitura de código e por lint/build):
- `grep -c 'somarLancamentos' actions.ts` devolveu 2 (import + uso), não 1 como o critério estimava — a função é importada e usada exatamente uma vez, sem reimplementação (D-03 preservado)
- `grep -c 'recalcularEGravarStatus' actions.ts` devolveu 5 (definição + 2 labels de `console.error` + 2 chamadas), não 3 — a função continua sendo o único ponto de recálculo, chamado por `registrarPagamentoAction` e `ajustarParcelaAction`, sem duplicação
- `grep -c 'Aplicar ajuste' ajustar-parcela-dialog.tsx` devolveu 1 (só o rótulo do botão em estado "não salvando"), não 2 — o título do diálogo é "Ajustar valor" (não "Aplicar ajuste"), então só existe uma ocorrência literal da string, exatamente como a `<action>` do plano especifica

## Issues Encountered
- `web/node_modules` ausente no worktree (gitignored, não copiado na criação do worktree) — resolvido com `robocopy /E /MT:16` de uma cópia física de `web/node_modules` do repo principal, seguindo o procedimento já documentado por agentes anteriores (05-01, 05-03) para esta mesma limitação da plataforma

## User Setup Required

None - nenhuma configuração de serviço externo necessária.

## Next Phase Readiness

Tasks 1 e 2 completas, lint e build passando (`cd web && npm run lint && npm run build`, código 0 nas duas). O plano está **halted** na Task 3 — `checkpoint:human-verify`, `gate="blocking"` — que exige testar em produção (`/financeiro`, logado com e-mail da allowlist):

1. Baixa total em 2 cliques
2. Baixa parcial → completar o restante → vira Paga sozinha
3. Acréscimo devolve uma parcela Paga para Parcial (a sequência mais importante)
4. Desconto reduz o valor devido sem mudar a situação de uma parcela sem pagamento
5. Parcela de contrato inativo continua aceitando as duas ações
6. Conferência no SQL Editor: uma linha nova por ação, nunca alterada, com `criado_por`/`criado_em` reais
7. Nenhuma tela mostrou erro cru do Postgres

O plano 06-02 (histórico de lançamentos) depende dos artefatos deste plano (`LancamentoDetalhado`, `lancamentos` em `LinhaParcela`) — já disponíveis para consumo, independente do resultado da Task 3.

---
*Phase: 06-baixa-e-ajustes-de-parcela*
*Completed: 2026-08-18 (Tasks 1-2; Task 3 pendente de verificação humana)*
