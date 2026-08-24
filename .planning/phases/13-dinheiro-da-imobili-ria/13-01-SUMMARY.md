---
phase: 13-dinheiro-da-imobili-ria
plan: 01
subsystem: database
tags: [supabase, postgres, migration, rls, triggers]

# Dependency graph
requires:
  - phase: 06.2-ciclo-de-vida-do-contrato
    provides: "public.impedir_exclusao_de_card_com_lancamento() — a função que este plano amplia via create or replace"
  - phase: 04-funda-o-financeira
    provides: "supabase/migrations/20260816000000_financeiro_schema.sql — o molde de tabela+CHECK+índice+RLS replicado aqui"
provides:
  - "public.cards.percentual_administracao / percentual_comissao_primeiro_aluguel (numeric(5,2), not null, defaults 10/50)"
  - "public.taxas_imobiliaria — livro-razão paralelo da taxa da imobiliária, estruturalmente isolado de parcela_lancamentos (D-04)"
  - "public.caucao_eventos — histórico append-only do ciclo de caução (recebido/devolvido/usado)"
  - "public.impedir_exclusao_de_card_com_lancamento() ampliada para recusar exclusão de card com taxa ou evento de caução registrado"
  - "supabase/verificacao_dinheiro_imobiliaria.sql — runbook de ensaio/verificação para os planos 13-02/13-03"
affects: [13-02-ensaio-em-producao, 13-03-aplicar-migracao, 13-04-taxa-no-registrar-pagamento, 13-05-configuracao-financeira, 13-06-ciclo-de-caucao, 13-07-relatorio-de-reconciliacao]

actuals:
  tokens: 12048
  tasks: 2
  commits: 2

tech-stack:
  added: []
  patterns:
    - "Migração aditiva reexecutável: create table if not exists / add column if not exists / drop constraint if exists antes de add constraint / create or replace function"
    - "Livro-razão estruturalmente isolado (D-04): tabela nova em vez de tipo novo dentro de uma tabela já coberta pelo cálculo de status"
    - "RLS via public.is_team_member(), nenhum outro predicado"
    - "Backstop de exclusão: create or replace function amplia o predicado existente, nunca cria segundo trigger"

key-files:
  created:
    - supabase/migrations/20260824000000_dinheiro_imobiliaria.sql
    - supabase/verificacao_dinheiro_imobiliaria.sql
  modified: []

key-decisions:
  - "A-01 a A-05 (planner assumptions do PLAN.md) implementadas sem desvio: nomes taxas_imobiliaria/caucao_eventos, taxas_imobiliaria.parcela_id not null, caucao_eventos.valor > 0 (não >= 0), backstop ampliado via create or replace (não duplicado), sem UPDATE de backfill nas duas colunas novas de cards"
  - "A assimetria de valor entre as duas tabelas novas é deliberada e comentada no arquivo: taxas_imobiliaria aceita valor = 0 (D-03, taxa pode ser dispensada), caucao_eventos exige valor > 0 (A-03, todo evento de caução é dinheiro real se movendo)"

patterns-established:
  - "Runbook de verificação SQL: BLOCO 1 (baseline sem citar as adições novas) -> BLOCO 2 (DDL colada em duas passagens dentro de begin/rollback, provas de CHECK/FK/RLS/backstop) -> BLOCO 3 (rollback + confirmação pós-rollback) -> Parte B (blocos independentes pós-push)"

requirements-completed: [IMOB-01, IMOB-02, IMOB-03, IMOB-04]

coverage:
  - id: D1
    description: "public.cards ganha percentual_administracao/percentual_comissao_primeiro_aluguel, numeric(5,2) not null default 10/50, sem UPDATE de backfill"
    requirement: "IMOB-01"
    verification:
      - kind: other
        ref: "grep de forma exata das duas colunas em supabase/migrations/20260824000000_dinheiro_imobiliaria.sql (Task 1 <verify>)"
        status: pass
    human_judgment: false
  - id: D2
    description: "public.taxas_imobiliaria criada, estruturalmente paralela a parcela_lancamentos (D-04), com CHECK valor >= 0 (aceita zero)"
    requirement: "IMOB-02"
    verification:
      - kind: other
        ref: "grep de create table/constraints/RLS + ausência de FK cruzada para parcela_lancamentos (Task 1 <verify>)"
        status: pass
    human_judgment: false
  - id: D3
    description: "public.caucao_eventos criada, append-only, com CHECK valor > 0 (nunca zero, A-03)"
    requirement: "IMOB-04"
    verification:
      - kind: other
        ref: "grep de create table/constraints/RLS em supabase/migrations/20260824000000_dinheiro_imobiliaria.sql (Task 1 <verify>)"
        status: pass
    human_judgment: false
  - id: D4
    description: "public.impedir_exclusao_de_card_com_lancamento() ampliada (create or replace, sem trigger novo) para recusar exclusão de card com taxa ou caução registrada"
    requirement: "IMOB-03"
    verification:
      - kind: other
        ref: "grep confirma create or replace function, ausência de create/drop trigger, e referências a taxas_imobiliaria/caucao_eventos no corpo (Task 1 <verify>)"
        status: pass
    human_judgment: false
  - id: D5
    description: "Runbook supabase/verificacao_dinheiro_imobiliaria.sql prova as 4 adições, 10 recusas de CHECK/FK, RLS negativa/positiva e os 4 lados do backstop, em transação revertida"
    verification:
      - kind: other
        ref: "grep de estrutura (PARTE A/B, BLOCO 1-7, aviso D-19, ausência das 4 adições entre BLOCO 1 e BLOCO 2, rollback, OK recusado) — Task 2 <verify>"
        status: pass
    human_judgment: true
    rationale: "Nenhum bloco deste runbook foi de fato executado contra um banco Postgres real neste plano — o ensaio real contra produção é o objeto explícito do plano 13-02. A prova aqui é estrutural (grep), não de execução; um humano/agente do plano 13-02 precisa confirmar que os blocos rodam sem erro contra o banco de verdade."

duration: 12min
completed: 2026-08-24
status: complete
---

# Phase 13 Plan 01: Migração aditiva de dinheiro da imobiliária Summary

**Migração Postgres aditiva com dois percentuais em `cards`, o livro-razão paralelo `taxas_imobiliaria`, o histórico append-only `caucao_eventos`, e o backstop de exclusão ampliado — mais o runbook de ensaio/verificação de 8 blocos que prova cada regra em transação revertida.**

## Performance

- **Duration:** 12 min
- **Started:** 2026-08-24T00:00:00Z (aprox.)
- **Completed:** 2026-08-24
- **Tasks:** 2
- **Files modified:** 2 (ambos novos)

## Accomplishments
- `public.cards.percentual_administracao`/`percentual_comissao_primeiro_aluguel` (`numeric(5,2) not null default 10/50`), preenchidos via fast default sem UPDATE de backfill
- `public.taxas_imobiliaria` — livro-razão da taxa da imobiliária, estruturalmente separado de `parcela_lancamentos` (nenhuma FK/trigger cruzada), com CHECK `valor >= 0` (aceita R$ 0,00 por D-03)
- `public.caucao_eventos` — histórico append-only do ciclo recebido/devolvido/usado, com CHECK `valor > 0` (A-03: nunca zero, diferente da taxa)
- `public.impedir_exclusao_de_card_com_lancamento()` ampliada via `create or replace function` (nenhum trigger novo) para recusar exclusão de card com taxa ou evento de caução registrado, além do predicado original sobre `parcela_lancamentos`
- `supabase/verificacao_dinheiro_imobiliaria.sql` — runbook de duas partes (ensaio em transação revertida / verificação pós-push) provando as 4 adições, 10 recusas de CHECK/FK, RLS negativa/positiva e os 4 lados do backstop ampliado

## Task Commits

Each task was committed atomically:

1. **Task 1: Migração aditiva completa — percentuais, taxa da imobiliária, caução e backstop ampliado** - `2031540` (feat)
2. **Task 2: Runbook de ensaio e verificação, com o aviso de pooling do D-19 no topo** - `73c1b9e` (test)

**Plan metadata:** commit pendente (este SUMMARY + STATE/ROADMAP)

## Files Created/Modified
- `supabase/migrations/20260824000000_dinheiro_imobiliaria.sql` - migração aditiva completa (5 seções: percentuais em cards, taxas_imobiliaria, caucao_eventos, backstop ampliado, declaração de RLS)
- `supabase/verificacao_dinheiro_imobiliaria.sql` - runbook de ensaio (Parte A, transação revertida) e verificação pós-push (Parte B), com aviso de pooling D-19 no cabeçalho

## Decisions Made
- Nenhum desvio das `planner_assumptions` A-01 a A-05 do PLAN.md foi necessário — todas implementadas exatamente como especificado (nomes das tabelas, `parcela_id not null`, assimetria de `valor` entre as duas tabelas, backstop ampliado sem duplicar trigger, sem backfill)
- A assimetria `taxas_imobiliaria.valor >= 0` vs `caucao_eventos.valor > 0` é intencional e comentada no arquivo (D-03 vs A-03) — não uma inconsistência a "corrigir"

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Corrigido comentário do BLOCO 1 do runbook que citava literalmente os quatro nomes novos**
- **Found during:** Task 2 (escrita do runbook), durante a verificação do próprio `<verify>` da task
- **Issue:** O comentário de aviso do BLOCO 1 ("este bloco não pode citar X, Y, Z, W") citava os quatro identificadores novos (`percentual_administracao`, `percentual_comissao_primeiro_aluguel`, `taxas_imobiliaria`, `caucao_eventos`) por nome, literalmente dentro do próprio bloco que o `<verify>` da task exige estar livre desses termos (`sed -n '/BLOCO 1/,/BLOCO 2/p' | grep -c ... | grep -qx 0`)
- **Fix:** Reescrito o comentário para descrever as quatro adições sem citar seus identificadores literais ("os dois percentuais novos de public.cards, nem as duas tabelas novas"), seguindo o mesmo padrão já usado em `verificacao_cards_arquivado_em.sql`
- **Files modified:** `supabase/verificacao_dinheiro_imobiliaria.sql`
- **Verification:** Re-executado o grep do `<verify>` da Task 2 — passou
- **Commit:** `73c1b9e` (parte do commit único da Task 2, arquivo escrito e corrigido antes do commit)

**2. [Rule 1 - Bug] Corrigida precedência de operador `and`/`or` sem parênteses numa query de inventário do runbook**
- **Found during:** Task 2 (revisão do BLOCO 5)
- **Issue:** A query do BLOCO 5 que lista as CHECK constraints novas usava `and conname like 'X' or conname like 'Y' or conname like 'Z'` sem parênteses, o que (por precedência SQL padrão, `and` mais forte que `or`) faria a cláusula devolver TODAS as constraints com `conname like 'Y'` ou `'Z'` de qualquer tabela do banco, não só as três tabelas filtradas por `conrelid in (...)`
- **Fix:** Envolvido o bloco `or` em parênteses: `and (conname like 'X' or conname like 'Y' or conname like 'Z')`
- **Files modified:** `supabase/verificacao_dinheiro_imobiliaria.sql`
- **Verification:** Inspeção visual da query corrigida — o filtro `conrelid in (...)` agora se aplica corretamente em conjunto com o filtro de nome
- **Commit:** `73c1b9e` (parte do commit único da Task 2, arquivo escrito e corrigido antes do commit)

---

**Total deviations:** 2 auto-fixed (2 bugs de conteúdo do runbook, ambos corrigidos antes do commit — nenhum dos dois chegou a ser commitado incorreto)
**Impact on plan:** Ambos os fixes são correções internas ao runbook (nunca executado contra um banco real neste plano); nenhum impacto na migração em si nem em nenhum arquivo além de `supabase/verificacao_dinheiro_imobiliaria.sql`. Sem scope creep.

## Issues Encountered
None além dos dois desvios documentados acima, ambos descobertos e corrigidos durante a própria escrita do runbook, antes do commit.

## User Setup Required
None - nenhuma configuração de serviço externo é necessária. Este plano não toca o banco de produção.

## Known Stubs
None - nenhum stub. Os dois arquivos são artefatos completos (migração + runbook), prontos para os planos seguintes.

## Next Phase Readiness
- `supabase/migrations/20260824000000_dinheiro_imobiliaria.sql` e `supabase/verificacao_dinheiro_imobiliaria.sql` existem, passam em todas as asserções de `grep` das duas `<verify>` das tasks, e cobrem todos os `must_haves.truths`/`artifacts` do frontmatter do PLAN.md
- **Nada foi aplicado em produção** — nenhum comando SQL deste plano rodou contra o banco real. O próximo passo (plano 13-02) é ensaiar de fato o runbook contra produção, em transação revertida, seguindo o aviso de pooling D-19 no topo do arquivo
- O plano 13-03 (aplicação real, atrás de `checkpoint:decision`) e os planos 13-04 a 13-07 (código de aplicação: taxa no registrar-pagamento, configuração de percentuais, ciclo de caução, relatório de reconciliação) dependem deste schema existir — nenhum deles pode começar antes do plano 13-03 aplicar esta migração de verdade

---
*Phase: 13-dinheiro-da-imobili-ria*
*Completed: 2026-08-24*

## Self-Check: PASSED

- FOUND: `supabase/migrations/20260824000000_dinheiro_imobiliaria.sql`
- FOUND: `supabase/verificacao_dinheiro_imobiliaria.sql`
- FOUND: commit `2031540` (Task 1)
- FOUND: commit `73c1b9e` (Task 2)
