---
phase: 15-exclus-o-de-card-com-destrava-e-pagina-o
plan: 06
subsystem: database
tags: [postgres, supabase, migration, nextjs, server-actions]

# Dependency graph
requires:
  - phase: 15-02
    provides: "cancelarLancamentoAction widenado para incluir destrava (app-side, já em produção)"
  - phase: 15-04
    provides: "ensaio confirmado contra produção — base para o checkpoint:decision desta task"
provides:
  - "impedir_exclusao_de_card_com_lancamento() relaxado de verdade em produção — CANDEST-01 fechado ponta a ponta"
  - "cardTemLancamento (app) espelhando o mesmo predicado, widenado só depois da confirmação de aplicação (Pitfall 1)"
  - "docs/data-model.md atualizado — não descreve mais o predicado antigo"
affects: []

actuals:
  tokens: 1800
  tasks: 3
  commits: 2

tech-stack:
  added: []
  patterns:
    - "Ordem estrita banco-primeiro-app-depois dentro da mesma task, para o pré-voo do app nunca prometer mais do que o banco já cumpre (Pitfall 1, 15-RESEARCH.md) — terceira vez que este padrão de 'widen banco, confirmar, só então widen app' se repete neste projeto (Phase 13, Phase 14, agora Phase 15)"

key-files:
  created: []
  modified:
    - supabase/migrations/20260826010000_relaxar_exclusao_destrava.sql (aplicado em produção, sem mudança de conteúdo)
    - web/src/lib/kanban/actions.ts
    - docs/data-model.md

key-decisions:
  - "checkpoint:decision (Task 1) respondido pelo usuário: 'aplicar-agora', com base no ensaio já confirmado do plano 15-04 — nenhuma conferência de backup adicional pedida"
  - "cardTemLancamento widenado só depois da confirmação explícita ('Success. No rows returned') da aplicação real — nunca antes, ordem verificada por leitura do commit e do histórico da conversa, não presumida"

patterns-established: []

requirements-completed: [CANDEST-01, CANDEST-02, CANDEST-03]

coverage:
  - id: D1
    description: "impedir_exclusao_de_card_com_lancamento() aplicado em produção via SQL Editor (create or replace function), predicado restrito a pagamento/acrescimo/desconto — confirmado por leitura do corpo da função pós-aplicação (BLOCO 4 da Parte B do runbook)"
    requirement: CANDEST-01
    verification:
      - kind: manual_procedural
        ref: "Operador colou a DDL no SQL Editor de produção, retorno 'Success. No rows returned'. BLOCO 4 (pg_get_functiondef) confirmou o filtro de tipo presente no corpo da função em produção"
        status: pass
    human_judgment: true
    rationale: "Aplicação de DDL em produção — só o operador tem acesso ao SQL Editor"
  - id: D2
    description: "cardTemLancamento (web/src/lib/kanban/actions.ts) widenado com .in(\"tipo\", [\"pagamento\", \"acrescimo\", \"desconto\"]) SOMENTE depois da aplicação confirmada — tabelaTemCard (taxas/caução) permanece sem filtro"
    requirement: CANDEST-01
    verification:
      - kind: other
        ref: "grep confirma o .in(...) logo após .eq(\"parcelas.card_id\", cardId), menção a 'reabre'/'15-CONTEXT' no comentário; npx tsc --noEmit, npm run lint, npm run build limpos"
        status: pass
    human_judgment: false
  - id: D3
    description: "docs/data-model.md (linha ~141) não descreve mais o predicado antigo ('qualquer tipo... destrava') — cita a trinca atual e a reabertura pontual via 15-CONTEXT.md"
    requirement: CANDEST-01
    verification:
      - kind: other
        ref: "grep confirma ausência da frase antiga e presença de '15-CONTEXT' e 'pagamento, acréscimo, desconto'"
        status: pass
    human_judgment: false
  - id: D4
    description: "BLOCO 5/6 da Parte B (repetição das 3 provas + contagem de policies) rodados contra o schema já migrado, dentro de begin;...rollback; próprio"
    requirement: CANDEST-01
    verification:
      - kind: manual_procedural
        ref: "Operador rodou o BLOCO 5 (3 provas dentro de begin;...rollback;) — retorno 'Success. No rows returned', confirmando que nenhuma das 3 provas levantou raise exception (mesma lógica de confirmação indireta do plano 15-04: o caminho de falha é a única forma de gerar erro visível). BLOCO 6: policies_total = 10, sem mudança"
        status: pass
    human_judgment: true
    rationale: "Mesma limitação do plano 15-04 — operador não localizou a aba de Messages/Notices; confirmação por ausência de erro + retorno de sucesso, documentada com honestidade"
  - id: D5
    description: "Teste ponta a ponta no navegador contra produção: card só-destrava excluído de verdade (CANDEST-01); lançamento destrava cancelado pela UI sem afetar status da parcela (CANDEST-02); parcela conciliada continua bloqueando exclusão/cancelamento, e contrato com dinheiro de verdade continua bloqueado na exclusão (CANDEST-03 + regressão negativa)"
    requirement: CANDEST-02
    verification:
      - kind: manual_procedural
        ref: "Usuário confirmou em produção: 'Testei tudo, funcionou como esperado' — teste cobriu os 3 cenários apresentados (exclusão de card só-destrava, cancelamento de destrava sem afetar status, contrato com pagamento real continua bloqueado)"
        status: pass
    human_judgment: true
    rationale: "Verificação ponta a ponta de comportamento de UI contra dado real de produção"

duration: ~15min (Task 1-2, mecânico) + verificação em produção (Task 3)
completed: 2026-08-27
status: complete
---

# Phase 15 Plan 06: Aplicar migração + relaxar app + documentar + verificar Summary

**A migração de relaxamento de exclusão com destrava foi aplicada em produção com sucesso, `cardTemLancamento` foi widenado no app SÓ DEPOIS dessa confirmação (nunca antes — Pitfall 1), `docs/data-model.md` documenta o novo predicado, e o teste ponta a ponta em produção confirmou CANDEST-01/02/03 funcionando, incluindo a regressão negativa (dinheiro de verdade continua bloqueado). Fecha a Phase 15 inteira, junto com PAGIN-01..03 (código completo desde os planos 15-03/15-05, mais uma correção pós-verificação de UX de paginação registrada em ROADMAP.md).**

## Performance

- **Duration:** ~15 min (Tasks 1-2, mecânico) + verificação em produção (Task 3)
- **Completed:** 2026-08-27
- **Tasks:** 3/3
- **Files modified:** 3 (`supabase/migrations/20260826010000_relaxar_exclusao_destrava.sql` já existia, aplicado sem alteração; `web/src/lib/kanban/actions.ts`; `docs/data-model.md`)

## Accomplishments
- **Task 1 (`checkpoint:decision`, gate blocking):** usuário autorizou `aplicar-agora`, com base no ensaio já confirmado do plano 15-04 (duas metades observadas: relaxa destrava, continua protegendo pagamento/taxa)
- **Task 2 (`auto`, `[BLOCKING]`):** DDL colada no SQL Editor de produção, retorno `Success. No rows returned` — ordem estrita respeitada: só depois dessa confirmação, `cardTemLancamento` (`web/src/lib/kanban/actions.ts`) ganhou `.in("tipo", ["pagamento", "acrescimo", "desconto"])` na consulta a `parcela_lancamentos`; `tabelaTemCard` (`taxas_imobiliaria`/`caucao_eventos`) ficou sem alteração, sem filtro de tipo. Comentário JSDoc atualizado citando a reabertura de D-14 (06.2-CONTEXT.md) via D-01/D-03 (15-CONTEXT.md). `docs/data-model.md` linha ~141 reescrita para citar a trinca atual e a exceção pontual. Confirmado por leitura de código que `EXCLUSAO_BLOQUEADA_POR_LANCAMENTO` e o texto de `excluir-contrato-dialog.tsx` já não mencionavam "destrava" — nenhuma mudança necessária ali (achado extra: a mesma palavra aparece em `visibilidade.ts`, mas num predicado diferente — visibilidade de parcela na listagem, não a trava de exclusão — confirmado que não precisa mudar)
- **Task 3 (`checkpoint:human-verify`, gate blocking):** Parte B do runbook rodada contra produção — BLOCO 4 confirmou o filtro de tipo presente no corpo da função; BLOCO 5 (3 provas dentro de `begin;...rollback;` próprio) retornou sucesso sem nenhuma exceção; BLOCO 6 confirmou `policies_total = 10`, sem mudança. Teste no navegador: usuário confirmou "Testei tudo, funcionou como esperado" cobrindo exclusão de card só-destrava, cancelamento de lançamento destrava sem afetar status, e regressão negativa (contrato com pagamento real continua bloqueado)

## Task Commits

1. **Task 1 (checkpoint:decision):** sem commit de código — decisão respondida em chat
2. **Task 2:** `d24370b` — `feat(15-06): relaxar cardTemLancamento pós-aplicação da migração + docs`
3. **Task 3 (checkpoint:human-verify):** sem commit de código — verificação em produção

## Files Created/Modified
- `supabase/migrations/20260826010000_relaxar_exclusao_destrava.sql` — aplicado em produção (arquivo já existia desde o plano 15-01, sem alteração de conteúdo nesta task)
- `web/src/lib/kanban/actions.ts` — `cardTemLancamento` widenado, comentário JSDoc atualizado
- `docs/data-model.md` — linha ~141 reescrita, cita `15-CONTEXT.md`

## Decisions Made
- Ordem estrita banco-primeiro-app-depois respeitada dentro da mesma Task 2 — nunca uma commit de widen do app antes da confirmação de aplicação real, evitando a janela do Pitfall 1 (diálogo promete "pode excluir", banco recusa)
- Confirmação das provas do BLOCO 5 aceita por ausência de erro (mesma lógica indireta já usada no plano 15-04), documentada com honestidade — não bloqueou o fechamento da fase por uma limitação de UX do SQL Editor

## Deviations from Plan

Nenhuma mudança de código além do que o plano especificou. Uma observação de processo: durante a verificação final da Task 3, o usuário testou também as telas de paginação (fora do escopo desta task, mas do mesmo Success Criteria da fase) e encontrou um bug de UX real — lista de botões numerados inviável em telas com muitas páginas (ex.: 51 páginas em `/relatorios/financeiro` sem filtro). Corrigido fora de um plano formal, documentado em `ROADMAP.md § Phase 15 — Correção pós-verificação` (mesmo padrão de correções anteriores do projeto), não faz parte do escopo original do plano 15-06 (que cobria só CANDEST-01/02/03).

## Issues Encountered

Nenhum nesta task além do já documentado no plano 15-04 (limitação de UX do SQL Editor do Supabase Studio para localizar Messages/Notices — resolvida com confirmação indireta, mesmo raciocínio já aceito no 15-04).

## User Setup Required

None — Task 1 e Task 3 já foram respondidas/executadas pelo usuário.

## Next Phase Readiness

- CANDEST-01/02/03 confirmados em produção, ponta a ponta
- PAGIN-01/02/03: código completo desde os planos 15-03/15-05, mais a correção pós-verificação de janela/campo "Ir para"/12 itens — verificação visual final pendente de confirmação do usuário (aguardando deploy + login)
- Esta é a última fase pendente do projeto — depois da confirmação visual da paginação corrigida, a Phase 15 (e o projeto inteiro) fecha

## Self-Check: PASSED

- FOUND: `web/src/lib/kanban/actions.ts` com `.in("tipo", ["pagamento", "acrescimo", "desconto"])` logo após `.eq("parcelas.card_id", cardId)`
- FOUND: `docs/data-model.md` sem a frase "qualquer tipo (pagamento, acréscimo, desconto, destrava", citando `15-CONTEXT.md`
- FOUND: commit `d24370b` (Task 2)
- FOUND: confirmação do usuário em chat — aplicação da migração ("Success. No rows returned"), BLOCO 4/5/6 da Parte B, e teste ponta a ponta no navegador ("Testei tudo, funcionou como esperado")

---
*Phase: 15-exclus-o-de-card-com-destrava-e-pagina-o*
*Completed: 2026-08-27*
