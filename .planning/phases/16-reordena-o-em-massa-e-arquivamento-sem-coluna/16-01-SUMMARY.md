---
phase: 16-reordena-o-em-massa-e-arquivamento-sem-coluna
plan: 01
subsystem: banco (migração + runbook de ensaio)
tags: [supabase, migration, schema, cards, arquivamento]
status: complete

dependency-graph:
  requires: []
  provides:
    - "supabase/migrations/20260827000000_arquivamento_sem_coluna.sql (não aplicada em produção — objeto do plano 16-04)"
    - "supabase/verificacao_arquivamento_sem_coluna.sql (RESULTADO DO ENSAIO vazio, a preencher no plano 16-03)"
  affects:
    - "16-03 (ensaio contra produção, depende diretamente desta migração/runbook)"
    - "16-04 (aplicação real + widen de arquivarCardAction/desarquivarCardAction, depende de 16-03)"

tech-stack:
  added: []
  patterns:
    - "alter table ... alter column ... drop not null — primeira migração deste projeto a relaxar uma constraint not null (todas as anteriores foram create or replace function sobre trigger)"
    - "backfill na MESMA migração da constraint relaxada (Pitfall 1, 16-RESEARCH.md), nunca um follow-up separado"

key-files:
  created:
    - supabase/migrations/20260827000000_arquivamento_sem_coluna.sql
    - supabase/verificacao_arquivamento_sem_coluna.sql
  modified: []

decisions:
  - "Migração feita em duas statements na mesma transação lógica: alter column (relaxa constraint) + update de backfill (arquivado_em is not null), seguindo Pitfall 1 de 16-RESEARCH.md à risca — sem isso, cards já arquivados antes da Phase 16 continuariam vulneráveis ao risco de cascade que a fase existe para fechar"
  - "Runbook segue o formato de duas partes já estabelecido em verificacao_relaxar_exclusao_destrava.sql (Phase 15): Parte A ensaio em begin/rollback, Parte B verificação pós-push, aviso de pooling D-19 no topo"
  - "Prova 2.4 (contraste) reproduz deliberadamente o comportamento pré-Phase-16 — um card arquivado com column_id ainda apontando para a coluna excluída é apagado em cascata — para documentar, dentro do próprio runbook, que o risco de D-02 era real antes desta migração"

metrics:
  duration: "~20min"
  completed: "2026-08-27"

actuals:
  tokens: 5283
  tasks: 2
  commits: 2
---

# Phase 16 Plan 01: Migração + runbook — arquivamento sem coluna Summary

Migração aditiva que relaxa `cards.column_id` de `not null` para nullable, com o backfill dos cards já arquivados na mesma migração, e o runbook de ensaio de duas partes que prova — dentro de uma transação revertida — as três metades da mudança: constraint relaxada, backfill seletivo, e o fechamento real do risco de cascade de D-02 (com bloco de contraste).

## What Was Built

**`supabase/migrations/20260827000000_arquivamento_sem_coluna.sql`** — duas statements:
1. `alter table public.cards alter column column_id drop not null;` — relaxa a constraint, sem tocar a FK (`references public.columns(id) on delete cascade`).
2. `update public.cards set column_id = null where arquivado_em is not null;` — backfill, na mesma migração, dos cards já arquivados antes desta fase (Pitfall 1, 16-RESEARCH.md).

O comentário-guarda cita D-01 (rated `one-way`, 16-CONTEXT.md), D-02 (o achado real: hoje uma coluna excluída com um card arquivado ainda apontando pra ela apaga esse card em cascata sem aviso) e D-05 (o ripple do tipo `string | null` fica contido no Board), e explica explicitamente por que um `column_id` nulo nunca é alcançado por `on delete cascade` de `columns` — não é mais uma checagem de aplicação, é estrutural.

**`supabase/verificacao_arquivamento_sem_coluna.sql`** — runbook de duas partes:
- Aviso de pooling D-19 no topo, com as duas saídas aceitas (paste único ou `psql`/CLI) e a via alternativa `do $$ ... $$` documentada em `verificacao_cards_arquivado_em.sql`.
- **Parte A (ensaio):** BLOCO 1 baseline fora de transação → BLOCO 2 `begin;` + DDL completa + cinco provas (`do $$` com `raise notice`/`raise exception`) + `rollback;` → BLOCO 3 confirmação pós-rollback via `information_schema.columns` (`is_nullable = 'NO'`).
  - Prova 2.1: constraint relaxada (update de `column_id = null` num card recém-criado passa a funcionar).
  - Prova 2.2: backfill seletivo (card arquivado zerado, card ativo preservado).
  - Prova 2.3: prova central — coluna de teste excluída, card arquivado com `column_id` nulo sobrevive.
  - Prova 2.4: contraste — card arquivado com `column_id` propositalmente ainda apontando para a coluna excluída É apagado em cascata, documentando que o risco de D-02 era real antes desta migração.
  - Prova 2.5: contagem de `pg_policies` inalterada.
- **Parte B (pós-push):** BLOCO 4 confirma `is_nullable = 'YES'` em produção, BLOCO 5 confirma zero cards arquivados com `column_id` não nulo, BLOCO 6 confirma contagem de policies inalterada.
- `RESULTADO DO ENSAIO` deixado vazio no fim do arquivo, para o plano 16-03 preencher.

**Nada foi aplicado em produção neste plano.** Apenas os dois arquivos `.sql` foram escritos no repositório.

## Deviations from Plan

None — plano executado exatamente como escrito. As duas tasks (`tracer` e `auto`) foram completadas sem necessidade de fix automático, gate arquitetural, ou checkpoint.

## Verification

Ambas as tasks passaram nas asserções automatizadas do `<verify>` do plano:
- Task 1: presença das duas statements exatas, citações D-01/D-02/D-05, `on delete cascade` mencionado, e ausência de qualquer `drop table`/`drop column`/`rename to`/`on delete restrict`/`create policy`/`drop policy`/`create trigger`/`drop trigger` fora de comentário.
- Task 2: aviso de pooling, formato "PARTE A"/"PARTE B", `RESULTADO DO ENSAIO`, `rollback;`, "cascata", "column_id is null", "is_nullable", pelo menos um `raise notice 'OK` e um `raise exception`.

Nenhuma verificação contra o banco real aconteceu neste plano (confirmado no próprio `<verification>` do plano) — é o objeto do plano 16-03.

## Self-Check

- `supabase/migrations/20260827000000_arquivamento_sem_coluna.sql` — FOUND
- `supabase/verificacao_arquivamento_sem_coluna.sql` — FOUND
- Commit `c3ba56e` (migração) — FOUND em `git log`
- Commit `b77b769` (runbook) — FOUND em `git log`

## Self-Check: PASSED

## Next Steps

Plano 16-03 (Wave 2, depende deste) roda o ensaio real contra produção via SQL Editor, preenche `RESULTADO DO ENSAIO` neste runbook, e prepara o terreno para o `checkpoint:decision` do plano 16-04, que aplica a migração de verdade e só então amplia `arquivarCardAction`/`desarquivarCardAction`.
