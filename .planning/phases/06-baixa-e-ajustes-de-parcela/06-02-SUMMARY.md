---
phase: 06-baixa-e-ajustes-de-parcela
plan: 02
subsystem: payments
tags: [nextjs, react, base-ui, lucide-react]

requires:
  - phase: 06-baixa-e-ajustes-de-parcela
    plan: 01
    provides: "LancamentoDetalhado, LinhaParcela.lancamentos (já montado por montarLinhas, sem fetch adicional), AcoesCell com Pagamento/Ajustar"
provides:
  - "LancamentoTipoLabel({ tipo }) — ícone + rótulo + cor de status para os 4 tipos de lançamento"
  - "ParcelaHistoricoSheet — Sheet lateral controlada mostrando todos os lançamentos de uma parcela, sem requisição própria"
  - "Terceiro controle (Histórico, icon-only) na coluna Ações de ParcelasTable"
affects: [07-conciliacao-e-destrava]

actuals:
  tokens: 1830
  tasks: 2
  commits: 2

tech-stack:
  added: []
  patterns:
    - "Sheet lateral totalmente controlada pelo pai (open/onOpenChange), sem SheetTrigger interno — o botão que a abre vive fora do componente, no AcoesCell, mesmo padrão de estado local já usado para os dois diálogos do plano 06-01"
    - "Componente de apresentação puro sem \"use client\" (LancamentoTipoLabel) reutilizando o molde exato de ParcelaSituacaoBadge — mapa module-level { tipo: { icon, label, className } }"

key-files:
  created:
    - web/src/components/financeiro/lancamento-tipo-label.tsx
    - web/src/components/financeiro/parcela-historico-sheet.tsx
  modified:
    - web/src/components/financeiro/parcelas-table.tsx

key-decisions:
  - "Task 1 (tracer) executada e commitada sem pausar no gate padrão de tracer — o prompt do orquestrador para esta execução definiu explicitamente que a única pausa deste plano é a Task 3 (checkpoint:human-verify), a mesma exceção já usada no plano 06-01"
  - "Nenhuma decisão de arquitetura fora do já fixado em 06-UI-SPEC.md foi necessária — a ação seguida ao pé da letra, incluindo o sinal U+2212 (−) no prefixo de desconto e o travessão sem formatCurrency em destrava"

requirements-completed: []

coverage:
  - id: D1
    description: "Botão Histórico abre uma Sheet lateral com todos os lançamentos já gravados de uma parcela, sem requisição nova ao banco"
    requirement: "BAIXA-05"
    verification:
      - kind: automated_ui
        ref: "cd web && npm run lint && npm run build"
        status: pass
      - kind: manual_procedural
        ref: "Task 3 (checkpoint:human-verify) — ainda não executada, aguardando o operador"
        status: unknown
    human_judgment: true
    rationale: "A prova de que nada foi sobrescrito (D-01/BAIXA-05) — duas linhas de pagamento distintas para uma parcela com baixa parcial + complemento — só é verificável olhando dados reais de produção, e o checkpoint que faz essa verificação ainda não rodou."
  - id: D2
    description: "Cada lançamento no histórico mostra ícone+rótulo do tipo, valor com o prefixo certo, quando foi feito e quem fez — nunca o UUID cru de criado_por"
    requirement: "BAIXA-05"
    verification:
      - kind: unit
        ref: "leitura manual do corpo de parcela-historico-sheet.tsx — só lê profiles.full_name/email, criado_por nem existe no tipo LancamentoDetalhado; grep -c criado_por retorna 0"
        status: pass
      - kind: manual_procedural
        ref: "Task 3, passo 3 — ainda não executada"
        status: unknown
    human_judgment: true
    rationale: "A garantia estrutural (nenhum campo de UUID lido) é verificável por código, mas a confirmação visual de que o nome/e-mail aparece legível em dados reais fica para o checkpoint."
  - id: D3
    description: "Componente já nasce pronto para os 4 tipos de lançamento, incluindo destrava, sem precisar reabertura na Phase 7"
    verification:
      - kind: unit
        ref: "grep -cE 'pagamento|acrescimo|desconto|destrava' lancamento-tipo-label.tsx"
        status: pass
    human_judgment: false

duration: ~35min (Tasks 1-2; Task 3 pendente)
completed: 2026-08-18
status: halted
---

# Phase 6 Plan 2: Histórico de lançamentos Summary

**Sheet lateral (`ParcelaHistoricoSheet`) que lê `linha.lancamentos` já embutido na consulta inicial de `/financeiro` — zero requisição nova — e mostra todos os lançamentos de uma parcela com ícone/rótulo/valor/quem via `LancamentoTipoLabel`, aberta por um terceiro controle icon-only na coluna Ações.**

## Performance

- **Duration:** ~35 min (Tasks 1-2)
- **Started:** 2026-08-18T08:20:00Z (aprox.)
- **Completed:** Tasks 1-2 em 2026-08-18T08:55:00Z (aprox.); Task 3 pausada em checkpoint
- **Tasks:** 2 de 3 (Task 3 é `checkpoint:human-verify`, pausa obrigatória)
- **Files modified:** 3 (2 novos, 1 modificado)

## Accomplishments
- `LancamentoTipoLabel({ tipo })` cobre os 4 estados (`pagamento`/`acrescimo`/`desconto`/`destrava`) com ícone `lucide-react` + cor de status token, mesmo molde de `ParcelaSituacaoBadge` — futuro-proofing para a Phase 7 (destrava), sem precisar reabrir o componente
- `ParcelaHistoricoSheet` renderiza a lista completa de lançamentos de uma parcela — sem nenhum fetch próprio, dados já vindos de `linha.lancamentos` (plano 06-01) — com estado vazio, quem (`full_name ?? email ?? "—"`, nunca UUID cru), data, observação sem truncamento, e o prefixo de valor certo por tipo (`+` pagamento/acréscimo, `−` desconto, `—` destrava)
- Coluna Ações da `ParcelasTable` ganha o terceiro controle: botão icon-only `ghost` com `History`, depois de Pagamento e Ajustar — menor peso visual dos três, conforme UI-SPEC
- Fecha visualmente a garantia de append-only (D-01): o usuário agora consegue *ver* que nada some, não só confiar nisso

## Task Commits

Cada task foi commitada atomicamente:

1. **Task 1: LancamentoTipoLabel + Sheet de histórico** - `5cb2373` (feat)
2. **Task 2: Fiar o botão Histórico na coluna Ações** - `ccc2cd1` (feat)
3. **Task 3: Conferir o histórico contra os lançamentos já gravados na verificação do plano 06-01** - `checkpoint:human-verify`, **pausada, aguardando o operador**

**Plan metadata:** este commit (docs: SUMMARY parcial, plano pausado no checkpoint)

## Files Created/Modified
- `web/src/components/financeiro/lancamento-tipo-label.tsx` (novo) - mapa dos 4 tipos de lançamento com ícone+rótulo+cor
- `web/src/components/financeiro/parcela-historico-sheet.tsx` (novo) - Sheet lateral controlada, lista de lançamentos sem fetch próprio
- `web/src/components/financeiro/parcelas-table.tsx` - `AcoesCell` ganha o estado `"historico"`, o terceiro botão icon-only e a renderização de `ParcelaHistoricoSheet`

## Decisions Made
- Task 1 (tracer) e Task 2 (auto) executadas em sequência sem pausar no gate de tracer padrão — o prompt do orquestrador definiu explicitamente que a única pausa deste plano é a Task 3, mesma exceção documentada no plano 06-01
- Nenhuma decisão de arquitetura fora do já fixado em `06-UI-SPEC.md` foi necessária

## Deviations from Plan

None - plano executado exatamente como escrito nas Tasks 1 e 2. O `grep -c 'full_name ?? .*email ?? "—"'` de linha única do acceptance criteria não bateu porque a expressão está quebrada em três linhas no código (`??` no fim de cada linha, formatação padrão do projeto) — confirmado manualmente que a expressão exata (`full_name ?? email ?? "—"`, nunca `criado_por`) está presente, exatamente a ressalva que o próprio critério previa ("confira manualmente a expressão exata se o grep não casar por causa de espaçamento").

## Issues Encountered
- `web/node_modules` ausente no worktree (gitignored, não copiado na criação do worktree) — resolvido com `robocopy /E /MT:16` de uma cópia física de `web/node_modules` do repo principal. Nesta execução, o robocopy só funcionou com `MSYS_NO_PATHCONV=1` prefixado (sem essa variável, o Git Bash reescreve `/E` como um caminho `E:\` antes de repassar ao robocopy nativo do Windows) — mesma limitação de plataforma já documentada por 05-01/05-03/06-01, com uma nota adicional sobre o `MSYS_NO_PATHCONV` para quem repetir o procedimento.

## User Setup Required

None - nenhuma configuração de serviço externo necessária.

## Next Phase Readiness

**Plano pausado no checkpoint da Task 3, por design.** Tasks 1 e 2 estão commitadas; `npm run lint` e `npm run build` passam nas duas; todos os `acceptance_criteria` automatizados bateram. O componente está pronto para verificação manual em produção contra as mesmas parcelas usadas no checkpoint do plano 06-01 (a que recebeu baixa parcial + complemento é o caso mais importante — precisa mostrar duas linhas de pagamento distintas).

**Bloqueio:** aguardando o operador abrir `/financeiro`, testar o botão Histórico nas parcelas indicadas em `<how-to-verify>` da Task 3, e responder "aprovado" ou descrever divergências. BAIXA-05 só fica confirmado como completo (`requirements-completed`) depois dessa aprovação — por isso o campo está vazio nesta SUMMARY parcial.

---
*Phase: 06-baixa-e-ajustes-de-parcela*
*Status: halted (aguardando checkpoint da Task 3)*
