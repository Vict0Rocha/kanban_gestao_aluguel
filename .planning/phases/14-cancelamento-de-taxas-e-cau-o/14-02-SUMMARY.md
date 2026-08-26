---
phase: 14-cancelamento-de-taxas-e-cau-o
plan: 02
subsystem: database
tags: [postgres, supabase, migration, sql, connection-pooling, cascade]

# Dependency graph
requires:
  - phase: 14-01
    provides: migração aditiva `taxas_imobiliaria.lancamento_id` (FK cascade) e runbook de ensaio de duas partes, nenhum dos dois aplicado ao banco
provides:
  - Migração `20260826000000_taxas_imobiliaria_lancamento_id.sql` aplicada e commitada de verdade em produção (não em transação revertida — ver Deviations)
  - `supabase/verificacao_taxas_imobiliaria_lancamento_id.sql` com o bloco `RESULTADO DO ENSAIO` registrando a história real
  - Confirmação, por consulta direta, de que a coluna/índice/RLS nasceram corretos e nenhum dado pré-existente foi tocado
affects: [14-03, 14-04]

actuals:
  tokens: 2100
  tasks: 2
  commits: 1

tech-stack:
  added: []
  patterns:
    - "Mesmo gotcha de connection pooling do Supabase Studio SQL Editor já documentado em `verificacao_cards_numero.sql` (Fase 6.1) — desta vez na forma mais simples ainda: colar SÓ a DDL (sem o `begin;` acima dela no mesmo clique) já é aplicação real, não existe 'ensaiar a DDL isolada'."

key-files:
  created: []
  modified:
    - supabase/verificacao_taxas_imobiliaria_lancamento_id.sql

key-decisions:
  - "Aceitar a migração `taxas_imobiliaria.lancamento_id` como aplicada em produção em vez de desfazer e refazer o ensaio — decisão explícita do usuário (via pergunta direta do orquestrador), já que os dados bateram 100% corretos e a mudança é aditiva/nullable/sem CHECK novo/sem policy nova"
  - "A cascata de exclusão (Prova 2.3, a prova central da fase) NÃO foi observada durante este incidente — só a DDL rodou, não o bloco `do $$` de teste. A verificação real da cascata fica movida para o checkpoint de produção do plano 14-04, quando `registrarPagamentoAction` gravar um `lancamento_id` real pela primeira vez e um cancelamento de pagamento puder ser observado removendo a taxa junto"
  - "Nenhuma alteração foi necessária na migração em si — a DDL estava e continua correta; o problema foi só a forma de execução (sem o `begin;` amarrado no mesmo clique)"

patterns-established:
  - "Reforço permanente no cabeçalho do runbook: colar a DDL isolada, sem `begin;` no mesmo clique, é aplicação real no SQL Editor do Supabase Studio — não uma forma alternativa de ensaio"

requirements-completed: []

coverage:
  - id: D1
    description: "Migração taxas_imobiliaria.lancamento_id verificada em produção real: coluna uuid/nullable/sem default, índice existe, RLS inalterada (1 policy), zero backfill, cards/lançamentos pré-existentes intocados"
    requirement: CANIMOB-03
    verification:
      - kind: manual_procedural
        ref: "Operador rodou consultas de verificação diretamente contra produção e reportou os resultados ao orquestrador: coluna uuid/YES/null, índice=1, policies=1, taxas_com_lancamento_id=0, cards_total=60 e cards_updated_at_max idênticos ao baseline anotado antes do incidente"
        status: pass
    human_judgment: true
    rationale: "Verificação só pode ser feita por um humano com acesso ao SQL Editor de produção; não existe suíte automatizada nem ambiente de staging neste projeto."
  - id: D2
    description: "A cascata de exclusão (Prova 2.3) NÃO foi observada neste plano — fica pendente para o checkpoint de produção do plano 14-04"
    requirement: CANIMOB-03
    verification:
      - kind: other
        ref: "Nenhuma verificação automatizada aplicável — a cascata depende de código que só existe a partir do plano 14-04 (registrarPagamentoAction gravando lancamento_id pela primeira vez)"
        status: unknown
    human_judgment: true
    rationale: "CANIMOB-03 só é confirmável de ponta a ponta quando houver uma taxa real com lancamento_id preenchido e um cancelamento de pagamento observável removendo-a — isso acontece no plano 14-04, não aqui."

duration: ~15min
completed: 2026-08-26
status: complete
---

# Phase 14 Plan 02: Ensaio real da migração taxas_imobiliaria.lancamento_id — pooling do SQL Editor Summary

**A migração `taxas_imobiliaria.lancamento_id` acabou aplicada e commitada de verdade em produção durante o "ensaio" (o operador rodou a DDL sozinha, sem o `begin;` amarrado no mesmo clique) — dados verificados corretos e sem efeito colateral, e o usuário decidiu explicitamente aceitar como aplicada em vez de desfazer.**

## Performance

- **Duration:** ~15 min (inclui o tempo do checkpoint aguardando o operador rodar consultas de verificação em produção)
- **Tasks:** 2 (1 checkpoint humano + 1 auto)
- **Files modified:** 1 (`supabase/verificacao_taxas_imobiliaria_lancamento_id.sql`)

## Accomplishments
- Ensaio real revelou, de novo, o mesmo gotcha de connection pooling do Supabase Studio SQL Editor já documentado na Fase 6.1 (`verificacao_cards_numero.sql`) — desta vez na forma mais simples: colar só a DDL (`alter table`/`create index`), sem o `begin;` acima dela no mesmo clique, já é uma aplicação real, com autocommit por statement
- Confirmado por consulta direta que a migração aplicou exatamente como pretendido: `lancamento_id` uuid/nullable/sem default, índice `taxas_imobiliaria_lancamento_id_idx` existe, RLS inalterada (`policies_taxas_imobiliaria = 1`), zero linha com `lancamento_id` preenchido (sem backfill), e `cards_total`/`cards_updated_at_max` idênticos ao baseline anotado antes do incidente (60 cards, mesmo timestamp) — nenhuma linha pré-existente tocada
- A cascata de exclusão (Prova 2.3, a prova central desta fase) NÃO foi observada neste incidente — só a DDL rodou, o bloco de teste `do $$` nunca chegou a executar. Documentado explicitamente que essa verificação fica para o checkpoint de produção do plano 14-04
- Usuário decidiu explicitamente aceitar a migração como aplicada, sem desfazer
- `RESULTADO DO ENSAIO` documentado no runbook com a história completa e honesta, incluindo lição operacional reforçada para ensaios futuros deste projeto

## Task Commits

1. **Task 1: Rodar a Parte A contra produção e observar a cascata funcionando** - checkpoint humano, sem commit de código neste repositório (a execução real aconteceu diretamente no banco de produção, feita pelo operador; ver Deviations para o que de fato ocorreu)
2. **Task 2: Registrar o resultado do ensaio dentro do próprio runbook** - commit deste SUMMARY.md + runbook atualizado (a seguir)

## Files Created/Modified
- `supabase/verificacao_taxas_imobiliaria_lancamento_id.sql` - bloco `RESULTADO DO ENSAIO` (2026-08-26) registrando a história real, os valores exatos observados, e a decisão do usuário de aceitar como aplicado

## Decisions Made
- Aceitar a migração `taxas_imobiliaria.lancamento_id` como aplicada em produção em vez de desfazer e refazer o ensaio (decisão explícita do usuário, relayed pelo orquestrador via pergunta direta)
- Mover a verificação da cascata (Prova 2.3) para o checkpoint de produção do plano 14-04, em vez de tentar reproduzi-la isoladamente aqui
- Nenhuma alteração na migração em si — a DDL estava e continua correta

## Deviations from Plan

### Checkpoint outcome diverged from the planned scenario (human decision required and obtained)

**Issue:** O plano previa um ensaio inteiramente confinado a `begin;...rollback;`. Na prática, o operador colou e rodou só a DDL (`alter table ... add column`/`create index`), sem o `begin;` do BLOCO 2 amarrado no mesmo clique — o SQL Editor do Supabase Studio trata cada statement fora de transação explícita como autocommit. As Provas 2.1 a 2.6 e o `rollback;` do BLOCO 3 nunca chegaram a rodar.

**Resultado real:** a migração `20260826000000_taxas_imobiliaria_lancamento_id.sql` foi aplicada e commitada de verdade em produção. Verificado depois, por consulta direta consolidada: coluna/índice corretos, RLS inalterada, zero backfill, `cards`/`parcela_lancamentos` pré-existentes intocados.

**Decisão:** o orquestrador levou a decisão ao usuário — desfazer com um `drop column` manual e refazer o ensaio corretamente, ou aceitar o estado atual. O usuário escolheu explicitamente aceitar como aplicada: a mudança é aditiva/nullable/sem CHECK/sem policy nova, e os dados bateram corretos.

**Ação tomada nesta Task 2:**
- Registrado o bloco `RESULTADO DO ENSAIO` com a história completa e honesta — não como um ensaio limpo em transação
- Reforçada, no corpo do `RESULTADO DO ENSAIO`, a lição de que colar só a DDL isolada (sem `begin;` no mesmo clique) já é aplicação real
- Nenhuma alteração foi necessária na migração em si

**Impacto no plano 14-03 (fora do escopo desta execução, decisão do orquestrador):** o `checkpoint:decision`/aplicação de 14-03 deixa de fazer sentido como escrito, já que o push já aconteceu aqui. O orquestrador tratou a Task 1 (checkpoint:decision) de 14-03 como respondida retroativamente pelo usuário, já atualizou `docs/data-model.md` (Task 2 de 14-03) diretamente, e a Task 3 (checkpoint:human-verify, regressão de Board/Financeiro/Relatórios) continua pendente, a ser executada como fechamento do plano 14-03.

## Issues Encountered
- Mesmo gotcha de connection pooling do Supabase Studio SQL Editor já visto na Fase 6.1, numa forma ainda mais simples de acontecer (DDL isolada sem `begin;`) — reforçado no runbook para não se repetir

## User Setup Required

None - a migração já está aplicada em produção; nenhuma configuração externa adicional é necessária.

## Next Phase Readiness
- A migração `20260826000000_taxas_imobiliaria_lancamento_id.sql` já está aplicada e commitada em produção — o plano 14-03 não precisa mais rodar um `checkpoint:decision`/aplicação para esta migração
- `docs/data-model.md` já foi atualizado pelo orquestrador (Task 2 de 14-03) com a coluna, a relação de cascata e a bullet de decisão
- Falta só a Task 3 de 14-03 (checkpoint:human-verify confirmando Board/Financeiro/Relatórios sem regressão) para fechar o plano 14-03
- A cascata de exclusão (Prova 2.3) ainda não foi observada de verdade — isso acontece no checkpoint de produção do plano 14-04, quando uma taxa real com `lancamento_id` for gerada e um pagamento cancelado

## Self-Check: PASSED

- FOUND: `supabase/verificacao_taxas_imobiliaria_lancamento_id.sql`
- FOUND: bloco `RESULTADO DO ENSAIO — 2026-08-26`

---
*Phase: 14-cancelamento-de-taxas-e-cau-o*
*Completed: 2026-08-26*
