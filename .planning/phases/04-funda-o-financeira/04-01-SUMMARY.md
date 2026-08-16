---
phase: 04-funda-o-financeira
plan: 01
subsystem: database
tags: [postgresql, supabase, rls, migrations, sql, financeiro]

# Dependency graph
requires: []
provides:
  - "public.cards.ativo (boolean not null default true) — flag manual de contrato ativo"
  - "public.parcelas — uma cobrança mensal por contrato, 4 CHECKs, 3 índices, RLS via is_team_member()"
  - "public.parcela_lancamentos — livro-razão append-only de pagamento/acréscimo/desconto/destrava, 6 CHECKs, RLS via is_team_member()"
  - "supabase/verificacao_financeiro.sql — runbook com ensaio em transação (RLS negativa/positiva, 10 CHECKs) e verificação pós-push"
affects: [05-aba-financeiro, 06-baixa-e-ajustes, 07-conciliacao-e-destrava, 08-relatorios-financeiros]

actuals:
  tokens: 11187
  tasks: 3
  commits: 3

tech-stack:
  added: []
  patterns:
    - "status/tipo como text + CHECK nomeado (drop/add reexecutável), não enum do Postgres — mesmo padrão de cards"
    - "GUC de transação (set_config com local=true) para carregar um id de teste através de uma troca de papel (set local role), já que um SELECT direto seria filtrado pelo próprio RLS que o bloco está provando"

key-files:
  created:
    - supabase/migrations/20260816000000_financeiro_schema.sql
    - supabase/verificacao_financeiro.sql
  modified: []

key-decisions:
  - "parcelas.status e parcela_lancamentos.tipo são text+CHECK, não enum — CHECK é derrubável/recriável no mesmo padrão já usado em cards; enum exigiria ALTER TYPE ADD VALUE"
  - "Nenhuma constraint relaciona vencimento a competencia — aluguel pago adiantado é um arranjo real do negócio; regra de coerência aqui quebraria a Phase 5"
  - "parcela_lancamentos_valor_nao_negativo usa >= 0 (não > 0): lançamento tipo=destrava é evento de estado, carrega valor 0"
  - "parcelas_conciliada_rastreada e parcela_lancamentos_valor_exigido vão além do piso do D-12, deliberadamente: impedem parcela conciliada sem autor/data e lançamento financeiro de valor zero"
  - "Migração 100% aditiva e reexecutável (if not exists / drop constraint if exists) — banco de produção com ~46 imóveis reais, sem staging"
  - "Runbook prova RLS com um controle positivo (BLOCO 7) além do negativo (BLOCO 6): um count(*)=0 sozinho não distingue RLS funcionando de grant faltando (mesmo SQLSTATE 42501) — por isso o BLOCO 5 confere os grants antes"

patterns-established:
  - "Runbook de verificação em duas partes (ensaio transacional que só termina em rollback + verificação pós-push independente), no estilo de hardening_seguranca.sql e 20260811010000_security_advisor_fixes.sql"

requirements-completed: [FINSEG-01, FINSEG-02]

coverage:
  - id: D1
    description: "Migração declara cards.ativo e parcelas completos (colunas, 4 CHECKs, 3 índices, RLS via is_team_member()), aditiva e reexecutável"
    requirement: FINSEG-01
    verification:
      - kind: other
        ref: "04-01-PLAN.md Task 1 <verify><automated> (grep estrutural sobre a migração, ignorando comentários) — TRACER_OK"
        status: pass
    human_judgment: true
    rationale: "O grep confirma que o texto SQL correto foi escrito, mas nenhum comando rodou contra um banco Postgres real — a prova de execução (a migração de fato aplica sem erro) fica para o plano 04-02, que roda o ensaio contra o Supabase de verdade."
  - id: D2
    description: "Migração declara parcela_lancamentos completo (9 colunas, 6 CHECKs, índice por parcela_id, RLS via is_team_member())"
    requirement: FINSEG-02
    verification:
      - kind: other
        ref: "04-01-PLAN.md Task 2 <verify><automated> (grep estrutural sobre a migração) — LEDGER_OK"
        status: pass
    human_judgment: true
    rationale: "Mesma ressalva de D1 — verificação estrutural, não de execução contra banco real."
  - id: D3
    description: "Runbook prova, num único ensaio que termina em rollback, RLS negativa (email fora da allowlist) e positiva de controle, mais inventário e verificação pós-push"
    verification:
      - kind: other
        ref: "04-01-PLAN.md Task 3 <verify><automated> (grep estrutural sobre o runbook) — RUNBOOK_OK"
        status: pass
    human_judgment: true
    rationale: "O runbook está escrito e estruturalmente correto (BLOCOs 1-11, transações balanceadas, zero commit; em início de linha), mas nunca foi executado contra um Postgres real neste plano — só o plano 04-02 roda a Parte A de fato no SQL Editor do Supabase e confirma que os blocos DO $$ compilam e que as exceptions (check_violation, unique_violation, insufficient_privilege) disparam como esperado."

duration: "~15min (Task 3, sessão de retomada); plano completo (Tasks 1-3) somou duas sessões — ver Issues Encountered"
completed: 2026-08-16
status: complete
---

# Phase 4 Plan 1: Fundação financeira — schema, CHECKs, RLS e runbook Summary

**Migração aditiva `20260816000000_financeiro_schema.sql` criando `cards.ativo`, `parcelas` (4 CHECKs, 3 índices) e `parcela_lancamentos` (6 CHECKs, livro-razão append-only), ambas com RLS via `is_team_member()`, mais o runbook `verificacao_financeiro.sql` (11 blocos) que prova essas regras e a barreira de RLS num ensaio transacional antes do push.**

## Performance

- **Duration:** Task 3 (retomada desta sessão) ~15 min. Tasks 1-2 rodaram numa sessão anterior (13:18-13:19 local) que terminou sem SUMMARY — estado ilegal per `atomic_close_out_invariant`, corrigido nesta retomada.
- **Started (Task 1):** 2026-08-16T13:18:04-04:00
- **Completed (Task 3):** 2026-08-16T16:39:32-04:00
- **Tasks:** 3
- **Files modified:** 2 (ambos criados: migração + runbook)

## Accomplishments
- `public.cards.ativo` (boolean, default true) — flag de contrato ativo, aditiva, sem backfill necessário
- `public.parcelas` — cobrança mensal por contrato, com 4 CHECKs (valor positivo, status válido, competência dia 1, conciliação rastreada) e índice único `(card_id, competencia)`
- `public.parcela_lancamentos` — livro-razão append-only (pagamento/acréscimo/desconto/destrava), 6 CHECKs incluindo `parcela_lancamentos_destrava_exige_motivo` (a garantia de banco da qual a Phase 7/CONCIL-03 depende)
- Duas policies RLS (`for all to authenticated`, `is_team_member()` em `using`/`with check`), sem nenhum predicado genérico de papel autenticado
- Runbook de 11 blocos: ensaio transacional completo (pré-voo, DDL duplicada para provar idempotência, provas de CHECK/índice único, prova de grants, RLS negativa com e-mail fora da allowlist, RLS positiva de controle) + verificação pós-push (inventário via `pg_constraint`/`pg_policies`, integridade de `cards`, repetição das provas contra o schema real, rollback de emergência comentado)

## Task Commits

Each task was committed atomically:

1. **Task 1: Fatia vertical — `cards.ativo` + `parcelas`** - `8a952d5` (feat)
2. **Task 2: Expansão — `parcela_lancamentos`** - `ab9417f` (feat)
3. **Task 3: Fechar o runbook — provas de RLS e verificação pós-push** - `dd54b52` (feat)

**Plan metadata:** this commit (docs: complete plan)

## Files Created/Modified
- `supabase/migrations/20260816000000_financeiro_schema.sql` - Migração aditiva: `cards.ativo`, `parcelas`, `parcela_lancamentos`, CHECKs, índices, RLS
- `supabase/verificacao_financeiro.sql` - Runbook de 11 blocos: ensaio em transação (Parte A) + verificação pós-push (Parte B)

## Decisions Made

Ver `key-decisions` no frontmatter. Ponto adicional desta retomada: o BLOCO 3 do runbook (criado na Task 1) precisou de uma linha extra — `perform set_config('app.parcela_teste', v_parcela_id::text, true);` — para que os BLOCOS 6/7 (RLS) da Task 3 conseguissem referenciar uma parcela válida depois de trocar de papel para `authenticated`/e-mail de teste. Sem essa GUC, um `SELECT` direto para achar o `parcela_id` seria filtrado pelo próprio RLS que o bloco está tentando provar, ou (pior) um `parcela_id` inventado faria o teste falhar com `foreign_key_violation` em vez de `insufficient_privilege` — um falso negativo mascarado de sucesso.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] GUC `app.parcela_teste` adicionada ao BLOCO 3**
- **Found during:** Task 3 (construindo o harness de RLS negativa/positiva para `parcela_lancamentos`)
- **Issue:** O plano especifica que o BLOCO 6 deve tentar `insert into public.parcela_lancamentos` "repetindo" o padrão do teste de `parcelas`, mas não define de onde vem o `parcela_id` — e sob RLS com e-mail de intruso, um `SELECT` normal devolveria zero linhas
- **Fix:** BLOCO 3 (Task 1) ganhou uma linha guardando o id da parcela de teste numa GUC de transação (`app.parcela_teste`), no mesmo padrão já usado por `app.card_teste`
- **Files modified:** `supabase/verificacao_financeiro.sql` (linha adicionada dentro do `do $$` do BLOCO 3)
- **Verification:** Task 3 `<verify><automated>` (RUNBOOK_OK) passou; contagem de blocos `do $$`/`$$;` balanceada (5/5); `begin;`/`rollback;` balanceados (2/2)
- **Committed in:** `dd54b52` (Task 3 commit)

---

**Total deviations:** 1 auto-fixed (1 missing critical)
**Impact on plan:** Necessário para que a prova de RLS de `parcela_lancamentos` seja válida (recusada por `insufficient_privilege`, não por `foreign_key_violation`). Sem escopo além do runbook já sob responsabilidade da Task 3.

## Issues Encountered

O plano foi executado em duas sessões. Tasks 1 e 2 (`8a952d5`, `ab9417f`) foram commitadas numa sessão anterior, mas a sessão terminou sem gerar `04-01-SUMMARY.md` — um estado parcial ilegal segundo o `atomic_close_out_invariant` do workflow (commits de produção sem SUMMARY commitado). Esta sessão de retomada identificou o estado via `git log` + comparação com o PLAN.md (Task 3 ausente do runbook: só existiam BLOCOs 1-4, faltando 5-11), completou a Task 3 e fecha o plano com este SUMMARY. Nenhum dado foi perdido; nenhum retrabalho de Tasks 1-2 foi necessário.

## User Setup Required

None - nenhuma configuração de serviço externo. A aplicação da migração em si (via `supabase db push`) fica para o plano 04-03, atrás do seu próprio portão de decisão — este plano só escreve os arquivos `.sql`.

## Next Phase Readiness

- Os dois arquivos `.sql` estão prontos para o plano 04-02, que roda o ensaio (Parte A do runbook) contra o Supabase real pela primeira vez. Isso é importante: **nenhuma linha de SQL deste plano foi executada contra um banco** — toda verificação aqui foi estrutural (grep sobre o texto). O plano 04-02 é o primeiro ponto em que erros de sintaxe SQL, comportamento real de `insufficient_privilege` sob RLS, ou qualquer suposição errada sobre o schema existente (`public.cards`, `public.profiles`, `public.is_team_member()`) seriam descobertos.
- `parcela_lancamentos_destrava_exige_motivo` (a constraint da qual a Phase 7/CONCIL-03 depende) está escrita e coberta por 2 provas (nulo e só-espaços) no BLOCO 4, e reprovada no BLOCO 10 pós-push.
- Pendência herdada do STATE.md (ROBUST-02 não verificado com login real) tem uma oportunidade natural de fechar junto no 04-02/04-03: o BLOCO 6/7 do runbook já prova RLS negativa/positiva para as tabelas novas com um e-mail real da allowlist — o mesmo exercício, feito manualmente no navegador, resolveria a pendência da v1.0.
- Nenhum bloqueador para o plano 04-02.

## Self-Check

- `supabase/migrations/20260816000000_financeiro_schema.sql` existe no disco — confirmado (`test -f`)
- `supabase/verificacao_financeiro.sql` existe no disco — confirmado (`test -f`)
- `git log --oneline --all --grep="04-01"` devolve 3 commits (`8a952d5`, `ab9417f`, `dd54b52`) — confirmado
- Task 1 `<verify><automated>` (TRACER_OK): re-verificado por amostragem — `add column if not exists ativo boolean not null default true` presente na migração — PASS
- Task 2 `<verify><automated>` (LEDGER_OK): arquivo de migração não foi tocado pela Task 3 (`git status` mostrou só o runbook modificado) — condição inalterada desde a execução original — PASS
- Task 3 `<verify><automated>` (RUNBOOK_OK): re-executado nesta sessão — todos os 7 rótulos BLOCO 5-11 presentes, `intruso-teste@exemplo.invalid`, `set local request.jwt.claims`, `insufficient_privilege`, `role_table_grants`, `pg_get_constraintdef`, `pg_policies` presentes, `rollback;` em início de linha = 2, `commit;` em início de linha = 0 — PASS
- Blocos `do $$` / `$$;` balanceados (5/5); `begin;` de transação / `rollback;` balanceados (2/2) — PASS
- Plan-level `<verification>` (5 itens do 04-01-PLAN.md): arquivos existem com nomes exatos (1) OK; símbolos da seção Artifacts presentes na migração (2) OK — herdado das Tasks 1/2, arquivo inalterado; zero `auth\.role` fora de comentário e zero DDL destrutiva (3) OK — herdado; runbook cobre BLOCO 1-11, termina toda transação em rollback, zero `commit;` em início de linha (4) OK; nenhum comando executado contra o banco (5) OK — este plano só escreveu arquivos `.sql`

## Self-Check: PASSED

---
*Phase: 04-funda-o-financeira*
*Completed: 2026-08-16*
