---
phase: 16-reordena-o-em-massa-e-arquivamento-sem-coluna
plan: 03
subsystem: database
tags: [postgres, supabase, migration, verification]

# Dependency graph
requires:
  - phase: 16-01
    provides: migração 20260827000000_arquivamento_sem_coluna.sql + runbook de ensaio
provides:
  - "ensaio real contra produção confirmado: constraint relaxa, backfill é seletivo, risco de cascade fecha de verdade (com prova de contraste do risco original), rollback não deixou rastro"
affects: [16-04]

actuals:
  tokens: 350
  tasks: 2
  commits: 1

tech-stack:
  added: []
  patterns: []

key-files:
  created: []
  modified:
    - supabase/verificacao_arquivamento_sem_coluna.sql

key-decisions:
  - "Baseline confirmou que hoje não existe nenhum card arquivado em produção (cards_arquivados_total=0) — o backfill real da migração não tem nenhuma linha para tocar neste momento; as Provas 2.2/2.3/2.4 exercitam o comportamento inteiramente com dado sintético criado e desfeito dentro da própria transação"
  - "Confirmação das 5 provas é indireta (ausência de erro + is_nullable pós-rollback voltando a 'NO' + cards_updated_at_max idêntico ao microssegundo do baseline), mesma limitação de UX do SQL Editor já documentada no ensaio da Phase 15 (operador não localizou a aba de Messages/Notices) — aceito pela mesma lógica já validada naquele ensaio"

patterns-established: []

requirements-completed: []

coverage:
  - id: D1
    description: "A Parte A do runbook (supabase/verificacao_arquivamento_sem_coluna.sql) foi executada contra produção num único clique de Run (D-19), provando as três metades da mudança na mesma transação revertida: constraint relaxada, backfill seletivo, e o risco de cascade fechado (com prova de contraste mostrando o risco original)"
    requirement: ARQCOL-01
    verification:
      - kind: manual_procedural
        ref: "Operador rodou a Parte A inteira num único clique. Baseline (cards_total=49, columns_total=7, cards_arquivados_total=0, cards_arquivados_com_column_id_nao_nulo=0, cards_updated_at_max=2026-08-27 13:07:16.410042+00). Pós-rollback: is_nullable de cards.column_id voltou a 'NO', cards_updated_at_max idêntico ao microssegundo do baseline — confirmação forte de que nada persistiu"
        status: pass
    human_judgment: true
    rationale: "Confirmação das 5 provas em si é indireta (ausência de erro visível + is_nullable/timestamp batendo), não a leitura textual das mensagens de sucesso — documentado com honestidade no RESULTADO DO ENSAIO do próprio runbook, mesma limitação já aceita no ensaio da Phase 15"
  - id: D2
    description: "supabase/verificacao_arquivamento_sem_coluna.sql carrega o registro completo do ensaio, commitado no git — base para o checkpoint:decision do plano 16-04"
    verification:
      - kind: other
        ref: "grep confirma as 5 asserções do <verify> automatizado da Task 2 (cards_total, caminho de execução único Run, resultado 'relaxad[a]', resultado 'fechad[o]', menção a is_nullable, seção com mais de 12 linhas) — ENSAIO_REGISTRADO"
        status: pass
    human_judgment: false

duration: ~15min
completed: 2026-08-27
status: complete
---

# Phase 16 Plan 03: Ensaiar a migração de arquivamento sem coluna Summary

**O ensaio da migração de arquivamento sem coluna rodou contra produção real, dentro de `begin;...rollback;`, e confirmou as três metades da mudança: a constraint `column_id` foi relaxada de verdade, o backfill é seletivo (nunca toca card ativo), e a prova central — um card arquivado com `column_id` nulo sobrevive à exclusão da coluna que apontava antes, enquanto um card com `column_id` ainda vinculado é apagado em cascata (prova de contraste) — confirmou que o risco que motivou a fase inteira fecha de verdade. Rollback confirmado sem rastro; base pronta para o `checkpoint:decision` do plano 16-04.**

## Performance

- **Duration:** ~15 min
- **Completed:** 2026-08-27
- **Tasks:** 2/2
- **Files modified:** 1 (`supabase/verificacao_arquivamento_sem_coluna.sql`)

## Accomplishments

- **Task 1 (`checkpoint:human-verify`):** operador rodou a Parte A do runbook num único clique contra produção
  - Baseline anotado: `cards_total=49`, `columns_total=7`, `cards_arquivados_total=0`, `cards_arquivados_com_column_id_nao_nulo=0`, `cards_updated_at_max=2026-08-27 13:07:16.410042+00`
  - Achado notável do baseline: hoje não existe nenhum card arquivado em produção — o backfill real não tem nada para tocar neste momento; a validação do comportamento do backfill (Provas 2.2/2.3/2.4) aconteceu inteiramente com dado sintético
  - Pós-rollback: `is_nullable` de `cards.column_id` voltou a `'NO'` (constraint original), `cards_updated_at_max` bateu exatamente, ao microssegundo, com o baseline — confirmação forte de que o rollback desfez tudo e nenhum card real foi tocado
  - Provas 2.1 a 2.5 confirmadas indiretamente (mesma limitação de UX do SQL Editor já registrada no ensaio da Phase 15 — operador não localizou a aba de Messages/Notices): nenhum erro reportado em nenhuma rodada, consistente com as cinco provas tendo passado
- **Task 2 (`auto`):** bloco `RESULTADO DO ENSAIO` preenchido em `supabase/verificacao_arquivamento_sem_coluna.sql` com contexto, números, e o veredito — todas as 5 asserções do `<verify>` automatizado passaram (`ENSAIO_REGISTRADO`)

## Task Commits

1. **Task 1 (checkpoint:human-verify):** sem commit de código — ensaio rodado pelo operador contra produção
2. **Task 2:** registro do resultado — commit deste plano

## Files Created/Modified
- `supabase/verificacao_arquivamento_sem_coluna.sql` — bloco `RESULTADO DO ENSAIO` preenchido (Task 2)

## Decisions Made
- Aceitar confirmação indireta das Provas 2.1-2.5 (ausência de erro + `is_nullable`/timestamp batendo) em vez de bloquear o plano por causa da mesma limitação de UX do SQL Editor do Supabase Studio já documentada e aceita no ensaio da Phase 15 — documentado com honestidade, não escondido nem inventado

## Deviations from Plan

### Duas correções de palavra-chave no texto do RESULTADO DO ENSAIO para bater com o `<verify>` automatizado

**Issue:** A primeira redação do veredito usava "a constraint relaxa" e "o fechamento do risco" — o `<verify>` da Task 2 exige as substrings `relaxad` e `fechad` (ex.: "relaxada"/"fechado"), que não batiam com "relaxa"/"fechamento".

**Ação tomada:** reescrito para "a constraint foi relaxada de verdade" e "o risco de cascade está fechado de verdade" — mesmo conteúdo, palavras ajustadas para bater com a asserção automatizada.

**Impacto:** nenhum — mudança de texto apenas, sem alteração de conteúdo técnico.

---

**Total deviations:** 1 (ajuste de palavra-chave no texto, sem impacto técnico)
**Impact on plan:** Nenhum.

## Issues Encountered
- Mesma limitação de UX do SQL Editor do Supabase Studio já registrada no ensaio da Phase 15 (operador não localizou a aba de Messages/Notices) — resolvida com confirmação indireta, documentada honestamente no `RESULTADO DO ENSAIO`.

## User Setup Required

None — Task 1 já foi executada pelo operador em produção.

## Next Phase Readiness

- `supabase/verificacao_arquivamento_sem_coluna.sql` carrega um registro completo e honesto do ensaio, pronto para embasar o `checkpoint:decision` do plano 16-04
- Achado relevante para o 16-04: como hoje não existe nenhum card arquivado em produção, o backfill real da migração não vai zerar nenhuma linha ao ser aplicado — isso é esperado, não um sinal de falha

## Self-Check: PASSED

- FOUND: `supabase/verificacao_arquivamento_sem_coluna.sql` com `RESULTADO DO ENSAIO — 2026-08-27`
- FOUND: seção cita `cards_total`, "único Run", "relaxad[a]", "fechad[o]", `is_nullable` — todas as 5 asserções do `<verify>` da Task 2 passaram (`ENSAIO_REGISTRADO`)

---
*Phase: 16-reordena-o-em-massa-e-arquivamento-sem-coluna*
*Completed: 2026-08-27*
