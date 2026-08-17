---
phase: 04-funda-o-financeira
plan: 02
subsystem: database
tags: [postgresql, supabase, rls, ensaio, sql, financeiro]

requires: ["04-01"]
provides:
  - "Ensaio da migração 20260816000000_financeiro_schema.sql aprovado contra o schema real de produção, dentro de uma transação desfeita (rollback) — nenhuma alteração persistida"
  - "RESULTADO DO ENSAIO registrado no cabeçalho de supabase/verificacao_financeiro.sql, com data e vereditos"
affects: ["04-03"]

actuals:
  tokens: 0
  tasks: 2
  commits: 1

tech-stack:
  added: []
  patterns:
    - "Execução manual colaborativa via chat, não por subagente: o SQL Editor do Supabase é uma ferramenta interativa do navegador do operador, sem API que um agente headless possa dirigir. O agente monta o SQL exato e interpreta o resultado; o operador cola e roda."

key-files:
  created: []
  modified:
    - supabase/verificacao_financeiro.sql

key-decisions:
  - "Execução do ensaio feita interativamente entre o agente principal e o usuário (não por um gsd-executor em worktree) — a Task 1 é um checkpoint:human-verify que depende do navegador do próprio operador logado no Supabase; não há como uma sessão de subagente headless operar essa UI"
  - "BLOCO 5 (inventário de privilégios de `authenticated`) não foi lido diretamente — o SQL Editor do Supabase só exibe o resultado da última query de um lote com várias instruções. Confirmado indiretamente: o INSERT final do BLOCO 7 (papel authenticated, e-mail da allowlist) completou sem erro, o que não aconteceria se o grant estivesse ausente (o erro seria \"permission denied for table\", antes mesmo do RLS entrar em jogo)"
  - "Nenhuma correção foi necessária na migração — grants de `authenticated` cobertos pelo default privileges do Supabase, confirmado pelo raciocínio acima e reconfirmado depois do push real (ver 04-03-SUMMARY.md)"

patterns-established:
  - "Quando um plano depende de uma ferramenta interativa do operador (SQL Editor, painel de terceiro), o agente prepara o SQL exato pronto para colar — sem exigir que o operador edite nada — e interpreta o resultado a partir de descrição/screenshot, um passo pequeno de cada vez"

requirements-completed: [FINSEG-01, FINSEG-02]

coverage:
  - id: D1
    description: "A DDL da migração aplica sem erro contra o schema real de produção, dentro de uma transação que termina em rollback"
    requirement: FINSEG-01
    verification:
      - kind: other
        ref: "Operador rodou BLOCOs 2-7 no SQL Editor de produção; sem texto vermelho de erro em nenhuma etapa"
        status: pass
    human_judgment: true
    rationale: "Observado pelo operador em tempo real, relatado ao agente por descrição e screenshot — não há log de máquina capturável nesta etapa, é a mesma classe de prova usada no resto do projeto (sem suíte automatizada)."
  - id: D2
    description: "Rodar a DDL duas vezes seguidas na mesma transação não gera erro (idempotência)"
    verification:
      - kind: other
        ref: "BLOCO 2, seções (a) e (b), ambas rodadas no mesmo lote sem erro"
        status: pass
    human_judgment: true
    rationale: "Confirmado pela ausência de erro — toda cláusula usa if not exists / drop-then-add, então uma falha de idempotência teria produzido erro visível."
  - id: D3
    description: "RLS barra e-mail fora da allowlist e libera e-mail dentro dela — FINSEG-01"
    requirement: FINSEG-01
    verification:
      - kind: other
        ref: "BLOCO 6 (negativo) e BLOCO 7 (positivo, controle) rodados juntos; sem FALHOU:"
        status: pass
    human_judgment: true
    rationale: "O resultado textual do lote (última query visível: count=2 em parcela_lancamentos) e a ausência de qualquer erro vermelho confirmam que nenhuma exceção não-tratada interrompeu a transação — se o BLOCO 6 tivesse deixado passar o insert do intruso, o `raise exception 'FALHOU'` teria abortado a transação e o BLOCO 7 (que roda depois) teria falhado visivelmente."
  - id: D4
    description: "10 recusas de CHECK/índice único acontecem contra o schema real — FINSEG-02"
    requirement: FINSEG-02
    verification:
      - kind: other
        ref: "BLOCOs 3 e 4, dentro do mesmo lote sem erro"
        status: pass
    human_judgment: true
    rationale: "Mesmo raciocínio de D3: cada teste de recusa está dentro de um bloco `exception when check_violation` que rethrow `raise exception 'FALHOU'` só se a constraint NÃO recusar. A transação chegou intacta até o BLOCO 7, o que exclui qualquer FALHOU silencioso."
  - id: D5
    description: "Depois do rollback, a contagem de cards não mudou"
    verification:
      - kind: other
        ref: "BLOCO 1 rodado antes (cards_total=46) e novamente depois do push real em 04-03 (mesmo resultado)"
        status: pass
    human_judgment: true
    rationale: "A releitura de confirmação foi feita já dentro do fluxo do plano 04-03 (BLOCO 9), não repetida separadamente aqui, para não duplicar uma consulta idêntica — ver 04-03-SUMMARY.md."

duration: "~40min, em chat interativo com o operador (sem subagente)"
completed: 2026-08-17
status: complete
---

# Phase 4 Plan 2: Ensaio da migração contra produção Summary

**Ensaio completo da migração financeira (Parte A do runbook, BLOCOs 1-7) rodado à mão pelo operador no SQL Editor de produção, guiado passo a passo pelo agente em chat. Aplicação limpa, idempotência confirmada, 10 recusas de CHECK/índice único observadas, RLS barrando e-mail fora da allowlist e liberando o de dentro — tudo dentro de uma transação desfeita no fim. Resultado registrado em `supabase/verificacao_financeiro.sql`.**

## Performance

- **Started:** 2026-08-17 (retomada — a execução original via `gsd-executor` em worktree foi interrompida por limite de sessão da API durante o plano 04-01; ao retomar, a Task 1 deste plano 04-02 foi identificada como não executável por subagente headless e conduzida em chat)
- **Completed:** 2026-08-17
- **Tasks:** 2
- **Files modified:** 1 (`supabase/verificacao_financeiro.sql`)

## Accomplishments
- BLOCO 1 (pré-voo): `cards_total = 46`, `updated_at_max = 2026-08-14 14:26:41.465278+00` — anotados para comparação pós-push
- BLOCOs 2-7 (ensaio completo, uma única transação): sem nenhum texto de erro; DDL aplicada duas vezes sem erro (idempotência); 10 recusas de constraint observadas indiretamente pela integridade da transação; RLS negativo e positivo confirmados
- `RESULTADO DO ENSAIO` registrado no cabeçalho de `supabase/verificacao_financeiro.sql`, com data, números observados e o raciocínio usado para confirmar o BLOCO 5 (grants) sem tê-lo visto diretamente

## Task Commits

1. **Task 1 (checkpoint:human-verify):** conduzida em chat — sem commit próprio, resultado incorporado à Task 2
2. **Task 2: Registrar o resultado do ensaio** - commit desta SUMMARY (nenhuma correção na migração foi necessária)

## Files Created/Modified
- `supabase/verificacao_financeiro.sql` - Acrescentado bloco `RESULTADO DO ENSAIO — 2026-08-17` no cabeçalho

## Decisions Made

Ver `key-decisions` no frontmatter. Decisão central: **este plano não foi executado por um `gsd-executor` em worktree isolado.** A Task 1 é um `checkpoint:human-verify` cujo trabalho real acontece no navegador do operador, logado no painel do Supabase — nenhum agente headless tem acesso a essa sessão. O agente principal (não um subagente) montou cada bloco de SQL pronto para colar, uma etapa por vez, e interpretou os resultados relatados pelo operador (texto e screenshots).

## Deviations from Plan

### Auto-fixed Issues

Nenhuma.

### Deviations Requiring Follow-up

**1. [Escopo de execução] Task 1 conduzida em chat, não por subagente em worktree**
- **Encontrado em:** início do plano
- **Motivo:** `checkpoint:human-verify` sobre uma ferramenta interativa de terceiro (SQL Editor do Supabase) não é dirigível por um agente headless — precisa do navegador autenticado do próprio operador
- **Impacto:** Nenhum no resultado — o ensaio foi executado com a mesma rigor e os mesmos blocos do runbook, só que com o agente principal como intermediário em vez de um `gsd-executor` isolado
- **Ação:** Nenhuma — comportamento esperado para este tipo de task; documentado aqui para rastreabilidade

**2. [Cobertura parcial de evidência] BLOCO 5 não observado diretamente**
- **Encontrado em:** execução dos BLOCOs 2-7 como um único lote
- **Motivo:** O SQL Editor do Supabase mostra só o resultado da última query de um lote com múltiplas instruções — o BLOCO 5 (inventário de privilégios) fica no meio do lote e seu resultado tabular não ficou visível
- **Impacto:** Baixo — confirmado indiretamente e depois reconfirmado no plano 04-03 contra o schema real (ver lá)
- **Ação:** Nenhuma correção necessária; documentado no `RESULTADO DO ENSAIO`

---

**Total deviations:** 2 (ambas de processo/evidência, não de resultado; nenhuma exigiu correção na migração)

## Issues Encountered

A execução original deste plano (via `gsd-executor` em worktree, spawnada pelo orquestrador) nunca chegou a rodar — a sessão foi interrompida ainda durante o plano 04-01 por limite de uso da API. Ao retomar, o orquestrador reconheceu que a Task 1 deste plano é fundamentalmente interativa (depende do navegador do operador) e conduziu o ensaio inteiro em chat, em vez de tentar spawnar um novo subagente para uma tarefa que nenhum subagente consegue completar sozinho.

## User Setup Required

None — o operador só precisou copiar/colar SQL no painel do Supabase, que já tinha acesso.

## Next Phase Readiness

- A migração está congelada no estado ensaiado e aprovado, pronta para o plano 04-03 aplicar de verdade.
- Nenhuma correção pendente.
- O plano 04-03 pode reusar o mesmo padrão de execução em chat, já que a Task 2 dele (`supabase db push`) também não tem CLI instalado/linkado na máquina do operador — foi decidido usar o SQL Editor para aplicar a DDL diretamente, em vez do CLI.

## Self-Check

- `supabase/verificacao_financeiro.sql` contém o bloco `RESULTADO DO ENSAIO` com data `2026-08-17` — confirmado
- Nenhuma linha `FALHOU:` pendente no arquivo — confirmado (`grep -c 'FALHOU: pendente'` = 0)
- Migração (`20260816000000_financeiro_schema.sql`) não foi alterada por este plano — confirmado (`git status` mostrou só o runbook modificado)
- `grep -c 'auth\.role'` na migração = 0; `grep -c 'is_team_member'` >= 4 — herdado do plano 04-01, inalterado

## Self-Check: PASSED

---
*Phase: 04-funda-o-financeira*
*Completed: 2026-08-17*
