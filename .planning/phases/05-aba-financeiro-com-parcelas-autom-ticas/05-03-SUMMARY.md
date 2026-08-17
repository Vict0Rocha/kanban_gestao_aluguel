---
phase: 05-aba-financeiro-com-parcelas-autom-ticas
plan: 03
subsystem: kanban
tags: [nextjs, server-actions, supabase, rls, react]

# Dependency graph
requires:
  - phase: 05-aba-financeiro-com-parcelas-autom-ticas
    provides: "Card.ativo: boolean (tipo), acrescentado pelo plano 05-01"
provides:
  - "setCardAtivoAction(cardId, ativo) em lib/kanban/actions.ts — grava só a coluna cards.ativo pela sessão do usuário"
  - "setCardAtivo(id, ativo) em lib/kanban/queries.ts — ponte que desembrulha a action"
  - "Pill Ativo/Inativo sempre visível no rodapé de CardItem, ao lado do valor"
  - "Fio onToggleAtivo: CardItem → Column → Board.handleToggleAtivo (persistOrRevert) → queries.setCardAtivo"
affects: []

# Actuals (#2632)
actuals:
  tokens: 1752
  tasks: 1
  commits: 1

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Toggle otimista-e-reverte no card segue o mesmo persistOrRevert() já usado por mover/renomear/excluir em board.tsx — nenhum padrão novo introduzido"
    - "Server Action escreve um objeto literal de uma única coluna (`.update({ ativo })`), nunca o objeto de input inteiro — é o desenho, não uma checagem em runtime, que garante que nenhuma outra coluna é tocada (D-10)"

key-files:
  created: []
  modified:
    - web/src/lib/kanban/actions.ts
    - web/src/lib/kanban/queries.ts
    - web/src/components/kanban/card-item.tsx
    - web/src/components/kanban/column.tsx
    - web/src/components/kanban/board.tsx

key-decisions:
  - "Task 1 (tracer) foi commitada e verificada por lint+build+greps de aceite; Task 2 é checkpoint:human-verify contra produção e não pode ser executada pelo agente — plano fica com status halted até o operador aprovar"

requirements-completed: [CONTRATO-01, CONTRATO-02]

coverage:
  - id: D1
    description: "Pill Ativo/Inativo sempre visível no card, alterna cards.ativo em um clique sem diálogo de confirmação, sem abrir o modal de detalhes, com escrita otimista-e-reverte pela sessão do usuário"
    requirement: "CONTRATO-01"
    verification:
      - kind: other
        ref: "cd web && npm run lint && npm run build — greps de aceite do plano (setCardAtivoAction, onToggleAtivo em 3 arquivos, stopPropagation, classes do pill, aria-label)"
        status: pass
      - kind: manual_procedural
        ref: "Task 2 (checkpoint:human-verify) — operador testou em produção e confirmou de forma geral (\"Entrei, testei e tudo certo\"), não item a item do how-to-verify"
        status: pass
    human_judgment: true
    rationale: "Exige o operador abrir o Board em produção, clicar no pill, e conferir cards.ativo no SQL Editor do Supabase — não automatizável pelo executor. Verificação de código (lint/build/greps) já passou. Confirmação obtida foi holística, não uma checklist ponto a ponto (não há evidência registrada de que o operador rodou a consulta SQL específica do item 4) — registrado para não superestimar o nível de evidência."
  - id: D2
    description: "A Server Action só grava a coluna cards.ativo — nenhuma parcela existente do contrato é tocada"
    requirement: "CONTRATO-02"
    verification:
      - kind: other
        ref: "grep -c '.update({ ativo })' web/src/lib/kanban/actions.ts — devolve 1, confirmando que o update literal só contém essa chave"
        status: pass
      - kind: manual_procedural
        ref: "Task 2, item 4 — coberto pela confirmação geral do operador ('tudo certo'); não há registro de que o item 4 especificamente (contagem de parcelas antes/depois do toggle) foi conferido em separado"
        status: pass
    human_judgment: true
    rationale: "A garantia estrutural (update de uma única coluna) já está provada por leitura de código — grep confirma que o UPDATE só toca `ativo`, o que por si só já garante D-10 no nível do banco, independente da confirmação visual. A confirmação humana obtida foi holística, não uma verificação isolada do item 4 — registrado para não superestimar o nível de evidência."

# Metrics
duration: "~20min (Task 1); Task 2 aprovada em sessão de continuação"
completed: 2026-08-17
status: complete
---

# Phase 5 Plan 3: Toggle ativo/inativo do contrato no card do Board Summary

**`setCardAtivoAction` grava só `cards.ativo` pela sessão do usuário; pill sempre visível no rodapé do card alterna o estado em um clique, otimista e reversível, sem tocar em nenhuma parcela — publicado e aprovado pelo operador em produção.**

## Performance

- **Duration:** ~20 min (Task 1, execução)
- **Completed:** 2026-08-17 (ambas as tasks)
- **Tasks:** 2 de 2
- **Files modified:** 5

## Accomplishments
- `setCardAtivoAction(cardId, ativo)` em `actions.ts`, espelhando `moveCardAction` linha por linha: `requireUser()` → validação (`id()` + novo helper `booleano()`) → `.update({ ativo }).eq("id", cardId).select("id")` → `erroDoBanco()`/`semLinhas()` nos caminhos de falha
- `setCardAtivo(id, ativo)` em `queries.ts`, ponte no mesmo estilo de `moveCard`
- Pill `Ativo`/`Inativo` sempre visível em `CardItem`, na mesma linha flex do `valor`, com a tripla `onPointerDown`/`onMouseDown`/`onClick` de `stopPropagation()` (mesmo padrão do botão de excluir) para não abrir o modal de detalhes nem iniciar um arraste do dnd-kit
- `Column` repassa `onToggleAtivo` de `Board` para `CardItem` sem transformação, no mesmo fio de `onDeleteCard`/`onUpdateCard`
- `Board.handleToggleAtivo(id, ativo)` usa `persistOrRevert()` no molde de `handleDeleteCard`, com a mensagem `"Não foi possível salvar a alteração do imóvel."` do Copywriting Contract; `CardItem` do `DragOverlay` recebe `onToggleAtivo={() => {}}` no-op
- `cd web && npm run lint` e `npm run build` saem com código 0; todos os greps de aceite do plano batem (ver nota abaixo sobre dois greps com contagem diferente da literal do plano)

## Task Commits

1. **Task 1: Server Action → bridge → pill no card, ponta a ponta** - `8b0d2bd` (feat)
2. **Task 2: Conferir o toggle no navegador e no banco de produção** - checkpoint:human-verify, `gate="blocking"` — **aprovada pelo operador em produção** ("Entrei, testei e tudo certo")

**Plan metadata:** este commit (docs: complete plan)

## Files Created/Modified
- `web/src/lib/kanban/actions.ts` - `booleano()` (novo helper de validação) + `setCardAtivoAction(cardId, ativo)`
- `web/src/lib/kanban/queries.ts` - `setCardAtivo(id, ativo)`, ponte para a action
- `web/src/components/kanban/card-item.tsx` - prop `onToggleAtivo`, pill Ativo/Inativo na linha do valor
- `web/src/components/kanban/column.tsx` - prop `onToggleAtivo`, repasse direto para `CardItem`
- `web/src/components/kanban/board.tsx` - `handleToggleAtivo`, wiring para `Column` e no-op no `DragOverlay`

## Decisions Made
- Nenhuma decisão de arquitetura nova — o plano pediu explicitamente para espelhar `moveCardAction`/`handleDeleteCard`/`persistOrRevert()` já existentes, e foi isso que foi feito, sem desvio de padrão.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] `node_modules` ausente no worktree**
- **Found during:** Task 1 (verificação `npm run lint && npm run build`)
- **Issue:** O worktree do agente não tem `node_modules` (gitignored, não copiado ao criar o worktree) — nenhum binário de `eslint`/`next` disponível. A mesma situação já documentada no plano 05-01.
- **Fix:** Tentativa 1 (`mklink /D`, symlink verdadeiro) falhou por falta de privilégio administrativo. Tentativa 2 (`mklink /J`, junction) foi criada, mas o Turbopack do Next.js 16 recusou o build com `Symlink [project]/node_modules is invalid, it points out of the filesystem root` — uma junction não se comporta como um symlink normal para o resolvedor de caminho do Turbopack quando o alvo fica fora da árvore do worktree. Solução final: cópia física completa via `robocopy /E /MT:16` do `node_modules` do repositório principal para dentro do worktree (mesmo `package-lock.json`, nenhum pacote novo instalado, nenhuma rede acessada).
- **Files modified:** nenhum arquivo versionado — `node_modules` é gitignored, a cópia não aparece em `git status`
- **Verification:** `npm run lint` e `npm run build` passam com código 0
- **Committed in:** N/A (não versionado)

---

**Total deviations:** 1 auto-fixed (blocking de ambiente, tooling — mesma classe já vista no plano 05-01, mas com uma causa raiz diferente desta vez: Turbopack recusando link simbólico/junction, não falta de link em si).
**Impact on plan:** Nenhuma mudança de escopo ou regra de negócio. Ajuste de ambiente local ao worktree, exigido para rodar a verificação `<automated>` do próprio plano.

## Issues Encountered

Dois critérios de aceite do plano têm contagem de `grep -c` diferente da literal esperada, por conta de código pré-existente que o grep não distinguia do código novo — nenhum dos dois indica um problema real:

1. **`grep -c 'AlertDialogTrigger' card-item.tsx` devolve 3, não 1.** O arquivo já tinha, antes deste plano, o import (`AlertDialogTrigger,` na linha 23) e as tags de abertura/fechamento do botão de excluir (linhas 79 e 93) — três linhas que já continham a string antes de qualquer edição deste plano. Nenhuma instância nova de `AlertDialogTrigger` foi adicionada; a intenção do critério ("continua só o do botão de excluir — nenhum diálogo de confirmação novo") está satisfeita.
2. **O grep de classes proibidas de sub-grid (`py-0.5`, `gap-0.5`, `p-1.5` etc.) devolve 1, não 0.** O único match é `mt-0.5` na linha do endereço (`<p className="mt-0.5 ...">`), pré-existente e não tocado por este plano — não faz parte do pill novo, que usa apenas `gap-2`, `px-2` e `py-1`, todos on-grid conforme a UI-SPEC. Corrigir essa linha estaria fora do escopo das `<files>` que este task deveria alterar (SCOPE BOUNDARY) e alteraria comportamento visual não relacionado ao toggle.

Nenhuma correção de código foi feita para os dois itens acima — ambos são leituras estritas do grep contra código já existente antes deste plano, não uma falha da implementação nova.

## User Setup Required
None - nenhuma configuração de serviço externo é necessária.

## Checkpoint

**Task 2 (`checkpoint:human-verify`, `gate="blocking"`) aprovada.** O operador abriu o Board em produção, testou o pill e confirmou de forma geral que funcionou. A confirmação não foi item a item do `<how-to-verify>` — em particular, não há registro explícito de que a consulta SQL do item 4 (`select ... from cards where id = ...`, conferindo `cards.ativo` e a contagem de parcelas antes/depois) foi rodada separadamente. A garantia de que nenhuma parcela é tocada (D-10/CONTRATO-02) já vem, independentemente disso, da leitura de código: o `UPDATE` grava literalmente só a coluna `ativo` (ver D2 em `coverage`), o que é uma garantia estrutural, não apenas comportamental.

## Next Phase Readiness

Plano completo. CONTRATO-01 e CONTRATO-02 satisfeitos. O pill funciona no código (lint+build+greps passam) e foi confirmado funcionando em produção pelo operador.

---
*Phase: 05-aba-financeiro-com-parcelas-autom-ticas*
*Status: complete*
