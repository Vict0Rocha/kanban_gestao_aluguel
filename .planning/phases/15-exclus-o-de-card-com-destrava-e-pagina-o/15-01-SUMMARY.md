---
phase: 15-exclus-o-de-card-com-destrava-e-pagina-o
plan: 01
subsystem: database
tags: [postgres, plpgsql, trigger, supabase, migration]

requires: []
provides:
  - "Migração 20260826010000_relaxar_exclusao_destrava.sql (não aplicada em produção) que relaxa o predicado de public.impedir_exclusao_de_card_com_lancamento() para excluir tipo='destrava' do bloqueio de exclusão de card"
  - "Runbook supabase/verificacao_relaxar_exclusao_destrava.sql pronto para ensaiar a migração dentro de begin;...rollback; no plano 15-04"
affects: ["15-04 (ensaio da migração)", "15-06 (apply + widen de cardTemLancamento no app)"]

actuals:
  tokens: 4764
  tasks: 2
  commits: 2

tech-stack:
  added: []
  patterns:
    - "create or replace function sobre trigger existente (terceira iteração do mesmo padrão das Phases 6.2 e 13) — nunca create function/create trigger do zero"
    - "runbook de duas partes (ensaio em begin;...rollback; / verificação pós-push) com aviso de pooling D-19 no cabeçalho"

key-files:
  created:
    - supabase/migrations/20260826010000_relaxar_exclusao_destrava.sql
    - supabase/verificacao_relaxar_exclusao_destrava.sql
  modified: []

key-decisions:
  - "Comentários da migração evitam as substrings literais 'create trigger'/'drop trigger'/'security definer' (mesmo dentro de comentários) para não colidir com os greps de segurança do <verify> do próprio plano — reformulados sem perder o sentido"

patterns-established:
  - "Runbook de duas partes com aviso de pooling D-19 primeiro, Parte A terminando em rollback e reconfirmação via pg_get_functiondef fora da transação, Parte B com blocos independentes pós-push"

requirements-completed: [CANDEST-01]

coverage:
  - id: D1
    description: "Migração aditiva relaxa o predicado do trigger de exclusão de card: parcela_lancamentos.tipo='destrava' deixa de bloquear a exclusão, mantendo pagamento/acrescimo/desconto/taxas_imobiliaria/caucao_eventos bloqueando exatamente como hoje"
    requirement: "CANDEST-01"
    verification:
      - kind: other
        ref: "grep sobre supabase/migrations/20260826010000_relaxar_exclusao_destrava.sql — presença do filtro de tipo, ausência de create/drop trigger, create/drop policy, security definer; presença de D-01/D-03"
        status: pass
    human_judgment: true
    rationale: "Nenhuma verificação contra o banco real acontece neste plano (por desenho — o ensaio é o plano 15-04, a aplicação é o plano 15-06). A prova funcional de que o predicado relaxado funciona como pretendido só é observável rodando o runbook contra um banco Postgres real, o que não é possível a partir deste executor."
  - id: D2
    description: "Runbook prova, dentro de uma transação revertida, as duas metades da mudança: card só-destrava passa a ser excluível, card com pagamento/taxa continua bloqueado, RLS inalterada"
    verification:
      - kind: other
        ref: "grep sobre supabase/verificacao_relaxar_exclusao_destrava.sql — aviso de pooling, PARTE A/PARTE B, rollback;, provas nomeadas de destrava/pagamento, contagem de raise notice/raise exception"
        status: pass
    human_judgment: true
    rationale: "O runbook em si só é executável contra um banco Postgres real (plano 15-04) — este plano só escreve o arquivo .sql, não roda nenhum bloco dele."

duration: ~2min
completed: 2026-08-26
status: complete
---

# Phase 15 Plan 01: Migração de relaxamento da exclusão de card com destrava Summary

**Migração `create or replace function` que restringe o bloqueio de exclusão de card a `parcela_lancamentos.tipo in ('pagamento', 'acrescimo', 'desconto')`, tirando `destrava` da lista de impeditivos, mais o runbook de ensaio de duas partes que prova a mudança dentro de uma transação revertida.**

## Performance

- **Duration:** ~2 min (execução mecânica — dois arquivos `.sql` novos, sem código de aplicação)
- **Tasks:** 2/2
- **Files modified:** 2 (ambos novos)

## Accomplishments
- `supabase/migrations/20260826010000_relaxar_exclusao_destrava.sql` — terceira iteração de `create or replace function public.impedir_exclusao_de_card_com_lancamento()`: o `exists` sobre `parcela_lancamentos` ganha `and pl.tipo in ('pagamento', 'acrescimo', 'desconto')`; os `exists` de `taxas_imobiliaria`/`caucao_eventos` ficam byte-a-byte como estavam; `set search_path = ''` preservado; nenhuma linha declara `security definer`; nenhum `create trigger`/`drop trigger`/`create policy`/`drop policy`.
- `supabase/verificacao_relaxar_exclusao_destrava.sql` — runbook de duas partes: Parte A (`begin;`...`rollback;`) cria três cards de teste (só-destrava, com pagamento, com taxa) e prova via `raise notice`/`raise exception` que o primeiro passa a ser excluível e os outros dois continuam bloqueados; confirma RLS inalterada; BLOCO 3 reconfirma pós-rollback, inclusive lendo `pg_get_functiondef` fora da transação para garantir que o ensaio não virou push acidental. Parte B tem os blocos independentes para depois do plano 15-06 aplicar de verdade.
- Nada foi aplicado em produção — os dois arquivos só existem no repositório, prontos para os planos 15-04 (ensaio) e 15-06 (apply + widen do app).

## Task Commits

Each task was committed atomically:

1. **Task 1: Migração — relaxar predicado de exclusão** - `f27b8d1` (feat)
2. **Task 2: Runbook de ensaio** - `3753644` (docs)

**Plan metadata:** (final commit made by orchestrator after worktree merge)

## Files Created/Modified
- `supabase/migrations/20260826010000_relaxar_exclusao_destrava.sql` - migração aditiva, `create or replace function` sobre o trigger já existente
- `supabase/verificacao_relaxar_exclusao_destrava.sql` - runbook de ensaio (Parte A) + verificação pós-push (Parte B)

## Decisions Made
- Reformulei trechos de comentário da migração que originalmente continham as substrings literais `"create trigger"`, `"drop trigger"` e `"security definer"` (mesmo só citando que essas coisas NÃO acontecem) porque o próprio `<verify>` do plano faz `grep -c "security definer" | grep -qx 0` etc. sobre o arquivo inteiro, incluindo comentários — a substring aparecer em prosa explicativa teria feito o grep de segurança falhar mesmo a DDL estando correta. Preservei o sentido (o corpo não declara esses modificadores) sem usar as frases literais.

## Deviations from Plan

None - plan executado exatamente como escrito, com o ajuste de fraseado de comentário descrito acima (não é uma mudança de comportamento, é adequação ao próprio `<verify>` do plano).

## Issues Encountered

Nenhum. As duas primeiras versões dos arquivos passaram nos greps de verificação após o ajuste de fraseado descrito em Decisions Made.

## User Setup Required

None - no external service configuration required. Nenhuma migração foi aplicada em produção neste plano.

## Next Phase Readiness

- `supabase/migrations/20260826010000_relaxar_exclusao_destrava.sql` e `supabase/verificacao_relaxar_exclusao_destrava.sql` prontos para o plano 15-04 (ensaio real contra o banco, dentro de `begin;...rollback;`).
- `web/src/lib/kanban/actions.ts` (`cardTemLancamento`) permanece deliberadamente intocado — só muda no plano 15-06, depois desta migração estar de verdade em produção (Pitfall 1 de 15-RESEARCH.md, ordem de segurança).
- Nenhum bloqueio conhecido para os planos seguintes da Wave 1 (15-02, 15-03), que não dependem deste plano.

---
*Phase: 15-exclus-o-de-card-com-destrava-e-pagina-o*
*Completed: 2026-08-26*

## Self-Check: PASSED

- FOUND: supabase/migrations/20260826010000_relaxar_exclusao_destrava.sql
- FOUND: supabase/verificacao_relaxar_exclusao_destrava.sql
- FOUND: commit f27b8d1
- FOUND: commit 3753644
