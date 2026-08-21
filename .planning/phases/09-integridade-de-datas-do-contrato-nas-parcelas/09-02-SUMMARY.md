---
phase: 09-integridade-de-datas-do-contrato-nas-parcelas
plan: 02
subsystem: database
tags: [sql, supabase, postgres, runbook, data-cleanup, rls]

# Dependency graph
requires:
  - phase: 09-integridade-de-datas-do-contrato-nas-parcelas (plan 01)
    provides: "Mesmo critério D-02 (status='aberta' + zero lançamento + fora do período), reimplementado aqui diretamente em SQL — este plano não depende do código de updateCardAction existir para rodar"
provides:
  - "supabase/limpeza_parcelas_orfas.sql — runbook SQL de limpeza pontual (BLOCO 1 leitura, BLOCO 2 exclusão real sem rollback, BLOCO 3 conferência pós-exclusão)"
  - "docs/data-model.md atualizado documentando que a poda ativa de parcelas órfãs reverte D-03 (D-01, Phase 9)"
  - "27 parcelas órfãs que já existiam em produção antes da Phase 9 removidas de verdade, confirmado por BLOCO 3"
affects: [09-integridade-de-datas-do-contrato-nas-parcelas, financeiro, relatorios]

# Actuals (#2632)
actuals:
  tokens: 2500
  tasks: 3
  commits: 1

tech-stack:
  added: []
  patterns:
    - "Runbook SQL revisável fora de supabase/migrations/ para exclusão pontual de dado real — BLOCO-numerado, leitura antes de exclusão, DELETE final sem begin/rollback (D-08)"

key-files:
  created:
    - supabase/limpeza_parcelas_orfas.sql
  modified:
    - docs/data-model.md

key-decisions:
  - "BLOCO 2 do runbook não usa begin/rollback, ao contrário de todo outro script deste projeto — a intenção declarada é gravar de verdade depois de revisão humana (D-08)"
  - "Divergência entre a expectativa inicial (~27 linhas/2 contratos) e a primeira releitura do BLOCO 1 pelo humano (35 linhas/3 contratos, incluindo o contrato #61 'ENDEREÇO' não visto antes) foi investigada antes de autorizar — usuário confirmou que #61 também é dado de teste"
  - "Entre a autorização da Task 2 e a execução real da Task 3, a poda síncrona da Phase 9 (plano 09-01) já havia removido o contrato #61 durante testes manuais em produção — o BLOCO 1 relido imediatamente antes do BLOCO 2 mostrou 27 linhas (não mais 35), e o BLOCO 2 apagou exatamente essas 27, sem drift"

patterns-established:
  - "Pattern: runbook de limpeza pontual (não repetível) documentado explicitamente como tal no cabeçalho do arquivo, distinto de runbooks de verificação recorrentes"

requirements-completed: [INTEG-05]

coverage:
  - id: D1
    description: "Script supabase/limpeza_parcelas_orfas.sql criado fora de supabase/migrations/, com BLOCO 1 (leitura), BLOCO 2 (exclusão real, predicado idêntico ao BLOCO 1, sem rollback) e BLOCO 3 (conferência pós-exclusão)"
    requirement: INTEG-05
    verification:
      - kind: other
        ref: "grep automatizado no plano (BLOCO 1/2/3 presentes, predicado idêntico, ausência de begin;/rollback;) — LIMPEZA_OK"
        status: pass
    human_judgment: false
  - id: D2
    description: "docs/data-model.md documenta que D-03 foi deliberadamente revertida por D-01 na Phase 9, com o novo critério e o porquê, sem apagar o item original"
    requirement: INTEG-05
    verification:
      - kind: other
        ref: "grep automatizado no plano (D-01 e 'reverte D-03' presentes em docs/data-model.md)"
        status: pass
    human_judgment: false
  - id: D3
    description: "As 27 parcelas órfãs já existentes em produção antes da Phase 9 foram removidas de verdade via BLOCO 2, confirmado por BLOCO 3 (zero órfãs restantes, contagem total consistente)"
    requirement: INTEG-05
    verification:
      - kind: manual_procedural
        ref: "Humano rodou BLOCO 1/BLOCO 2/BLOCO 3 no SQL Editor de produção, mesma aba/sessão; resultado relatado ao executor (27/27 linhas batendo, parcelas_total_depois = 357, BLOCO 3 query 2 sem linhas)"
        status: pass
    human_judgment: true
    rationale: "DELETE real e irreversível contra dado financeiro de produção — só o operador tem acesso ao SQL Editor; a confirmação depende do resultado real da query, não de suposição do executor"

duration: ~50min (com pausas para checkpoints humanos)
completed: 2026-08-21
status: complete
---

# Phase 9 Plan 2: Limpeza das parcelas órfãs pré-existentes Summary

**Runbook SQL revisável (`supabase/limpeza_parcelas_orfas.sql`) removeu de verdade as 27 parcelas órfãs que já existiam em produção antes da Phase 9, e `docs/data-model.md` agora documenta que essa poda ativa reverte deliberadamente D-03.**

## Performance

- **Duration:** ~50min (Task 1 automática; Tasks 2 e 3 pausaram para decisão e ação humana em produção)
- **Started:** 2026-08-20T19:16:49Z (aprox., commit da Task 1)
- **Completed:** 2026-08-21T00:16:46Z
- **Tasks:** 3/3
- **Files modified:** 2 (código/docs) + 1 runbook executado em produção (sem alteração de arquivo na Task 3)

## Accomplishments

- `supabase/limpeza_parcelas_orfas.sql` criado fora de `supabase/migrations/`, com BLOCO 1 (leitura), BLOCO 2 (exclusão real, sem `rollback`) e BLOCO 3 (conferência pós-exclusão), predicado idêntico ao critério D-02 (`status='aberta'` + zero lançamento + fora do período atual, nas duas direções)
- `docs/data-model.md` ganhou um novo item na lista "Decisões de design" documentando que a poda ativa (D-01, Phase 9) reverte D-03 (Phase 6.2), sem apagar o item original
- As 27 parcelas órfãs que já existiam em produção antes desta fase foram removidas de verdade, confirmado pelo BLOCO 3 (zero órfãs restantes)

## Task Commits

Cada task foi commitada individualmente:

1. **Task 1: Escrever o runbook de limpeza e documentar a reversão de D-03** - `9905384` (feat)
2. **Task 2: Autorizar a exclusão real das parcelas órfãs já existentes em produção** - checkpoint:decision, sem commit próprio (decisão registrada abaixo)
3. **Task 3: Rodar o BLOCO 2 e confirmar o resultado** - sem commit próprio (nenhum arquivo alterado; ação operacional em produção, resultado registrado abaixo)

**Plan metadata:** commit final de documentação (SUMMARY.md), ver final_commit

## Files Created/Modified

- `supabase/limpeza_parcelas_orfas.sql` - runbook de limpeza pontual (BLOCO 1/2/3), fora de `supabase/migrations/`
- `docs/data-model.md` - novo item documentando a reversão de D-03 por D-01 (Phase 9)

## Decisões Made

- **Task 2 (checkpoint:decision), opção `aplicar-agora`:** o usuário rodou o BLOCO 1 no SQL Editor de produção antes de decidir, como o checkpoint exigia. O resultado inicial (35 linhas em 3 contratos: #59 "A" com 15 linhas, #54 "outro" com 13 linhas, e um terceiro contrato #61 "ENDEREÇO" com 7 linhas, não visto na sessão de investigação anterior que estimava ~27/2 contratos) divergiu da expectativa. Seguindo a própria instrução do checkpoint ("se a lista vier muito diferente... pare e investigue"), a divergência foi levantada ao usuário antes de autorizar. O usuário confirmou que o contrato #61 também é dado de teste ("O contrato 61 é só um teste, depois eu vou excluir"), então nenhuma correção de predicado foi necessária — a divergência era só um terceiro contrato de teste fora do escopo da investigação original.
- **Race observada entre a autorização e a execução:** entre a Task 2 (autorização) e a Task 3 (execução real), a poda síncrona da própria Phase 9 (plano 09-01, já mergeado em `updateCardAction`) removeu o contrato #61 durante testes manuais em produção do plano 09-01. Por isso o BLOCO 1 relido imediatamente antes do BLOCO 2 (na mesma sessão da Task 3) já mostrava 27 linhas, não mais 35 — e o BLOCO 2 apagou exatamente essas 27, com `returning` batendo linha por linha com a releitura. Isso não é um bug: é o comportamento correto e esperado do runbook (mesma defesa contra race do BLOCO 1→BLOCO 2 que o plano documenta) — a poda síncrona de produção já havia feito parte do trabalho antes do runbook rodar.

## Resultado real da execução (Task 3, em produção)

Rodado pelo usuário no SQL Editor de produção, na mesma aba usada para a releitura do BLOCO 1:

- **BLOCO 1 (releitura imediatamente antes do BLOCO 2):** 27 linhas, concentradas nos contratos de teste `#54 "outro"` e `#59 "A"`. Nenhum contrato inesperado — o `#61 "ENDEREÇO"` que aparecera na primeira leitura já não aparecia mais, por ter sido podado pela poda síncrona da Phase 9 durante testes manuais em produção do plano 09-01, entre a Task 2 e a Task 3 deste plano.
- **BLOCO 2 (`DELETE ... returning`):** 27 linhas apagadas, mesmos `id`/`competencia` exatos da releitura do BLOCO 1 — sem drift entre o que foi mostrado e o que foi apagado.
- **BLOCO 3, query 1 (contagem pós-exclusão):** `parcelas_total_depois = 357`.
- **BLOCO 3, query 2 (repetição do `select` do BLOCO 1):** "Success. No rows returned" — zero órfãs restantes, confirmando que o critério D-02 não encontra mais candidatas e que a exclusão funcionou como esperado.

As acceptance criteria da Task 3 estão satisfeitas: o `returning` do BLOCO 2 bate linha por linha com a releitura do BLOCO 1, e o `select` repetido no BLOCO 3 devolveu zero linhas.

## Deviations from Plan

Nenhuma no código ou no runbook — o script e a documentação foram escritos exatamente como especificado. Duas observações operacionais, não desvios de escopo:

1. **Divergência investigada na Task 2** (contrato #61 aparecendo na primeira leitura) — resolvida por confirmação do usuário, sem alteração no predicado. Documentado em "Decisões Made" acima.
2. **Race benigna entre autorização (Task 2) e execução (Task 3)** — a poda síncrona do plano 09-01 já havia removido uma das linhas candidatas (contrato #61) antes do BLOCO 2 rodar, então o número final apagado (27) é menor que o número visto na primeira leitura da Task 2 (35). Isso é o comportamento correto e esperado de duas defesas independentes se sobrepondo (poda automática de código + limpeza manual pontual), não um bug.

**Total deviations:** 0 no código; 2 observações operacionais documentadas acima, ambas sem impacto na correção do resultado final.

## Issues Encountered

Nenhum problema técnico. O único ponto de atenção foi a divergência de contagem inicial na Task 2, tratada pelo próprio fluxo de investigação que o checkpoint já previa.

## Nota fora do escopo deste plano (contexto para leitura futura)

Durante a verificação em produção do plano 09-01, o usuário encontrou um gap não coberto pelas decisões originais da Phase 9: remover só `periodo_fim` de um card com parcelas futuras já geradas não podava nada, porque `periodo_fim` nulo virava "sem teto" em `competenciaNoPeriodo`. Documentado como **D-09** em `09-CONTEXT.md` e corrigido diretamente em `main` (commit `b07dd07`), fora deste worktree e fora do escopo deste plano — citado aqui só como contexto de que a Phase 9 teve esse achado adicional pós-execução, sem exigir nenhuma ação deste plano 09-02.

## User Setup Required

None - nenhuma configuração de serviço externo necessária.

## Next Phase Readiness

- INTEG-05 fechado: as 27 parcelas órfãs pré-existentes não existem mais em produção, e `docs/data-model.md` documenta a reversão de D-03.
- Este plano (09-02) é independente do plano 09-01 e não bloqueia nem depende dele para fechar a Phase 9 — ambos, juntos, fecham o escopo da fase.
- Nenhum blocker identificado para a Phase 9 seguir para fechamento, pendente apenas da revisão/merge deste worktree pelo usuário.

---
*Phase: 09-integridade-de-datas-do-contrato-nas-parcelas*
*Completed: 2026-08-21*

## Self-Check: PASSED

- FOUND: `supabase/limpeza_parcelas_orfas.sql`
- FOUND: `.planning/phases/09-integridade-de-datas-do-contrato-nas-parcelas/09-02-SUMMARY.md`
- FOUND: commit `9905384` in `git log --oneline --all`
