---
plan: 13-03
phase: 13-dinheiro-da-imobili-ria
completed: 2026-08-24
---

# Plan 13-03 Summary — Aplicar a migração de dinheiro da imobiliária em produção

## What Was Built

Task 1 (`checkpoint:decision`, `gate="blocking"`): usuário autorizou explicitamente
`aplicar-agora`, com o resultado do ensaio do plano 13-02 como base.

Task 2 (`auto`, `[BLOCKING]`): a migração `20260824000000_dinheiro_imobiliaria.sql`
foi aplicada em produção via SQL Editor (Supabase CLI confirmado ausente de novo —
mesma constante desde a Phase 4), colando a DDL completa sem wrapper de transação.
Terminou com "Success. No rows returned". `docs/data-model.md` atualizado: diagrama
`mermaid` com as duas colunas novas de `cards` e os blocos `TAXAS_IMOBILIARIA`/
`CAUCAO_EVENTOS`, lista de entidades com as duas tabelas novas, e três bullets novos
em "Decisões de design" (fronteira estrutural D-04, caução como histórico D-06,
backstop de exclusão ampliado).

Task 3 (`checkpoint:human-verify`, `gate="blocking"`): usuário rodou a Parte B do
runbook contra o banco já migrado (BLOCO 4/5/7 combinados numa consulta única via
`json_agg`, e o BLOCO 6 — os quatro lados do backstop — numa transação revertida
separada) e confirmou visualmente Board, Financeiro, Relatórios/Relatório Financeiro
dedicado, e a exclusão de um contrato com lançamento continuando recusada.

## Resultado observado (Task 3, BLOCO 4/5/7)
- `cards.percentual_administracao`/`percentual_comissao_primeiro_aluguel`: `numeric`,
  `not null`, defaults `10`/`50` — corretos
- `cards_total = 58`, `updated_at_max` idêntico ao baseline do plano 13-02 —
  nenhuma linha existente tocada
- `cards_percentual_divergente = 0` — nenhum contrato com percentual fora do default
- `taxas_imobiliaria`: 9 colunas (incluindo `id`), tipos corretos
- `caucao_eventos`: 8 colunas (incluindo `id`), tipos corretos
- 8 CHECK constraints novas (2 `cards`, 3 `taxas_imobiliaria`, 3 `caucao_eventos`)
- 2 policies novas, ambas `is_team_member()` em `qual` e `with_check`
- `impedir_exclusao_de_card_com_lancamento()` cita as três tabelas
  (`parcela_lancamentos`, `taxas_imobiliaria`, `caucao_eventos`)
- Policies de `cards`/`parcelas`/`parcela_lancamentos` inalteradas

## Resultado observado (Task 3, BLOCO 6 — backstop pós-push)
Executado dentro de `begin;...rollback;`, sem nenhum erro visível — os quatro lados
(bloqueia por taxa, bloqueia por caução, continua bloqueando por lançamento em
`parcela_lancamentos`, libera card sem nenhum dos três) se comportaram como
projetado, mesma lógica de evidência do plano 13-02 (o script propaga `FALHOU` se
qualquer lado sair diferente do esperado).

## Requirements Completed
IMOB-01, IMOB-02, IMOB-03, IMOB-04 (schema em produção — nenhum código de aplicação
existe ainda; os planos 13-04 a 13-07 são o que torna estes requisitos utilizáveis
de verdade)

## Deviations from Plan
Nenhum. Aplicação limpa na primeira tentativa, sem necessidade de correção nem de
reensaiar.

## Next Phase Readiness
- Schema do dinheiro da imobiliária vivo em produção: `cards.percentual_*`,
  `taxas_imobiliaria`, `caucao_eventos`, backstop de exclusão ampliado
- `docs/data-model.md` documenta as três decisões estruturais desta fase
- Board, Financeiro, Relatórios e Relatório Financeiro dedicado confirmados
  funcionando sem regressão
- Próximo: plano 13-04 (tracer) — estender `registrarPagamentoAction` com o campo
  de taxa, provando a fronteira D-04 em produção

---
*Phase: 13-dinheiro-da-imobili-ria*
*Completed: 2026-08-24*
