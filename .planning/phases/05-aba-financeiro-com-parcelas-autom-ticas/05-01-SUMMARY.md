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
  - "Rota /financeiro (Server Component) com geração preguiçosa de parcelas das duas competências (mês atual + próximo mês)"
  - "lib/kanban/parcelas.ts: 9 funções puras + garantirParcelas(), consumidas pelos planos 05-02 e 05-03"
  - "ParcelasTable — componente de apresentação reutilizado/estendido pelo plano 05-02 (badge de situação)"
  - "Item Financeiro na navegação (NAV_ITEMS), entre Board e Relatórios"
  - "Campo ativo: boolean no tipo Card"
affects: [05-02-mes-atual-proximo-mes, 05-03-toggle-ativo-inativo]

# Actuals (#2632)
actuals:
  tokens: 4444
  tasks: 1
  commits: 1

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Geração preguiçosa na leitura (mesmo padrão de alerts.ts): sem cron, sem chave privilegiada — check-then-insert com upsert(onConflict, ignoreDuplicates) como cinto e suspensório contra corrida entre abas"
    - "Módulo puro sem dependência de next/headers nem @/lib/supabase/server — cliente Supabase recebido por parâmetro, tipado via `import type { SupabaseClient } from \"@supabase/supabase-js\"`"
    - "Situação (a_vencer/vencida) nunca gravada — derivada na leitura comparando vencimento com hojeISO string ISO, sem passar por Date (evita bug de fuso já documentado em report.ts)"

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

requirements-completed: [PARCELA-01, PARCELA-02, PARCELA-03, PARCELA-04, FINUI-01, FINUI-03]

coverage:
  - id: D1
    description: "Item Financeiro aparece na navegação entre Board e Relatórios e abre /financeiro"
    requirement: "FINUI-01"
    verification:
      - kind: other
        ref: "npm run build — rota /financeiro listada; grep de ordem de NAV_ITEMS"
        status: pass
    human_judgment: false
  - id: D2
    description: "Geração preguiçosa grava as parcelas faltantes de mês atual e próximo mês para contratos ativos dentro do período, sem duplicar e sem erro visível ao recarregar"
    requirement: "PARCELA-01, PARCELA-02, PARCELA-04"
    verification: []
    human_judgment: true
    rationale: "Escreve em public.parcelas de produção (~46 contratos reais); exige rodar as consultas SQL de verificação e recarregar a UI logada — não automatizável pelo executor. Isto é exatamente a Task 2 (checkpoint:human-verify), ainda não executada."
  - id: D3
    description: "valor_original gravado é a fotografia do valor do card no instante da geração (nunca relido depois)"
    requirement: "PARCELA-03"
    verification: []
    human_judgment: true
    rationale: "Só verificável contra dados reais gravados em produção — consulta (f) da Task 2."
  - id: D4
    description: "Cada linha mostra imóvel, proprietário, vencimento, valor devido, valor pago e situação em português, com a_vencer/vencida derivadas na leitura"
    requirement: "FINUI-03"
    verification:
      - kind: other
        ref: "npm run lint && npm run build — grep das 6 colunas e do container em parcelas-table.tsx"
        status: pass
    human_judgment: true
    rationale: "A leitura visual dos valores contra os cards reais (Passo 4 da Task 2) exige o operador olhando a tela em produção."

# Metrics
duration: ~25min
completed: 2026-08-17
status: halted
---

# Phase 5 Plan 1: Fatia vertical da aba Financeiro Summary

**Rota `/financeiro` com geração preguiçosa das parcelas de duas competências (mês atual e próximo mês) para contratos ativos, gravando pela primeira vez em `public.parcelas` via cliente de sessão do usuário — Task 1 (tracer) commitada; Task 2 (checkpoint:human-verify contra produção) aguardando o operador.**

## Performance

- **Duration:** ~25 min
- **Completed:** 2026-08-17
- **Tasks:** 1 de 2 (Task 2 é checkpoint:human-verify, não executável pelo agente)
- **Files modified:** 5 (3 criados, 2 modificados)

## Accomplishments
- `lib/kanban/parcelas.ts`: módulo puro no espírito de `alerts.ts` com as 9 funções do plano (`competenciasAlvo`, `ultimoDiaDoMes`, `vencimentoDaCompetencia`, `competenciaNoPeriodo`, `parcelasFaltantes`, `situacaoDaParcela`, `somarLancamentos`, `montarLinhas`, `garantirParcelas`), sem nenhuma dependência de `next/headers` ou de cliente privilegiado
- Rota `/financeiro` (Server Component) que busca o board, monta `hojeISO` no servidor, chama `garantirParcelas` e lista o mês atual — erro do Supabase nunca chega ao navegador (mensagem constante + `console.error` no servidor)
- `ParcelasTable`: tabela de apresentação com o shell de `ContractsTable`, as 6 colunas fixadas na UI-SPEC, texto simples de situação (badge com ícone é o plano 05-02)
- Item `Financeiro` (ícone `Wallet`) inserido em `NAV_ITEMS`, entre Board e Relatórios
- `Card.ativo: boolean` adicionado ao tipo, sem tocar em `CardDetailsInput`

## Task Commits

1. **Task 1: Fatia vertical — nav → rota /financeiro → geração → lista** - `53dd9bc` (feat)

**Plan metadata:** pendente — este SUMMARY é commitado separadamente pelo executor de worktree; STATE.md/ROADMAP.md são atualizados pelo orquestrador após o merge.

## Files Created/Modified
- `web/src/lib/kanban/parcelas.ts` - tipos + funções puras de competência/vencimento/situação/soma do livro-razão + `garantirParcelas()`
- `web/src/app/(app)/financeiro/page.tsx` - Server Component da rota `/financeiro`
- `web/src/components/financeiro/parcelas-table.tsx` - container e tabela das parcelas
- `web/src/lib/kanban/types.ts` - campo `ativo: boolean` no tipo `Card`
- `web/src/components/app-shell.tsx` - entrada `Financeiro` em `NAV_ITEMS`

## Decisions Made
- O embed `cards` no `.select()` de `parcelas` é tipado como array pelo inferenciador de tipos do supabase-js (sem `Database` generics configurados no cliente), embora a relação seja muitos-para-um; resolvido com um cast explícito e comentado em `page.tsx`, em vez de introduzir tipos de schema do Supabase nesta fase (fora de escopo do plano)
- O header da página (`h1` + subtítulo) é renderizado uma única vez, com o corpo (tabela vs. "Nenhum board encontrado.") condicional dentro dele, para não duplicar a string do Copywriting Contract em dois `return`s — ajuste de estrutura em relação ao rascunho inicial descrito no `<action>` do plano, sem mudança de comportamento

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

**Total deviations:** 3 auto-fixed (1 blocking de ambiente, 2 bugs de tipo/estrutura)
**Impact on plan:** Nenhuma mudança de escopo ou de regra de negócio — todos os três ajustes são de tooling/tipagem/estrutura de renderização, exigidos pelos próprios critérios de aceite do plano.

## Issues Encountered
Nenhum outro problema além dos documentados em Deviations acima.

## User Setup Required
None - nenhuma configuração de serviço externo é necessária.

## Next Phase Readiness

**Task 2 deste plano (checkpoint:human-verify) não foi executada — requer o operador.** É a primeira gravação real do app em `public.parcelas` de produção (~46 a ~92 linhas novas). O `<how-to-verify>` completo está em `05-01-PLAN.md`, Task 2:

1. Rodar a consulta de pré-voo no SQL Editor do Supabase (confirmar `parcelas_antes = 0`, anotar `contratos_ativos`)
2. Abrir `/financeiro` em produção logado com um e-mail da allowlist
3. Rodar as 6 consultas SQL de conferência ((a) a (f)) — todas com o resultado esperado documentado no plano
4. Recarregar a aba 3× e navegar Board → Financeiro → Relatórios → Financeiro, depois reconferir (a) e (d) — nem duplicata nem erro na tela
5. Conferir visualmente a lista (endereço, proprietário, valor, situação coerente com o vencimento)
6. Responder "aprovado" com os números observados, ou descrever qual passo falhou

Só depois dessa aprovação o plano 05-02 (visão "próximo mês" + badge de situação com ícone) deve começar — ele consome `parcelas.ts` e `ParcelasTable` tal como ficaram aqui.

---
*Phase: 05-aba-financeiro-com-parcelas-autom-ticas*
*Completed: 2026-08-17 (Task 1 apenas — plano pausado no checkpoint da Task 2)*
