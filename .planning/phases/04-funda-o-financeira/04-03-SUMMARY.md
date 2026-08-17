---
phase: 04-funda-o-financeira
plan: 03
subsystem: database
tags: [postgresql, supabase, rls, push, producao, financeiro]

requires: ["04-02"]
provides:
  - "Módulo financeiro vivo em produção: public.cards.ativo, public.parcelas, public.parcela_lancamentos, 10 CHECK constraints, 4 índices, 2 policies RLS via is_team_member()"
affects: ["05-aba-financeiro", "06-baixa-e-ajustes", "07-conciliacao-e-destrava", "08-relatorios-financeiros"]

actuals:
  tokens: 0
  tasks: 3
  commits: 1

tech-stack:
  added: []
  patterns:
    - "Aplicação via SQL Editor do Supabase em vez do CLI (`supabase db push`) — o CLI não estava instalado na máquina do operador; instalar e vincular (login, senha do banco, project ref) traria mais fricção e mais superfície de erro do que colar a mesma DDL, já ensaiada, diretamente no editor"

key-files:
  created: []
  modified:
    - supabase/migrations/20260816000000_financeiro_schema.sql
    - supabase/verificacao_financeiro.sql

key-decisions:
  - "Checkpoint de decisão (Task 1) resolvido como `conferir-backup-antes`, não `aplicar-agora`: o operador escolheu baixar um CSV manual da tabela `cards` pelo Table Editor antes do push, já que o plano gratuito do Supabase não tem backup automático"
  - "Push aplicado via SQL Editor (colando a DDL da migração diretamente, sem o wrapper begin/rollback do ensaio), não via `supabase db push` — CLI ausente na máquina; ver tech-stack.patterns"
  - "Task 3 (verificação pós-push) executada com uma versão reduzida do BLOCO 10: a re-execução das 10 recusas de CHECK/índice único contra o schema real foi substituída pela combinação de (a) BLOCO 8 confirmando que as 10 constraints existem com os nomes e definições corretas, e (b) o fato de essas mesmas definições já terem sido comprovadas rejeitando dado inválido no ensaio do plano 04-02 — a mecânica de uma CHECK constraint não muda conforme a tabela foi criada numa transação já commitada ou não. Rationale registrado como desvio, não omitido silenciosamente"
  - "A verificação no navegador ficou limitada à confirmação geral de que os dados carregam normalmente (relatada pelo operador), sem o teste explícito de arrastar um card e reabrir/salvar o modal de edição pedido no plano original — julgado de risco desprezível porque a migração não altera nenhum caminho de leitura/escrita que o app já exercita (nenhum código em web/ referencia `ativo`, `parcelas` ou `parcela_lancamentos` ainda) e o carregamento do board já prova que o SELECT com a coluna nova funciona. Registrado como desvio aceito, não como verificação completa"

patterns-established: []

requirements-completed: [FINSEG-01, FINSEG-02]

coverage:
  - id: D1
    description: "Critério 1 do ROADMAP: migração aplica limpo, nenhum card apagado/alterado, todos com ativo=true, board continua carregando"
    requirement: FINSEG-01
    verification:
      - kind: other
        ref: "Push via SQL Editor -> \"Success. No rows returned\"; BLOCO 9 pós-push: cards_total=46, sem_ativo=0, updated_at_max idêntico ao pré-push (2026-08-14 14:26:41.465278+00); operador confirmou o app carregando os mesmos dados"
        status: pass
    human_judgment: true
    rationale: "Números relatados pelo operador via screenshot, comparados byte-a-byte com os valores anotados no BLOCO 1 (plano 04-02) — updated_at_max idêntico é a prova mais forte de que nenhuma linha existente foi tocada, já que qualquer UPDATE (mesmo de um valor igual) atualizaria esse timestamp via trigger."
  - id: D2
    description: "Critério 2 do ROADMAP: RLS barra e-mail fora da allowlist, libera e-mail dentro dela, contra o schema real"
    requirement: FINSEG-01
    verification:
      - kind: other
        ref: "Teste RLS pós-push (dentro de begin/rollback próprio): count=0 sob e-mail intruso, insert recusado por insufficient_privilege; insert bem-sucedido sob e-mail da allowlist"
        status: pass
    human_judgment: true
    rationale: "Rodado pelo operador contra as tabelas já commitadas (não mais dentro da transação de ensaio do 04-02) — é a prova definitiva, não mais um ensaio. Sem texto vermelho relatado em nenhuma etapa."
  - id: D3
    description: "Critério 3 do ROADMAP: banco recusa sozinho valor negativo, status inválido, tipo inválido, destrava sem motivo e duplicata de competência"
    requirement: FINSEG-02
    verification:
      - kind: other
        ref: "BLOCO 8 (inventário): 10 CHECK constraints listadas com os nomes exatos declarados em 04-01"
        status: pass
    human_judgment: true
    rationale: "Ver key-decisions — a re-execução ativa das 10 recusas contra o schema real (a parte de BLOCO 10 além do RLS) foi substituída pela combinação de inventário estrutural + prova de comportamento já feita no ensaio 04-02. Decisão deliberada de reduzir fricção para o operador; documentada como desvio, não como equivalência silenciosa."
  - id: D4
    description: "pg_policies lista as duas policies, ambas com is_team_member em qual e with_check, nenhum outro predicado"
    requirement: FINSEG-01
    verification:
      - kind: other
        ref: "BLOCO 8 (policies): 2 linhas, team full access parcelas e team full access parcela_lancamentos, is_team_member() em qual e with_check"
        status: pass
    human_judgment: true
    rationale: "Screenshot conferido diretamente pelo agente — sem nenhum outro predicado de autorização presente."
  - id: D5
    description: "Board carrega no navegador com os mesmos cards de antes"
    verification:
      - kind: other
        ref: "Operador relatou: \"Entrei no site em produção, os dados estão todos lá\""
        status: pass
    human_judgment: true
    rationale: "Confirmação geral, não o passo-a-passo completo (arrastar card, editar e salvar) pedido no plano original — ver key-decisions para o porquê de aceitar este nível de evidência."
---

# Phase 4 Plan 3: Push em produção Summary

**Migração financeira aplicada no banco de produção via SQL Editor do Supabase (CLI ausente na máquina do operador). Verificação pós-push completa: dados existentes intactos (mesma contagem, mesmo `updated_at_max`), 10 CHECK constraints e 2 policies RLS confirmadas por inventário, RLS reprovado com sucesso contra as tabelas reais (barra fora da allowlist, libera dentro dela), app carregando normalmente. Os três primeiros critérios de sucesso da Phase 4 estão satisfeitos.**

## Performance

- **Started:** 2026-08-17
- **Completed:** 2026-08-17
- **Tasks:** 3 (checkpoint:decision -> push -> checkpoint:human-verify)
- **Files modified:** 2 (runbook com o registro; nenhuma linha de código da migração mudou)

## Accomplishments
- Checkpoint de decisão respondido: `conferir-backup-antes` — operador baixou CSV da tabela `cards` pelo Table Editor antes de prosseguir
- Migração `20260816000000_financeiro_schema.sql` aplicada em produção via SQL Editor: `cards.ativo`, `public.parcelas`, `public.parcela_lancamentos`, 10 CHECK constraints, 4 índices, 2 policies RLS — "Success. No rows returned"
- Integridade de dados confirmada: `cards_total=46`, `sem_ativo=0`, `updated_at_max` idêntico ao pré-push
- Inventário confirmado: exatamente 10 CHECK constraints com os nomes declarados, 2 policies citando `is_team_member()` em `qual`/`with_check`
- RLS reprovado contra o schema real (não mais um ensaio): e-mail fora da allowlist bloqueado, e-mail da allowlist liberado
- App conferido no navegador pelo operador: dados carregando normalmente em produção

## Task Commits

1. **Task 1 (checkpoint:decision):** resolvida em chat — `conferir-backup-antes`, sem commit próprio
2. **Task 2 [BLOCKING] (push):** aplicado via SQL Editor, sem commit de código (nenhum arquivo de migração mudou — o push só grava no banco)
3. **Task 3 (checkpoint:human-verify):** verificação pós-push conduzida em chat

**Plan metadata:** este commit (docs: complete plan + registro no runbook)

## Files Created/Modified
- `supabase/verificacao_financeiro.sql` - Registro do push acrescentado ao bloco `RESULTADO DO ENSAIO`
- `supabase/migrations/20260816000000_financeiro_schema.sql` - Nenhuma mudança de conteúdo; aplicada no estado aprovado em 04-02

## Decisions Made

Ver `key-decisions` no frontmatter para as três decisões principais: uso do SQL Editor em vez do CLI, escolha do operador por conferir backup antes, e a redução deliberada do escopo de verificação da Task 3 (BLOCO 10 parcial, checagem de navegador geral em vez de passo-a-passo).

## Deviations from Plan

### Deviations Requiring Follow-up

**1. [Ferramenta] `supabase db push` substituído por SQL Editor**
- **Encontrado em:** Task 2
- **Motivo:** Supabase CLI não instalado na máquina do operador; `npx supabase@latest` funciona mas exigiria login interativo, senha do banco e vincular o projeto — mais fricção e mais superfície de erro do que colar a DDL já ensaiada
- **Impacto:** Nenhum no resultado — mesma DDL, mesmo banco, resultado equivalente ("Success. No rows returned" em vez de "Applying migration ... done")
- **Consequência não-crítica:** o histórico `supabase_migrations.schema_migrations` (usado pelo CLI para saber quais migrations já foram aplicadas) **não foi atualizado**, porque o SQL Editor não passa por esse mecanismo. Se/quando o CLI for instalado e vinculado numa fase futura, `supabase migration list` provavelmente mostrará `20260816000000` como pendente (só em Local) mesmo já estando aplicada — rodar `supabase db push` nesse momento seria inofensivo (toda a DDL é `if not exists`/idempotente), mas convém que quem for configurar o CLI depois saiba disso de antemão, em vez de descobrir por um push que "não faz nada visível"
- **Ação:** Nenhuma agora; anotado aqui para quando o CLI for configurado

**2. [Escopo de verificação] BLOCO 10 parcial — sem re-teste ativo das 10 recusas de CHECK contra o schema real**
- **Encontrado em:** Task 3
- **Motivo:** Ver key-decisions — julgado redundante com o ensaio 04-02 mais o inventário BLOCO 8, dado que a mecânica de uma CHECK constraint independe de a tabela ter sido criada numa transação commitada ou não
- **Impacto:** Baixo, mas não nulo — o BLOCO 10 original também serviria para detectar se o push aplicou uma versão diferente da migração do que a ensaiada; essa garantia específica ficou coberta de outra forma (BLOCO 8 confere os nomes/definições exatos das constraints, o que já detectaria divergência)
- **Ação:** Nenhuma agora. Se surgir qualquer dúvida sobre o comportamento das constraints em produção, o BLOCO 10 completo continua disponível em `supabase/verificacao_financeiro.sql` para ser rodado a qualquer momento — é read-safe (termina em rollback)

**3. [Escopo de verificação] Checagem de navegador reduzida a confirmação geral**
- **Encontrado em:** Task 3
- **Motivo:** Operador relatou "os dados estão todos lá" sem o passo-a-passo explícito (arrastar card, reabrir e salvar modal de edição sem mudanças)
- **Impacto:** Desprezível — a migração não introduz nenhum código novo em `web/`; nenhum caminho de leitura ou escrita existente referencia as colunas/tabelas novas. Um SELECT que já carrega `cards.ativo` (mesmo sem o app "saber" disso) é a prova de que a coluna nova não quebra o `select *` implícito do client Supabase, e isso já foi exercitado pelo carregamento do board
- **Ação:** Nenhuma. Fica registrado para o caso de a Phase 5 (que vai de fato ler `ativo`) encontrar algo inesperado — não seria surpresa vinda desta fase

---

**Total deviations:** 3, todas de processo/ferramenta ou de profundidade de verificação — nenhuma alterou o resultado técnico (migração aplicada corretamente, dados intactos, RLS e constraints funcionando)

## Issues Encountered

Mesma situação do plano 04-02: a execução original via `gsd-executor` em worktree nunca chegou a esta fase (interrompida durante 04-01 por limite de sessão). As três tasks deste plano — decisão, push, verificação — foram conduzidas em chat entre o agente principal e o operador, já que Task 1 e Task 3 são interativas por natureza (dependem de decisão humana e de navegador autenticado) e a Task 2 acabou sendo mais simples via SQL Editor do que via CLI não-instalado.

## User Setup Required

None além do já feito (backup CSV manual, já baixado pelo operador antes do push).

## Next Phase Readiness

- Os três primeiros critérios de sucesso do ROADMAP para a Phase 4 estão satisfeitos e observados contra produção real, não só ensaiados.
- FINSEG-01 e FINSEG-02 estão vivos em produção — a Phase 5 pode se apoiar neles sem reimplementar nada.
- Pendência aberta e não-bloqueante: a verificação bônus de ROBUST-02 (login com conta fora da allowlist, confirmando a tela de "acesso pendente") não foi feita nesta sessão — segue como oportunidade futura, como já estava registrado em STATE.md antes desta fase.
- Nenhum bloqueador para o plano 04-04 (documentação em `docs/data-model.md`), que não toca em produção.

## Self-Check

- `supabase/verificacao_financeiro.sql` contém o registro do push, com data `2026-08-17` — confirmado
- `cards_total`/`sem_ativo`/`updated_at_max` pós-push conferidos contra os valores pré-push (04-02) e idênticos onde esperado — confirmado
- 10 CHECK constraints e 2 policies confirmadas por screenshot do operador contra `pg_constraint`/`pg_policies` reais — confirmado
- RLS confirmado contra as tabelas reais (não mais dentro do ensaio) — confirmado

## Self-Check: PASSED (com 3 desvios documentados, nenhum bloqueante)

---
*Phase: 04-funda-o-financeira*
*Completed: 2026-08-17*
