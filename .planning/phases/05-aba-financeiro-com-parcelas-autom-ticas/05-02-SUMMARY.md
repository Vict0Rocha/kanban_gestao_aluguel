---
phase: 05-aba-financeiro-com-parcelas-autom-ticas
plan: 02
subsystem: financeiro
tags: [nextjs, react, tailwind, shadcn, ui]

# Dependency graph
requires:
  - phase: 05-aba-financeiro-com-parcelas-autom-ticas
    provides: "05-01: rota /financeiro, lib/kanban/parcelas.ts (competenciasAlvo, montarLinhas, garantirParcelas), ParcelasTable base"
provides:
  - "ParcelaSituacaoBadge — badge de situação com ícone + rótulo para os 5 estados (a_vencer/vencida/paga/parcial/conciliada)"
  - "MesSwitcher — segmented control de seleção única (Mês atual / Próximo mês)"
  - "FinanceiroView — client component que guarda a competência selecionada e filtra as linhas já montadas no servidor"
  - "ParcelasTable com dois estados vazios distintos (sem-contrato-ativo / sem-parcela-no-periodo)"
  - "page.tsx calcula temContratoAtivo e separa as linhas nas duas competências"
affects: []

# Actuals (#2632)
actuals:
  tokens: 2556
  tasks: 2
  commits: 2

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Badge de situação segue exatamente o molde de ContractStatusBadge (icone lucide + rótulo pt-BR + token de status), mas com font-semibold (600) em vez do font-medium (500) do irmão mais antigo — peso de ênfase desta fase, per UI-SPEC"
    - "Segmented control de seleção única (mes-switcher.tsx) distinto do FilterChip combinável de reports-view.tsx: bg-muted/p-1 track, segmento ativo em superfície elevada (bg-card + shadow-sm), nunca cor de destaque da marca"
    - "FinanceiroView recebe as duas competências já montadas do servidor (linhasAtual/linhasProximo) e só filtra por competencia no cliente — trocar de segmento nunca vai ao banco nem recarrega a rota (D-12)"

key-files:
  created:
    - web/src/components/financeiro/parcela-situacao-badge.tsx
    - web/src/components/financeiro/mes-switcher.tsx
    - web/src/components/financeiro/financeiro-view.tsx
  modified:
    - web/src/components/financeiro/parcelas-table.tsx
    - "web/src/app/(app)/financeiro/page.tsx"

key-decisions:
  - "Rule 3 (blocking): tornar `vazio` uma prop obrigatória em ParcelasTable na Task 1 quebrava o build, já que o único chamador (page.tsx) ainda não passava essa prop até a Task 2. Corrigido com um valor temporário `vazio=\"sem-parcela-no-periodo\"` no commit da Task 1, substituído pela chamada real via FinanceiroView no commit da Task 2 — nenhuma mudança de comportamento visível ao usuário final entre os dois commits, só uma janela de build verde task-a-task"
  - "temContratoAtivo é calculado com uma contagem enxuta (`count: \"exact\", head: true` sobre cards.ativo=true), não trazendo linhas — se a contagem falhar, o valor cai para true por padrão (D-conforme especificado no plano: mostrar o texto de período é menos enganoso que dizer 'nenhum contrato ativo' por causa de uma falha de rede)"

requirements-completed: []

coverage:
  - id: D1
    description: "Badge de situação com ícone + rótulo em português, cobrindo os 5 estados (a_vencer/vencida/paga/parcial/conciliada), nunca cor sozinha"
    requirement: "FINUI-03"
    verification:
      - kind: other
        ref: "npm run lint && npm run build — greps dos 5 estados, 5 ícones, 3 tokens de status, ausência de font-medium/bg-primary em parcela-situacao-badge.tsx"
        status: pass
      - kind: manual_procedural
        ref: "Task 3 (checkpoint:human-verify) — item 3 do how-to-verify: confirmar Vencida em vermelho e A vencer em cinza neutro no navegador"
        status: unknown
    human_judgment: true
    rationale: "Cor correta em ambiente real (light/dark) e leitura visual do ícone+rótulo só são confirmáveis por um humano olhando a tela — Task 3 ainda não foi executada (plano pausado no checkpoint)"
  - id: D2
    description: "Seletor Mês atual / Próximo mês como segmented control de seleção única, trocando as linhas sem navegar nem recarregar, com o segmento ativo como superfície elevada (não a cor de destaque da marca)"
    requirement: "FINUI-02"
    verification:
      - kind: other
        ref: "npm run lint && npm run build — greps de aria-pressed, bg-muted/bg-card, ausência de bg-primary/text-primary/border-primary em mes-switcher.tsx"
        status: pass
      - kind: manual_procedural
        ref: "Task 3 (checkpoint:human-verify) — itens 1, 2, 4 e 8 do how-to-verify: troca sem reload/navegação, contagens batendo com 05-01-SUMMARY, hierarquia visual, acesso por teclado"
        status: unknown
    human_judgment: true
    rationale: "Comportamento sem reload/navegação, hierarquia visual e navegação por teclado exigem um humano interagindo com a página real — Task 3 ainda não foi executada (plano pausado no checkpoint)"

# Metrics
duration: "~35min (Task 1 + Task 2)"
completed: 2026-08-17
status: halted
---

# Phase 5 Plan 2: Mês atual / Próximo mês + badge de situação Summary

**MesSwitcher (segmented control de seleção única) e ParcelaSituacaoBadge (5 estados com ícone) implementados e commitados; plano pausado na Task 3 (checkpoint:human-verify) aguardando conferência visual do operador.**

## Performance

- **Duration:** ~35 min (Task 1 + Task 2)
- **Completed:** 2026-08-17 (Tasks 1-2)
- **Tasks:** 2 de 3 (Task 3 é checkpoint:human-verify — aguardando o operador)
- **Files modified:** 5 (3 criados, 2 modificados)

## Accomplishments
- `ParcelaSituacaoBadge`: badge de apresentação com os 5 estados (`a_vencer`/`vencida`/`paga`/`parcial`/`conciliada`), cada um com ícone `lucide-react`, rótulo em português e token de cor de status — os três últimos futuro-prontos para as Phases 6/7 sem precisar reabrir o componente
- `ParcelasTable` passa a usar o badge (em vez de texto simples) e distingue os dois estados vazios exigidos pela UI-SPEC (`sem-contrato-ativo` vs `sem-parcela-no-periodo`)
- `MesSwitcher`: segmented control de seleção única (`Mês atual` / `Próximo mês`), com `aria-pressed`, sem usar a cor de destaque da marca (segmento ativo é `bg-card shadow-sm`, não `bg-primary`)
- `FinanceiroView`: componente cliente que guarda a competência selecionada em `useState` e filtra entre as duas listas já montadas no servidor — trocar de segmento não navega, não recarrega e não vai ao banco (D-12)
- `page.tsx`: separa as parcelas nas duas competências (mês atual / próximo mês), calcula `temContratoAtivo` com uma contagem enxuta (`count`, sem trazer linhas), e passa a renderizar `FinanceiroView`
- `npm run lint` e `npm run build` passam após cada task; a rota `/financeiro` continua dinâmica (`ƒ`), não estática

## Task Commits

1. **Task 1: Badge de situação com os 5 estados e estados vazios da tabela** - `b0de276` (feat)
2. **Task 2: Seletor Mês atual / Próximo mês e a view cliente** - `af20cc8` (feat)
3. **Task 3: Conferir as duas visões e os estados de tela no navegador** - checkpoint:human-verify, **não executado nesta sessão** — plano pausado aguardando o operador

**Plan metadata:** pendente — será commitado quando o plano fechar (após a Task 3 ser aprovada)

## Files Created/Modified
- `web/src/components/financeiro/parcela-situacao-badge.tsx` - badge de situação com os 5 estados
- `web/src/components/financeiro/mes-switcher.tsx` - segmented control de seleção única Mês atual/Próximo mês
- `web/src/components/financeiro/financeiro-view.tsx` - client component que guarda a competência selecionada e alimenta ParcelasTable
- `web/src/components/financeiro/parcelas-table.tsx` - usa o badge de situação; ganha prop `vazio` com os dois textos de estado vazio
- `web/src/app/(app)/financeiro/page.tsx` - separa parcelas nas duas competências, calcula `temContratoAtivo`, renderiza `FinanceiroView`

## Decisions Made
- Ver `key-decisions` no frontmatter: (1) valor temporário de `vazio` no commit da Task 1 para manter o build verde task-a-task, substituído pela chamada real na Task 2; (2) `temContratoAtivo` cai para `true` por padrão se a contagem falhar, para não mostrar um texto enganoso de "nenhum contrato ativo" por causa de uma falha de rede.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Prop `vazio` obrigatória quebrava o build antes da Task 2**
- **Found during:** Task 1 (`npm run build` — TypeScript, erro TS2741 em `page.tsx`)
- **Issue:** `ParcelasTable` ganhou a prop obrigatória `vazio` na Task 1, mas o único chamador (`page.tsx`, arquivo fora do escopo de arquivos da Task 1) só seria reescrito na Task 2 — o build quebrava entre os dois commits
- **Fix:** Adicionado `vazio="sem-parcela-no-periodo"` na chamada existente de `page.tsx` como valor temporário, no mesmo commit da Task 1; a Task 2 substitui essa chamada inteira por `FinanceiroView`, que computa o valor real de `vazio` a partir de `temContratoAtivo`
- **Files modified:** `web/src/app/(app)/financeiro/page.tsx` (linha adicionada na Task 1, arquivo inteiro reescrito na Task 2)
- **Verification:** `npm run lint && npm run build` passam em ambos os commits
- **Committed in:** `b0de276` (Task 1), substituído em `af20cc8` (Task 2)

---

**Total deviations:** 1 auto-fixed (blocking, causado pela ordem de tasks do próprio plano)
**Impact on plan:** Nenhuma mudança de escopo ou de regra de negócio — ajuste temporário de tipagem para manter o critério de aceite "build sai com código 0" satisfeito em cada task individualmente, como o plano exige.

## Issues Encountered
Nenhum além do documentado em Deviations acima.

## User Setup Required
None - nenhuma configuração de serviço externo é necessária.

## Next Phase Readiness

**Plano pausado na Task 3 (checkpoint:human-verify).** Tasks 1 e 2 estão commitadas e passam lint/build; a interface está pronta para a conferência visual descrita no `<how-to-verify>` da Task 3 (troca de segmento sem reload, badges com ícone+cor corretos, hierarquia visual, estados vazios, teclado). Requer o operador abrindo `/financeiro` em produção (ou no ambiente onde este worktree for mesclado/publicado) e respondendo "aprovado" ou descrevendo divergências item a item.

Não bloqueia a Phase 5 além da própria Task 3: o plano 05-03 (toggle ativo/inativo) roda em paralelo em outro worktree e não depende deste checkpoint.

---
*Phase: 05-aba-financeiro-com-parcelas-autom-ticas*
*Status: halted — aguardando Task 3 (checkpoint:human-verify)*
