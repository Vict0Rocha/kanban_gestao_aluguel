---
phase: 04-funda-o-financeira
plan: 04
subsystem: database
tags: [documentation, data-model, mermaid, postgresql, supabase, financeiro]

# Dependency graph
requires:
  - phase: 04-funda-o-financeira (plan 04-01)
    provides: "Migração `20260816000000_financeiro_schema.sql` — cards.ativo, parcelas, parcela_lancamentos, CHECKs, índices, RLS"
  - phase: 04-funda-o-financeira (plan 04-03)
    provides: "Módulo financeiro vivo em produção — schema aplicado e verificado"
provides:
  - "`docs/data-model.md` atualizado: diagrama Mermaid com PARCELAS e PARCELA_LANCAMENTOS, CARDS.ativo, quatro relacionamentos novos"
  - "Parágrafos de entidade para parcelas e parcela_lancamentos, no tom já estabelecido do documento"
  - "Três decisões de design documentadas: livro-razão append-only, geração preguiçosa sem cron, ativo como flag manual"
  - "Bullets de RLS por allowlist e Validação de dados também no banco ampliados para cobrir as tabelas financeiras"
  - "Seção Como aplicar aponta supabase/verificacao_financeiro.sql como runbook de verificação"
affects: [05-aba-financeiro, 06-baixa-e-ajustes, 07-conciliacao-e-destrava, 08-relatorios-financeiros]

actuals:
  tokens: 2737
  tasks: 2
  commits: 2

tech-stack:
  added: []
  patterns:
    - "Documentação escrita na fase que introduziu a decisão de modelo de dados, não numa fase final (pilar 4 da spec do módulo financeiro)"

key-files:
  created: []
  modified:
    - docs/data-model.md

key-decisions:
  - "Nenhuma decisão nova de produto ou schema — este plano documenta decisões já tomadas em 04-01/04-CONTEXT.md (D-01, D-06, D-08, D-09, D-10), sem reabri-las"
  - "Bullets de RLS por allowlist e Validação de dados também no banco foram ampliados (não duplicados) para cobrir parcelas/parcela_lancamentos, preservando o ponto único de verdade sobre 'estar autenticado não basta'"

patterns-established: []

requirements-completed: [FINDOC-01]

coverage:
  - id: D1
    description: "Diagrama Mermaid mostra PARCELAS e PARCELA_LANCAMENTOS com colunas e ligações a CARDS e PROFILES; CARDS ganha boolean ativo"
    requirement: FINDOC-01
    verification:
      - kind: other
        ref: "04-04-PLAN.md Task 1 <verify><automated> (grep sobre docs/data-model.md) — DIAGRAMA_OK"
        status: pass
    human_judgment: false
  - id: D2
    description: "Seção Entidades ganha parágrafos para parcelas e parcela_lancamentos no tom já usado no documento"
    requirement: FINDOC-01
    verification:
      - kind: other
        ref: "04-04-PLAN.md Task 1 <verify><automated> — DIAGRAMA_OK; leitura manual confirmando o registro e o formato dos parágrafos"
        status: pass
    human_judgment: true
    rationale: "'No mesmo tom' é um julgamento de estilo de prosa que o grep não confere — verificado por leitura direta do parágrafo contra os parágrafos vizinhos (alerts, allowed_members) durante a execução."
  - id: D3
    description: "Seção Decisões de design explica livro-razão append-only, geração preguiçosa sem cron, e ativo como flag manual, no estilo 'decisão + porquê'"
    requirement: FINDOC-01
    verification:
      - kind: other
        ref: "04-04-PLAN.md Task 2 <verify><automated> (grep sobre docs/data-model.md, npm run lint --prefix web) — DECISOES_OK"
        status: pass
    human_judgment: false
  - id: D4
    description: "npm run lint --prefix web continua passando após a edição do documento"
    verification:
      - kind: other
        ref: "npm run lint --prefix web (via node_modules instalado nesta execução, ausente no worktree)"
        status: pass
    human_judgment: false

duration: "~20min"
completed: 2026-08-17
status: complete
---

# Phase 4 Plan 4: Documentação do modelo financeiro Summary

**`docs/data-model.md` ganhou o diagrama Mermaid de `parcelas`/`parcela_lancamentos`, dois parágrafos de entidade, e as três decisões "livro-razão append-only", "geração preguiçosa sem cron" e "`ativo` como flag manual" no estilo "decisão + porquê" já estabelecido do documento — FINDOC-01 satisfeito.**

## Performance

- **Duration:** ~20 min
- **Started:** 2026-08-17T13:45:00Z (aprox.)
- **Completed:** 2026-08-17T14:08:23Z
- **Tasks:** 2
- **Files modified:** 1

## Accomplishments
- Diagrama Mermaid ampliado: blocos `PARCELAS` e `PARCELA_LANCAMENTOS` com todas as colunas do schema aplicado, coluna `boolean ativo` em `CARDS`, e quatro relacionamentos novos (`CARDS -> PARCELAS`, `PARCELAS -> PARCELA_LANCAMENTOS`, `PROFILES -> PARCELAS`, `PROFILES -> PARCELA_LANCAMENTOS`)
- Dois parágrafos novos na seção `## Entidades`, no mesmo registro dos existentes, cada um apontando de volta para a decisão de design correspondente
- Bullets `RLS por allowlist` e `Validação de dados também no banco` ampliados para cobrir as tabelas financeiras, sem duplicar o texto já existente
- Três bullets novos em `## Decisões de design` cobrindo exatamente o que o FINDOC-01 exige: por que o financeiro é um livro-razão append-only (e por que não há coluna `valor_pago`/`valor_devido`), por que a geração de parcela é preguiçosa na leitura em vez de cron (citando `service_role`, o precedente de `alerts.ts`, e a idempotência via `parcelas_unica_por_competencia`), e por que `ativo` é flag manual em vez de derivada de `periodo_fim`
- Seção `## Como aplicar` ganhou um parágrafo apontando `supabase/verificacao_financeiro.sql` como o runbook de verificação, comparado a `supabase/hardening_seguranca.sql`

## Task Commits

Each task was committed atomically:

1. **Task 1: Diagrama e entidades** - `2e9708a` (docs)
2. **Task 2: As três decisões que o FINDOC-01 exige** - `63ab6f4` (docs)

**Plan metadata:** this commit (docs: complete plan)

## Files Created/Modified
- `docs/data-model.md` - Diagrama Mermaid, seção Entidades e seção Decisões de design ampliados com o modelo financeiro

## Decisions Made

Nenhuma decisão de produto ou schema nova — este plano é puramente documentação de decisões já fechadas em `04-01-PLAN.md`/`04-CONTEXT.md` (D-01, D-06, D-08, D-09, D-10). A única escolha editorial feita durante a execução foi ampliar dois bullets existentes (`RLS por allowlist`, `Validação de dados também no banco`) em vez de criar bullets paralelos para os mesmos assuntos, seguindo a instrução explícita do plano de manter o documento com um único ponto de verdade por tópico.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] `node_modules` ausente no worktree, impedindo `npm run lint --prefix web`**
- **Found during:** Task 2 (verificação `<automated>`, etapa `npm run lint --prefix web`)
- **Issue:** O worktree isolado desta execução nunca teve `npm install` rodado em `web/`; `eslint` não existia em `node_modules/.bin`, então o comando de lint do gate de verificação falhava com "eslint não é reconhecido"
- **Fix:** Rodei `npm install` (sem argumentos — restaura as dependências já declaradas em `package.json`/`package-lock.json`, não instala nada novo) dentro de `web/`. Isso não é o cenário coberto pela exclusão de Rule 3 para pacotes (que trata de instalar um pacote referenciado pelo plano e possivelmente inexistente/sequestrado) — aqui é restaurar um lockfile já commitado
- **Files modified:** nenhum arquivo versionado (`web/node_modules/` é gitignored; confirmado via `git status --short` antes e depois)
- **Verification:** `npm run lint --prefix web` passou limpo após a instalação (sem erros/warnings de saída)
- **Committed in:** N/A — nenhum artefato para commitar; a instalação só populou um diretório já ignorado pelo git

---

**Total deviations:** 1 auto-fixed (1 blocking, ambiente)
**Impact on plan:** Nenhum no conteúdo do documento. Necessário apenas para poder executar o gate de verificação `npm run lint --prefix web` exigido pela Task 2 dentro deste worktree isolado.

## Issues Encountered

Nenhum além da dependência de ambiente documentada acima. As leituras de contexto (04-01-SUMMARY.md, 04-03-SUMMARY.md, 04-CONTEXT.md, a migração aplicada, `alerts.ts`) confirmaram que 04-02/04-03 foram conduzidos manualmente em chat (não por subagente), mas isso não afeta este plano: a migração aplicada em produção é byte-idêntica ao que 04-01 produziu, então documentar a partir do arquivo de migração no disco é equivalente a documentar o que está em produção.

## User Setup Required

None - documentação apenas, nenhuma configuração de serviço externo.

## Next Phase Readiness

- FINDOC-01 satisfeito: `docs/data-model.md` agora explica o módulo financeiro (schema + as três decisões não-óbvias) para alguém que não participou da implementação, sem precisar abrir a migração.
- Critério 4 do ROADMAP da Phase 4 satisfeito.
- Nenhum bloqueador para a Phase 5 (Aba Financeiro com parcelas automáticas) — a documentação está pronta como referência para quem implementar a geração preguiçosa e a UI da aba.
- Pendências herdadas de fases anteriores (ROBUST-02 sem verificação com login real, SEC-02 adiado por escolha do usuário) permanecem em aberto, sem relação com este plano.

## Self-Check

- `docs/data-model.md` existe e contém `PARCELAS`, `PARCELA_LANCAMENTOS`, `boolean ativo` - confirmado (grep)
- `grep -c 'PROFILES ||--o{' docs/data-model.md` = 4 - confirmado
- `grep -c '^- \*\*' docs/data-model.md` = 17 (8 em Entidades + 9 em Decisões de design) - confirmado
- Commit `2e9708a` (Task 1) presente em `git log --oneline` - confirmado
- Commit `63ab6f4` (Task 2) presente em `git log --oneline` - confirmado
- `npm run lint --prefix web` passa sem erros - confirmado

## Self-Check: PASSED

---
*Phase: 04-funda-o-financeira*
*Completed: 2026-08-17*
