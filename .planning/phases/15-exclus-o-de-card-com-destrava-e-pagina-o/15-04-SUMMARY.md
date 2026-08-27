---
phase: 15-exclus-o-de-card-com-destrava-e-pagina-o
plan: 04
subsystem: database
tags: [postgres, supabase, migration, verification]

# Dependency graph
requires:
  - phase: 15-01
    provides: migração 20260826010000_relaxar_exclusao_destrava.sql + runbook de ensaio
provides:
  - "ensaio real contra produção confirmado: card só-destrava passa a poder ser excluído, card com dinheiro de verdade (pagamento/taxa) continua bloqueado, rollback não deixou rastro"
  - "bug de sintaxe corrigido no runbook (::regprocedure sem parênteses) — fix(15-04), commit 265473c"
affects: [15-06]

actuals:
  tokens: 400
  tasks: 2
  commits: 1

tech-stack:
  added: []
  patterns: []

key-files:
  created: []
  modified:
    - supabase/verificacao_relaxar_exclusao_destrava.sql

key-decisions:
  - "Bug real encontrado durante o ensaio: 'nome'::regprocedure exige parênteses vazios para função sem argumento ('nome()'::regprocedure) — Postgres recusa a forma sem parênteses com ERROR 22P02. Corrigido no repositório (não só no ensaio ao vivo), nas duas ocorrências (BLOCO 3 e BLOCO 4), porque o BLOCO 4 (Parte B, pós-push) tem o mesmo bug e seria usado de novo no plano 15-06"
  - "Confirmação das Provas 2.1/2.2/2.3 é indireta (ausência de erro + números batendo com o baseline), não a leitura textual das mensagens 'OK ...' — o operador não localizou a aba de Messages/Notices do SQL Editor do Supabase Studio. Aceito como suficiente porque cada prova só levanta raise exception (erro visível, mesma classe do erro de sintaxe que o operador já demonstrou conseguir ver e reportar) no caminho de falha — o caminho de sucesso é silencioso por design"
  - "O ensaio foi refeito por inteiro (Rodada 2) depois da correção do bug de sintaxe, em vez de só rodar a última linha corrigida isoladamente — segue a instrução explícita do plano de nunca fechar o registro com um ensaio parcial depois de uma correção"

patterns-established: []

requirements-completed: []

coverage:
  - id: D1
    description: "A Parte A do runbook (supabase/verificacao_relaxar_exclusao_destrava.sql) foi executada contra produção num único clique de Run (D-19), provando as duas metades da mudança na mesma transação revertida: card só-destrava excluído sem erro, card com pagamento/taxa continua bloqueado"
    requirement: CANDEST-01
    verification:
      - kind: manual_procedural
        ref: "Operador rodou a Parte A duas vezes (Rodada 1 pegou um bug de sintaxe do próprio runbook na última linha, sem afetar o rollback já executado; Rodada 2, com o bug corrigido, completou de ponta a ponta sem erro). Baseline (cards_total=56, parcelas_total=531, lancamentos_total=25, cards_updated_at_max=2026-08-26 18:57:24.819176+00) idêntico ao pós-rollback. pg_get_functiondef pós-rollback confirmou o corpo original da função (sem o filtro de tipo) — o rollback desfez o create or replace function do BLOCO 2 de verdade"
        status: pass
    human_judgment: true
    rationale: "Confirmação das Provas 2.1/2.2/2.3 em si é indireta (ausência de erro visível + números batendo), não a leitura textual das mensagens de sucesso — documentado com honestidade no RESULTADO DO ENSAIO do próprio runbook, não escondido"
  - id: D2
    description: "supabase/verificacao_relaxar_exclusao_destrava.sql carrega o registro completo do ensaio, commitado no git — base para o checkpoint:decision do plano 15-06"
    verification:
      - kind: other
        ref: "grep confirma as 5 asserções do <verify> automatizado da Task 2 (cards_total, caminho de execução único Run, resultado 'relaxad[o]', resultado 'protegid[o]', seção com mais de 12 linhas) — ENSAIO_REGISTRADO"
        status: pass
    human_judgment: false

duration: ~20min (incluindo diagnóstico e correção do bug de sintaxe)
completed: 2026-08-27
status: complete
---

# Phase 15 Plan 04: Ensaiar a migração de relaxamento contra produção Summary

**O ensaio da migração de relaxamento de exclusão com destrava rodou contra produção real, dentro de `begin;...rollback;`, e confirmou as duas metades da mudança — mas só na segunda tentativa, depois de corrigir um bug de sintaxe real (`::regprocedure` sem parênteses) encontrado durante a primeira rodada. Rollback confirmado sem rastro; base pronta para o `checkpoint:decision` do plano 15-06.**

## Performance

- **Duration:** ~20 min (incluindo diagnóstico e correção do bug de sintaxe)
- **Completed:** 2026-08-27
- **Tasks:** 2/2
- **Files modified:** 1 (`supabase/verificacao_relaxar_exclusao_destrava.sql`)

## Accomplishments

- **Task 1 (`checkpoint:human-verify`):** operador rodou a Parte A do runbook duas vezes contra produção
  - Rodada 1: baseline anotado (`cards_total=56`, `parcelas_total=531`, `lancamentos_total=25`, `cards_updated_at_max=2026-08-26 18:57:24.819176+00`); o BLOCO 2 (DDL + 3 provas + `rollback;`) completou, mas a última linha do BLOCO 3 (leitura pós-rollback do corpo da função via `pg_get_functiondef`) quebrou com `ERROR: 22P02: expected a left parenthesis` — bug de sintaxe do próprio runbook (cast `::regprocedure` exige parênteses vazios para função sem argumento), não um problema de dado ou de lógica da migração. Como `rollback;` é uma instrução independente executada antes dessa linha, nada ficou pendente — só a leitura de confirmação não completou
  - Correção aplicada diretamente pelo orquestrador (fora de um plano formal, mudança de uma linha × 2 ocorrências): `'nome'::regprocedure` → `'nome()'::regprocedure`, commit `265473c`, push imediato
  - Rodada 2 (depois da correção): Parte A inteira refeita do zero, completou sem nenhum erro. `pg_get_functiondef` pós-rollback confirmou o corpo original da função (sem o filtro de tipo novo); os 4 números pós-rollback bateram exatamente com o baseline
  - Provas 2.1/2.2/2.3 confirmadas indiretamente: o operador não localizou a aba de Messages/Notices do SQL Editor onde `raise notice` aparece; aceito como suficiente porque o caminho de falha de cada prova é a única forma de gerar um erro visível (mesma classe do erro de sintaxe que o operador já demonstrou conseguir ver), e a Rodada 2 completou sem nenhum erro reportado
- **Task 2 (`auto`):** bloco `RESULTADO DO ENSAIO` preenchido em `supabase/verificacao_relaxar_exclusao_destrava.sql` com contexto, as duas rodadas, os números lado a lado, e a ressalva honesta sobre a confirmação indireta das provas — todas as 5 asserções do `<verify>` automatizado passaram (`ENSAIO_REGISTRADO`)

## Task Commits

1. **Task 1 (checkpoint:human-verify):** sem commit de código — ensaio rodado pelo operador contra produção; a correção do bug de sintaxe encontrado no caminho foi commitada separadamente (`265473c`, fora deste plano formal, antes da Rodada 2)
2. **Task 2:** registro do resultado — commit deste plano

## Files Created/Modified
- `supabase/verificacao_relaxar_exclusao_destrava.sql` — bloco `RESULTADO DO ENSAIO` preenchido (Task 2); o fix de sintaxe (`265473c`) já estava commitado antes desta task, feito pelo orquestrador durante o diagnóstico da Rodada 1

## Decisions Made
- Corrigir o bug de sintaxe no repositório (não só contornar ao vivo no SQL Editor), porque o mesmo cast quebrado existe no BLOCO 4 (Parte B, pós-push) — que será usado de novo no plano 15-06 para confirmar a migração já aplicada
- Refazer a Parte A inteira depois da correção, em vez de só rodar a última linha isoladamente — segue a instrução explícita do plano (`<action>` da Task 2: "Se alguma correção foi feita... o ensaio precisa ser refeito por inteiro")
- Aceitar confirmação indireta das Provas 2.1/2.2/2.3 (ausência de erro + números batendo) em vez de bloquear o plano inteiro por causa de uma limitação de UX do SQL Editor do Supabase Studio — documentado com honestidade no runbook, não escondido nem inventado

## Deviations from Plan

### Bug real encontrado no runbook durante o ensaio (não no design da migração em si)

**Issue:** O `<action>` da Task 2 do plano 15-01 (que escreveu o runbook) usou `'public.impedir_exclusao_de_card_com_lancamento'::regprocedure` sem parênteses — sintaxe que o Postgres recusa para função sem nenhum argumento (`ERROR: 22P02: expected a left parenthesis`). Só apareceu ao rodar de verdade contra produção; nenhuma verificação de `grep` do plano 15-01 pegaria isso, porque o texto em si "parecia" válido.

**Ação tomada:** corrigido nas duas ocorrências do arquivo (BLOCO 3 e BLOCO 4), commitado (`265473c`) e enviado antes de pedir ao operador para refazer o ensaio.

**Impacto:** nenhum no schema ou na lógica da migração em si — o predicado relaxado (`create or replace function`) nunca teve esse bug; ele só afetava a *leitura* de confirmação pós-rollback/pós-push. Sem esse fix, o plano 15-06 (que reusa o BLOCO 4) teria o mesmo erro ao confirmar a aplicação real.

---

**Total deviations:** 1 (bug de sintaxe no runbook, corrigido no caminho)
**Impact on plan:** Nenhum na migração em si; o runbook ficou mais correto do que o plano 15-01 tinha produzido.

## Issues Encountered
- Operador não conseguiu localizar a aba de Messages/Notices do SQL Editor do Supabase Studio onde `raise notice` normalmente aparece — resolvido com confirmação indireta (ver "Decisions Made" acima), documentada honestamente no `RESULTADO DO ENSAIO`, não inventada.

## User Setup Required

None — Task 1 já foi executada pelo operador em produção.

## Next Phase Readiness

- `supabase/verificacao_relaxar_exclusao_destrava.sql` carrega um registro completo e honesto do ensaio, pronto para embasar o `checkpoint:decision` do plano 15-06
- O bug de sintaxe do `::regprocedure` já está corrigido também no BLOCO 4 (Parte B), que o plano 15-06 vai usar para confirmar a aplicação real — não deve repetir o mesmo erro

## Self-Check: PASSED

- FOUND: `supabase/verificacao_relaxar_exclusao_destrava.sql` com `RESULTADO DO ENSAIO — 2026-08-27`
- FOUND: seção cita `cards_total`, "único Run", "relaxad[o]", "protegid[o]" — todas as 5 asserções do `<verify>` da Task 2 passaram (`ENSAIO_REGISTRADO`)
- FOUND: commit `265473c` (fix do bug de sintaxe, pré-requisito da Rodada 2)

---
*Phase: 15-exclus-o-de-card-com-destrava-e-pagina-o*
*Completed: 2026-08-27*
