---
phase: 14-cancelamento-de-taxas-e-cau-o
plan: 05
subsystem: payments
tags: [nextjs, react, typescript, supabase, server-actions]

# Dependency graph
requires:
  - phase: 14-04
    provides: "CancelarLancamentoDialog generalizado (parentId/itemId/rotulo/acao) — pronto para caução"
provides:
  - "cancelarEventoCaucaoAction — DELETE do evento de caução mais recente, reconfirmado no servidor (order by criado_em desc limit 1) a cada chamada"
  - "cancelarEventoCaucao (queries.ts) — wrapper ao lado de registrarEventoCaucao"
  - "CancelarLancamentoDialog ampliado para acao: \"lancamento\" | \"taxa\" | \"caucao\" — fecha CANIMOB-05 (mesmo diálogo cobrindo os três domínios)"
  - "CaucaoHistoricoSheet — botão \"Cancelar\" só no último evento do array (ordem ascendente, index === eventos.length - 1)"
affects: []

actuals:
  tokens: 2630
  tasks: 2
  commits: 1

tech-stack:
  added: []
  patterns:
    - "Reconfirmação servidor-side de 'sou eu o mais recente' via SELECT+DELETE em duas etapas (mesmo molde de destravarParcelaAction), aplicada agora a uma terceira tabela (caucao_eventos) — nunca o índice do array no cliente decide o que pode ser apagado"

key-files:
  created: []
  modified:
    - web/src/lib/kanban/actions.ts
    - web/src/lib/kanban/queries.ts
    - web/src/components/financeiro/cancelar-lancamento-dialog.tsx
    - web/src/components/financeiro/caucao-historico-sheet.tsx

key-decisions:
  - "Task 2 (documentar em docs/data-model.md) já estava integralmente satisfeita por um commit anterior (b9fa668, docs 14-02/14-03) — o planner do plano 14-03 antecipou a bullet 'Cancelamento de taxa e de caução (D-02/D-04/D-05, Phase 14)' inteira, cobrindo as três operações (taxa isolada, cascata, caução sequencial) e o ponteiro na bullet de caução (Phase 13), byte a byte igual ao que a Task 2 deste plano pedia. Nenhuma mudança de código foi necessária — só verificação (grep + leitura) de que todas as acceptance criteria já estavam cumpridas."
  - "Seguir o mesmo padrão usado em 14-03-SUMMARY.md/14-04-SUMMARY.md (versão pré-confirmação) para este cenário (checkpoint blocking pendente): status: halted no frontmatter e requirements-completed: [], já que a confirmação em produção (Task 3) é o que efetivamente fecha CANIMOB-04/05 para este plano e para a Phase 14 inteira (última fase pendente)"

patterns-established: []

requirements-completed: []

coverage:
  - id: D1
    description: "No histórico de caução (CaucaoHistoricoSheet), o botão 'Cancelar' aparece só no último evento do array (index === eventos.length - 1, ordem ascendente) — cancelarEventoCaucaoAction reconfirma no servidor (order by criado_em desc limit 1) que o eventoId recebido é de fato o mais recente antes do DELETE, condicionado a dois .eq(), nunca toca parcela_lancamentos/taxas_imobiliaria"
    requirement: CANIMOB-04
    verification:
      - kind: other
        ref: "npm run lint && npm run build (código 0) + asserções de fonte do <verify> da Task 1: order by criado_em desc limit 1, maisRecente.id !== eventoId, dois .eq(), ausência de parcela_lancamentos/taxas_imobiliaria no corpo, eventos.map((evento, index) com index === eventos.length - 1 (nunca index === 0) — todas passaram"
        status: pass
    human_judgment: true
    rationale: "O ciclo sequencial completo (recebido → uso → devolução, cancelar a partir do topo três vezes, nunca um evento do meio) e a reflexão no relatório de reconciliação só são prováveis em produção real — Task 3 (checkpoint:human-verify, gate=blocking), ainda não executada."
  - id: D2
    description: "CancelarLancamentoDialog reusado (acao=\"caucao\") para a confirmação de cancelamento de caução — mesmo padrão sem motivo obrigatório, DELETE real, já usado para lançamento e taxa; fecha CANIMOB-05 (os três domínios no mesmo componente)"
    requirement: CANIMOB-05
    verification:
      - kind: other
        ref: "asserções de fonte: acao: \"lancamento\" | \"taxa\" | \"caucao\" no union, branch acao === \"caucao\" despachando cancelarEventoCaucao(parentId, itemId), descricaoEfeito com o terceiro caso — todas passaram"
        status: pass
    human_judgment: true
    rationale: "Confirmação visual do diálogo (rótulo 'Caução · Devolvida', ausência de campo de motivo) em produção é o Passo 2/4 da Task 3, ainda pendente."
  - id: D3
    description: "docs/data-model.md documenta o mecanismo de cancelamento de taxa e de caução desta fase, sem contradizer a bullet de caução da Phase 13"
    verification:
      - kind: other
        ref: "grep confirma 'Cancelamento de taxa e de caução', 'cancelarEventoCaucaoAction', 'cancelarTaxaImobiliariaAction', 'sempre a partir do topo' e o ponteiro 'cancelamento sequencial a partir do evento mais recente' na bullet de caução (Phase 13) — já presentes desde o commit b9fa668, nenhuma mudança nova necessária"
        status: pass
    human_judgment: false

duration: ~25min (Tasks 1-2; Task 3 pendente)
completed: 2026-08-26
status: halted
---

# Phase 14 Plan 05: Cancelar evento de caução mais recente Summary

**O histórico de caução ganha um botão "Cancelar" restrito ao evento mais recente (`eventos[eventos.length - 1]`, ordem ascendente) — cancelar o topo libera o que sobrou no novo topo, permitindo desfazer o ciclo inteiro (recebido → uso → devolução) sequencialmente. `CancelarLancamentoDialog` agora cobre os três domínios (`lancamento`/`taxa`/`caucao`), fechando CANIMOB-05. Tasks 1-2 completas; Task 3 (prova em produção, última verificação da Phase 14 inteira) aguardando o operador.**

## Performance

- **Duration:** ~25 min (Tasks 1-2)
- **Completed:** 2026-08-26
- **Tasks:** 2/3 (Task 3 bloqueada em `checkpoint:human-verify`, `gate="blocking"`)
- **Files modified:** 4

## Accomplishments
- `cancelarEventoCaucaoAction` (nova, `actions.ts`): SELECT `order by criado_em desc limit 1` decide quem é "o mais recente", recusa com mensagem explícita se o `eventoId` recebido não bater, e só então DELETE condicionado a `id`+`card_id` — mesmo molde de duas etapas de `destravarParcelaAction`, nunca referencia `parcela_lancamentos`/`taxas_imobiliaria`
- `cancelarEventoCaucao` (nova, `queries.ts`): wrapper posicionado ao lado de `registrarEventoCaucao` (A-03), import alfabético entre `arquivarCardAction` e `cancelarLancamentoAction`
- `CancelarLancamentoDialog`: `acao` ampliado para `"lancamento" | "taxa" | "caucao"`, terceiro ramo em `handleConfirm` despachando `cancelarEventoCaucao(parentId, itemId)`, terceiro caso em `descricaoEfeito` — nenhum diálogo novo criado (D-06)
- `CaucaoHistoricoSheet`: `.map((evento, index) => ...)` calcula `ultimo = index === eventos.length - 1` (array ASCENDENTE — o mais recente é sempre o ÚLTIMO índice, nunca `index === 0`, Pitfall 3 de 14-RESEARCH.md); botão "Cancelar" (`Trash2`, mesmo padrão visual de `ParcelaHistoricoSheet`) só aparece nesse item; nova instância de `CancelarLancamentoDialog` com `rotulo={Caução · ${CAUCAO_TIPO[cancelando.tipo].label}}`; comentário de cabeçalho atualizado (não mais "sem mecanismo de cancelamento nesta fase")
- `docs/data-model.md` (Task 2): já estava integralmente documentado por um commit anterior (`b9fa668`) — verificado, não alterado

## Task Commits

Cada task foi commitada atomicamente:

1. **Task 1: Cancelar evento de caução mais recente — Server Action + diálogo ampliado + wiring (CANIMOB-04, CANIMOB-05)** - `d8dd721` (feat)
2. **Task 2: Documentar o mecanismo de cancelamento de taxa e de caução em `docs/data-model.md`** - já satisfeita por `b9fa668` (commit anterior, fora deste plano); nenhum commit novo necessário

Task 3 (`checkpoint:human-verify`, `gate="blocking"`) não executada — ver "User Setup Required".

## Files Created/Modified
- `web/src/lib/kanban/actions.ts` - nova `cancelarEventoCaucaoAction`, logo após `registrarEventoCaucaoAction`
- `web/src/lib/kanban/queries.ts` - novo wrapper `cancelarEventoCaucao`, import alfabético
- `web/src/components/financeiro/cancelar-lancamento-dialog.tsx` - `acao` ampliado para incluir `"caucao"`, branch de despacho e `descricaoEfeito`
- `web/src/components/financeiro/caucao-historico-sheet.tsx` - índice no `.map`, botão "Cancelar" condicional ao último evento, instância de `CancelarLancamentoDialog`, comentário de cabeçalho atualizado
- `docs/data-model.md` - já documentado por commit anterior (`b9fa668`), sem alteração nesta execução

## Decisions Made
- Task 2 do plano já estava satisfeita por um commit anterior (`b9fa668`, "docs(14-02/14-03): migration applied via pooling incident, accepted; docs updated") — o planner do 14-03 escreveu a bullet "Cancelamento de taxa e de caução (D-02/D-04/D-05, Phase 14)" cobrindo as três operações da fase inteira (taxa isolada, cascata, caução sequencial) antes mesmo dos planos 14-04/14-05 rodarem, junto com o ponteiro na bullet de caução (Phase 13). Confirmado byte a byte contra as `<acceptance_criteria>` da Task 2 — nenhuma reescrita necessária.
- `status: halted`/`requirements-completed: []` no frontmatter, mesmo padrão de `14-03-SUMMARY.md`/`14-04-SUMMARY.md` (versão pré-confirmação): a confirmação em produção (Task 3) é o que efetivamente fecha CANIMOB-04/05 — e, por ser o último plano da fase, também fecha CANIMOB-01 a CANIMOB-05 e a Phase 14 inteira

## Deviations from Plan

### Nenhuma mudança de código além do que o plano especificou

Task 1 segue literalmente as seções `<action>` do plano — nenhum Rule 1-4 disparado durante a implementação. Uma observação sobre a Task 2, não sobre código:

**1. [Rule 3-adjacent — não é bug, é trabalho já feito] Task 2 (documentação) já satisfeita por commit anterior**
- **Encontrado durante:** leitura de `<read_first>` da Task 2, antes de qualquer edição
- **Constatação:** `docs/data-model.md` já continha, desde o commit `b9fa668` (fora deste plano — parte do plano 14-03), a bullet nova "Cancelamento de taxa e de caução (D-02/D-04/D-05, Phase 14)" e o ponteiro na bullet de caução (Phase 13), com o texto exigido pelas `<acceptance_criteria>` da Task 2 (inclusive `cancelarEventoCaucaoAction`, `cancelarTaxaImobiliariaAction`, "sempre a partir do topo", "cancelamento sequencial a partir do evento mais recente")
- **Ação:** rodei o `<verify>` automatizado da Task 2 contra o arquivo como está — todas as asserções passaram (`grep` confirma as 5 frases exigidas). Nenhuma edição feita, para não reescrever um texto que já está correto e completo.
- **Verificação:** `grep` das 5 frases da asserção original do plano, todas presentes

---

**Total deviations:** 0 de código (1 observação: Task 2 documental antecipada por um plano anterior)
**Impact on plan:** Nenhum — `npm run lint`/`npm run build` passam com código 0, todas as asserções de fonte da Task 1 passaram, e a Task 2 está de fato satisfeita (confirmado, não presumido).

## Issues Encountered
- `node_modules/` não existia neste worktree (`.claude/worktrees/agent-a058cbf215686f6e7/web`) — rodei `npm install` antes do primeiro `npm run lint`/`build`. Sem impacto no código do plano; apenas setup de ambiente necessário para verificar a Task 1.

## User Setup Required

**Task 3 pendente** — o operador precisa confirmar em produção (ver `<how-to-verify>`/`<acceptance_criteria>` da Task 3 no `14-05-PLAN.md`):
1. Registrar 3 eventos de caução num contrato de teste (recebido R$1.000, uso parcial R$300, devolução R$700) e confirmar que **só o último** (devolução) mostra "Cancelar"
2. Cancelar sequencialmente a partir do topo — devolução, depois uso, depois recebido — confirmando que cada cancelamento libera o novo topo, até a lista esvaziar
3. Confirmar que nenhum evento do meio mostra "Cancelar" enquanto o topo existir
4. Reconfirmar rapidamente CANIMOB-01/02/03 (já confirmados nos planos 14-03/14-04) — fecha os 5 critérios de sucesso do ROADMAP da Phase 14
5. Confirmar que `/relatorios/imobiliaria` reflete os cancelamentos automaticamente, sem código novo

## Next Phase Readiness

- O código de Task 1 está pronto e verificado (lint+build limpos, todas as asserções de fonte do plano passaram, incluindo a checagem de índice `eventos.length - 1` vs `index === 0`) — só falta a prova em produção da Task 3
- Task 2 (documentação) confirmada satisfeita, sem ação necessária
- Esta é a última fase pendente do Módulo Financeiro (Phase 14) — a Task 3 deste plano fecha não só CANIMOB-04/05 mas os 5 critérios de sucesso do ROADMAP da fase inteira

## Self-Check: PASSED

- FOUND: `web/src/lib/kanban/actions.ts` com `export async function cancelarEventoCaucaoAction`
- FOUND: `web/src/lib/kanban/queries.ts` com `export async function cancelarEventoCaucao(`
- FOUND: `web/src/components/financeiro/cancelar-lancamento-dialog.tsx` com `acao: "lancamento" | "taxa" | "caucao"`
- FOUND: `web/src/components/financeiro/caucao-historico-sheet.tsx` com `index === eventos.length - 1`
- FOUND: commit `d8dd721` (Task 1)
- FOUND: `docs/data-model.md` com "Cancelamento de taxa e de caução" (commit `b9fa668`, pré-existente)

---
*Phase: 14-cancelamento-de-taxas-e-cau-o*
*Completed (Tasks 1-2 only): 2026-08-26*
