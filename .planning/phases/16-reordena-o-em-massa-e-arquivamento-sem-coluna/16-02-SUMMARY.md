---
phase: 16-reordena-o-em-massa-e-arquivamento-sem-coluna
plan: 02
subsystem: ui
tags: [nextjs, react, server-actions, supabase, dnd-kit, kanban]

# Dependency graph
requires: []
provides:
  - "reordenarCardsAction (actions.ts): Server Action de bulk-write, N updates individuais via Promise.all, cap defensivo de 200 cardIds"
  - "reordenarCards (queries.ts): wrapper client no molde de moveCard"
  - "GAP exportado de position.ts, reusável por qualquer escrita em lote futura"
  - "ReordenarDialog (reordenar-dialog.tsx): primeiro precedente deste projeto de diálogo de seleção de item de uma lista (sem RadioGroup)"
  - "botão Reordenar funcional no Board, ao lado do SearchField"
affects: [16-01, 16-03, 16-04]

actuals:
  tokens: 2661
  tasks: 1
  commits: 1

tech-stack:
  added: []
  patterns:
    - "Bulk-write via Promise.all de N updates individuais (não update...where id=any) — Supabase-js não expressa valores por linha numa única query"
    - "Dialog de seleção de item de lista sem RadioGroup: Button com variant condicional (default vs ghost) por item"

key-files:
  created:
    - web/src/components/kanban/reordenar-dialog.tsx
  modified:
    - web/src/lib/kanban/position.ts
    - web/src/lib/kanban/actions.ts
    - web/src/lib/kanban/queries.ts
    - web/src/components/kanban/board.tsx

key-decisions:
  - "cardIds.length > 200 recusado antes do Promise.all — cap defensivo inline (não constante nomeada), para casar literalmente com o comentário 'fail closed' que espelha deleteCardAction"
  - "handleReordenar em board.tsx é síncrono e delega a persistOrRevert (fire-and-forget); ReordenarDialog fecha assim que a Promise de onConfirm resolve, mesmo padrão de todo outro handler otimista deste Board (nenhuma espera visível pelo round-trip real)"
  - "estado otimista da coluna de destino = cards não-elegíveis mantidos (ordem original) + todos os cards elegíveis do board inteiro (ordered, com posição nova via GAP) — não houve tentativa de interleaving por índice original, simplificação aceitável dado que D-10 só define a ordem relativa dos elegíveis entre si"

patterns-established:
  - "Server Action de bulk-write: mesmo molde de moveCardAction (id()/requireUser/erroDoBanco/semLinhas), com cap de array antes de qualquer round-trip"

requirements-completed: [REORD-01, REORD-02, REORD-03]

coverage:
  - id: D1
    description: "Botão 'Reordenar' existe ao lado do SearchField, abre ReordenarDialog listando as colunas do board"
    requirement: REORD-01
    verification:
      - kind: unit
        ref: "grep: ReordenarDialog em board.tsx, export function ReordenarDialog em reordenar-dialog.tsx"
        status: pass
    human_judgment: false
  - id: D2
    description: "Confirmar move todos os cards elegíveis (busca ativa -> só destacados; sem busca -> todos) para a coluna escolhida, numa única ação sem segunda tela"
    requirement: REORD-02
    verification: []
    human_judgment: true
    rationale: "Comportamento interativo dependente de estado do navegador (query de busca, drag state) e de dado real de produção — precisa de verificação humana via <human-check> do plano, não reproduzível por grep/tsc/build neste ambiente sem login real"
  - id: D3
    description: "Posições novas sequenciais via GAP na coluna de destino, escrita otimista com revert em falha (persistOrRevert), drag-and-drop individual intocado"
    requirement: REORD-03
    verification:
      - kind: unit
        ref: "grep: column_id: columnId, position: (index + 1) * GAP em actions.ts; tsc --noEmit; npm run build"
        status: pass
    human_judgment: true
    rationale: "Revert em falha de rede e preservação do drag-and-drop exigem teste manual em produção (desconectar rede, arrastar card depois de usar Reordenar) — ver <human-check> do plano"

duration: ~20min
completed: 2026-08-27
status: complete
---

# Phase 16 Plan 02: Botão "Reordenar" ponta a ponta Summary

**Botão "Reordenar" no Board move em lote todos os cards elegíveis (respeitando busca ativa) para uma coluna escolhida, via `reordenarCardsAction` (Promise.all de updates individuais, cap de 200) e escrita otimista com revert.**

## Performance

- **Duration:** ~20 min
- **Tasks:** 1 (tracer)
- **Files modified:** 5 (4 modificados, 1 criado)

## Accomplishments
- `GAP` exportado de `position.ts` (única mudança nesse arquivo)
- `reordenarCardsAction` nova em `actions.ts`: valida sessão, `columnId`, array `cardIds` (não vazio, cap de 200, cada id), grava via `Promise.all` de updates individuais (`column_id`+`position` novo via `GAP`), mapeia erro/zero-linhas com `erroDoBanco`/`semLinhas`, mesmo molde de `moveCardAction`
- `reordenarCards` novo em `queries.ts`, wrapper de uma linha no molde de `moveCard`
- `ReordenarDialog` novo (`reordenar-dialog.tsx`): Dialog listando as colunas do board como botões selecionáveis (sem `RadioGroup`, que não existe neste design system), confirma numa única ação (D-07)
- `board.tsx`: botão "Reordenar" ao lado do `SearchField`; `handleReordenar` reusa `matchedIds` (D-08, sem branch de busca novo) e `persistOrRevert` (mesmo mecanismo de revert de toda mutação do Board)
- `moveCardAction`/`handleDragEnd`/`handleDragOver` permanecem intocados — caminho novo ao lado do existente, nunca substituição

## Task Commits

Each task was committed atomically:

1. **Task 1: Botão "Reordenar" ponta a ponta** - `5eb9a69` (feat)

_Plano de tarefa única (`type="tracer"`); nenhum commit de metadata separado neste worktree — o orquestrador cuida de STATE.md/ROADMAP.md após o merge._

## Files Created/Modified
- `web/src/lib/kanban/position.ts` - `GAP` passa a ser exportado (única mudança)
- `web/src/lib/kanban/actions.ts` - `reordenarCardsAction` nova (Server Action de bulk-write)
- `web/src/lib/kanban/queries.ts` - `reordenarCards` novo (wrapper client)
- `web/src/components/kanban/reordenar-dialog.tsx` - novo componente, `ReordenarDialog`
- `web/src/components/kanban/board.tsx` - botão "Reordenar" + `handleReordenar`, imports de `GAP`/`reordenarCards`/`ReordenarDialog`

## Decisions Made
- Cap defensivo (`cardIds.length > 200`) escrito inline, não como constante nomeada — garante que o texto literal `cardIds.length > 200` apareça no código de verdade (não só no comentário), casando com a asserção de grep do `<verify>` do plano sem depender de coincidência
- `ReordenarDialog.onConfirm` é assíncrono por contrato, mas `handleReordenar` em si é síncrono e delega a `persistOrRevert` (fire-and-forget) — o diálogo fecha assim que a Promise de `onConfirm` resolve (imediatamente), mesmo padrão de UX otimista já usado por todo outro handler deste Board (nenhum diálogo deste projeto espera o round-trip real antes de fechar)
- Estado otimista da coluna de destino: cards não-elegíveis mantidos na ordem original, seguidos por todos os cards elegíveis do board inteiro (`ordered`, já remapeados com posição nova via `GAP`) — sem tentar interleaving por índice original, já que D-10 define ordem só entre os elegíveis, não sua posição relativa aos residentes não-elegíveis

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

O worktree não tinha `node_modules` (mesmo padrão de todo executor paralelo anterior neste projeto) — resolvido com `npm install` próprio antes de rodar `tsc`/`lint`/`build`, como o context note já antecipava.

## Known Stubs

Nenhum. O botão "Reordenar" está funcional ponta a ponta: clique → diálogo → confirmação → gravação no banco → estado otimista com revert em falha.

## User Setup Required

None - nenhuma configuração de serviço externo necessária. Não há migração de banco neste plano (a coluna `column_id` de `cards` já existe e não muda aqui — isso é escopo de 16-01/16-04).

## Next Phase Readiness

- `GAP` agora exportado de `position.ts` — reusável por qualquer escrita em lote futura sem número mágico duplicado
- Verificação automatizada completa: `npx tsc --noEmit`, `npm run lint`, `npm run build` limpos dentro de `web/` (worktree com `npm install` próprio)
- **Human-check pendente em produção** (D2/D3 na tabela `coverage`): o `<human-check>` do plano cobre dois cenários interativos que grep/tsc não provam sozinhos — (1) busca ativa vs. sem busca movendo o escopo certo de cards, e (2) revert visual em caso de falha de rede, sem card duplicado nem perdido. Nenhum blocker de código; aguarda apenas o usuário testar no board real (mesmo padrão de toda fase anterior deste projeto — login exige senha real, este agente não pode dirigir o navegador com credenciais)
- Capacidade independente da migração de arquivamento (16-01/16-03/16-04) — não toca `column_id` nullable nem `arquivarCardAction`/`desarquivarCardAction`, pronta para merge sem esperar as outras plans desta fase

## Self-Check: PASSED

- FOUND: web/src/components/kanban/reordenar-dialog.tsx
- FOUND: web/src/lib/kanban/position.ts
- FOUND: commit 5eb9a69

---
*Phase: 16-reordena-o-em-massa-e-arquivamento-sem-coluna*
*Completed: 2026-08-27*
