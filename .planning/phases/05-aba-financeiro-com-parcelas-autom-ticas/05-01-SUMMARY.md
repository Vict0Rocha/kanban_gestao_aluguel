---
phase: 05-aba-financeiro-com-parcelas-autom-ticas
plan: 01
subsystem: financeiro
tags: [nextjs, server-components, supabase, postgrest, rls]

# Dependency graph
requires:
  - phase: 04-funda-o-financeira
    provides: "cards.ativo, public.parcelas (colunas, constraints, índice único parcelas_unica_por_competencia), RLS is_team_member()"
provides:
  - "Rota /financeiro (Server Component) com geração preguiçosa de parcelas das duas competências (mês atual + próximo mês), confirmada em produção contra os ~46 contratos reais"
  - "lib/kanban/parcelas.ts: 9 funções puras + garantirParcelas(), consumidas pelos planos 05-02 e 05-03"
  - "ParcelasTable — componente de apresentação reutilizado/estendido pelo plano 05-02 (badge de situação)"
  - "Item Financeiro na navegação (NAV_ITEMS), entre Board e Relatórios"
  - "Campo ativo: boolean no tipo Card"
affects: [05-02-mes-atual-proximo-mes, 05-03-toggle-ativo-inativo]

# Actuals (#2632)
actuals:
  tokens: 4444
  tasks: 2
  commits: 1

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Geração preguiçosa na leitura (mesmo padrão de alerts.ts): sem cron, sem chave privilegiada — check-then-insert com upsert(onConflict, ignoreDuplicates) como cinto e suspensório contra corrida entre abas"
    - "Módulo puro sem dependência de next/headers nem @/lib/supabase/server — cliente Supabase recebido por parâmetro, tipado via `import type { SupabaseClient } from \"@supabase/supabase-js\"`"
    - "Situação (a_vencer/vencida) nunca gravada — derivada na leitura comparando vencimento com hojeISO string ISO, sem passar por Date (evita bug de fuso já documentado em report.ts)"
    - "`valor_original` é fotografia congelada no INSERT (D-05/PARCELA-03) — confirmado com dado real: editar o aluguel de um card depois que a parcela da competência já existe não altera a parcela até a próxima competência ser gerada. Comportamento por design, não bug"

key-files:
  created:
    - web/src/lib/kanban/parcelas.ts
    - "web/src/app/(app)/financeiro/page.tsx"
    - web/src/components/financeiro/parcelas-table.tsx
  modified:
    - web/src/lib/kanban/types.ts
    - web/src/components/app-shell.tsx

key-decisions:
  - "O embed `cards` do PostgREST em `parcelas.select(\"...cards(endereco,proprietario)...\")` é muitos-para-um (objeto único), mas o inferenciador de tipos do supabase-js (sem Database generics no cliente) o tipa como array — resolvido com um cast explícito `as unknown as ParcelaComCard[]`, documentado inline no page.tsx"
  - "Header (h1+subtítulo) da página é renderizado uma única vez, com o corpo (tabela ou estado 'sem board') condicional dentro dele — evita duplicar a string do Copywriting Contract em dois branches de retorno"
  - "Task 2 (checkpoint:human-verify) confirmou contra os ~46 contratos reais de produção: geração correta, idempotência sob 3 reloads + navegação cruzada, e nenhum vazamento de erro cru na tela. A queda de 46→45 parcelas entre agosto e setembro é o comportamento correto de A-03/D-04 (um contrato ativo tem periodo_fim dentro de agosto), não uma falha de geração"

requirements-completed: [PARCELA-01, PARCELA-02, PARCELA-03, PARCELA-04, FINUI-01, FINUI-03]

coverage:
  - id: D1
    description: "Item Financeiro aparece na navegação entre Board e Relatórios e abre /financeiro"
    requirement: "FINUI-01"
    verification:
      - kind: other
        ref: "npm run build — rota /financeiro listada; grep de ordem de NAV_ITEMS"
        status: pass
      - kind: manual
        ref: "Task 2, Passo 1 — operador confirmou a aba abrindo em produção sem erro"
        status: pass
    human_judgment: false
  - id: D2
    description: "Geração preguiçosa grava as parcelas faltantes de mês atual e próximo mês para contratos ativos dentro do período, sem duplicar e sem erro visível ao recarregar"
    requirement: "PARCELA-01, PARCELA-02, PARCELA-04"
    verification:
      - kind: manual
        ref: "Task 2, Passos 0-3 contra produção: pré-voo (contratos_ativos=46, ativos_sem_inicio=25, total_cards=46, parcelas_antes=0) → geração real → consultas (a)-(f) → 3 reloads (F5) + navegação Board→Financeiro→Relatórios→Financeiro"
        status: pass
    human_judgment: true
    rationale: "Escreveu em public.parcelas de produção (~46 contratos reais); exigiu rodar as consultas SQL de verificação e recarregar a UI logada — não automatizável pelo executor. Aprovado pelo operador em 2026-08-17."
  - id: D3
    description: "valor_original gravado é a fotografia do valor do card no instante da geração (nunca relido depois)"
    requirement: "PARCELA-03"
    verification:
      - kind: manual
        ref: "Task 2, consulta (f) valor_divergente = 0; side investigation confirmou que editar valor após a parcela existir legitimamente não altera a parcela já gravada"
        status: pass
    human_judgment: true
    rationale: "Só verificável contra dados reais gravados em produção — consulta (f) da Task 2, aprovada pelo operador."
  - id: D4
    description: "Cada linha mostra imóvel, proprietário, vencimento, valor devido, valor pago e situação em português, com a_vencer/vencida derivadas na leitura"
    requirement: "FINUI-03"
    verification:
      - kind: other
        ref: "npm run lint && npm run build — grep das 6 colunas e do container em parcelas-table.tsx"
        status: pass
      - kind: manual
        ref: "Task 2, Passo 4 — leitura visual: endereço/proprietário batendo com o card, valor devido = aluguel, valor pago = R$ 0,00, situação coerente com vencimento. Operador: \"Bateu tudo.\""
        status: pass
    human_judgment: true
    rationale: "A leitura visual dos valores contra os cards reais (Passo 4 da Task 2) exigiu o operador olhando a tela em produção. Aprovado."
  - id: D5
    description: "Recarregar múltiplas vezes e navegar entre abas não duplica parcela nem produz erro de tela"
    requirement: "PARCELA-02"
    verification:
      - kind: manual
        ref: "Task 2, Passo 3 — 3× F5 + Board→Financeiro→Relatórios→Financeiro; consulta (a) idêntica (2026-08-01→46, 2026-09-01→45), consulta (d) = 0, nenhuma tela de erro"
        status: pass
    human_judgment: true
    rationale: "Idempotência só é provável contra o banco real sob reload real do navegador. Aprovado pelo operador."

# Metrics
duration: "~25min (Task 1) + verificação do operador contra produção (Task 2)"
completed: 2026-08-17
status: complete
---

# Phase 5 Plan 1: Fatia vertical da aba Financeiro Summary

**Rota `/financeiro` com geração preguiçosa das parcelas de duas competências (mês atual e próximo mês) para contratos ativos, gravando pela primeira vez em `public.parcelas` via cliente de sessão do usuário — Task 1 (tracer) commitada e Task 2 (checkpoint:human-verify contra os ~46 contratos reais de produção) aprovada pelo operador.**

## Performance

- **Duration:** ~25 min (Task 1, execução) + sessão de verificação do operador contra produção (Task 2)
- **Completed:** 2026-08-17
- **Tasks:** 2 de 2 (Task 2 é checkpoint:human-verify — sem código, verificação operacional)
- **Files modified:** 5 (3 criados, 2 modificados)

## Accomplishments
- `lib/kanban/parcelas.ts`: módulo puro no espírito de `alerts.ts` com as 9 funções do plano (`competenciasAlvo`, `ultimoDiaDoMes`, `vencimentoDaCompetencia`, `competenciaNoPeriodo`, `parcelasFaltantes`, `situacaoDaParcela`, `somarLancamentos`, `montarLinhas`, `garantirParcelas`), sem nenhuma dependência de `next/headers` ou de cliente privilegiado
- Rota `/financeiro` (Server Component) que busca o board, monta `hojeISO` no servidor, chama `garantirParcelas` e lista o mês atual — erro do Supabase nunca chega ao navegador (mensagem constante + `console.error` no servidor)
- `ParcelasTable`: tabela de apresentação com o shell de `ContractsTable`, as 6 colunas fixadas na UI-SPEC, texto simples de situação (badge com ícone é o plano 05-02)
- Item `Financeiro` (ícone `Wallet`) inserido em `NAV_ITEMS`, entre Board e Relatórios
- `Card.ativo: boolean` adicionado ao tipo, sem tocar em `CardDetailsInput`
- **Primeira gravação real do app em `public.parcelas` de produção**, confirmada correta pelo operador: 46 contratos ativos geraram 46 parcelas em `2026-08-01` e 45 em `2026-09-01` — a queda de 46 para 45 é o comportamento correto de A-03/D-04 (um contrato tem `periodo_fim` dentro de agosto, então setembro fica corretamente fora do período), não uma falha de geração
- Idempotência confirmada sob 3 reloads (F5) e navegação cruzada Board→Financeiro→Relatórios→Financeiro: nenhuma duplicata, nenhuma tela de erro

## Task Commits

1. **Task 1: Fatia vertical — nav → rota /financeiro → geração → lista** - `53dd9bc` (feat)
2. **Task 2: Conferir a primeira geração real contra os ~46 contratos de produção** - checkpoint:human-verify, sem arquivo alterado, sem commit de código — aprovado pelo operador em 2026-08-17 (ver seção "Task 2 — Verificação em Produção" abaixo)

**Plan metadata:** this commit (docs: complete plan)

## Files Created/Modified
- `web/src/lib/kanban/parcelas.ts` - tipos + funções puras de competência/vencimento/situação/soma do livro-razão + `garantirParcelas()`
- `web/src/app/(app)/financeiro/page.tsx` - Server Component da rota `/financeiro`
- `web/src/components/financeiro/parcelas-table.tsx` - container e tabela das parcelas
- `web/src/lib/kanban/types.ts` - campo `ativo: boolean` no tipo `Card`
- `web/src/components/app-shell.tsx` - entrada `Financeiro` em `NAV_ITEMS`

## Decisions Made
- O embed `cards` no `.select()` de `parcelas` é tipado como array pelo inferenciador de tipos do supabase-js (sem `Database` generics configurados no cliente), embora a relação seja muitos-para-um; resolvido com um cast explícito e comentado em `page.tsx`, em vez de introduzir tipos de schema do Supabase nesta fase (fora de escopo do plano)
- O header da página (`h1` + subtítulo) é renderizado uma única vez, com o corpo (tabela vs. "Nenhum board encontrado.") condicional dentro dele, para não duplicar a string do Copywriting Contract em dois `return`s — ajuste de estrutura em relação ao rascunho inicial descrito no `<action>` do plano, sem mudança de comportamento

## Task 2 — Verificação em Produção

O operador executou o `<how-to-verify>` completo da Task 2 contra o banco de produção e aprovou.

**Pré-voo (antes da primeira visita a /financeiro):**
- `contratos_ativos = 46`, `ativos_sem_inicio = 25`, `total_cards = 46`
- `parcelas_antes = 0` (confirmado: nenhuma parcela real existia antes desta geração)

**Após abrir /financeiro (primeira gravação real) — consulta consolidada de verificação:**
- `a_parcelas_por_competencia`: `2026-08-01 → 46 parcelas`, `2026-09-01 → 45 parcelas`
- `b_de_contrato_inativo = 0`
- `c_fora_do_periodo = 0`
- `d_duplicadas = 0`
- `e_vencimento_inesperado = 0`
- `f_valor_divergente = 0`

**A queda de 46 para 45 parcelas entre agosto e setembro é esperada e correta, não um bug.** Ela significa que um dos contratos ativos tem `periodo_fim` caindo dentro de agosto, então a regra de período de PARCELA-04/A-03 corretamente excluiu esse contrato da competência de setembro. Esta é uma confirmação positiva, com dado real, de que o limite de período está funcionando — não uma anomalia a investigar.

**Idempotência (reload 3× com F5 + navegação Board → Financeiro → Relatórios → Financeiro):**
- Consulta consolidada re-executada: `a_parcelas_por_competencia` idêntica (`2026-08-01 → 46`, `2026-09-01 → 45`), `d_duplicadas = 0`
- Nenhuma tela de erro nem mensagem de falha apareceu em nenhum dos reloads/navegações

**Leitura visual:** o operador confirmou que as linhas mostram endereço, proprietário e valor devido corretos (batendo com o aluguel do card), valor pago = R$ 0,00 em todas as linhas, e situação coerente com o vencimento exibido. Relato do operador: "Bateu tudo."

**Investigação lateral (não-issue, encerrada):** o operador inicialmente reportou que editar proprietário/endereço/valor de um card no Board não refletia em Financeiro para "alguns, mas não todos" os imóveis, mesmo após hard refresh. A investigação (conduzida pelo orquestrador) identificou duas causas distintas, nenhuma delas um bug de código:
1. O campo `valor` corretamente **não** é relido para parcelas já geradas — `valor_original` é uma fotografia intencional por competência (D-05/PARCELA-03), então editar o aluguel depois que a parcela da competência já existe mostra legitimamente o valor antigo até a próxima competência ser gerada. Isso é comportamento por design, confirmado pela consulta (f) = 0.
2. A queixa de endereço/proprietário era erro de operação do teste: o operador tinha dois imóveis semelhantes do mesmo proprietário e estava editando um enquanto olhava o outro.

Nenhuma alteração de código foi necessária ou feita. Esta investigação confirmou que o pipeline de dados de Financeiro (join de embed ao vivo a cada requisição, sem cache) está correto.

**Verificação ROBUST-02 (bônus, opcional per o plano):** não realizada nesta sessão — o operador não tinha uma conta de teste fora da allowlist disponível de imediato. Permanece em aberto, com o mesmo status que carrega desde v1.0/Phase 4. Não bloqueia este plano nem a Phase 5.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] `node_modules` ausente no worktree**
- **Found during:** Task 1 (verificação `npm run lint && npm run build`)
- **Issue:** O worktree do agente não tem `node_modules` (gitignored, não copiado ao criar o worktree) — nenhum binário de `eslint`/`next` disponível
- **Fix:** Link simbólico de `web/node_modules` para o `node_modules` já instalado no repositório principal (mesmo `package-lock.json`, nenhum pacote novo instalado, nenhuma rede acessada)
- **Files modified:** nenhum arquivo versionado — `node_modules` é gitignored, o link não aparece em `git status`
- **Verification:** `npm run lint` e `npm run build` passam
- **Committed in:** N/A (não versionado)

**2. [Rule 1 - Bug] Cast de tipo do embed `cards` no `.select()` de `parcelas`**
- **Found during:** Task 1 (`npm run build` — TypeScript)
- **Issue:** TypeScript inferiu `cards` como array (`{ endereco; proprietario }[]`) em vez do objeto único que o PostgREST devolve para uma relação muitos-para-um, porque o cliente Supabase não tem `Database` generics configurados neste projeto
- **Fix:** Cast explícito `(data ?? []) as unknown as ParcelaComCard[]`, com comentário inline explicando o motivo
- **Files modified:** `web/src/app/(app)/financeiro/page.tsx`
- **Verification:** `npm run build` passa (TypeScript e build de produção)
- **Committed in:** `53dd9bc`

**3. [Rule 1 - Bug] Duplicação do texto do subtítulo entre os dois branches de retorno**
- **Found during:** Task 1 (checagem do critério de aceite `grep -c 'Parcelas do mês atual...'` devolvia 2, não 1)
- **Issue:** O rascunho inicial de `page.tsx` tinha um `return` cedo para "sem board" e outro no final, cada um com sua própria cópia do header — violava o critério de aceite explícito do plano
- **Fix:** Reestruturado para computar `linhas`/`erro` primeiro e renderizar o header uma única vez, com o corpo condicional (`board ? <ParcelasTable/> : <div>Nenhum board encontrado.</div>`)
- **Files modified:** `web/src/app/(app)/financeiro/page.tsx`
- **Verification:** `grep -c` retorna 1; `npm run lint && npm run build` seguem passando
- **Committed in:** `53dd9bc`

---

**Total deviations:** 3 auto-fixed (1 blocking de ambiente, 2 bugs de tipo/estrutura). Nenhuma deviation na Task 2 — verificação confirmou o comportamento previsto pelo plano, sem necessidade de correção de código.
**Impact on plan:** Nenhuma mudança de escopo ou de regra de negócio — todos os três ajustes são de tooling/tipagem/estrutura de renderização, exigidos pelos próprios critérios de aceite do plano.

## Issues Encountered
Nenhum problema além dos documentados em Deviations acima. A investigação lateral descrita em "Task 2 — Verificação em Produção" não revelou nenhum bug de código.

## User Setup Required
None - nenhuma configuração de serviço externo é necessária.

## Next Phase Readiness

**Plano 05-01 completo — Task 1 e Task 2 aprovadas.** O plano 05-02 (visão "próximo mês" + badge de situação com ícone) pode começar: ele consome `parcelas.ts` e `ParcelasTable` tal como ficaram aqui, ambos já confirmados contra dado real de produção.

Pendência herdada (não bloqueia): ROBUST-02 (login com conta fora da allowlist) segue em aberto, mesmo status desde v1.0/Phase 4 — ver nota acima.

---
*Phase: 05-aba-financeiro-com-parcelas-autom-ticas*
*Completed: 2026-08-17 (Task 1 + Task 2, plano fechado)*
