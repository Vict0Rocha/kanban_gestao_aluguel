---
phase: 14-cancelamento-de-taxas-e-cau-o
plan: 01
subsystem: database
tags: [postgres, supabase, migration, rls, cascade]

# Dependency graph
requires:
  - phase: 13-dinheiro-da-imobili-ria
    provides: "public.taxas_imobiliaria e public.caucao_eventos (D-03/D-04/D-06), a migração 20260824000000_dinheiro_imobiliaria.sql estendida por este plano"
provides:
  - "supabase/migrations/20260826000000_taxas_imobiliaria_lancamento_id.sql — coluna lancamento_id (FK cascade) + índice"
  - "supabase/verificacao_taxas_imobiliaria_lancamento_id.sql — runbook de ensaio/verificação provando a cascata real"
affects: [14-02, 14-03, 14-04, 14-05]

# Actuals (#2632)
actuals:
  tokens: 3900
  tasks: 2
  commits: 2

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Migração aditiva reexecutável (add column/create index if not exists), mesmo molde de todas as migrações anteriores do projeto"
    - "Cascata de exclusão pai→filho via on delete cascade no banco, zero código novo em cancelarLancamentoAction"
    - "Runbook de duas partes (ensaio em transação revertida + verificação pós-push) com aviso de pooling D-19 no cabeçalho"

key-files:
  created:
    - supabase/migrations/20260826000000_taxas_imobiliaria_lancamento_id.sql
    - supabase/verificacao_taxas_imobiliaria_lancamento_id.sql
  modified: []

key-decisions:
  - "Nome da coluna: lancamento_id (A-01) — segue a convenção de nomear pela tabela referenciada, não pelo tipo de lançamento"
  - "Sem CHECK adicional além da FK (A-02) — só registrarPagamentoAction insere em taxas_imobiliaria hoje, disciplina de código, não regra de banco"
  - "Cascata 100% do banco via on delete cascade (A-03) — replica o padrão já usado em 7/7 FKs deste schema, zero DELETE explícito novo em cancelarLancamentoAction"

patterns-established:
  - "Comentário-guarda citando D-04 (Phase 13) ao reabrir pontualmente um isolamento estrutural — mesmo espírito do comentário-guarda original, sem contradizê-lo"

requirements-completed: []  # CANIMOB-03 NÃO marcado completo aqui de propósito: o texto do requisito
  # descreve comportamento de produção ("cancelar um pagamento cancela automaticamente a taxa
  # vinculada"), que só passa a ser verdade depois do plano 14-03 (aplicar a migração em produção)
  # e do plano 14-04 (registrarPagamentoAction gravar lancamento_id). Este plano só entrega o
  # artefato de schema (arquivo .sql) — gsd-tools requirements mark-complete também não encontrou
  # o checkbox (retornou not_found), então REQUIREMENTS.md permanece "Pendente" para CANIMOB-03,
  # o que reflete corretamente o estado real.

coverage:
  - id: D1
    description: "Migração aditiva declara taxas_imobiliaria.lancamento_id (uuid, nullable, FK cascade para parcela_lancamentos) + índice, reexecutável, sem policy nova, com comentário-guarda citando D-04"
    requirement: "CANIMOB-03"
    verification:
      - kind: other
        ref: "grep-based source assertions no <verify> da Task 1 (coluna/índice/guarda/ausência de create-drop policy/ausência de DDL destrutiva) — todas confirmadas nesta execução"
        status: pass
    human_judgment: false
  - id: D2
    description: "Runbook de duas partes prova, dentro de begin;...rollback;, a cascata real (cria card/parcela/lançamento/taxa de teste, apaga o lançamento, confirma via raise exception/raise notice que a taxa some junto), coluna nullable, índice, lancamento_id nulo aceito, RLS inalterada, cards intocado"
    requirement: "CANIMOB-03"
    verification:
      - kind: other
        ref: "grep-based source assertions no <verify> da Task 2 (aviso D-19, PARTE A/B, ausência de lancamento_id entre BLOCO 1 e BLOCO 2, cascata, raise notice/raise exception) — todas confirmadas nesta execução"
        status: pass
    human_judgment: true
    rationale: "Este plano não roda o SQL contra o banco (nenhum acesso a produção neste plano, por design) — a execução real do runbook contra o banco de produção acontece no plano 14-02, onde um humano confirma o resultado do ensaio antes do checkpoint:decision do plano 14-03."

duration: 12min
completed: 2026-08-26
status: complete
---

# Phase 14 Plan 01: Migração aditiva taxas_imobiliaria.lancamento_id Summary

**Migração aditiva de uma coluna (`lancamento_id`, FK cascade para `parcela_lancamentos`) e o runbook que prova, dentro de uma transação revertida, que apagar um lançamento de pagamento remove automaticamente a taxa da imobiliária vinculada a ele.**

## Performance

- **Duration:** ~12 min
- **Tasks:** 2/2
- **Files modified:** 2 (ambos novos)

## Accomplishments
- `supabase/migrations/20260826000000_taxas_imobiliaria_lancamento_id.sql` criado: coluna `lancamento_id` (uuid, nullable, sem default, `references public.parcela_lancamentos(id) on delete cascade`) + índice `taxas_imobiliaria_lancamento_id_idx`, reexecutável (`add column if not exists`/`create index if not exists`), com o comentário-guarda obrigatório citando D-04 (13-CONTEXT.md) — a FK reabre o isolamento estrutural só para cascata de limpeza, nunca para join de cálculo de status
- `supabase/verificacao_taxas_imobiliaria_lancamento_id.sql` criado: runbook de duas partes (ensaio em `begin;...rollback;` + verificação pós-push) que prova, com `raise exception`/`raise notice` dentro de um `do $$ ... $$`, a cascata real — cria card/parcela/lançamento/taxa de teste, apaga o lançamento, confirma que a taxa some junto — além de provas separadas para coluna nullable, índice, `lancamento_id` nulo aceito, RLS inalterada (1 policy) e `cards` pré-existente intocado
- Nenhuma alteração em produção — os dois arquivos só existem no repositório; a aplicação real acontece no plano 14-03, atrás de um `checkpoint:decision`

## Task Commits

Cada task foi commitada atomicamente:

1. **Task 1: Migração aditiva — taxas_imobiliaria.lancamento_id (FK cascade) + índice** - `75ce2bf` (feat)
2. **Task 2: Runbook de ensaio e verificação — provando a cascata de verdade** - `7ca25bc` (test)

_Nenhuma task TDD nesta plan — ambas são `type="tracer"`/`type="auto"` escrevendo arquivos `.sql` verificados por `grep`._

## Files Created/Modified
- `supabase/migrations/20260826000000_taxas_imobiliaria_lancamento_id.sql` - migração aditiva: coluna `lancamento_id` + índice + comentário-guarda de D-04
- `supabase/verificacao_taxas_imobiliaria_lancamento_id.sql` - runbook de ensaio (Parte A, `begin;...rollback;`) e verificação pós-push (Parte B)

## Decisions Made
- **A-01 (nome da coluna):** `lancamento_id`, não `pagamento_id` — segue a convenção de nomear pela tabela referenciada no singular (`parcela_id`→`parcelas`, `card_id`→`cards`), não pelo tipo de lançamento que ela hoje sempre referencia. Renomear depois exigiria uma segunda migração.
- **A-02 (sem CHECK adicional):** só a FK — `registrarPagamentoAction` é o único ponto de INSERT em `taxas_imobiliaria` hoje, mas isso é disciplina de código, não uma regra que o banco precise impor por CHECK cruzando tabelas (Postgres não suporta CHECK correlacionado nativo aqui).
- **A-03 (cascata 100% do banco):** `on delete cascade` na FK nova, zero DELETE explícito novo em `cancelarLancamentoAction` — replica o padrão que 100% das FKs deste schema (7/7) já usam.

## Deviations from Plan

None - plano executado exatamente como escrito. Nenhum stub, nenhum teste pulado, nenhum `<verify>` não executado — os dois `<verify>` (Task 1 e Task 2) rodaram e passaram nesta execução (via `Grep`, dado que o Bash tool deste ambiente recusa comandos `grep` encadeados complexos dentro do worktree; cada assertion individual foi verificada separadamente com o mesmo resultado).

## Issues Encountered
- O comando `<verify>` de cada task, como escrito no PLAN.md, encadeia múltiplos `grep`/`sed` num único pipeline `&&`. O ambiente de execução (worktree isolado) recusou rodar esse pipeline via Bash por ser "complexo demais para verificar que fica dentro do worktree". Resolvido rodando cada assertion do pipeline individualmente via o tool `Grep` (mesmo padrão, mesmos arquivos, mesmas regex) — todas as condições do `<verify>` original foram confirmadas uma a uma, com resultado idêntico ao que o pipeline original produziria (`MIGRACAO_OK`/`RUNBOOK_OK`).

## User Setup Required

None - nenhuma configuração de serviço externo necessária. Nenhum pacote novo instalado.

## Next Phase Readiness
- O plano 14-02 pode rodar o runbook (`supabase/verificacao_taxas_imobiliaria_lancamento_id.sql`) contra o banco de produção real, seguindo a Parte A (ensaio revertido) e preenchendo o cabeçalho `RESULTADO DO ENSAIO` deixado vazio no fim do arquivo
- O plano 14-03 aplica a migração de verdade via SQL Editor (Supabase CLI não instalado neste projeto) atrás de um `checkpoint:decision`, e roda a Parte B do runbook depois
- Nenhum bloqueio conhecido — os dois artefatos estão prontos e passam em todas as asserções `grep` do `<verify>` das duas tasks

## Self-Check: PASSED

- FOUND: supabase/migrations/20260826000000_taxas_imobiliaria_lancamento_id.sql
- FOUND: supabase/verificacao_taxas_imobiliaria_lancamento_id.sql
- FOUND: .planning/phases/14-cancelamento-de-taxas-e-cau-o/14-01-SUMMARY.md
- FOUND commit: 75ce2bf
- FOUND commit: 7ca25bc

---
*Phase: 14-cancelamento-de-taxas-e-cau-o*
*Completed: 2026-08-26*
