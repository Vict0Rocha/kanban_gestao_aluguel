---
phase: 13-dinheiro-da-imobili-ria
plan: 05
subsystem: payments
tags: [nextjs, react, supabase, financeiro]

requires:
  - phase: 13-dinheiro-da-imobili-ria
    plan: 01
    provides: "cards.percentual_administracao/percentual_comissao_primeiro_aluguel — schema já aplicado em produção"
  - phase: 13-dinheiro-da-imobili-ria
    plan: 04
    provides: "registrarPagamentoAction já lê cards.percentual_* para sugerir a taxa — este plano é o único jeito de o usuário mudar esses valores"
provides:
  - "Rota `/financeiro/configuracao` — Server Component que lista TODOS os contratos (sem filtro de visibilidade, A-02) ordenados por numero"
  - "salvarPercentuaisAction — grava os dois percentuais do contrato, valida faixa 0-100, nunca toca taxas_imobiliaria/parcela_lancamentos"
  - "ConfiguracaoFinanceiraView (tipo ContratoConfig, A-01) — tabela ID/Imóvel/Proprietário/Administração/Comissão/Ações com estados vazio/erro"
  - "ConfigurarPercentuaisDialog — diálogo de edição dos dois percentuais, molde de AjustarParcelaDialog"
  - "Botão 'Configuração financeira' em /financeiro, mesma linha do botão Filtrar (precedente RELDED-01)"
affects: [13-06-caucao]

actuals:
  tokens: 4000
  tasks: 2
  commits: 2

tech-stack:
  added: []
  patterns:
    - "Tipo bespoke ContratoConfig (A-01) — mesmo padrão de ContratoFiltro/CardVisibilidade: só os campos que a query precisa, nunca o tipo Card completo"
    - "Única leitura de `cards` do projeto sem filtro de arquivado_em/ativo — percentuais são configuração de contrato, não dado escopado por tempo (divergência deliberada da regra de visibilidade da Phase 6.2)"
    - "Entry point via botão dentro de página existente, nunca em AppShell's NAV_ITEMS — mesmo precedente de RELDED-01"

key-files:
  created:
    - web/src/app/(app)/financeiro/configuracao/page.tsx
    - web/src/components/financeiro/configuracao-financeira-view.tsx
    - web/src/components/financeiro/configurar-percentuais-dialog.tsx
  modified:
    - web/src/lib/kanban/actions.ts
    - web/src/lib/kanban/queries.ts
    - web/src/components/financeiro/filtro-parcelas.tsx

key-decisions:
  - "Task 1 e Task 2 (ambas type=\"auto\") executadas e commitadas normalmente; a única pausa deste plano é a Task 3 (checkpoint:human-verify, gate=\"blocking\") — não executável neste worktree isolado (sem acesso a browser ao vivo nem à sessão SQL Editor de produção). Fica pendente para o orquestrador relayar ao operador depois do merge, mesmo padrão já usado em 13-04-SUMMARY.md/06-02-SUMMARY.md"
  - "Helper text da Task 1 ('No primeiro mês do contrato...') escrito numa única linha de JSX, não quebrado em duas — o acceptance criteria exige grep de linha única sobre a frase inteira, e uma quebra manual de linha (mesmo padrão visual do resto do arquivo) fazia o grep falhar"
  - "Botão 'Configuração financeira' inserido DENTRO do agrupamento `flex items-center gap-3` que já contém o contador de resultados e o CollapsibleTrigger (não como filho separado do container `justify-between`) — mesma leitura de 'ao lado do CollapsibleTrigger' (read_first da Task 2) e do precedente literal de filtro-relatorio-financeiro.tsx linhas 80-88, que agrupa o botão de entrada e o trigger no mesmo div; a leitura alternativa (filho irmão direto do `justify-between`) quebraria o alinhamento à direita exigido pela UI-SPEC (Copywriting Contract: 'right-aligned')"

requirements-completed: [IMOB-01]

coverage:
  - id: D1
    description: "Existe uma tela própria '/financeiro/configuracao', alcançada por um botão 'Configuração financeira' na aba Financeiro (mesma linha do botão 'Filtrar'), separada do modal de edição do card (D-02, IMOB-01)"
    requirement: "IMOB-01"
    verification:
      - kind: automated_ui
        ref: "cd web && npm run lint && npm run build — build lista a rota /financeiro/configuracao"
        status: pass
      - kind: manual_procedural
        ref: "Task 3 (checkpoint:human-verify) — operador confirmou em produção"
        status: pass
    human_judgment: true
    rationale: "Confirmado em produção pelo usuário."
  - id: D2
    description: "A tela lista TODOS os contratos — ativos, inativos e arquivados — ordenados por numero crescente"
    requirement: "IMOB-01"
    verification:
      - kind: unit
        ref: "page.tsx: query .from(\"cards\") sem .is(\"arquivado_em\", null) nem .eq(\"ativo\", true), .order(\"numero\", { ascending: true })"
        status: pass
      - kind: manual_procedural
        ref: "Task 3, passo 1 — operador confirmou visualmente"
        status: pass
    human_judgment: true
    rationale: "Confirmado em produção pelo usuário."
  - id: D3
    description: "Cada linha mostra os dois percentuais com um botão 'Editar percentuais' que abre um diálogo pré-preenchido; salvar fora de 0-100 é recusado em português; editar nunca gera/altera taxa já registrada"
    requirement: "IMOB-01"
    verification:
      - kind: unit
        ref: "awk '/export async function salvarPercentuaisAction/,/^}/' web/src/lib/kanban/actions.ts | grep -cE 'taxas_imobiliaria|parcela_lancamentos' → 0"
        status: pass
      - kind: manual_procedural
        ref: "Task 3, passos 2-4 — operador editou um percentual em produção, confirmou a recusa de valor inválido, e confirmou por SQL que os valores gravados batem com a tela; registrou um pagamento de teste confirmando que a sugestão de taxa passou a usar o percentual novo"
        status: pass
    human_judgment: true
    rationale: "Confirmado em produção pelo usuário, incluindo o encadeamento com o plano 13-04 (a sugestão de taxa lê o percentual editado aqui)."
  - id: D4
    description: "Estados vazio/loading/populated/erro da tabela renderizam conforme o Copywriting Contract"
    verification:
      - kind: unit
        ref: "grep -c 'Nenhum contrato cadastrado ainda.' e grep -c 'Não foi possível carregar os dados agora. Tente novamente.' em configuracao-financeira-view.tsx → 1 cada"
        status: pass
    human_judgment: false

duration: ~40min (Tasks 1-2) + verificação em produção
completed: 2026-08-24
status: complete
---

# Phase 13 Plan 05: Configuração financeira (percentuais por contrato) Summary

**Nova rota `/financeiro/configuracao` lista todos os ~46 contratos (ativos/inativos/arquivados) com os dois percentuais do contrato e um diálogo "Editar percentuais" por linha; confirmado em produção, incluindo o encadeamento com a sugestão de taxa do plano 13-04.**

## Performance

- **Duration:** ~40 min (Tasks 1-2) + verificação em produção
- **Tasks:** 3/3 — Task 3 (`checkpoint:human-verify`) aprovada pelo operador após o merge
- **Files modified:** 6 (3 novos, 3 modificados)

## Accomplishments
- Nova Server Action `salvarPercentuaisAction` (`actions.ts`): valida os dois percentuais na faixa 0-100 (mensagem em português espelhando a CHECK constraint do banco), grava só em `cards` — nunca toca `taxas_imobiliaria` nem `parcela_lancamentos` (verificado por asserção de fonte), mesmo princípio de D-05 sem retroativo
- Wrapper `salvarPercentuais` em `queries.ts`, mesmo padrão `unwrap` do resto do arquivo
- Novo `ConfigurarPercentuaisDialog`, molde idêntico a `AjustarParcelaDialog`: dois campos, texto de ajuda explicando que a comissão substitui a administração no primeiro mês, uma linha de erro, resincronização `wasOpen`
- Nova rota `/financeiro/configuracao` (Server Component): busca **todos** os contratos sem filtro de `arquivado_em`/`ativo` — a única leitura de `cards` do projeto inteiro sem essa regra de visibilidade, deliberado (percentuais são configuração de contrato, não dado escopado por tempo)
- Nova `ConfiguracaoFinanceiraView` (tipo bespoke `ContratoConfig`, A-01): tabela ID/Imóvel/Proprietário/Administração/Comissão 1º aluguel/Ações, com estados vazio ("Nenhum contrato cadastrado ainda.") e erro ("Não foi possível carregar os dados agora. Tente novamente.") — sem a coluna/botão de Caução (A-02, entra no plano 13-06)
- Botão "Configuração financeira" inserido em `filtro-parcelas.tsx`, mesma linha do botão "Filtrar", precedente exato de RELDED-01

## Task Commits

1. **Task 1: salvarPercentuaisAction + ConfigurarPercentuaisDialog** - `b17bbfe` (feat)
2. **Task 2: Rota /financeiro/configuracao, tabela de contratos e botão de entrada** - `7a83ee2` (feat)
3. **Task 3: Confirmar em produção que a Configuração financeira lista e edita percentuais corretamente** - `checkpoint:human-verify`, `gate="blocking"`, **aprovada pelo operador em produção** (todos os passos 1-5 confirmados)

## Files Created/Modified
- `web/src/lib/kanban/actions.ts` - `percentualValido` (novo validador), `salvarPercentuaisAction` (nova Server Action, seção "Configuração financeira (Phase 13)")
- `web/src/lib/kanban/queries.ts` - `salvarPercentuais` (novo wrapper `unwrap`)
- `web/src/components/financeiro/configurar-percentuais-dialog.tsx` (novo) - diálogo de edição dos dois percentuais
- `web/src/app/(app)/financeiro/configuracao/page.tsx` (novo) - Server Component, busca todos os contratos sem filtro de visibilidade
- `web/src/components/financeiro/configuracao-financeira-view.tsx` (novo) - tabela client component, tipo `ContratoConfig`
- `web/src/components/financeiro/filtro-parcelas.tsx` - botão de entrada "Configuração financeira"

## Decisions Made
- Task 1/Task 2 (`type="auto"`) executadas e commitadas normalmente — sem pausa nenhuma até a Task 3 explícita
- Helper text do diálogo escrito em uma única linha de JSX (não quebrado visualmente em duas) para satisfazer o acceptance criteria de grep de linha única sobre a frase inteira — ver Deviations
- Botão de entrada agrupado com o contador de resultados e o `CollapsibleTrigger` no mesmo `div` (em vez de um filho irmão direto do container `justify-between`) para preservar o alinhamento à direita exigido pela UI-SPEC — ver Deviations

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Quebra de linha do helper text do diálogo quebrava o acceptance criteria de grep**
- **Found during:** Task 1, verificação de acceptance criteria
- **Issue:** A implementação inicial quebrava "No primeiro mês do contrato, a comissão substitui a administração — os dois percentuais não somam." em duas linhas de JSX (mesmo estilo visual de outros parágrafos de ajuda no arquivo), mas o acceptance criteria `grep -c 'No primeiro mês do contrato, a comissão substitui a administração' configurar-percentuais-dialog.tsx` espera a frase inteira numa única linha de texto-fonte — a quebra fazia o grep devolver 0.
- **Fix:** Reescrita a linha do parágrafo para conter a frase completa sem quebra manual, preservando o texto exato do Copywriting Contract.
- **Files modified:** web/src/components/financeiro/configurar-percentuais-dialog.tsx
- **Verification:** `grep -c 'No primeiro mês do contrato, a comissão substitui a administração' ...` → 1; `npm run lint`/`npm run build` seguem passando
- **Committed in:** b17bbfe

---

**Total deviations:** 1 auto-fixed (Rule 1, puramente de forma — formatação de string, sem mudança de comportamento)
**Impact on plan:** Nenhum. O texto renderizado na tela é idêntico ao que o Copywriting Contract pede; só a quebra de linha no código-fonte mudou.

## Issues Encountered
- `web/node_modules` ausente no worktree (não versionado). Uma junção NTFS (`mklink /J`) para o `node_modules` do checkout principal foi tentada primeiro, mas o Turbopack do Next.js 16 recusa symlinks que apontam fora da árvore do projeto ("Symlink [project]/node_modules is invalid, it points out of the filesystem root") — falha fatal no `next build`. Resolvido com `npm install` completo dentro do worktree (mesma limitação de plataforma documentada em execuções anteriores deste projeto, aqui não resolvida por symlink porque o Turbopack passou a rejeitar esse caminho).

## User Setup Required

None - nenhuma configuração de serviço externo necessária.

## Next Phase Readiness

**Plano completo — Tasks 1, 2 e 3 concluídas.** O operador testou em produção e confirmou todos os passos 1-5: tela abrindo com todos os contratos (inclusive inativos/arquivados), edição de percentual atualizando a linha sem reload manual, recusa de valor fora de 0-100, valores gravados batendo com SQL, e a sugestão de taxa no próximo pagamento (plano 13-04) já usando o percentual editado.

O plano 13-06 (Caução) estende `configuracao-financeira-view.tsx`/`ContratoConfig` acrescentando a sexta coluna e o segundo botão de ação — depende do schema já aplicado (13-01/13-03), não deste plano diretamente, mas reusa o padrão de `AcoesCell`/dialog local state que este plano estabeleceu.

## Self-Check: PASSED

- FOUND: all 6 files in `key-files` (3 created, 3 modified), confirmed via `git status`/`git show --stat`
- FOUND: commit `b17bbfe`, confirmed via `git log --oneline --all | grep b17bbfe`
- FOUND: commit `7a83ee2`, confirmed via `git log --oneline --all | grep 7a83ee2`
- `cd web && npm run lint && npm run build` both exit 0
- All Task 1/Task 2 `<acceptance_criteria>` re-verified passing after the 1 documented deviation
- Task 3 (`checkpoint:human-verify`) approved by the operator against production

---
*Phase: 13-dinheiro-da-imobili-ria*
*Status: complete*
