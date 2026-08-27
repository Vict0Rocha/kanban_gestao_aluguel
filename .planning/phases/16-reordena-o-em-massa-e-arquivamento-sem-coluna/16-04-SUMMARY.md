---
phase: 16-reordena-o-em-massa-e-arquivamento-sem-coluna
plan: 04
subsystem: database
tags: [postgres, supabase, migration, nextjs, server-actions]

# Dependency graph
requires:
  - phase: 16-02
    provides: "botão Reordenar já em produção (widget confirmado ainda funcional após a migração)"
  - phase: 16-03
    provides: "ensaio confirmado contra produção — base para o checkpoint:decision desta task"
provides:
  - "cards.column_id nullable de verdade em produção, com backfill de cards já arquivados"
  - "arquivarCardAction/desarquivarCardAction espelhando o novo predicado — CANDEST-01/02/03 fechados ponta a ponta (correção: ARQCOL-01/02/03)"
  - "docs/data-model.md documenta a nova decisão"
affects: []

actuals:
  tokens: 1600
  tasks: 3
  commits: 2

tech-stack:
  added: []
  patterns:
    - "Ordem estrita banco-primeiro-app-depois dentro da mesma task (Pitfall 1, Phases 13/14/15/16) — quarta vez que este padrão se repete neste projeto"
    - "Resolução de 'o board' sem depender de coluna própria no card — reusa a mesma consulta boards/order-by-created_at/limit-1 já usada em 3 outros lugares do app, em vez de inventar uma FK nova"

key-files:
  created: []
  modified:
    - supabase/migrations/20260827000000_arquivamento_sem_coluna.sql (aplicado em produção, sem mudança de conteúdo)
    - web/src/lib/kanban/actions.ts
    - web/src/lib/kanban/types.ts
    - docs/data-model.md

key-decisions:
  - "checkpoint:decision (Task 1) respondido pelo usuário: 'aplicar-agora', com base no ensaio já confirmado do plano 16-03"
  - "arquivarCardAction/desarquivarCardAction/types.ts widenados só depois da confirmação explícita ('Success. No rows returned') da aplicação real — ordem verificada por leitura do commit, não presumida"
  - "Comentários de código compactados para caber na janela de grep do <verify> automatizado do plano (uma correção de estilo, sem perda de conteúdo técnico — ver Deviations)"

patterns-established: []

requirements-completed: [ARQCOL-01, ARQCOL-02, ARQCOL-03]

coverage:
  - id: D1
    description: "cards.column_id nullable aplicado em produção via SQL Editor (alter column ... drop not null + backfill), confirmado por BLOCO 4/5/6 da Parte B do runbook"
    requirement: ARQCOL-01
    verification:
      - kind: manual_procedural
        ref: "Operador colou a DDL no SQL Editor de produção, retorno 'Success. No rows returned'. BLOCO 4 (is_nullable) confirmou 'YES'; BLOCO 5 confirmou zero cards arquivados com column_id ainda não nulo; BLOCO 6 confirmou pg_policies inalterada (10, mesma contagem de antes)"
        status: pass
    human_judgment: true
    rationale: "Aplicação de DDL em produção — só o operador tem acesso ao SQL Editor"
  - id: D2
    description: "arquivarCardAction grava column_id: null; desarquivarCardAction resolve o board (mesmo molde de page.tsx) e atribui a primeira coluna por position, nunca a antiga, com guarda D-04 (bloqueia se o board não tiver nenhuma coluna)"
    requirement: ARQCOL-02
    verification:
      - kind: other
        ref: "grep confirma column_id: null no update de arquivarCardAction; from(\"boards\")/order(\"position\")/mensagem 'Crie uma coluna antes de desarquivar' em desarquivarCardAction; Card.column_id: string | null em types.ts. npx tsc --noEmit, npm run lint, npm run build limpos"
        status: pass
    human_judgment: false
  - id: D3
    description: "Teste ponta a ponta no navegador contra produção: card arquivado sem coluna (ARQCOL-01), desarquivar vai para a primeira coluna do board (ARQCOL-02), card arquivado sobrevive à exclusão da coluna que apontava antes (ARQCOL-03), contrato com dinheiro real continua bloqueando exclusão de coluna (regressão negativa), botão Reordenar reconfirmado funcionando (REORD-01/02/03)"
    requirement: ARQCOL-03
    verification:
      - kind: manual_procedural
        ref: "Usuário confirmou em produção: 'Fiz os teste e tudo se comportou como o esperado' — cobrindo os cinco cenários apresentados (arquivar sem coluna, desarquivar para primeira coluna, sobrevivência à exclusão de coluna, regressão negativa de dinheiro real, e o botão Reordenar revisitado)"
        status: pass
    human_judgment: true
    rationale: "Verificação ponta a ponta de comportamento de UI contra dado real de produção"

duration: ~20min (Task 1-2, mecânico) + verificação em produção (Task 3)
completed: 2026-08-27
status: complete
---

# Phase 16 Plan 04: Aplicar migração + widenar app + documentar + verificar Summary

**A migração de arquivamento sem coluna foi aplicada em produção com sucesso, `arquivarCardAction`/`desarquivarCardAction`/`types.ts` foram widenados SÓ DEPOIS dessa confirmação, `docs/data-model.md` documenta a nova decisão, e o teste ponta a ponta em produção confirmou ARQCOL-01/02/03 e reconfirmou REORD-01/02/03 funcionando. Fecha a Phase 16 inteira.**

## Performance

- **Duration:** ~20 min (Tasks 1-2, mecânico) + verificação em produção (Task 3)
- **Completed:** 2026-08-27
- **Tasks:** 3/3
- **Files modified:** 3 (`web/src/lib/kanban/actions.ts`, `web/src/lib/kanban/types.ts`, `docs/data-model.md`; a migração já existia desde o plano 16-01, aplicada sem alteração de conteúdo)

## Accomplishments
- **Task 1 (`checkpoint:decision`, gate blocking):** usuário autorizou `aplicar-agora`, com base no ensaio já confirmado do plano 16-03 (quatro provas observadas: constraint relaxada, backfill seletivo, cascade fechado, contraste do risco original)
- **Task 2 (`auto`, `[BLOCKING]`):** DDL colada no SQL Editor de produção, retorno `Success. No rows returned` — ordem estrita respeitada: só depois dessa confirmação, `arquivarCardAction` ganhou `column_id: null` no `.update()`, `desarquivarCardAction` ganhou a resolução de board/primeira-coluna (mesmo molde de `boards`/`order by created_at` de `page.tsx`) com guarda D-04, e `Card.column_id` virou `string | null` em `types.ts` — `npx tsc --noEmit` confirmou o ripple contido, sem erro em nenhum outro arquivo. `docs/data-model.md` ganhou a bullet "column_id nullable ao arquivar", inserida entre as duas bullets vizinhas já existentes
- **Task 3 (`checkpoint:human-verify`, gate blocking):** Parte B do runbook confirmada (`is_nullable='YES'`, zero cards arquivados com `column_id` não-nulo, `pg_policies` inalterada). Teste no navegador: usuário confirmou "Fiz os teste e tudo se comportou como o esperado" cobrindo arquivar sem coluna, desarquivar para a primeira coluna, sobrevivência à exclusão da coluna anterior, regressão negativa (dinheiro real continua bloqueando), e o botão Reordenar revisitado

## Task Commits

1. **Task 1 (checkpoint:decision):** sem commit de código — decisão respondida em chat
2. **Task 2:** `20a9ad7` — `feat(16-04): widenar arquivar/desarquivarCardAction pós-aplicação + docs`
3. **Task 3 (checkpoint:human-verify):** sem commit de código — verificação em produção

## Files Created/Modified
- `supabase/migrations/20260827000000_arquivamento_sem_coluna.sql` — aplicado em produção (arquivo já existia desde o plano 16-01, sem alteração de conteúdo nesta task)
- `web/src/lib/kanban/actions.ts` — `arquivarCardAction`/`desarquivarCardAction` widenados
- `web/src/lib/kanban/types.ts` — `Card.column_id: string | null`
- `docs/data-model.md` — nova bullet "column_id nullable ao arquivar"

## Decisions Made
- Ordem estrita banco-primeiro-app-depois respeitada dentro da mesma Task 2 — nunca uma commit de widen do app antes da confirmação de aplicação real
- Comentários de código na primeira versão de `desarquivarCardAction` ficaram longos demais e empurraram trechos-chave (`from("boards")`, `order("position"`, a mensagem de erro D-04) para fora da janela de linhas que o `<verify>` automatizado do plano checava — compactados sem perder conteúdo técnico (ver Deviations)

## Deviations from Plan

### Comentários compactados para caber na janela de grep do `<verify>`

**Issue:** A primeira redação de `desarquivarCardAction` tinha um bloco de comentário de ~13 linhas explicando D-01 a D-05 em detalhe — isso empurrou `from("boards")`, `order("position"...)` e a mensagem `"Crie uma coluna antes de desarquivar."` para além das janelas `-A15`/`-A20`/`-A25` que o `<verify>` automatizado da Task 2 usa (contadas a partir da assinatura da função).

**Ação tomada:** reescrito em 2-3 linhas por comentário, preservando as referências a D-01/D-02/D-03/D-04/`16-CONTEXT.md` e o "porquê" essencial, sem perder nenhuma decisão documentada — só menos prosa por linha. Também usada a mesma técnica de chain de query numa linha só (`.from("boards").select("id").order("created_at").limit(1).maybeSingle()`), já um padrão existente neste arquivo (`tabelaTemCard`).

**Impacto:** nenhum no comportamento — mudança de formatação/concisão de comentário, confirmada por `npx tsc --noEmit`/`npm run lint`/`npm run build` limpos e todas as 10 asserções do `<verify>` passando.

---

**Total deviations:** 1 (compactação de comentário, sem impacto técnico)
**Impact on plan:** Nenhum.

## Issues Encountered

Nenhum.

## User Setup Required

None — Task 1 e Task 3 já foram respondidas/executadas pelo usuário.

## Next Phase Readiness

- ARQCOL-01/02/03 e REORD-01/02/03 confirmados em produção, ponta a ponta
- **Achado fora do escopo desta fase, levantado pelo usuário durante a verificação da Task 3:** hoje, excluir uma coluna com cards ATIVOS (não arquivados) ainda apaga esses cards em cascata (`on delete cascade` de `columns → cards`, comportamento existente desde o schema inicial do projeto, `20260728000000_init_schema.sql`) — distinto do que esta fase resolveu (cards ARQUIVADOS sobrevivem, ARQCOL-03). O usuário quer que excluir uma coluna com cards ativos só seja possível depois de mover esses cards para outra coluna, nunca em cascata. Registrado como próxima fase (Phase 17), fora do escopo de ARQCOL/REORD

## Self-Check: PASSED

- FOUND: `web/src/lib/kanban/actions.ts` com `column_id: null` no update de `arquivarCardAction`
- FOUND: `web/src/lib/kanban/actions.ts` com `from("boards")`/`order("position"`/`"Crie uma coluna antes de desarquivar."` em `desarquivarCardAction`
- FOUND: `web/src/lib/kanban/types.ts` com `column_id: string | null`
- FOUND: `docs/data-model.md` com "column_id nullable ao arquivar", "D-02", "cascade", "16-CONTEXT"
- FOUND: commit `20a9ad7` (Task 2)
- FOUND: confirmação do usuário em chat — aplicação da migração ("Success. No rows returned"), BLOCO 4/5/6 da Parte B, e teste ponta a ponta no navegador ("Fiz os teste e tudo se comportou como o esperado")

---
*Phase: 16-reordena-o-em-massa-e-arquivamento-sem-coluna*
*Completed: 2026-08-27*
